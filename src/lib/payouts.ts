// Seller payouts = remittance CREDIT wallet transactions (orders linked via order.remittanceTxId),
// each paired with the RTO DEBIT the admin remittance flow creates in the same request.
import { prisma } from "@/lib/prisma";

type Tx = { id: string; type: string; amount: number; note: string | null; remittanceDate: Date | null; bankTxId: string | null; createdAt: Date };

const PAIR_WINDOW_MS = 2 * 60 * 1000;

/** The RTO deduction created alongside a remittance credit (same request → within a couple of minutes, created after it). */
export function pairRtoDebits(txns: Tx[]) {
  const credits = txns.filter(t => t.type === "CREDIT").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const debits = txns.filter(t => t.type === "DEBIT" && (t.note ?? "").startsWith("RTO Deduction"));
  const pair = new Map<string, Tx>();
  const used = new Set<string>();
  for (const c of credits) {
    const d = debits.find(x => !used.has(x.id)
      && x.createdAt.getTime() >= c.createdAt.getTime()
      && x.createdAt.getTime() - c.createdAt.getTime() <= PAIR_WINDOW_MS);
    if (d) { pair.set(c.id, d); used.add(d.id); }
  }
  return { credits, pair, unpairedDebits: debits.filter(d => !used.has(d.id)) };
}

export async function orderSumsByTx(txIds: string[]) {
  if (!txIds.length) return new Map<string, { count: number; gross: number; productCost: number; shipping: number; packing: number; rto: number }>();
  const rows = await prisma.order.groupBy({
    by: ["remittanceTxId"],
    where: { remittanceTxId: { in: txIds } },
    _count: { _all: true },
    _sum: { totalAmount: true, productCost: true, shippingCharge: true, packingCharge: true, rtoCharge: true },
  });
  return new Map(rows.map(r => [r.remittanceTxId as string, {
    count: r._count._all,
    gross: r._sum.totalAmount ?? 0,
    productCost: r._sum.productCost ?? 0,
    shipping: r._sum.shippingCharge ?? 0,
    packing: r._sum.packingCharge ?? 0,
    rto: r._sum.rtoCharge ?? 0,
  }]));
}
