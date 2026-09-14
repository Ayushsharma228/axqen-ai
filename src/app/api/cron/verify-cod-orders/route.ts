/**
 * Cron: verify-cod-orders
 * Schedule: every hour (set in vercel.json)
 *
 * Finds new COD orders, scores them with the RTO predictor, then:
 *   LOW risk    → skip HillTeck (auto-approve, low fraud risk)
 *   MEDIUM risk → send to HillTeck for confirmation
 *   HIGH/VERY_HIGH → send to HillTeck (highest priority)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getConfig, requestCODVerification } from "@/lib/hillteck";
import { batchPredictRtoRisk } from "@/lib/rto-predictor";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getConfig();
  if (!config || !config.enabled) {
    return NextResponse.json({ skipped: true, reason: "HillTeck not configured or disabled" });
  }

  // Find COD orders that haven't been sent for verification yet
  const orders = await prisma.order.findMany({
    where: {
      paymentMode:        "COD",
      confirmationStatus: "NOT_REQUIRED",
      status:             { notIn: ["DELIVERED", "CANCELLED", "RTO"] },
      createdAt:          { gte: new Date(Date.now() - 3 * 86400000) },
    },
    select: {
      id: true, sellerId: true, externalOrderId: true,
      customerName: true, customerAddress: true, totalAmount: true,
      items: { select: { name: true, quantity: true, price: true } },
    },
    take: 100,
  });

  if (orders.length === 0) {
    return NextResponse.json({ sent: 0, skippedLowRisk: 0, total: 0 });
  }

  // Group orders by seller so we can batch-score per seller (history is seller-scoped)
  const bySeller = new Map<string, typeof orders>();
  for (const o of orders) {
    const list = bySeller.get(o.sellerId) ?? [];
    list.push(o);
    bySeller.set(o.sellerId, list);
  }

  // Score all orders
  const scoreMap: Record<string, string> = {}; // orderId -> level
  for (const [sellerId, sellerOrders] of bySeller) {
    const scores = await batchPredictRtoRisk(sellerOrders.map(o => o.id), sellerId);
    for (const [id, score] of Object.entries(scores)) {
      scoreMap[id] = score.level;
    }
  }

  let sent = 0;
  let failed = 0;
  let skippedLowRisk = 0;

  for (const order of orders) {
    const riskLevel = scoreMap[order.id] ?? "MEDIUM"; // default to MEDIUM if no score

    // LOW risk COD orders: reliable customer, good address → skip verification
    if (riskLevel === "LOW") {
      skippedLowRisk++;
      continue;
    }

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
        data: {
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

  console.log(`[cron] verify-cod-orders: sent=${sent} skippedLowRisk=${skippedLowRisk} failed=${failed} total=${orders.length}`);
  return NextResponse.json({ sent, skippedLowRisk, failed, total: orders.length });
}
