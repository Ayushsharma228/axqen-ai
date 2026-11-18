import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { pairRtoDebits } from "@/lib/payouts";

// One payout's statement: the orders it paid for and the RTO orders deducted with it.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sellerId = session.user.id;
  const { id } = await params;

  const credit = await prisma.walletTransaction.findFirst({
    where: { id, sellerId, type: "CREDIT" },
    select: { id: true, type: true, amount: true, note: true, remittanceDate: true, bankTxId: true, createdAt: true },
  });
  if (!credit) return NextResponse.json({ error: "Payout not found" }, { status: 404 });

  const nearby = await prisma.walletTransaction.findMany({
    where: { sellerId, createdAt: { gte: new Date(credit.createdAt.getTime() - 5 * 60000), lte: new Date(credit.createdAt.getTime() + 5 * 60000) } },
    select: { id: true, type: true, amount: true, note: true, remittanceDate: true, bankTxId: true, createdAt: true },
  });
  const debit = pairRtoDebits(nearby).pair.get(credit.id) ?? null;

  const select = {
    id: true, externalOrderId: true, customerName: true, paymentMode: true, createdAt: true,
    totalAmount: true, productCost: true, shippingCharge: true, packingCharge: true, rtoCharge: true,
  } as const;
  const [orders, rtoOrders] = await Promise.all([
    prisma.order.findMany({ where: { sellerId, remittanceTxId: credit.id }, select, orderBy: { createdAt: "asc" } }),
    debit ? prisma.order.findMany({ where: { sellerId, remittanceTxId: debit.id }, select, orderBy: { createdAt: "asc" } }) : Promise.resolve([]),
  ]);

  const iso = <T extends { createdAt: Date }>(o: T) => ({ ...o, createdAt: o.createdAt.toISOString() });
  return NextResponse.json({
    payout: {
      id: credit.id,
      status: credit.bankTxId ? "PAID" : "SCHEDULED",
      date: (credit.remittanceDate ?? credit.createdAt).toISOString(),
      bankRef: credit.bankTxId,
      note: credit.note,
      credit: credit.amount,
      rtoDeduction: debit?.amount ?? 0,
      net: credit.amount - (debit?.amount ?? 0),
    },
    orders: orders.map(iso),
    rtoOrders: rtoOrders.map(iso),
  });
}
