import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { orderSumsByTx, pairRtoDebits } from "@/lib/payouts";

// Seller payout overview: money pipeline + one row per payout (remittance) with its breakdown.
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sellerId = session.user.id;

  const [txns, seller, deliveredOpen, rtoOpen] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { sellerId },
      select: { id: true, type: true, amount: true, note: true, remittanceDate: true, bankTxId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findUnique({ where: { id: sellerId }, select: { bankHolder: true, bankAccount: true, bankIfsc: true, dataStartDate: true } }),
    prisma.order.findMany({
      where: { sellerId, status: "DELIVERED", remittedAt: null },
      select: { totalAmount: true, productCost: true, shippingCharge: true, packingCharge: true, paymentMode: true },
    }),
    prisma.order.findMany({
      where: { sellerId, status: "RTO", remittedAt: null },
      select: { productCost: true, rtoCharge: true, packingCharge: true },
    }),
  ]);

  const floor = seller?.dataStartDate ?? null;
  const { credits, pair } = pairRtoDebits(txns);
  const sums = await orderSumsByTx([...credits.map(c => c.id), ...[...pair.values()].map(d => d.id)]);

  const payouts = credits
    .filter(c => c.amount > 0)
    .map(c => {
      const d = pair.get(c.id) ?? null;
      const s = sums.get(c.id);
      const r = d ? sums.get(d.id) : undefined;
      return {
        id: c.id,
        status: c.bankTxId ? "PAID" : "SCHEDULED",
        date: (c.remittanceDate ?? c.createdAt).toISOString(),
        bankRef: c.bankTxId,
        note: c.note,
        orders: s?.count ?? 0,
        gross: s?.gross ?? null,
        productCost: s?.productCost ?? null,
        shipping: s?.shipping ?? null,
        packing: s?.packing ?? null,
        credit: c.amount,
        rtoOrders: r?.count ?? 0,
        rtoDeduction: d?.amount ?? 0,
        net: c.amount - (d?.amount ?? 0),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const scheduled = payouts.filter(p => p.status === "SCHEDULED");
  const paid = payouts.filter(p => p.status === "PAID");
  const est = (o: { totalAmount: number; productCost: number | null; shippingCharge: number | null; packingCharge: number | null }) =>
    o.totalAmount - (o.productCost ?? 0) - (o.shippingCharge ?? 0) - (o.packingCharge ?? 0);
  const nextDates = scheduled.map(p => p.date).sort();

  return NextResponse.json({
    pipeline: {
      awaiting: { count: deliveredOpen.length, amount: deliveredOpen.reduce((s, o) => s + est(o), 0), costsKnown: deliveredOpen.every(o => o.productCost != null) },
      rtoPending: { count: rtoOpen.length, amount: rtoOpen.reduce((s, o) => s + (o.productCost ?? 0) + (o.rtoCharge ?? 0) + (o.packingCharge ?? 0), 0) },
      scheduled: { count: scheduled.length, amount: scheduled.reduce((s, p) => s + p.net, 0), nextDate: nextDates[0] ?? null },
      paid: { count: paid.length, amount: paid.reduce((s, p) => s + p.net, 0), lastDate: paid[0]?.date ?? null },
    },
    payouts,
    bank: { holder: seller?.bankHolder ?? null, account: seller?.bankAccount ? `••••${seller.bankAccount.slice(-4)}` : null, ifsc: seller?.bankIfsc ?? null },
    since: floor?.toISOString() ?? null,
  });
}
