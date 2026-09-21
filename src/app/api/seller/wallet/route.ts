import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sellerId = session.user.id;

  const [transactions, seller] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { sellerId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: sellerId },
      select: { bankHolder: true, bankAccount: true, bankIfsc: true },
    }),
  ]);

  // Total remittance = ALL credit entries (confirmed + upcoming)
  const totalRemittance = transactions.filter(t => t.type === "CREDIT").reduce((s, t) => s + t.amount, 0);
  // Total deductions = ALL debit entries
  const totalDeductions = transactions.filter(t => t.type === "DEBIT").reduce((s, t) => s + t.amount, 0);
  // Net balance = remittance - deductions
  const balance = totalRemittance - totalDeductions;

  // Upcoming = credits not yet confirmed (no bankTxId)
  const upcoming = transactions.filter(t => t.bankTxId === null && t.type === "CREDIT");
  const upcomingAmount = upcoming.reduce((s, t) => s + t.amount, 0);

  // Paid list for transaction log display
  const paid = transactions.filter(t => t.bankTxId !== null);

  // Total actually settled/transferred to seller's bank (CREDIT with bankTxId)
  const totalSettled = transactions
    .filter(t => t.type === "CREDIT" && t.bankTxId !== null)
    .reduce((s, t) => s + t.amount, 0);

  return NextResponse.json({
    balance,
    totalRemittance,
    totalDeductions,
    totalSettled,
    upcomingAmount,
    upcoming,
    paid,
    transactions,
    bankDetails: {
      bankHolder:  seller?.bankHolder  ?? null,
      bankAccount: seller?.bankAccount ?? null,
      bankIfsc:    seller?.bankIfsc    ?? null,
    },
  });
}
