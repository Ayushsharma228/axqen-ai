import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { emailKycApproved, emailKycRejected } from "@/lib/email";
import { dispatchEvent } from "@/lib/automation/engine";
import { ensureSellerActivation, updateActivation } from "@/lib/activation/engine";
import { startPlanBilling } from "@/lib/plan-billing";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id }    = await params;
  const { action, adminNote, activate, payment } = await req.json() as {
    action: string; adminNote?: string; activate?: boolean;
    payment?: { amount?: number | string; paidAt?: string; mode?: string; transactionId?: string; note?: string } | null;
  };

  if (!["APPROVED", "REJECTED"].includes(action))
    return NextResponse.json({ error: "action must be APPROVED or REJECTED" }, { status: 400 });

  // Signup payment is collected offline and recorded here, at KYC approval. Validate before changing anything.
  let pay: { amount: number; paidAt: Date; mode: string; transactionId: string | null; note: string | null } | null = null;
  if (action === "APPROVED" && activate && payment) {
    const amount = Math.round(Number(payment.amount) * 100) / 100;
    const paidAt = payment.paidAt ? new Date(payment.paidAt) : null;
    const mode = String(payment.mode ?? "").toUpperCase();
    const tx = String(payment.transactionId ?? "").trim();
    if (!(amount > 0)) return NextResponse.json({ error: "Enter the amount received" }, { status: 400 });
    if (!paidAt || isNaN(paidAt.getTime())) return NextResponse.json({ error: "Enter the date it was received" }, { status: 400 });
    if (!["UPI", "BANK", "CASH", "CHEQUE", "OTHER"].includes(mode)) return NextResponse.json({ error: "Pick how it was paid" }, { status: 400 });
    if (mode !== "CASH" && !tx) return NextResponse.json({ error: "Enter the transaction ID / UTR" }, { status: 400 });
    pay = { amount, paidAt, mode, transactionId: tx || null, note: String(payment.note ?? "").trim().slice(0, 300) || null };
  }

  const seller = await prisma.user.update({
    where: { id },
    data:  { kycStatus: action as never },
    select: { name: true, email: true },
  });

  if (action === "APPROVED") {
    emailKycApproved({ to: seller.email, name: seller.name ?? "Seller" }).catch(() => {});
  } else {
    emailKycRejected({
      to: seller.email,
      name: seller.name ?? "Seller",
      reason: adminNote ?? "Please resubmit with valid documents.",
    }).catch(() => {});
  }

  // Notify seller
  await prisma.notification.create({
    data: {
      userId:  id,
      type:    "GENERAL",
      title:   action === "APPROVED" ? "KYC Approved ✓" : "KYC Rejected",
      message: action === "APPROVED"
        ? "Your KYC has been verified. You are now eligible for full payout."
        : `Your KYC was rejected. Reason: ${adminNote ?? "Please resubmit with valid documents."}`,
      data: { action, adminNote },
    },
  });

  // Approve + activate: dashboard opens, plan billing starts today, offline payment recorded.
  const result: { activated?: boolean; billingStarted?: boolean; paymentRecorded?: boolean; warning?: string } = {};
  if (action === "APPROVED" && activate) {
    const u = await prisma.user.update({
      where: { id }, data: { accountStatus: "ACTIVE", ...(pay ? { paymentConfirmed: true } : {}) },
      select: { plan: true },
    });
    result.activated = true;
    let period = await prisma.planPeriod.findFirst({ where: { sellerId: id }, orderBy: { periodNo: "asc" } });
    if (!period && u.plan) {
      try { period = await startPlanBilling(id, new Date(), session.user.id); result.billingStarted = true; }
      catch (e) { result.warning = e instanceof Error ? e.message : "Couldn't start plan billing"; }
    }
    if (pay) {
      if (period) {
        await prisma.planPayment.create({
          data: { periodId: period.id, sellerId: id, amount: pay.amount, paidAt: pay.paidAt, mode: pay.mode, transactionId: pay.transactionId, note: pay.note ?? "Recorded at KYC approval", recordedById: session.user.id },
        });
        result.paymentRecorded = true;
      } else {
        result.warning = result.warning ?? "The seller has no plan, so the payment wasn't recorded. Add it in Plan Billing.";
      }
    }
    await prisma.notification.create({
      data: { userId: id, type: "GENERAL", title: "Your account is active 🎉", message: "Your dashboard is ready. Connect your store and start selling.", data: { kind: "ACCOUNT_ACTIVATED" } },
    }).catch(() => {});
  }

  dispatchEvent({ type: action === "APPROVED" ? "KYC_APPROVED" : "KYC_REJECTED",
                  entityId: id, entityType: "SELLER",
                  payload: { sellerId: id, action }, actorId: session.user.id });

  if (action === "APPROVED") {
    setImmediate(async () => {
      try {
        await ensureSellerActivation(id);
        await updateActivation(id);
      } catch {}
    });
  }

  return NextResponse.json({ ok: true, ...result });
}
