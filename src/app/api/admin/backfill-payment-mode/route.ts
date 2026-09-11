import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { inferPaymentMode } from "@/app/api/webhooks/shopify/orders/route";

// One-time admin migration: backfill paymentMode from rawData for existing Shopify orders.
// Orders where rawData contains Shopify gateway/payment information will be reclassified.
// Orders where rawData is unavailable remain UNKNOWN.
export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sellerId: targetSellerId } = (await req.json().catch(() => ({}))) as { sellerId?: string };

  // Find all Shopify orders still at UNKNOWN (default) that have rawData to inspect
  const orders = await prisma.order.findMany({
    where: {
      source: "SHOPIFY",
      paymentMode: "UNKNOWN",
      ...(targetSellerId ? { sellerId: targetSellerId } : {}),
    },
    select: { id: true, rawData: true, externalOrderId: true, sellerId: true },
    take: 5000,
  });

  let corrected = 0;
  let cod = 0;
  let prepaid = 0;
  let remainUnknown = 0;

  const updates: { id: string; paymentMode: import("@prisma/client").PaymentMode }[] = [];

  for (const order of orders) {
    if (!order.rawData || typeof order.rawData !== "object") {
      remainUnknown++;
      continue;
    }
    const mode = inferPaymentMode(order.rawData as Record<string, unknown>);
    if (mode === "UNKNOWN") {
      remainUnknown++;
      continue;
    }
    updates.push({ id: order.id, paymentMode: mode });
    if (mode === "COD") cod++;
    if (mode === "PREPAID") prepaid++;
    corrected++;
  }

  // Batch update in groups of 100
  for (let i = 0; i < updates.length; i += 100) {
    const batch = updates.slice(i, i + 100);
    await Promise.all(
      batch.map(u =>
        prisma.order.update({ where: { id: u.id }, data: { paymentMode: u.paymentMode } })
      )
    );
  }

  return NextResponse.json({
    ok: true,
    inspected: orders.length,
    corrected,
    cod,
    prepaid,
    remainUnknown,
  });
}
