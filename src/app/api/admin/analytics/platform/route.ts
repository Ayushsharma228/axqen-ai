import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { platformFeePerOrder } from "@/lib/profit";
import { pairRtoDebits } from "@/lib/payouts";

// READ-ONLY platform analytics from live data: orders, delivery, AXQEN earnings, payouts. GET ?days=7|30|90 (omit for all time)
const istMonth = (d: Date) => new Date(d.getTime() + 5.5 * 3600000).toISOString().slice(0, 7);

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const days = Number(req.nextUrl.searchParams.get("days") ?? "") || null;
  const since = days ? new Date(Date.now() - days * 86400000) : null;
  const created = since ? { createdAt: { gte: since } } : {};

  const [orders, fee, planPays, txns] = await Promise.all([
    prisma.order.findMany({
      where: { status: { not: "HIDDEN" }, ...created },
      select: { status: true, totalAmount: true, packingCharge: true, createdAt: true, sellerId: true, paymentMode: true, seller: { select: { name: true, brandName: true, email: true } } },
    }),
    platformFeePerOrder(),
    prisma.planPayment.findMany({ where: since ? { paidAt: { gte: since } } : {}, select: { amount: true, paidAt: true } }),
    prisma.walletTransaction.findMany({ select: { id: true, type: true, amount: true, note: true, remittanceDate: true, bankTxId: true, createdAt: true, sellerId: true } }),
  ]);

  type B = { orders: number; delivered: number; rto: number; cancelled: number; moving: number; gmv: number; packing: number; packingMissing: number; cod: number };
  const blank = (): B => ({ orders: 0, delivered: 0, rto: 0, cancelled: 0, moving: 0, gmv: 0, packing: 0, packingMissing: 0, cod: 0 });
  const T = blank();
  const months = new Map<string, B & { plans: number; paidOut: number }>();
  const sellers = new Map<string, B & { name: string }>();
  const month = (k: string) => { let m = months.get(k); if (!m) { m = { ...blank(), plans: 0, paidOut: 0 }; months.set(k, m); } return m; };
  const add = (b: B, o: (typeof orders)[number]) => {
    b.orders++;
    if (o.paymentMode === "COD") b.cod++;
    if (o.status === "DELIVERED") {
      b.delivered++; b.gmv += o.totalAmount;
      if (o.packingCharge != null) b.packing += o.packingCharge; else b.packingMissing++;
    } else if (o.status === "RTO") b.rto++;
    else if (o.status === "CANCELLED") b.cancelled++;
    else b.moving++;
  };
  for (const o of orders) {
    add(T, o);
    add(month(istMonth(o.createdAt)), o);
    const s = sellers.get(o.sellerId) ?? { ...blank(), name: o.seller.brandName || o.seller.name || o.seller.email };
    add(s, o); sellers.set(o.sellerId, s);
  }
  let plans = 0;
  for (const p of planPays) { plans += p.amount; month(istMonth(p.paidAt)).plans += p.amount; }

  // Paid to sellers: remittance credits marked paid, minus the RTO deduction created with each
  const bySellerTx = new Map<string, typeof txns>();
  for (const t of txns) { const l = bySellerTx.get(t.sellerId) ?? []; l.push(t); bySellerTx.set(t.sellerId, l); }
  let paidOut = 0;
  for (const list of bySellerTx.values()) {
  const { credits, pair } = pairRtoDebits(list);
  for (const c of credits) {
    if (!c.bankTxId || c.amount <= 0) continue;
    const when = c.remittanceDate ?? c.createdAt;
    if (since && when < since) continue;
    const net = c.amount - (pair.get(c.id)?.amount ?? 0);
    paidOut += net;
    month(istMonth(when)).paidOut += net;
  }
  }

  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
  const view = (b: B) => ({
    orders: b.orders, delivered: b.delivered, rto: b.rto, cancelled: b.cancelled, moving: b.moving, cod: b.cod,
    gmv: Math.round(b.gmv), deliveredPct: pct(b.delivered, b.delivered + b.rto), rtoPct: pct(b.rto, b.delivered + b.rto),
    commission: b.delivered * fee, packing: Math.round(b.packing), packingMissing: b.packingMissing,
  });

  return NextResponse.json({
    feePerDelivered: fee,
    totals: { ...view(T), plans: Math.round(plans), paidOut: Math.round(paidOut), activeSellers: sellers.size },
    byMonth: [...months.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([m, b]) => ({ month: m, ...view(b), plans: Math.round(b.plans), paidOut: Math.round(b.paidOut) })),
    bySeller: [...sellers.entries()].map(([id, b]) => ({ id, name: b.name, ...view(b) })).sort((a, b) => b.gmv - a.gmv || b.orders - a.orders),
  });
}
