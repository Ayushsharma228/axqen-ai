"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, AlertTriangle, BadgeCheck, ChevronRight, Landmark } from "lucide-react";

interface Sched { id: string; date: string; orders: number; rtoOrders: number; net: number; credit: number; note: string | null }
interface Row {
  id: string; name: string; email: string; bankReady: boolean;
  awaiting: { count: number; amount: number; costsKnown: boolean }; rtoPending: { count: number; amount: number };
  scheduled: { count: number; amount: number; nextDate: string | null }; onHold: number; paid: { amount: number; lastDate: string | null };
  scheduledItems: Sched[];
}
interface Data { sellers: Row[]; totals: { awaiting: number; awaitingOrders: number; rtoPending: number; scheduled: number; scheduledCount: number; onHold: number } }

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "—");

/** Payouts across all sellers. Clicking a seller opens the existing per-seller remittance flow. */
export function RemittanceOverview({ onOpenSeller }: { onOpenSeller: (sellerId: string) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<"sellers" | "scheduled">("sellers");
  const [q, setQ] = useState("");
  const [paying, setPaying] = useState<string | null>(null);
  const [ref, setRef] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Record<string, { hold: number; transfer: number }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/remittance/overview").then(r => r.json()).then(d => (d.sellers ? setData(d) : setError(true))).catch(() => setError(true));
  }, []);
  useEffect(() => { load(); }, [load]);

  const sellers = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.sellers ?? []).filter(r => !s || r.name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s))
      .sort((a, b) => (b.awaiting.amount + b.scheduled.amount) - (a.awaiting.amount + a.scheduled.amount));
  }, [data, q]);
  const scheduled = useMemo(() => sellers.flatMap(r => r.scheduledItems.map(i => ({ ...i, seller: r }))).sort((a, b) => a.date.localeCompare(b.date)), [sellers]);

  async function openPay(sellerId: string, item: Sched) {
    setPaying(item.id); setMsg(null);
    const d = await fetch(`/api/admin/plan-billing/hold-preview?sellerId=${sellerId}&amount=${item.credit}`).then(r => r.json()).catch(() => null);
    if (d && typeof d.hold === "number") setPreview(p => ({ ...p, [item.id]: { hold: d.hold, transfer: d.transfer } }));
  }
  async function markPaid(item: Sched & { seller: Row }) {
    const bankTxId = ref[item.id]?.trim();
    if (!bankTxId) { setMsg({ ok: false, text: "Enter the bank or UPI transaction ID" }); return; }
    setBusy(item.id); setMsg(null);
    const res = await fetch("/api/admin/remittance", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ txId: item.id, bankTxId }) });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? "Couldn't mark as paid" }); return; }
    setMsg({ ok: true, text: d.held > 0
      ? `${item.seller.name}: marked paid. ${inr(d.held)} held for their plan due, so transfer only ${inr(d.transfer)}.`
      : `${item.seller.name}: ${inr(item.net)} marked paid.` });
    setPaying(null);
    load();
  }

  if (error) return <p className="py-24 text-center text-[13px] text-[#B91C1C]">Couldn&apos;t load payouts. Refresh to try again.</p>;
  if (!data) return <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-[#9CA3AF]"><Loader2 className="w-5 h-5 animate-spin" /> Working out what each seller is owed…</div>;
  const t = data.totals;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Delivered, not remitted", value: inr(t.awaiting), sub: `${t.awaitingOrders} orders · estimate`, tone: "#0C1220" },
          { label: "Scheduled, not paid", value: inr(t.scheduled), sub: `${t.scheduledCount} payouts`, tone: "#4361EE" },
          { label: "RTO to deduct", value: inr(t.rtoPending), sub: "From the next payouts", tone: t.rtoPending ? "#B91C1C" : "#0C1220" },
          { label: "Held for plan dues", value: inr(t.onHold), sub: "Released when paid", tone: t.onHold ? "#B45309" : "#0C1220" },
        ].map(x => (
          <div key={x.label} className="bg-white rounded-xl border border-[#E8EDF6] p-4">
            <p className="text-[11.5px] font-semibold text-[#6B7280]">{x.label}</p>
            <p className="text-[24px] font-black leading-tight tabular-nums mt-1" style={{ color: x.tone }}>{x.value}</p>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">{x.sub}</p>
          </div>
        ))}
      </div>

      {msg && <div className="px-4 py-2.5 rounded-xl text-[13px]" style={{ background: msg.ok ? "#ECFDF5" : "#FEF2F2", color: msg.ok ? "#047857" : "#B91C1C" }}>{msg.text}</div>}

      <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
        <div className="flex items-center gap-2 flex-wrap px-4 py-3 bg-[#FAFBFF] border-b border-[#F3F4F6]">
          <div className="flex items-center gap-1">
            {([["sellers", `Sellers (${sellers.length})`], ["scheduled", `Scheduled payouts (${scheduled.length})`]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-lg text-[12.5px] font-semibold ${tab === k ? "bg-[#E8EDFF] text-[#4361EE]" : "text-[#6B7280] hover:bg-[#F3F6FF]"}`}>{l}</button>
            ))}
          </div>
          <div className="relative ml-auto w-full sm:w-[260px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
            <input id="rem-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search sellers" className="pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] w-full" />
          </div>
        </div>

        {tab === "sellers" ? (
          sellers.length === 0 ? <p className="py-16 text-center text-[13px] text-[#9CA3AF]">No seller has money pending.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-[12.5px]">
                <thead>
                  <tr className="bg-[#FAFBFF] text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                    <th className="px-4 py-2.5">Seller</th><th className="px-3 py-2.5 text-right">Delivered, not remitted</th><th className="px-3 py-2.5 text-right">RTO to deduct</th>
                    <th className="px-3 py-2.5 text-right">Scheduled</th><th className="px-3 py-2.5 text-right">On hold</th><th className="px-3 py-2.5">Last paid</th><th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {sellers.map(r => (
                    <tr key={r.id} onClick={() => onOpenSeller(r.id)} className="cursor-pointer hover:bg-[#FAFBFF]">
                      <td className="px-4 py-2.5">
                        <span className="block font-semibold text-[#0C1220]">{r.name}</span>
                        <span className="block text-[11px] text-[#9CA3AF]">{r.email}</span>
                        {!r.bankReady && <span className="text-[11px] font-semibold text-[#B91C1C] inline-flex items-center gap-1"><Landmark className="w-3 h-3" /> No bank details</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {r.awaiting.count ? <><span className="font-semibold text-[#0C1220]">{inr(r.awaiting.amount)}</span><span className="block text-[10.5px] text-[#9CA3AF]">{r.awaiting.count} orders{!r.awaiting.costsKnown && " · costs missing"}</span></> : <span className="text-[#C4C9D4]">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.rtoPending.count ? <><span className="font-semibold text-[#B91C1C]">− {inr(r.rtoPending.amount)}</span><span className="block text-[10.5px] text-[#9CA3AF]">{r.rtoPending.count} orders</span></> : <span className="text-[#C4C9D4]">—</span>}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.scheduled.count ? <><span className="font-semibold text-[#4361EE]">{inr(r.scheduled.amount)}</span><span className="block text-[10.5px] text-[#9CA3AF]">{r.scheduled.nextDate ? `due ${fmt(r.scheduled.nextDate)}` : `${r.scheduled.count} payouts`}</span></> : <span className="text-[#C4C9D4]">—</span>}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.onHold ? <span className="font-semibold text-[#B45309]">{inr(r.onHold)}</span> : <span className="text-[#C4C9D4]">—</span>}</td>
                      <td className="px-3 py-2.5 text-[#6B7280] whitespace-nowrap">{fmt(r.paid.lastDate)}</td>
                      <td className="px-3 py-2.5 text-right"><span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#4361EE]">Open <ChevronRight className="w-3.5 h-3.5" /></span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : scheduled.length === 0 ? <p className="py-16 text-center text-[13px] text-[#9CA3AF]">No payouts waiting to be paid.</p> : (
          <div className="divide-y divide-[#F3F4F6]">
            {scheduled.map(item => {
              const overdue = new Date(item.date).getTime() < Date.now() - 86400000;
              const pv = preview[item.id];
              return (
                <div key={item.id} className="px-4 py-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <button onClick={() => onOpenSeller(item.seller.id)} className="font-semibold text-[#0C1220] hover:text-[#4361EE] text-[13px]">{item.seller.name}</button>
                      <p className="text-[11.5px] text-[#6B7280]">{item.orders} orders{item.rtoOrders ? ` · ${item.rtoOrders} RTO deducted` : ""}{item.note ? ` · ${item.note}` : ""}</p>
                    </div>
                    <span className={`text-[12px] whitespace-nowrap ${overdue ? "text-[#B91C1C] font-semibold" : "text-[#6B7280]"}`}>{overdue ? "Was due " : "Due "}{fmt(item.date)}</span>
                    <span className="w-[110px] text-right text-[15px] font-black tabular-nums text-[#0C1220]">{inr(item.net)}</span>
                    {paying !== item.id && <button onClick={() => openPay(item.seller.id, item)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-white bg-[#059669]"><BadgeCheck className="w-3.5 h-3.5" /> Mark paid</button>}
                  </div>
                  {paying === item.id && (
                    <div className="mt-2.5 space-y-2">
                      {pv && pv.hold > 0 && (
                        <p className="text-[12px] font-semibold text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2 flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> Plan due pending: transfer only {inr(pv.transfer)}. {inr(pv.hold)} will be held until the seller pays.
                        </p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <input id={`ref-${item.id}`} value={ref[item.id] ?? ""} onChange={e => setRef(x => ({ ...x, [item.id]: e.target.value }))} placeholder="Bank / UPI transaction ID"
                          className="flex-1 min-w-[200px] px-3 py-2 text-[13px] font-mono rounded-lg border border-[#E8EDF6] outline-none focus:border-[#059669]" />
                        <button onClick={() => markPaid(item)} disabled={busy === item.id} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold text-white bg-[#059669] disabled:opacity-50">
                          {busy === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />} Confirm paid
                        </button>
                        <button onClick={() => setPaying(null)} className="px-3 py-2 text-[12.5px] text-[#6B7280]">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <p className="text-[11px] text-[#9CA3AF]">&quot;Delivered, not remitted&quot; is an estimate: order value minus product, shipping and packing already on the order. The exact amount is set when you generate the remittance.</p>
    </div>
  );
}
