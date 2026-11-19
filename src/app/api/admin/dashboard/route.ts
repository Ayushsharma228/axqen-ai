import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { RTO_RECEIVED, RTO_OVERDUE_DAYS } from "@/lib/rto";
import { withGst } from "@/lib/plan-billing";
import { platformFeePerOrder } from "@/lib/profit";
import { pairRtoDebits } from "@/lib/payouts";
import { productStats } from "@/lib/product-analytics";

// READ-ONLY admin dashboard. GET ?days=1|7|30 (1 = today, IST) for the key numbers; the rest is fixed windows.
const DAY = 86400000;
const IST = 5.5 * 3600000;
const istDay = (d: Date) => new Date(d.getTime() + IST).toISOString().slice(0, 10);
function istStartOfDay(daysBack = 0) {
  const n = new Date(Date.now() + IST);
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() - daysBack) - IST);
}

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 1));
  const since = istStartOfDay(days - 1);
  const since30 = istStartOfDay(29);
  const now = new Date();
  const monthStart = (() => { const n = new Date(Date.now() + IST); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1) - IST); })();

  const [
    kyc, listings, calling, toShip, ndr, rtoOverdue, invoicesHeld, openTickets, duePeriods, allPeriods,
    rangeOrders, orders30, unpaidDelivered, txns, fee, monthPlanPays, monthDelivered,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "SELLER", kycStatus: "SUBMITTED" } }),
    prisma.listingRequest.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { status: "NEW" } }),
    prisma.order.count({ where: { status: "PROCESSING", awbNumber: null } }),
    prisma.order.count({ where: { ndrStatus: { not: null }, ndrActionTaken: null } }),
    prisma.order.count({ where: { status: "RTO", updatedAt: { lt: new Date(now.getTime() - RTO_OVERDUE_DAYS * DAY), gte: new Date(now.getTime() - 60 * DAY) }, timeline: { none: { eventType: RTO_RECEIVED } } } }),
    prisma.invoice.count({ where: { status: "HELD" } }),
    prisma.supportTicket.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      select: { messages: { where: { isInternal: false }, orderBy: { createdAt: "desc" }, take: 1, select: { author: { select: { role: true } } } } },
    }),
    prisma.planPeriod.findMany({ where: { dueDate: { lt: now } }, select: { id: true, sellerId: true, amountDue: true } }),
    prisma.planPeriod.findMany({ where: { startDate: { lte: now } }, select: { id: true, sellerId: true, amountDue: true } }),
    prisma.order.findMany({ where: { status: { not: "HIDDEN" }, createdAt: { gte: since } }, select: { status: true, totalAmount: true, packingCharge: true, sellerId: true } }),
    prisma.order.findMany({
      where: { status: { not: "HIDDEN" }, createdAt: { gte: since30 } },
      select: { status: true, createdAt: true, sellerId: true, seller: { select: { name: true, brandName: true, email: true } } },
    }),
    prisma.order.findMany({ where: { status: "DELIVERED", remittedAt: null }, select: { totalAmount: true, productCost: true, shippingCharge: true, packingCharge: true, createdAt: true, seller: { select: { dataStartDate: true } } } }),
    prisma.walletTransaction.findMany({ select: { id: true, type: true, amount: true, note: true, remittanceDate: true, bankTxId: true, createdAt: true, sellerId: true } }),
    platformFeePerOrder(),
    prisma.planPayment.aggregate({ where: { paidAt: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.order.findMany({ where: { status: "DELIVERED", createdAt: { gte: monthStart } }, select: { packingCharge: true } }),
  ]);

  // Plan dues: pending with GST, overdue sellers
  const periodIds = [...new Set([...duePeriods, ...allPeriods].map(p => p.id))];
  const paid = periodIds.length ? await prisma.planPayment.groupBy({ by: ["periodId"], where: { periodId: { in: periodIds } }, _sum: { amount: true } }) : [];
  const paidBy = new Map(paid.map(p => [p.periodId, p._sum.amount ?? 0]));
  const pendingOf = (p: { id: string; amountDue: number }) => Math.max(0, withGst(p.amountDue) - (paidBy.get(p.id) ?? 0));
  const planOverdue = new Set(duePeriods.filter(p => pendingOf(p) > 0.5).map(p => p.sellerId));
  const toCollect = allPeriods.reduce((n, p) => n + pendingOf(p), 0);

  // Scheduled payouts (generated, not paid), net of the RTO deduction made with each
  const bySeller = new Map<string, typeof txns>();
  for (const t of txns) { const l = bySeller.get(t.sellerId) ?? []; l.push(t); bySeller.set(t.sellerId, l); }
  let scheduledCount = 0, scheduledAmount = 0;
  for (const list of bySeller.values()) {
    const { credits, pair } = pairRtoDebits(list);
    for (const c of credits) if (c.amount > 0 && !c.bankTxId) { scheduledCount++; scheduledAmount += c.amount - (pair.get(c.id)?.amount ?? 0); }
  }
  const awaiting = unpaidDelivered
    .filter(o => !o.seller.dataStartDate || o.createdAt >= o.seller.dataStartDate)
    .reduce((n, o) => n + o.totalAmount - (o.productCost ?? 0) - (o.shippingCharge ?? 0) - (o.packingCharge ?? 0), 0);

  // Key numbers for the selected range
  const del = rangeOrders.filter(o => o.status === "DELIVERED"), rto = rangeOrders.filter(o => o.status === "RTO").length;
  const gmv = del.reduce((n, o) => n + o.totalAmount, 0);
  const packing = del.reduce((n, o) => n + (o.packingCharge ?? 0), 0);

  // 30-day trend by order date (IST)
  const trend: { day: string; delivered: number; rto: number; orders: number }[] = [];
  for (let i = 29; i >= 0; i--) trend.push({ day: istDay(istStartOfDay(i)), delivered: 0, rto: 0, orders: 0 });
  const tIdx = new Map(trend.map((t, i) => [t.day, i]));
  for (const o of orders30) {
    const t = trend[tIdx.get(istDay(o.createdAt)) ?? -1];
    if (!t) continue;
    t.orders++; if (o.status === "DELIVERED") t.delivered++; if (o.status === "RTO") t.rto++;
  }

  // Seller health (last 30 days)
  const sMap = new Map<string, { id: string; name: string; orders: number; delivered: number; rto: number }>();
  for (const o of orders30) {
    const s = sMap.get(o.sellerId) ?? { id: o.sellerId, name: o.seller.brandName || o.seller.name || o.seller.email, orders: 0, delivered: 0, rto: 0 };
    s.orders++; if (o.status === "DELIVERED") s.delivered++; if (o.status === "RTO") s.rto++;
    sMap.set(o.sellerId, s);
  }
  const lastOrders = await prisma.order.groupBy({ by: ["sellerId"], where: { sellerId: { in: [...sMap.keys()] } }, _max: { createdAt: true } });
  const lastBy = new Map(lastOrders.map(l => [l.sellerId, l._max.createdAt]));
  const sellers = [...sMap.values()].map(s => {
    const done = s.delivered + s.rto;
    const rtoPct = done ? Math.round((s.rto / done) * 100) : null;
    const flags = [planOverdue.has(s.id) && "Plan overdue", rtoPct != null && done >= 5 && rtoPct >= 40 && "High RTO"].filter(Boolean) as string[];
    return { ...s, deliveredPct: done ? Math.round((s.delivered / done) * 100) : null, rtoPct, flags, lastOrder: lastBy.get(s.id)?.toISOString() ?? null };
  }).sort((a, b) => b.flags.length - a.flags.length || b.orders - a.orders).slice(0, 10);

  // Top products (last 30 days)
  const ps = await productStats({ days: 30 });
  const topIds = [...ps.stats.entries()].sort((a, b) => b[1].orders - a[1].orders).slice(0, 5);
  const names = await prisma.product.findMany({ where: { id: { in: topIds.map(t => t[0]) } }, select: { id: true, name: true, images: true } });
  const products = topIds.map(([id, s]) => ({ id, name: names.find(n => n.id === id)?.name ?? "Product", image: names.find(n => n.id === id)?.images?.[0] ?? null, ...s }));

  const done = del.length + rto;
  return NextResponse.json({
    needs: {
      kyc, listings, calling, toShip, ndr, rtoOverdue, invoicesHeld,
      planOverdue: planOverdue.size,
      supportNeedsReply: openTickets.filter(t => (t.messages[0]?.author.role ?? "SELLER") === "SELLER").length,
      scheduledPayouts: { count: scheduledCount, amount: Math.round(scheduledAmount) },
    },
    key: {
      days, orders: rangeOrders.length, delivered: del.length, rto,
      deliveredPct: done ? Math.round((del.length / done) * 100) : null, rtoPct: done ? Math.round((rto / done) * 100) : null,
      gmv: Math.round(gmv), earned: Math.round(del.length * fee + packing), activeSellers: new Set(rangeOrders.map(o => o.sellerId)).size,
    },
    trend, sellers, products,
    money: {
      toPay: Math.round(awaiting + scheduledAmount), awaiting: Math.round(awaiting), scheduled: Math.round(scheduledAmount),
      toCollect: Math.round(toCollect),
      earnedThisMonth: Math.round(monthDelivered.length * fee + monthDelivered.reduce((n, o) => n + (o.packingCharge ?? 0), 0) + (monthPlanPays._sum.amount ?? 0)),
    },
  });
}
