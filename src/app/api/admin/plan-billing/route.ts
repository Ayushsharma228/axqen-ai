import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { addMonths, changePlan, getBilling, mergeSplitPlanChange, RENEWAL_MONTHS, startPlanBilling } from "@/lib/plan-billing";

async function admin(req: NextRequest) {
  const s = await getRouteSession(req);
  return s?.user.role === "ADMIN" ? s : null;
}
const MODES = ["UPI", "BANK", "CASH", "CHEQUE", "OTHER"];
const date = (v: unknown) => {
  const d = new Date(String(v ?? ""));
  return isNaN(d.getTime()) ? null : d;
};

// GET            → every seller with a plan: due, paid, pending, overdue, held
// GET ?sellerId= → one seller's full billing
export async function GET(req: NextRequest) {
  if (!(await admin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sellerId = req.nextUrl.searchParams.get("sellerId");
  if (sellerId) {
    const seller = await prisma.user.findUnique({ where: { id: sellerId }, select: { id: true, name: true, brandName: true, email: true, plan: true, planTier: true, accountStatus: true, createdAt: true } });
    if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    return NextResponse.json({ seller, billing: await getBilling(sellerId) });
  }

  const sellers = await prisma.user.findMany({
    where: { role: "SELLER", plan: { not: null } },
    select: { id: true, name: true, brandName: true, email: true, plan: true, planTier: true, accountStatus: true },
    orderBy: { createdAt: "desc" },
  });
  const rows = await Promise.all(sellers.map(async s => {
    const b = await getBilling(s.id);
    return {
      ...s,
      started: b.periods.length > 0,
      due: b.totals.due, paid: b.totals.paid, pending: b.totals.pending,
      overdue: b.overdue, nextDueDate: b.nextDueDate, held: b.holds.held, releasable: b.holds.releasable, ordersBlocked: b.ordersBlocked,
    };
  }));
  return NextResponse.json({ sellers: rows });
}

// POST actions:
//  { action: "start", sellerId, startDate }
//  { action: "setDueDate", periodId, dueDate | null }
//  { action: "setStart", periodId, startDate }
//  { action: "recordPayment", periodId, amount, paidAt, transactionId?, mode, note? }
//  { action: "deletePayment", paymentId }
//  { action: "release", holdId, releaseRef }
//  { action: "changePlan", sellerId, plan, tier?, startDate }   → current bill becomes the new plan; paid amount is adjusted
//  { action: "mergePlanChange", sellerId }                      → repair an old split plan change into one bill
export async function POST(req: NextRequest) {
  const session = await admin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;

  try {
    switch (b.action) {
      case "start": {
        const startDate = date(b.startDate);
        if (!startDate) throw new Error("Pick a start date");
        await startPlanBilling(String(b.sellerId ?? ""), startDate, session.user.id);
        return NextResponse.json({ ok: true });
      }
      case "changePlan": {
        const startDate = date(b.startDate);
        if (!startDate) throw new Error("Pick the date the new plan starts");
        const r = await changePlan(String(b.sellerId ?? ""), String(b.plan ?? ""), b.tier ? String(b.tier) : null, startDate, session.user.id);
        return NextResponse.json({ ok: true, ...r });
      }
      case "mergePlanChange": {
        const r = await mergeSplitPlanChange(String(b.sellerId ?? ""));
        return NextResponse.json({ ok: true, ...r });
      }
      case "setDueDate": {
        const dueDate = b.dueDate ? date(b.dueDate) : null;
        if (b.dueDate && !dueDate) throw new Error("Invalid due date");
        await prisma.planPeriod.update({ where: { id: String(b.periodId) }, data: { dueDate } });
        return NextResponse.json({ ok: true });
      }
      case "setStart": {
        const startDate = date(b.startDate);
        if (!startDate) throw new Error("Pick a start date");
        const p = await prisma.planPeriod.findUnique({ where: { id: String(b.periodId) } });
        if (!p) throw new Error("Period not found");
        if (p.periodNo !== 1) throw new Error("Only the first period's start date can be changed; renewals follow from it");
        await prisma.planPeriod.update({
          where: { id: p.id },
          data: { startDate, endDate: p.plan === "MARKETPLACE" ? addMonths(startDate, RENEWAL_MONTHS) : null },
        });
        return NextResponse.json({ ok: true });
      }
      case "recordPayment": {
        const p = await prisma.planPeriod.findUnique({ where: { id: String(b.periodId) } });
        if (!p) throw new Error("Period not found");
        const amount = Number(b.amount);
        if (!isFinite(amount) || amount <= 0) throw new Error("Enter the amount received");
        const paidAt = date(b.paidAt);
        if (!paidAt) throw new Error("Enter the date it was received");
        const mode = String(b.mode ?? "").toUpperCase();
        if (!MODES.includes(mode)) throw new Error("Pick how it was paid");
        const tx = String(b.transactionId ?? "").trim();
        if (mode !== "CASH" && !tx) throw new Error("Enter the transaction ID / UTR");
        const payment = await prisma.planPayment.create({
          data: {
            periodId: p.id, sellerId: p.sellerId, amount: Math.round(amount * 100) / 100, paidAt, mode,
            transactionId: tx || null, note: String(b.note ?? "").trim().slice(0, 300) || null, recordedById: session.user.id,
          },
        });
        await prisma.notification.create({
          data: {
            userId: p.sellerId, type: "ORDER_UPDATE", title: "Plan payment received",
            message: `₹${Math.round(amount).toLocaleString("en-IN")} received${tx ? ` (ref ${tx})` : ""}. Thank you!`,
            data: { kind: "PLAN_PAYMENT", paymentId: payment.id },
          },
        }).catch(() => {});
        return NextResponse.json({ ok: true, billing: await getBilling(p.sellerId) });
      }
      case "deletePayment": {
        const pay = await prisma.planPayment.findUnique({ where: { id: String(b.paymentId) } });
        if (!pay) throw new Error("Payment not found");
        await prisma.planPayment.delete({ where: { id: pay.id } });
        return NextResponse.json({ ok: true });
      }
      case "release": {
        const hold = await prisma.payoutHold.findUnique({ where: { id: String(b.holdId) } });
        if (!hold || hold.status !== "HELD") throw new Error("Hold not found or already released");
        const billing = await getBilling(hold.sellerId);
        if (billing.totals.pending > 0) throw new Error(`The seller still owes ₹${billing.totals.pending.toLocaleString("en-IN")}. Release once the plan due is cleared.`);
        const ref = String(b.releaseRef ?? "").trim();
        if (!ref) throw new Error("Enter the bank / UPI reference of the release transfer");
        await prisma.payoutHold.update({ where: { id: hold.id }, data: { status: "RELEASED", releasedAt: new Date(), releaseRef: ref } });
        await prisma.notification.create({
          data: {
            userId: hold.sellerId, type: "ORDER_UPDATE", title: "Held payout released",
            message: `₹${Math.round(hold.amount).toLocaleString("en-IN")} that was on hold has been sent to your bank (ref ${ref}).`,
            data: { kind: "PAYOUT_RELEASE", holdId: hold.id },
          },
        }).catch(() => {});
        return NextResponse.json({ ok: true });
      }
      default:
        throw new Error("Unknown action");
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
