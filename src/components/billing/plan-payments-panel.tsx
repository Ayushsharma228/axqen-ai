"use client";

import { useEffect, useState } from "react";
import { Loader2, CalendarClock, CheckCircle2, AlertTriangle, MessageCircle, Lock } from "lucide-react";
import { WA_LINK } from "@/components/landing/constants";

export interface BillingView {
  plan: string | null; tier: string | null;
  periods: {
    id: string; periodNo: number; plan: string; tier: string | null; startDate: string; endDate: string | null; dueDate: string | null; note: string | null;
    amountDue: number; base: number; gst: number; paid: number; pending: number; status: "PAID" | "PARTLY_PAID" | "UNPAID" | "OVERDUE" | "UPCOMING";
    payments: { id: string; amount: number; paidAt: string; transactionId: string | null; mode: string; note: string | null }[];
  }[];
  totals: { due: number; paid: number; pending: number };
  overdue: boolean; nextDueDate: string | null; ordersBlocked: boolean;
  holds: { held: number; releasable: number; items: { id: string; amount: number; status: string; createdAt: string; releasedAt: string | null; releaseRef: string | null }[] };
}

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const fmtD = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const PLAN = (p: string, t: string | null) => p === "MARKETPLACE" ? "Amazon Marketplace" : `Dropshipping${t ? ` · ${t.charAt(0)}${t.slice(1).toLowerCase()}` : ""}`;
const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  PAID:        { label: "Paid",         bg: "#ECFDF5", color: "#047857" },
  PARTLY_PAID: { label: "Partly paid",  bg: "#FFFBEB", color: "#B45309" },
  UNPAID:      { label: "Unpaid",       bg: "#F3F4F6", color: "#6B7280" },
  OVERDUE:     { label: "Overdue",      bg: "#FEF2F2", color: "#DC2626" },
  UPCOMING:    { label: "Upcoming",     bg: "#EEF2FF", color: "#4361EE" },
};

export function useBilling() {
  const [b, setB] = useState<BillingView | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/seller/plan-billing").then(r => r.json()).then(d => setB(d.periods ? d : null)).catch(() => {}).finally(() => setLoading(false));
  }, []);
  return { billing: b, loading };
}

/** One-line plan-due notice (Dashboard, Profile). Renders nothing when nothing is pending. */
export function PlanDueNotice({ billing, compact = false }: { billing: BillingView | null; compact?: boolean }) {
  if (!billing || billing.totals.pending <= 0) return null;
  const overdue = billing.overdue;
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 ${compact ? "py-2.5" : "py-3"} flex-wrap`}
      style={{ background: overdue ? "#FEF2F2" : "#FFFBEB", borderColor: overdue ? "#FECACA" : "#FDE68A" }}>
      {overdue ? <AlertTriangle className="w-4 h-4 mt-0.5 text-[#DC2626]" /> : <CalendarClock className="w-4 h-4 mt-0.5 text-[#D97706]" />}
      <div className="flex-1 min-w-[220px] text-[13px]" style={{ color: overdue ? "#991B1B" : "#92400E" }}>
        <b>{inr(billing.totals.pending)} pending on your plan</b>
        {billing.nextDueDate && <>{overdue ? ", was due " : ", due by "}{fmtD(billing.nextDueDate)}</>}.
        {billing.ordersBlocked && <> Your orders are on hold until it&apos;s paid.</>}
        {billing.holds.held > 0 && <> {inr(billing.holds.held)} of your payouts is on hold until then.</>}
      </div>
      <a href={`${WA_LINK}?text=${encodeURIComponent(`Hi AXQEN team, I want to pay my plan due of ${inr(billing.totals.pending)}.`)}`} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-bold text-white bg-[#16A34A] whitespace-nowrap">
        <MessageCircle className="w-3.5 h-3.5" /> Pay / talk to us
      </a>
    </div>
  );
}

/** Full plan payments view (Documents & Invoices → Plan payments). */
export function PlanPaymentsPanel() {
  const { billing, loading } = useBilling();

  if (loading) return <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[#9CA3AF]"><Loader2 className="w-5 h-5 animate-spin text-[#4361EE]" /> Loading plan payments…</div>;
  if (!billing || billing.periods.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#E8EDF6] p-6 max-w-2xl">
        <p className="text-[15px] font-bold text-[#0C1220]">No plan billing yet</p>
        <p className="text-[13px] text-[#6B7280] mt-1">Once the AXQEN team activates your plan, the amount due and every payment you make will show here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PlanDueNotice billing={billing} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Plan", value: billing.plan ? PLAN(billing.plan, billing.tier) : "—", small: true },
          { label: "Total due", value: inr(billing.totals.due) },
          { label: "Paid", value: inr(billing.totals.paid) },
          { label: "Pending", value: inr(billing.totals.pending), red: billing.totals.pending > 0 },
        ].map(t => (
          <div key={t.label} className="bg-white rounded-xl border border-[#E8EDF6] px-4 py-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF] mb-1.5">{t.label}</p>
            <p className={`${t.small ? "text-[15px]" : "text-[22px]"} font-black leading-tight tabular-nums`} style={{ color: t.red ? "#DC2626" : "#0C1220" }}>{t.value}</p>
          </div>
        ))}
      </div>

      {billing.holds.items.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E8EDF6] p-4">
          <p className="text-[13px] font-bold text-[#0C1220] flex items-center gap-1.5"><Lock className="w-4 h-4 text-[#DC2626]" /> Payout holds</p>
          <ul className="mt-2 divide-y divide-[#F3F4F6]">
            {billing.holds.items.map(h => (
              <li key={h.id} className="flex items-center justify-between py-2 text-[12.5px]">
                <span className="text-[#374151]">Held from a payout on {fmtD(h.createdAt)}</span>
                <span className="flex items-center gap-2">
                  <b className="tabular-nums">{inr(h.amount)}</b>
                  {h.status === "HELD"
                    ? <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-[#FEF2F2] text-[#DC2626]">On hold</span>
                    : <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#047857]">Released {h.releasedAt ? fmtD(h.releasedAt) : ""}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        {[...billing.periods].reverse().map(p => {
          const st = STATUS[p.status];
          return (
            <div key={p.id} className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
              <div className="px-4 py-3 flex items-start justify-between gap-3 flex-wrap border-b border-[#F3F4F6]">
                <div>
                  <p className="text-[14px] font-bold text-[#0C1220]">
                    {p.plan === "MARKETPLACE" ? `Period ${p.periodNo}: ${fmtD(p.startDate)} to ${p.endDate ? fmtD(p.endDate) : "—"}` : `${PLAN(p.plan, p.tier)} (one-time)`}
                  </p>
                  <p className="text-[12px] text-[#6B7280] mt-0.5">
                    {inr(p.amountDue)} due ({inr(p.base)} + {inr(p.gst)} GST){p.dueDate ? ` by ${fmtD(p.dueDate)}` : ""} · {inr(p.paid)} paid{p.pending > 0 ? ` · ${inr(p.pending)} pending` : ""}
                  </p>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: st.bg, color: st.color }}>{st.label}</span>
              </div>
              {p.payments.length === 0 ? (
                <p className="px-4 py-3 text-[12px] text-[#9CA3AF]">No payments recorded yet.</p>
              ) : (
                <ul className="divide-y divide-[#F3F4F6]">
                  {p.payments.map(x => (
                    <li key={x.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-[12.5px]">
                      <span className="flex items-center gap-2 text-[#374151]">
                        <CheckCircle2 className="w-4 h-4 text-[#047857]" />
                        {fmtD(x.paidAt)} · {x.mode}{x.transactionId ? <> · <span className="font-mono">{x.transactionId}</span></> : null}
                      </span>
                      <b className="tabular-nums text-[#0C1220]">{inr(x.amount)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11.5px] text-[#9CA3AF]">Your plan invoice is sent by the AXQEN team. Payments appear here once the team records them.</p>
    </div>
  );
}
