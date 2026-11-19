import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// READ-ONLY. All sellers with 30-day performance, unpaid delivered value and plan status, for Admin → All Sellers.
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * 86400000);

  const sellers = await prisma.user.findMany({
    where: { role: "SELLER" },
    select: {
      id: true, name: true, email: true, phone: true, brandName: true, businessName: true,
      accountStatus: true, plan: true, planTier: true, kycStatus: true, dataStartDate: true, createdAt: true,
      shopifyStore: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const ids = sellers.map(s => s.id);

  const [by30, lastOrders, unpaid, periods] = await Promise.all([
    prisma.order.groupBy({
      by: ["sellerId", "status"], where: { sellerId: { in: ids }, createdAt: { gte: since30 }, status: { not: "HIDDEN" } }, _count: { id: true },
    }),
    prisma.order.groupBy({ by: ["sellerId"], where: { sellerId: { in: ids } }, _max: { createdAt: true } }),
    // Delivered but not yet remitted (same estimate the seller sees as "awaiting payout")
    prisma.order.findMany({
      where: { sellerId: { in: ids }, status: "DELIVERED", remittedAt: null },
      select: { sellerId: true, createdAt: true, totalAmount: true, productCost: true, shippingCharge: true, packingCharge: true },
    }),
    prisma.planPeriod.findMany({ where: { sellerId: { in: ids } }, select: { id: true, sellerId: true, amountDue: true, dueDate: true } }),
  ]);
  const paid = periods.length
    ? await prisma.planPayment.groupBy({ by: ["periodId"], where: { periodId: { in: periods.map(p => p.id) } }, _sum: { amount: true } })
    : [];
  const paidBy = new Map(paid.map(p => [p.periodId, p._sum.amount ?? 0]));

  const rows = sellers.map(s => {
    const st = (k: string) => by30.find(g => g.sellerId === s.id && g.status === k)?._count.id ?? 0;
    const orders30 = by30.filter(g => g.sellerId === s.id).reduce((n, g) => n + g._count.id, 0);
    const delivered = st("DELIVERED"), rto = st("RTO"), done = delivered + rto;
    const mine = unpaid.filter(o => o.sellerId === s.id && (!s.dataStartDate || o.createdAt >= s.dataStartDate));
    const ps = periods.filter(p => p.sellerId === s.id).map(p => ({ ...p, pending: Math.max(0, p.amountDue - (paidBy.get(p.id) ?? 0)) }));
    const pending = ps.reduce((n, p) => n + p.pending, 0);
    const overdue = ps.some(p => p.pending > 0.5 && p.dueDate && p.dueDate < now);
    return {
      id: s.id, name: s.name, email: s.email, phone: s.phone, brand: s.brandName || s.businessName || null,
      status: s.accountStatus, plan: s.plan, tier: s.planTier, kyc: s.kycStatus,
      shopify: !!s.shopifyStore, joined: s.createdAt.toISOString(),
      orders30, delivered30: delivered, rto30: rto,
      deliveredPct: done ? Math.round((delivered / done) * 100) : null,
      rtoPct: done ? Math.round((rto / done) * 100) : null,
      unpaidCount: mine.length,
      unpaidAmount: Math.round(mine.reduce((n, o) => n + o.totalAmount - (o.productCost ?? 0) - (o.shippingCharge ?? 0) - (o.packingCharge ?? 0), 0)),
      planState: ps.length === 0 ? "NOT_STARTED" : overdue ? "OVERDUE" : pending > 0.5 ? "DUE" : "PAID",
      planPending: Math.round(pending),
      lastOrder: lastOrders.find(l => l.sellerId === s.id)?._max.createdAt?.toISOString() ?? null,
    };
  });

  return NextResponse.json({
    sellers: rows,
    summary: {
      total: rows.length,
      active: rows.filter(r => r.status === "ACTIVE").length,
      pending: rows.filter(r => r.status === "PENDING").length,
      suspended: rows.filter(r => r.status === "SUSPENDED").length,
      planOverdue: rows.filter(r => r.planState === "OVERDUE").length,
    },
  });
}
