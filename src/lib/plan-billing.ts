// Plan billing: what a seller owes for their plan, what they've paid, and what is pending.
// - Dropshipping: one-time payment (one period). Marketplace: renews every 3 months (new period each time).
// - Due dates are agreed with the seller and set by the AXQEN team.
// - Dropshipping payouts: a pending due is HELD from payouts (not used to pay the due) and released once the due is paid.
// - Marketplace: after a period's due date passes unpaid, orders aren't processed.
import { prisma } from "@/lib/prisma";
import { PLAN_PRICES_INR } from "@/lib/plan-pricing";

export const RENEWAL_MONTHS = 3;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Plan prices are before GST; the seller pays price + 18% GST. Stored amountDue is the price before GST. */
export const PLAN_GST_RATE = 18;
export const withGst = (base: number) => r2(base * (1 + PLAN_GST_RATE / 100));

export function planPrice(plan: string | null | undefined, tier: string | null | undefined): number | null {
  if (plan !== "DROPSHIPPING" && plan !== "MARKETPLACE") return null;
  const t = (tier ?? "STARTER").toUpperCase() as keyof (typeof PLAN_PRICES_INR)["DROPSHIPPING"];
  return PLAN_PRICES_INR[plan]?.[t] ?? PLAN_PRICES_INR[plan]?.STARTER ?? null;
}

export function addMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + months);
  return x;
}

export interface PeriodView {
  id: string; periodNo: number; plan: string; tier: string | null;
  startDate: string; endDate: string | null; dueDate: string | null; note: string | null;
  amountDue: number;   // payable, GST included
  base: number; gst: number; // plan price before GST, and the GST on it
  paid: number; pending: number;
  status: "PAID" | "PARTLY_PAID" | "UNPAID" | "OVERDUE" | "UPCOMING";
  payments: { id: string; amount: number; paidAt: string; transactionId: string | null; mode: string; note: string | null }[];
}

export interface Billing {
  plan: string | null; tier: string | null;
  periods: PeriodView[];
  totals: { due: number; paid: number; pending: number };
  overdue: boolean;           // a started period is past its due date with money pending
  nextDueDate: string | null; // earliest due date among periods with money pending
  holds: { held: number; releasable: number; items: { id: string; amount: number; status: string; walletTxId: string; createdAt: string; releasedAt: string | null; releaseRef: string | null }[] };
  ordersBlocked: boolean;     // Marketplace + overdue
}

export async function getBilling(sellerId: string): Promise<Billing> {
  const now = new Date();
  const [seller, periods, payments, holds] = await Promise.all([
    prisma.user.findUnique({ where: { id: sellerId }, select: { plan: true, planTier: true } }),
    prisma.planPeriod.findMany({ where: { sellerId }, orderBy: { periodNo: "asc" } }),
    prisma.planPayment.findMany({ where: { sellerId }, orderBy: { paidAt: "asc" } }),
    prisma.payoutHold.findMany({ where: { sellerId }, orderBy: { createdAt: "desc" } }),
  ]);

  const views: PeriodView[] = periods.map(p => {
    const pays = payments.filter(x => x.periodId === p.id);
    const paid = r2(pays.reduce((s, x) => s + x.amount, 0));
    const gross = withGst(p.amountDue);
    const pending = r2(Math.max(0, gross - paid));
    const started = p.startDate <= now;
    const status: PeriodView["status"] = pending <= 0 ? "PAID"
      : !started ? "UPCOMING"
      : p.dueDate && p.dueDate < now ? "OVERDUE"
      : paid > 0 ? "PARTLY_PAID" : "UNPAID";
    return {
      id: p.id, periodNo: p.periodNo, plan: p.plan, tier: p.tier,
      startDate: p.startDate.toISOString(), endDate: p.endDate?.toISOString() ?? null,
      dueDate: p.dueDate?.toISOString() ?? null, note: p.note,
      amountDue: gross, base: p.amountDue, gst: r2(gross - p.amountDue), paid, pending, status,
      payments: pays.map(x => ({ id: x.id, amount: x.amount, paidAt: x.paidAt.toISOString(), transactionId: x.transactionId, mode: x.mode, note: x.note })),
    };
  });

  const active = views.filter(v => v.status !== "UPCOMING");
  const totals = {
    due: r2(active.reduce((s, v) => s + v.amountDue, 0)),
    paid: r2(active.reduce((s, v) => s + v.paid, 0)),
    pending: r2(active.reduce((s, v) => s + v.pending, 0)),
  };
  const overdue = views.some(v => v.status === "OVERDUE");
  const nextDueDate = views.filter(v => v.pending > 0 && v.dueDate).map(v => v.dueDate!).sort()[0] ?? null;
  const held = r2(holds.filter(h => h.status === "HELD").reduce((s, h) => s + h.amount, 0));

  return {
    plan: seller?.plan ?? null, tier: seller?.planTier ?? null,
    periods: views, totals, overdue, nextDueDate,
    holds: {
      held,
      releasable: totals.pending <= 0 ? held : 0,
      items: holds.map(h => ({ id: h.id, amount: h.amount, status: h.status, walletTxId: h.walletTxId, createdAt: h.createdAt.toISOString(), releasedAt: h.releasedAt?.toISOString() ?? null, releaseRef: h.releaseRef })),
    },
    ordersBlocked: seller?.plan === "MARKETPLACE" && overdue,
  };
}

/** Start billing for a seller's plan (period 1). Start date = activation date, editable later. */
export async function startPlanBilling(sellerId: string, startDate: Date, by?: string) {
  const seller = await prisma.user.findUnique({ where: { id: sellerId }, select: { plan: true, planTier: true } });
  if (!seller?.plan) throw new Error("This seller has no plan yet");
  const exists = await prisma.planPeriod.findFirst({ where: { sellerId }, select: { id: true } });
  if (exists) throw new Error("Billing is already started for this seller");
  const amount = planPrice(seller.plan, seller.planTier);
  if (amount == null) throw new Error("No price is set for this plan");
  return prisma.planPeriod.create({
    data: {
      sellerId, plan: seller.plan, tier: seller.planTier, periodNo: 1, startDate,
      endDate: seller.plan === "MARKETPLACE" ? addMonths(startDate, RENEWAL_MONTHS) : null,
      amountDue: amount, createdById: by ?? null,
    },
  });
}

/** Create Marketplace renewal periods that have come due (cron, daily). */
export async function createDueRenewals() {
  const now = new Date();
  const lasts = await prisma.planPeriod.findMany({
    where: { plan: "MARKETPLACE", endDate: { not: null, lte: now } },
    orderBy: { periodNo: "desc" },
    distinct: ["sellerId"],
  });
  let created = 0;
  for (const last of lasts) {
    const seller = await prisma.user.findUnique({ where: { id: last.sellerId }, select: { plan: true, planTier: true, accountStatus: true } });
    if (seller?.plan !== "MARKETPLACE" || seller.accountStatus === "SUSPENDED") continue;
    let prev = last;
    // Catch up if several periods were missed (e.g. the cron didn't run)
    while (prev.endDate && prev.endDate <= now) {
      const startDate = prev.endDate;
      const amount = planPrice("MARKETPLACE", seller.planTier) ?? prev.amountDue;
      try {
        prev = await prisma.planPeriod.create({
          data: {
            sellerId: prev.sellerId, plan: "MARKETPLACE", tier: seller.planTier, periodNo: prev.periodNo + 1,
            startDate, endDate: addMonths(startDate, RENEWAL_MONTHS), amountDue: amount, note: "Renewal",
          },
        });
        created++;
      } catch {
        break; // another run created it
      }
    }
  }
  return { created };
}

/** How much of a payout must be held for pending plan dues (already-held money counts towards it). */
export async function holdAmountFor(sellerId: string, payoutAmount: number) {
  const b = await getBilling(sellerId);
  const stillUncovered = Math.max(0, b.totals.pending - b.holds.held);
  return { hold: r2(Math.min(stillUncovered, Math.max(0, payoutAmount))), pending: b.totals.pending, alreadyHeld: b.holds.held };
}

/** Record a hold when a remittance is paid. Idempotent per wallet transaction. */
export async function applyHoldOnPaid(sellerId: string, walletTxId: string, payoutAmount: number) {
  const existing = await prisma.payoutHold.findFirst({ where: { walletTxId } });
  if (existing) return { held: existing.amount, transfer: r2(payoutAmount - existing.amount) };
  const { hold } = await holdAmountFor(sellerId, payoutAmount);
  if (hold > 0) {
    await prisma.payoutHold.create({ data: { sellerId, walletTxId, amount: hold, status: "HELD" } });
    await prisma.notification.create({
      data: {
        userId: sellerId, type: "ORDER_UPDATE", title: "Part of your payout is on hold",
        message: `₹${Math.round(hold).toLocaleString("en-IN")} is on hold because your plan payment is pending. It's released in a payout once the plan payment is cleared.`,
        data: { kind: "PAYOUT_HOLD", walletTxId },
      },
    }).catch(() => {});
  }
  return { held: hold, transfer: r2(payoutAmount - hold) };
}

/** Marketplace sellers past their due date: orders must not be processed. */
export async function ordersBlockedFor(sellerId: string) {
  const seller = await prisma.user.findUnique({ where: { id: sellerId }, select: { plan: true } });
  if (seller?.plan !== "MARKETPLACE") return false;
  return (await getBilling(sellerId)).ordersBlocked;
}

export const BLOCKED_MESSAGE = "This seller's plan payment is overdue, so their orders are on hold. Record the payment in Admin → Plan Billing to continue.";

const PLAN_LABEL = (plan: string | null | undefined, tier: string | null | undefined) =>
  !plan ? "No plan" : plan === "MARKETPLACE" ? "Marketplace" : `Dropshipping ${(tier ?? "STARTER")[0]}${(tier ?? "STARTER").slice(1).toLowerCase()}`;

/**
 * Change a seller's plan/tier. The current bill is converted to the new plan at its full price and
 * everything already paid on it is adjusted against it, so the seller sees one plan with what's pending.
 * `startDate` is used only when moving to Marketplace (its 3-month cycle starts then).
 */
export async function changePlan(sellerId: string, plan: string, tier: string | null, startDate: Date, by?: string) {
  if (plan !== "DROPSHIPPING" && plan !== "MARKETPLACE") throw new Error("Pick Dropshipping or Marketplace");
  const t = plan === "MARKETPLACE" ? "STARTER" : (tier ?? "").toUpperCase();
  if (plan === "DROPSHIPPING" && !["STARTER", "GROWTH", "SCALE"].includes(t)) throw new Error("Pick Starter, Growth or Scale");

  const seller = await prisma.user.findUnique({ where: { id: sellerId }, select: { plan: true, planTier: true, role: true } });
  if (!seller || seller.role !== "SELLER") throw new Error("Seller not found");
  const same = seller.plan === plan && (plan === "MARKETPLACE" || (seller.planTier ?? "STARTER").toUpperCase() === t);
  if (same) throw new Error("The seller is already on this plan");

  const amount = planPrice(plan, t);
  if (amount == null) throw new Error("No price is set for this plan");
  const last = await prisma.planPeriod.findFirst({ where: { sellerId }, orderBy: { periodNo: "desc" } });
  const note = `Plan changed from ${PLAN_LABEL(seller.plan, seller.planTier)} to ${PLAN_LABEL(plan, t)}`;

  return prisma.$transaction(async tx => {
    await tx.user.update({ where: { id: sellerId }, data: { plan: plan as "DROPSHIPPING" | "MARKETPLACE", planTier: t } });
    if (!last) return { billed: false, amount: 0, note };
    const start = plan === "MARKETPLACE" ? startDate : last.startDate;
    await tx.planPeriod.update({
      where: { id: last.id },
      data: {
        plan, tier: t, amountDue: amount, startDate: start,
        endDate: plan === "MARKETPLACE" ? addMonths(start, RENEWAL_MONTHS) : null,
        note: [last.note, note].filter(Boolean).join(" · "),
      },
    });
    return { billed: true, amount, note };
  });
}

/**
 * One-time repair for plan changes made before the adjust-in-place rule: an unpaid "Plan changed" bill
 * sitting after an older bill is folded into that older bill (payments stay where they are).
 */
export async function mergeSplitPlanChange(sellerId: string) {
  const periods = await prisma.planPeriod.findMany({ where: { sellerId }, orderBy: { periodNo: "asc" } });
  const paidCount = await prisma.planPayment.groupBy({ by: ["periodId"], where: { sellerId }, _count: { id: true } });
  const hasPay = new Set(paidCount.map(p => p.periodId));
  let merged = 0;
  for (let i = 1; i < periods.length; i++) {
    const p = periods[i], prev = periods[i - 1];
    if (!p.note?.startsWith("Plan changed") || hasPay.has(p.id)) continue;
    await prisma.$transaction([
      prisma.planPeriod.update({
        where: { id: prev.id },
        data: {
          plan: p.plan, tier: p.tier, amountDue: p.amountDue,
          startDate: p.plan === "MARKETPLACE" ? p.startDate : prev.startDate,
          endDate: p.plan === "MARKETPLACE" ? p.endDate : null,
          note: [prev.note, p.note].filter(Boolean).join(" · "),
        },
      }),
      prisma.planPeriod.delete({ where: { id: p.id } }),
    ]);
    merged++;
    break; // one per call; periods shift after a merge
  }
  return { merged };
}
