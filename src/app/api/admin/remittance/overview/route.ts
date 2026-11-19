import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { payoutSummary } from "@/lib/seller-payouts";

// READ-ONLY payouts overview across sellers: what's owed, what's scheduled, what's held.
// Uses the same calculation as the seller's own Wallet page.
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sellers = await prisma.user.findMany({
    where: { role: "SELLER" },
    select: { id: true, name: true, email: true, brandName: true, bankAccount: true, bankIfsc: true, bankHolder: true },
    orderBy: { createdAt: "desc" },
  });

  const rows = await Promise.all(sellers.map(async s => {
    const p = await payoutSummary(s.id);
    return {
      id: s.id, name: s.brandName || s.name || s.email, email: s.email,
      bankReady: !!(s.bankAccount && s.bankIfsc && s.bankHolder),
      awaiting: { count: p.pipeline.awaiting.count, amount: Math.round(p.pipeline.awaiting.amount), costsKnown: p.pipeline.awaiting.costsKnown },
      rtoPending: { count: p.pipeline.rtoPending.count, amount: Math.round(p.pipeline.rtoPending.amount) },
      scheduled: { count: p.pipeline.scheduled.count, amount: Math.round(p.pipeline.scheduled.amount), nextDate: p.pipeline.scheduled.nextDate },
      onHold: Math.round(p.pipeline.onHold.amount),
      paid: { amount: Math.round(p.pipeline.paid.amount), lastDate: p.pipeline.paid.lastDate },
      scheduledItems: p.payouts.filter(x => x.status === "SCHEDULED").map(x => ({ id: x.id, date: x.date, orders: x.orders, rtoOrders: x.rtoOrders, net: Math.round(x.net), credit: x.credit, note: x.note })),
    };
  }));

  const active = rows.filter(r => r.awaiting.count || r.rtoPending.count || r.scheduled.count || r.onHold || r.paid.amount);
  return NextResponse.json({
    sellers: active,
    totals: {
      awaiting: active.reduce((n, r) => n + r.awaiting.amount, 0),
      awaitingOrders: active.reduce((n, r) => n + r.awaiting.count, 0),
      rtoPending: active.reduce((n, r) => n + r.rtoPending.amount, 0),
      scheduled: active.reduce((n, r) => n + r.scheduled.amount, 0),
      scheduledCount: active.reduce((n, r) => n + r.scheduled.count, 0),
      onHold: active.reduce((n, r) => n + r.onHold, 0),
    },
  });
}
