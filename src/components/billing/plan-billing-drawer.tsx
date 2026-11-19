"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, X, Plus, Trash2, Lock, Unlock, AlertTriangle, CalendarClock, Play, ArrowUpDown } from "lucide-react";

interface Period {
  id: string; periodNo: number; plan: string; tier: string | null; startDate: string; endDate: string | null; dueDate: string | null; note: string | null;
  amountDue: number; paid: number; pending: number; status: string;
  payments: { id: string; amount: number; paidAt: string; transactionId: string | null; mode: string; note: string | null }[];
}
interface Billing {
  periods: Period[]; totals: { due: number; paid: number; pending: number }; overdue: boolean; ordersBlocked: boolean;
  holds: { held: number; releasable: number; items: { id: string; amount: number; status: string; createdAt: string; releasedAt: string | null; releaseRef: string | null }[] };
}

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const fmtD = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const toInput = (d: string | null) => (d ? new Date(new Date(d).getTime() + 5.5 * 3600000).toISOString().slice(0, 10) : "");
const today = () => toInput(new Date().toISOString());
const planName = (p: string, t: string | null) => p === "MARKETPLACE" ? "Marketplace" : `Dropshipping${t ? ` ${t.charAt(0)}${t.slice(1).toLowerCase()}` : ""}`;
export function PlanBillingDrawer({ sellerId, onClose, onChanged }: { sellerId: string; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<{ seller: { id: string; brandName: string | null; name: string | null; email: string; plan: string | null; planTier: string | null; createdAt: string }; billing: Billing } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [pay, setPay] = useState<Record<string, { amount: string; paidAt: string; mode: string; transactionId: string; note: string }>>({});
  const [releaseRef, setReleaseRef] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    fetch(`/api/admin/plan-billing?sellerId=${sellerId}`).then(r => r.json()).then(d => { if (d.billing) setData(d); });
  }, [sellerId]);
  useEffect(() => { load(); }, [load]);

  async function act(body: Record<string, unknown>, key: string) {
    setBusy(key); setErr("");
    const res = await fetch("/api/admin/plan-billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setErr(d.error ?? "Failed"); return false; }
    load(); onChanged();
    return true;
  }

  const input = "w-full px-2.5 py-1.5 text-[12.5px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE]";
  const b = data?.billing;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-xl bg-[#F7F8FC] h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-[#E8EDF6] px-5 py-4 flex items-center justify-between z-10">
          <div>
            <p className="text-[16px] font-bold text-[#0C1220]">{data?.seller.brandName || data?.seller.name || "Seller"}</p>
            <p className="text-[12px] text-[#9CA3AF]">{data?.seller.plan ? planName(data.seller.plan, data.seller.planTier) : ""} · {data?.seller.email}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-[#F3F4F6]"><X className="w-4 h-4" /></button>
        </div>

        {!data || !b ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#4361EE]" /></div>
        ) : (
          <div className="p-5 space-y-4">
            {err && <p className="text-[12.5px] text-[#B91C1C] bg-[#FEF2F2] rounded-lg px-3 py-2">{err}</p>}

            <ChangePlan current={{ plan: data.seller.plan, tier: data.seller.planTier }} started={b.periods.length > 0} busy={busy === "plan"}
              onSubmit={(plan, tier, startDate) => act({ action: "changePlan", sellerId, plan, tier, startDate }, "plan")} />

            {b.periods.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#E8EDF6] p-4 space-y-3">
                <p className="text-[14px] font-bold text-[#0C1220]">Start plan billing</p>
                <p className="text-[12.5px] text-[#6B7280]">The plan start is normally the day the seller was activated. {data.seller.plan === "MARKETPLACE" ? "Marketplace renews every 3 months from this date." : "Dropshipping is a one-time payment."}</p>
                <div className="flex items-center gap-2">
                  <input id="pb-start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`${input} max-w-[180px]`} />
                  <button onClick={() => act({ action: "start", sellerId, startDate }, "start")} disabled={busy === "start"}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold text-white bg-[#4361EE] disabled:opacity-60">
                    {busy === "start" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Start billing
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {[["Due", b.totals.due, "#0C1220"], ["Paid", b.totals.paid, "#047857"], ["Pending", b.totals.pending, b.totals.pending ? "#DC2626" : "#9CA3AF"]].map(([l, v, c]) => (
                    <div key={String(l)} className="bg-white rounded-lg border border-[#E8EDF6] px-3 py-2.5">
                      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{l}</p>
                      <p className="text-[17px] font-black tabular-nums" style={{ color: String(c) }}>{inr(Number(v))}</p>
                    </div>
                  ))}
                </div>
                {b.ordersBlocked && (
                  <p className="flex items-center gap-2 text-[12.5px] font-semibold text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">
                    <AlertTriangle className="w-4 h-4" /> Past due date: this Marketplace seller&apos;s orders are on hold until payment is recorded.
                  </p>
                )}

                {b.holds.items.length > 0 && (
                  <div className="bg-white rounded-xl border border-[#E8EDF6] p-4 space-y-2">
                    <p className="text-[13px] font-bold text-[#0C1220] flex items-center gap-1.5"><Lock className="w-4 h-4" /> Payout holds</p>
                    {b.holds.items.map(h => (
                      <div key={h.id} className="flex items-center gap-2 flex-wrap text-[12.5px] border-t border-[#F3F4F6] pt-2">
                        <span className="flex-1 min-w-[160px] text-[#374151]">{inr(h.amount)} held on {fmtD(h.createdAt)}</span>
                        {h.status === "RELEASED" ? (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#047857]">Released {h.releasedAt ? fmtD(h.releasedAt) : ""} · {h.releaseRef}</span>
                        ) : b.totals.pending > 0 ? (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FEF2F2] text-[#DC2626]">Held until the due is paid</span>
                        ) : (
                          <>
                            <input id={`rel-${h.id}`} value={releaseRef[h.id] ?? ""} onChange={e => setReleaseRef(x => ({ ...x, [h.id]: e.target.value }))} placeholder="Bank/UPI ref of transfer" className={`${input} max-w-[180px] font-mono`} />
                            <button onClick={() => act({ action: "release", holdId: h.id, releaseRef: releaseRef[h.id] ?? "" }, h.id)} disabled={busy === h.id}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-bold text-white bg-[#047857] disabled:opacity-60">
                              <Unlock className="w-3.5 h-3.5" /> Mark released
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {[...b.periods].reverse().map(p => {
                  const f = pay[p.id] ?? { amount: p.pending > 0 ? String(p.pending) : "", paidAt: today(), mode: "UPI", transactionId: "", note: "" };
                  const setF = (k: keyof typeof f, v: string) => setPay(x => ({ ...x, [p.id]: { ...f, [k]: v } }));
                  return (
                    <div key={p.id} className="bg-white rounded-xl border border-[#E8EDF6] p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className="text-[13.5px] font-bold text-[#0C1220]">{p.plan === "MARKETPLACE" ? `Period ${p.periodNo}` : "One-time plan"} · {inr(p.amountDue)}</p>
                          <p className="text-[11.5px] text-[#6B7280]">{fmtD(p.startDate)}{p.endDate ? ` to ${fmtD(p.endDate)}` : ""} · paid {inr(p.paid)} · pending {inr(p.pending)}</p>
                        </div>
                        <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full" style={{ background: p.status === "PAID" ? "#ECFDF5" : p.status === "OVERDUE" ? "#FEF2F2" : "#F3F4F6", color: p.status === "PAID" ? "#047857" : p.status === "OVERDUE" ? "#DC2626" : "#6B7280" }}>{p.status.replace("_", " ")}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-[11.5px] font-semibold text-[#374151]">
                          <span className="flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" /> Due date (agreed with seller)</span>
                          <input id={`due-${p.id}`} type="date" defaultValue={toInput(p.dueDate)} onBlur={e => { if (e.target.value !== toInput(p.dueDate)) act({ action: "setDueDate", periodId: p.id, dueDate: e.target.value || null }, `due-${p.id}`); }} className={`${input} mt-1`} />
                        </label>
                        {p.periodNo === 1 && (
                          <label className="text-[11.5px] font-semibold text-[#374151]">
                            Plan start date
                            <input id={`start-${p.id}`} type="date" defaultValue={toInput(p.startDate)} onBlur={e => { if (e.target.value && e.target.value !== toInput(p.startDate)) act({ action: "setStart", periodId: p.id, startDate: e.target.value }, `start-${p.id}`); }} className={`${input} mt-1`} />
                          </label>
                        )}
                      </div>

                      {p.payments.length > 0 && (
                        <ul className="divide-y divide-[#F3F4F6] border-t border-[#F3F4F6]">
                          {p.payments.map(x => (
                            <li key={x.id} className="flex items-center justify-between gap-2 py-2 text-[12.5px]">
                              <span className="text-[#374151]">{fmtD(x.paidAt)} · {x.mode}{x.transactionId ? <> · <span className="font-mono">{x.transactionId}</span></> : null}{x.note ? ` · ${x.note}` : ""}</span>
                              <span className="flex items-center gap-2">
                                <b className="tabular-nums">{inr(x.amount)}</b>
                                <button onClick={() => { if (confirm(`Delete the ${inr(x.amount)} payment?`)) act({ action: "deletePayment", paymentId: x.id }, x.id); }} aria-label="Delete payment" className="p-1 text-[#9CA3AF] hover:text-[#DC2626]"><Trash2 className="w-3.5 h-3.5" /></button>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {p.pending > 0 && (
                        <div className="border-t border-[#F3F4F6] pt-3 space-y-2">
                          <p className="text-[12px] font-bold text-[#0C1220]">Record a payment</p>
                          <div className="grid grid-cols-2 gap-2">
                            <input id={`amt-${p.id}`} inputMode="decimal" placeholder="Amount ₹" value={f.amount} onChange={e => setF("amount", e.target.value)} className={input} />
                            <input id={`date-${p.id}`} type="date" value={f.paidAt} onChange={e => setF("paidAt", e.target.value)} className={input} />
                            <select id={`mode-${p.id}`} value={f.mode} onChange={e => setF("mode", e.target.value)} className={input}>
                              {[["UPI", "UPI"], ["BANK", "Bank transfer"], ["CASH", "Cash"], ["CHEQUE", "Cheque"], ["OTHER", "Other"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                            <input id={`tx-${p.id}`} placeholder={f.mode === "CASH" ? "Receipt no. (optional)" : "Transaction ID / UTR"} value={f.transactionId} onChange={e => setF("transactionId", e.target.value)} className={`${input} font-mono`} />
                          </div>
                          <input id={`note-${p.id}`} placeholder="Note (optional), e.g. Tally invoice VV/26-27/0012" value={f.note} onChange={e => setF("note", e.target.value)} className={input} />
                          <button onClick={async () => { if (await act({ action: "recordPayment", periodId: p.id, ...f }, `pay-${p.id}`)) setPay(x => { const n = { ...x }; delete n[p.id]; return n; }); }}
                            disabled={busy === `pay-${p.id}`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold text-white bg-[#4361EE] disabled:opacity-60">
                            {busy === `pay-${p.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Record payment
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const PRICES: Record<string, number> = { "DROPSHIPPING:STARTER": 9999, "DROPSHIPPING:GROWTH": 19999, "DROPSHIPPING:SCALE": 39999, "MARKETPLACE:STARTER": 8999 };

function ChangePlan({ current, started, busy, onSubmit }: {
  current: { plan: string | null; tier: string | null }; started: boolean; busy: boolean;
  onSubmit: (plan: string, tier: string, startDate: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState(current.plan ?? "DROPSHIPPING");
  const [tier, setTier] = useState((current.tier ?? "STARTER").toUpperCase());
  const [start, setStart] = useState(today());
  const t = plan === "MARKETPLACE" ? "STARTER" : tier;
  const same = plan === current.plan && (plan === "MARKETPLACE" || t === (current.tier ?? "STARTER").toUpperCase());
  const price = PRICES[`${plan}:${t}`];
  const input = "px-2.5 py-1.5 text-[12.5px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE]";

  if (!open) return (
    <button onClick={() => setOpen(true)} className="w-full flex items-center justify-between bg-white rounded-xl border border-[#E8EDF6] px-4 py-3 text-left hover:border-[#C7D2FE]">
      <span>
        <span className="block text-[13px] font-bold text-[#0C1220]">Change plan</span>
        <span className="block text-[12px] text-[#6B7280]">Currently {current.plan ? planName(current.plan, current.tier) : "no plan"}</span>
      </span>
      <ArrowUpDown className="w-4 h-4 text-[#4361EE]" />
    </button>
  );
  return (
    <div className="bg-white rounded-xl border border-[#C7D2FE] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-bold text-[#0C1220]">Change plan</p>
        <button onClick={() => setOpen(false)} aria-label="Cancel" className="p-1 rounded hover:bg-[#F3F4F6]"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="text-[11.5px] font-semibold text-[#374151]">Plan
          <select id="cp-plan" className={`${input} w-full mt-1`} value={plan} onChange={e => setPlan(e.target.value)}>
            <option value="DROPSHIPPING">Dropshipping</option><option value="MARKETPLACE">Marketplace</option>
          </select>
        </label>
        <label className="text-[11.5px] font-semibold text-[#374151]">Tier
          <select id="cp-tier" className={`${input} w-full mt-1`} value={t} disabled={plan === "MARKETPLACE"} onChange={e => setTier(e.target.value)}>
            <option value="STARTER">Starter</option><option value="GROWTH">Growth</option><option value="SCALE">Scale</option>
          </select>
        </label>
        <label className="text-[11.5px] font-semibold text-[#374151]">Starts on
          <input id="cp-start" type="date" className={`${input} w-full mt-1`} value={start} onChange={e => setStart(e.target.value)} />
        </label>
      </div>
      <p className="text-[12px] text-[#6B7280]">
        {same ? "The seller is already on this plan." : started
          ? <>A new bill of <b className="text-[#0C1220]">{price ? inr(price) : "—"}</b> (full price of {planName(plan, t)}{plan === "MARKETPLACE" ? ", renews every 3 months" : ""}) is added from this date. Earlier bills and payments stay as they are.</>
          : <>Billing hasn&apos;t started yet, so only the plan changes. {planName(plan, t)} will be billed when you start billing.</>}
      </p>
      <button disabled={same || busy} onClick={async () => { if (await onSubmit(plan, t, start)) setOpen(false); }}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold text-white bg-[#4361EE] disabled:opacity-50">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpDown className="w-3.5 h-3.5" />} Change to {planName(plan, t)}
      </button>
    </div>
  );
}
