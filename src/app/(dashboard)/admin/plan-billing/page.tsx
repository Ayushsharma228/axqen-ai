"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Search, X, Plus, Trash2, Lock, Unlock, AlertTriangle, CalendarClock, Play } from "lucide-react";

interface SellerRow {
  id: string; name: string | null; brandName: string | null; email: string; plan: string; planTier: string | null; accountStatus: string;
  started: boolean; due: number; paid: number; pending: number; overdue: boolean; nextDueDate: string | null;
  held: number; releasable: number; ordersBlocked: boolean;
}
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
type Filter = "ALL" | "PENDING" | "OVERDUE" | "RELEASE" | "NOT_STARTED";

export default function PlanBillingPage() {
  const [rows, setRows] = useState<SellerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/plan-billing").then(r => r.json()).then(d => setRows(d.sellers ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const count = (f: Filter) => rows.filter(r => match(r, f)).length;
  const shown = rows.filter(r => match(r, filter)).filter(r => !q.trim() || `${r.brandName} ${r.name} ${r.email}`.toLowerCase().includes(q.trim().toLowerCase()));
  const totalPending = rows.reduce((s, r) => s + r.pending, 0);
  const totalHeld = rows.reduce((s, r) => s + r.held, 0);

  return (
    <div className="px-4 py-5 md:p-8 space-y-5" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div>
        <h1 className="text-[22px] font-black text-[#0C1220]">Plan Billing</h1>
        <p className="text-[12.5px] text-[#6B7280] mt-1 max-w-[80ch]">Plan dues and payments for every seller (invoices are made in Tally). Pending dues are held from Dropshipping payouts; Marketplace orders stop after an unpaid due date.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Pending across sellers", value: inr(totalPending), color: totalPending ? "#DC2626" : "#0C1220" },
          { label: "Overdue sellers", value: String(count("OVERDUE")), color: count("OVERDUE") ? "#DC2626" : "#0C1220" },
          { label: "Held from payouts", value: inr(totalHeld), color: "#0C1220" },
          { label: "Ready to release", value: String(count("RELEASE")), color: count("RELEASE") ? "#047857" : "#0C1220" },
        ].map(t => (
          <div key={t.label} className="bg-white rounded-xl border border-[#E8EDF6] px-4 py-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF] mb-1.5">{t.label}</p>
            <p className="text-[22px] font-black leading-none tabular-nums" style={{ color: t.color }}>{loading ? "…" : t.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
        <div className="flex items-center gap-1 border-b border-[#F3F4F6] px-2 overflow-x-auto">
          {([["PENDING", "Pending"], ["OVERDUE", "Overdue"], ["RELEASE", "Release held money"], ["NOT_STARTED", "Billing not started"], ["ALL", "All"]] as [Filter, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className="px-3 py-3 text-[13px] font-semibold border-b-2 -mb-px whitespace-nowrap"
              style={{ borderColor: filter === k ? "#4361EE" : "transparent", color: filter === k ? "#4361EE" : "#6B7280" }}>
              {l} <span className="ml-1 text-[10.5px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: filter === k ? "#4361EE" : "#F3F4F6", color: filter === k ? "white" : "#9CA3AF" }}>{count(k)}</span>
            </button>
          ))}
        </div>
        <div className="px-4 py-3 bg-[#FAFBFF] border-b border-[#F3F4F6]">
          <div className="relative max-w-[280px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
            <input id="pb-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Seller name or email"
              className="pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] w-full" />
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[#9CA3AF]"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
        ) : shown.length === 0 ? (
          <p className="py-16 text-center text-[13px] text-[#9CA3AF]">No sellers here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-[12.5px]">
              <thead>
                <tr className="bg-[#FAFBFF] text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                  <th className="px-4 py-2.5">Seller</th><th className="px-3 py-2.5">Plan</th>
                  <th className="px-3 py-2.5 text-right">Due</th><th className="px-3 py-2.5 text-right">Paid</th><th className="px-3 py-2.5 text-right">Pending</th>
                  <th className="px-3 py-2.5">Due date</th><th className="px-3 py-2.5 text-right">Held</th><th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {shown.map(r => (
                  <tr key={r.id} className="hover:bg-[#FAFBFF] cursor-pointer" onClick={() => setOpenId(r.id)}>
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-[#0C1220]">{r.brandName || r.name || r.email}</p>
                      <p className="text-[11px] text-[#9CA3AF]">{r.email}</p>
                    </td>
                    <td className="px-3 py-2.5 text-[#374151]">{planName(r.plan, r.planTier)}</td>
                    {r.started ? <>
                      <td className="px-3 py-2.5 text-right tabular-nums">{inr(r.due)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#047857]">{inr(r.paid)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold" style={{ color: r.pending > 0 ? "#DC2626" : "#9CA3AF" }}>{inr(r.pending)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {r.nextDueDate ? <span style={{ color: r.overdue ? "#DC2626" : "#374151", fontWeight: r.overdue ? 700 : 400 }}>{fmtD(r.nextDueDate)}{r.overdue ? " · overdue" : ""}</span> : <span className="text-[#9CA3AF]">{r.pending > 0 ? "Not set" : "—"}</span>}
                        {r.ordersBlocked && <p className="text-[10.5px] font-bold text-[#DC2626]">Orders on hold</p>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.held > 0 ? <span style={{ color: r.releasable ? "#047857" : "#0C1220", fontWeight: 600 }}>{inr(r.held)}{r.releasable ? " · release" : ""}</span> : "—"}</td>
                    </> : (
                      <td colSpan={5} className="px-3 py-2.5 text-[12px] text-[#B45309]">Billing not started</td>
                    )}
                    <td className="px-3 py-2.5 text-right text-[12px] font-semibold text-[#4361EE]">Open</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openId && <SellerDrawer sellerId={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}

function match(r: SellerRow, f: Filter) {
  if (f === "ALL") return true;
  if (f === "NOT_STARTED") return !r.started;
  if (f === "PENDING") return r.started && r.pending > 0;
  if (f === "OVERDUE") return r.overdue;
  return r.releasable > 0;
}

function SellerDrawer({ sellerId, onClose, onChanged }: { sellerId: string; onClose: () => void; onChanged: () => void }) {
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
