import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { dispatchEvent } from "@/lib/automation/engine";

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requests = await prisma.withdrawalRequest.findMany({
    where:   { sellerId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}

export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sellerId = session.user.id;
  const { amount } = await req.json();

  if (!amount || amount <= 0)
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

  // Fetch seller bank details
  const seller = await prisma.user.findUnique({
    where:  { id: sellerId },
    select: { bankHolder: true, bankAccount: true, bankIfsc: true },
  });

  if (!seller?.bankAccount || !seller?.bankIfsc || !seller?.bankHolder)
    return NextResponse.json(
      { error: "Bank details not set. Please update your profile before requesting a payout." },
      { status: 400 }
    );

  // Block if a PENDING request already exists
  const pending = await prisma.withdrawalRequest.findFirst({
    where: { sellerId, status: "PENDING" },
  });
  if (pending)
    return NextResponse.json(
      { error: "You already have a pending withdrawal request. Please wait for it to be processed." },
      { status: 400 }
    );

  // Available balance = all credits minus all debits (matches wallet page display)
  const txns = await prisma.walletTransaction.findMany({
    where: { sellerId },
  });
  const available = txns.reduce(
    (acc, t) => (t.type === "CREDIT" ? acc + t.amount : acc - t.amount), 0
  );

  if (amount > available)
    return NextResponse.json(
      { error: `Requested amount ₹${amount} exceeds available balance ₹${available.toFixed(2)}` },
      { status: 400 }
    );

  const request = await prisma.withdrawalRequest.create({
    data: {
      sellerId,
      amount,
      bankHolder:  seller.bankHolder,
      bankAccount: seller.bankAccount,
      bankIfsc:    seller.bankIfsc,
    },
  });

  // In-app notification
  await prisma.notification.create({
    data: {
      userId:  sellerId,
      type:    "GENERAL",
      title:   "Withdrawal Request Submitted",
      message: `Your withdrawal request of ₹${amount.toFixed(2)} has been submitted and is under review.`,
      data:    { withdrawalId: request.id },
    },
  });

  dispatchEvent({ type: "WITHDRAWAL_REQUESTED", entityId: request.id, entityType: "WITHDRAWAL",
                  payload: { sellerId, amount }, actorId: sellerId });

  return NextResponse.json({ ok: true, request });
}
