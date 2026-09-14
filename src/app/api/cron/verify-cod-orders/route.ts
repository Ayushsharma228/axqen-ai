/**
 * Cron: verify-cod-orders
 * Schedule: every hour (set in vercel.json)
 *
 * Finds new COD orders that haven't been sent to HillTeck yet,
 * pushes them for verification, and marks them as PENDING.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getConfig, requestCODVerification } from "@/lib/hillteck";

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
      // Only process orders from the last 3 days (avoid backfilling old orders)
      createdAt: { gte: new Date(Date.now() - 3 * 86400000) },
    },
    select: {
      id:              true,
      externalOrderId: true,
      customerName:    true,
      customerAddress: true,
      totalAmount:     true,
      items: {
        select: { name: true, quantity: true, price: true },
      },
    },
    take: 100, // Process in batches
  });

  if (orders.length === 0) {
    return NextResponse.json({ sent: 0, total: 0 });
  }

  let sent = 0;
  let failed = 0;

  for (const order of orders) {
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
          confirmationStatus:       "PENDING" as never,
          confirmationRequestedAt:  new Date(),
          confirmationChannel:      "HILLTECK",
        },
      });
      sent++;
    } else {
      failed++;
    }
  }

  console.log(`[cron] verify-cod-orders: sent=${sent} failed=${failed} total=${orders.length}`);
  return NextResponse.json({ sent, failed, total: orders.length });
}
