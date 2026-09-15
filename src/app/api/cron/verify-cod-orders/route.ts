/**
 * Cron: verify-cod-orders
 * Schedule: every hour (set in vercel.json)
 *
 * RTO-risk-aware COD order processing:
 *   LOW         → skip
 *   MEDIUM      → WhatsApp trigger already fired at order creation;
 *                 this cron only retriggers NOT_REQUIRED orders that slipped
 *                 through (e.g. created via sync, not live webhook)
 *   HIGH / VERY_HIGH → auto-cancel immediately (too risky to ship)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getConfig, requestCODVerification } from "@/lib/hillteck";
import { batchPredictRtoRisk } from "@/lib/rto-predictor";
import { decrypt } from "@/lib/encrypt";

async function cancelOnShopify(
  shopifyOrderId: string | number,
  storeUrl: string,
  accessToken: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://${storeUrl}/admin/api/2025-01/orders/${shopifyOrderId}/cancel.json`,
      {
        method:  "POST",
        headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
        body:    JSON.stringify({ reason: "other" }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paConfig = await getConfig();

  // All eligible COD orders from the last 3 days
  const orders = await prisma.order.findMany({
    where: {
      paymentMode: "COD",
      // NOT_REQUIRED = never triggered | PENDING = awaiting customer response
      confirmationStatus: { in: ["NOT_REQUIRED", "PENDING"] },
      status:    { notIn: ["DELIVERED", "CANCELLED", "RTO"] },
      createdAt: { gte: new Date(Date.now() - 3 * 86400000) },
    },
    select: {
      id: true, sellerId: true, source: true,
      externalOrderId: true, customerName: true,
      customerAddress: true, totalAmount: true,
      confirmationStatus: true,
      rawData: true,
      items: { select: { name: true, quantity: true, price: true } },
    },
    take: 100,
  });

  if (orders.length === 0) {
    return NextResponse.json({ sent: 0, autoCancel: 0, skippedLow: 0, total: 0 });
  }

  // Score all orders by RTO risk, grouped by seller
  const bySeller = new Map<string, typeof orders>();
  for (const o of orders) {
    const list = bySeller.get(o.sellerId) ?? [];
    list.push(o);
    bySeller.set(o.sellerId, list);
  }

  const scoreMap: Record<string, string> = {};
  for (const [sellerId, sellerOrders] of bySeller) {
    const scores = await batchPredictRtoRisk(sellerOrders.map(o => o.id), sellerId);
    for (const [id, score] of Object.entries(scores)) {
      scoreMap[id] = score.level;
    }
  }

  // Fetch Shopify stores for sellers with HIGH-risk orders (needed for Shopify cancellation)
  const sellerIdsWithHighRisk = new Set<string>();
  for (const o of orders) {
    const level = scoreMap[o.id] ?? "MEDIUM";
    if ((level === "HIGH" || level === "VERY_HIGH") && o.source === "SHOPIFY") {
      sellerIdsWithHighRisk.add(o.sellerId);
    }
  }
  const shopifyStores = sellerIdsWithHighRisk.size > 0
    ? await prisma.shopifyStore.findMany({
        where:  { sellerId: { in: [...sellerIdsWithHighRisk] } },
        select: { sellerId: true, storeUrl: true, accessToken: true },
      })
    : [];
  const storeMap = new Map(shopifyStores.map(s => [s.sellerId, s]));

  // Fetch seller brand names for WhatsApp trigger payload
  const sellerIds = [...new Set(orders.map(o => o.sellerId))];
  const sellers   = await prisma.user.findMany({
    where:  { id: { in: sellerIds } },
    select: { id: true, name: true, brandName: true },
  });
  const sellerMap = new Map(sellers.map(s => [s.id, s]));

  let sent = 0;
  let autoCancel = 0;
  let skippedLow = 0;
  let failed = 0;

  for (const order of orders) {
    const level = scoreMap[order.id] ?? "MEDIUM";

    // LOW → skip
    if (level === "LOW") {
      skippedLow++;
      continue;
    }

    // HIGH / VERY_HIGH → auto-cancel immediately
    if (level === "HIGH" || level === "VERY_HIGH") {
      if (order.source === "SHOPIFY") {
        const store        = storeMap.get(order.sellerId);
        const rawData      = order.rawData as { id?: number | string } | null;
        const shopifyOrderId = rawData?.id;
        if (store && shopifyOrderId) {
          await cancelOnShopify(shopifyOrderId, store.storeUrl, decrypt(store.accessToken));
        }
      }
      await prisma.order.update({
        where: { id: order.id },
        data:  { status: "CANCELLED" as never, confirmationStatus: "FAILED" as never, confirmationFailedAt: new Date() },
      });
      autoCancel++;
      console.log(`[rto-auto-cancel] order=${order.externalOrderId} level=${level}`);
      continue;
    }

    // MEDIUM — only trigger WhatsApp for NOT_REQUIRED orders (PENDING = already triggered)
    if (order.confirmationStatus !== "NOT_REQUIRED") continue;
    if (!paConfig?.enabled) { failed++; continue; }

    const seller = sellerMap.get(order.sellerId);
    const ok = await requestCODVerification(
      {
        id:              order.id,
        externalOrderId: order.externalOrderId,
        customerName:    order.customerName,
        customerAddress: order.customerAddress as Record<string, unknown> | null,
        totalAmount:     order.totalAmount,
        items:           order.items,
      },
      paConfig,
      seller ?? undefined,
    );

    if (ok) {
      await prisma.order.update({
        where: { id: order.id },
        data:  {
          confirmationStatus:      "PENDING" as never,
          confirmationRequestedAt: new Date(),
          confirmationChannel:     "WHATSAPP",
        },
      });
      sent++;
    } else {
      failed++;
    }
  }

  console.log(
    `[cron] verify-cod-orders: autoCancel=${autoCancel} whatsappSent=${sent} skippedLow=${skippedLow} failed=${failed} total=${orders.length}`,
  );
  return NextResponse.json({ sent, autoCancel, skippedLow, failed, total: orders.length });
}
