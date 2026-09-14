/**
 * Cron: verify-cod-orders
 * Schedule: every hour (set in vercel.json)
 *
 * RTO-risk-aware intervention:
 *   LOW         → skip — seller manually confirms through normal flow
 *   MEDIUM      → send to HillTeck for humanized IVR / WhatsApp verification
 *   HIGH / VERY_HIGH → auto-cancel immediately (too risky to ship)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getConfig, requestCODVerification } from "@/lib/hillteck";
import { batchPredictRtoRisk } from "@/lib/rto-predictor";

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

  const config = await getConfig();
  if (!config || !config.enabled) {
    return NextResponse.json({ skipped: true, reason: "HillTeck not configured or disabled" });
  }

  // All eligible COD orders from the last 3 days
  const orders = await prisma.order.findMany({
    where: {
      paymentMode:        "COD",
      confirmationStatus: "NOT_REQUIRED",
      status:             { notIn: ["DELIVERED", "CANCELLED", "RTO"] },
      createdAt:          { gte: new Date(Date.now() - 3 * 86400000) },
    },
    select: {
      id: true, sellerId: true, source: true,
      externalOrderId: true, customerName: true,
      customerAddress: true, totalAmount: true,
      rawData: true,
      items: { select: { name: true, quantity: true, price: true } },
    },
    take: 100,
  });

  if (orders.length === 0) {
    return NextResponse.json({ sent: 0, autoCancel: 0, skippedLow: 0, total: 0 });
  }

  // Score all orders grouped by seller (history is seller-scoped)
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

  // Pre-fetch Shopify stores for sellers who have HIGH-risk orders
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

  // Process each order
  let sent = 0;
  let autoCancel = 0;
  let skippedLow = 0;
  let failed = 0;

  for (const order of orders) {
    const level = scoreMap[order.id] ?? "MEDIUM";

    // ── LOW → seller confirms manually, nothing to do here ───────────────
    if (level === "LOW") {
      skippedLow++;
      continue;
    }

    // ── HIGH / VERY_HIGH → auto-cancel ───────────────────────────────────
    if (level === "HIGH" || level === "VERY_HIGH") {
      // Cancel on Shopify first if applicable
      if (order.source === "SHOPIFY") {
        const store = storeMap.get(order.sellerId);
        const rawData = order.rawData as { id?: number | string } | null;
        const shopifyOrderId = rawData?.id;
        if (store && shopifyOrderId) {
          await cancelOnShopify(shopifyOrderId, store.storeUrl, store.accessToken);
        }
      }

      await prisma.order.update({
        where: { id: order.id },
        data:  { status: "CANCELLED" as never },
      });
      autoCancel++;
      console.log(`[rto-auto-cancel] order=${order.externalOrderId} level=${level}`);
      continue;
    }

    // ── MEDIUM → HillTeck humanized verification ──────────────────────────
    const ok = await requestCODVerification(
      {
        id:              order.id,
        externalOrderId: order.externalOrderId,
        customerName:    order.customerName,
        customerAddress: order.customerAddress as { phone?: string; city?: string; state?: string } | null,
        totalAmount:     order.totalAmount,
        items:           order.items,
      },
      config,
    );

    if (ok) {
      await prisma.order.update({
        where: { id: order.id },
        data:  {
          confirmationStatus:      "PENDING" as never,
          confirmationRequestedAt: new Date(),
          confirmationChannel:     "HILLTECK",
        },
      });
      sent++;
    } else {
      failed++;
    }
  }

  console.log(
    `[cron] verify-cod-orders: autoCancel=${autoCancel} hillteckSent=${sent} skippedLow=${skippedLow} failed=${failed} total=${orders.length}`,
  );
  return NextResponse.json({ sent, autoCancel, skippedLow, failed, total: orders.length });
}
