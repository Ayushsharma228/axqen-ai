/**
 * Cron: auto-payout
 * Schedule: 30 13 * * 1  (Monday 13:30 UTC = 7:00 PM IST / end of day)
 *
 * Automatically transfers each seller's full wallet balance to their bank
 * account. Financial transfer logic (bank API integration) is a TODO —
 * this stub computes who gets paid and how much, logs it, and returns
 * the payout manifest.
 *
 * DO NOT modify the balance calculation logic below — it mirrors the
 * formula in /api/seller/wallet/route.ts (CREDIT - DEBIT = net balance).
 *
 * TODO: wire up actual bank transfer API when finance team provides credentials.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Aggregate wallet balance per seller from transactions
  const txRows = await prisma.walletTransaction.groupBy({
    by:       ["sellerId"],
    _sum:     { amount: true },
    where:    { type: "CREDIT" },
  });
  const debitRows = await prisma.walletTransaction.groupBy({
    by:       ["sellerId"],
    _sum:     { amount: true },
    where:    { type: "DEBIT" },
  });

  const debitMap = new Map(debitRows.map(r => [r.sellerId, r._sum.amount ?? 0]));
  const sellerBalances = txRows.map(r => ({
    sellerId: r.sellerId,
    balance:  (r._sum.amount ?? 0) - (debitMap.get(r.sellerId) ?? 0),
  })).filter(r => r.balance > 0);

  if (sellerBalances.length === 0) {
    console.log("[cron] auto-payout: no sellers with positive balance");
    return NextResponse.json({ paid: 0, totalAmount: 0 });
  }

  // Fetch bank details for sellers with a positive balance
  const sellerIds = sellerBalances.map(r => r.sellerId);
  const users = await prisma.user.findMany({
    where:  { id: { in: sellerIds }, bankAccount: { not: null } },
    select: { id: true, businessName: true, bankHolder: true, bankAccount: true, bankIfsc: true },
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  const payouts = sellerBalances
    .map(r => ({ ...r, user: userMap.get(r.sellerId) }))
    .filter(r => r.user !== undefined);

  const totalAmount = payouts.reduce((s, r) => s + r.balance, 0);

  console.log(
    `[cron] auto-payout: ${payouts.length} sellers · ₹${totalAmount.toLocaleString("en-IN")} total`,
  );

  // TODO: for each payout, initiate bank transfer via payment gateway
  // await Promise.all(payouts.map(p => transferToBank(p.user!, p.balance)));

  // Notify all admins with payout summary
  const admins = await prisma.user.findMany({
    where:  { role: "ADMIN" },
    select: { id: true },
  });

  if (admins.length > 0) {
    const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
    await prisma.notification.createMany({
      data: admins.map(a => ({
        userId:  a.id,
        type:    "GENERAL" as const,
        title:   `Monday Payout — ${payouts.length} seller${payouts.length !== 1 ? "s" : ""}`,
        message: `Auto-payout computed: ${inr(totalAmount)} across ${payouts.length} seller${payouts.length !== 1 ? "s" : ""}. Bank transfer pending — initiate manually until payment gateway is wired.`,
        data:    { payoutCount: payouts.length, totalAmount, runAt: new Date().toISOString() },
      })),
    });
    console.log(`[cron] auto-payout: notified ${admins.length} admin(s)`);
  }

  return NextResponse.json({
    paid: payouts.length,
    totalAmount,
    sellers: payouts.map(p => ({
      id:      p.sellerId,
      name:    p.user!.businessName,
      account: p.user!.bankAccount ? "••••" + p.user!.bankAccount.slice(-4) : null,
      amount:  p.balance,
    })),
  });
}
