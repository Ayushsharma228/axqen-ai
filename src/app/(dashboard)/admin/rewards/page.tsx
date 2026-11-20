"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Trash2, Gift, CheckCircle2, Search, Save, Flag, Trophy } from "lucide-react";

interface Milestone { id?: string; orders: number | string; reward: string; note?: string }
interface Config { setup: { enabled: boolean; reward: string }; milestones: Milestone[]; countFrom: string | null; rto: { enabled: boolean; maxPct: number | string; days: number | string } }
interface Reached { id: string; label: string; reward: string; given: boolean; givenAt: string | null }
interface Row {
  id: string; name: string; email: string; phone: string | null; joined: string; delivered: number; deliveredAll: number; rtoPct: number | null; rtoOk: boolean;
  setupDone: boolean; stepsDone: number; stepsTotal: number; reached: Reached[]; pending: number;
  next: { orders: number; reward: string; left: number } | null;
}
type View = "pending" | "new" | "all";

const BLUE = "#1D5CFF";
const fmt = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });

export default function AdminRewardsPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [view, setView] = useState<View>("pending");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/rewards").then(r => r.json()).then(d => { if (d.config) { setConfig(d.config); setRows(d.sellers ?? []); } }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!config) return;
    setSaving(true); setMsg(null);
    const res = await fetch("/api/admin/rewards", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    setMsg(res.ok ? { ok: true, text: "Saved. Sellers see the new journey on their dashboard straight away." } : { ok: false, text: d.error ?? "Couldn't save" });
    if (res.ok) load();
  }
  async function markGiven(r: Row, m: Reached, given: boolean) {
    if (given && !confirm(`Mark "${m.reward}" as given to ${r.name}? They'll get a notification.`)) return;
    setBusy(`${r.id}:${m.id}`);
    await fetch("/api/admin/rewards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sellerId: r.id, milestoneId: m.id, given }) });
    setBusy(null); load();
  }

  const setMs = (i: number, patch: Partial<Milestone>) => setConfig(c => c && ({ ...c, milestones: c.milestones.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));
  const sortedPreview = useMemo(() => (config?.milestones ?? []).filter(m => Number(m.orders) > 0 && m.reward.trim()).sort((a, b) => Number(a.orders) - Number(b.orders)), [config]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows
      .filter(r => view === "all" || (view === "pending" ? r.pending > 0 : !r.setupDone))
      .filter(r => !s || r.name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s));
  }, [rows, view, q]);
  const counts = { pending: rows.filter(r => r.pending > 0).length, new: rows.filter(r => !r.setupDone).length, all: rows.length };
  const input = "w-full px-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#1D5CFF]";

  return (
    <div className="px-4 py-5 md:p-8 space-y-5" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div>
        <h1 className="text-[22px] font-black text-[#0C1220]">Rewards</h1>
        <p className="text-[12.5px] text-[#6B7280] mt-1">Set the milestones and what each one unlocks. Sellers see their journey on their dashboard; your team hands out the reward and marks it given here.</p>
      </div>

      {loading || !config ? <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-[#9CA3AF]"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div> : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 items-start">
            <section className="bg-white rounded-xl border border-[#E8EDF6] p-5 space-y-5">
              <div>
                <h2 className="text-[15px] font-bold text-[#0C1220]">Milestones</h2>
                <p className="text-[12px] text-[#9CA3AF] mt-0.5">Counted on each seller&apos;s delivered orders{config.countFrom ? ` placed since ${new Date(config.countFrom).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ", all time"}.</p>
              </div>

              <div className="rounded-xl border border-[#EEF1F8] p-4 space-y-3">
                <p className="text-[13px] font-semibold text-[#0C1220]">Counting rules</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="rw-from" className="block text-[11.5px] font-semibold text-[#374151] mb-1">Count delivered orders from</label>
                    <input id="rw-from" type="date" value={config.countFrom ?? ""} onChange={e => setConfig({ ...config, countFrom: e.target.value || null })} className={input} />
                    <p className="text-[11px] text-[#9CA3AF] mt-1">{config.countFrom ? "Only orders placed on or after this date count. Existing sellers start fresh." : "Empty = all orders ever. Existing sellers would unlock past milestones at once."}</p>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[11.5px] font-semibold text-[#374151] mb-1 cursor-pointer">
                      <input id="rw-rto" type="checkbox" checked={config.rto.enabled} onChange={e => setConfig({ ...config, rto: { ...config.rto, enabled: e.target.checked } })} className="accent-[#1D5CFF]" /> Only while RTO is under a limit
                    </label>
                    <div className="flex items-center gap-1.5 text-[12.5px] text-[#374151]">
                      <input id="rw-rto-max" aria-label="Maximum RTO %" inputMode="numeric" disabled={!config.rto.enabled} value={config.rto.maxPct} onChange={e => setConfig({ ...config, rto: { ...config.rto, maxPct: e.target.value.replace(/\D/g, "") } })} className={`${input} w-[64px] text-right`} />
                      <span>% in the last</span>
                      <input id="rw-rto-days" aria-label="Days" inputMode="numeric" disabled={!config.rto.enabled} value={config.rto.days} onChange={e => setConfig({ ...config, rto: { ...config.rto, days: e.target.value.replace(/\D/g, "") } })} className={`${input} w-[64px] text-right`} />
                      <span>days</span>
                    </div>
                    <p className="text-[11px] text-[#9CA3AF] mt-1">Sellers above the limit see &quot;keep RTO under {config.rto.maxPct || 30}% to claim&quot;. Needs 5+ completed orders to judge.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#EEF1F8] p-4 space-y-3 bg-[#FAFBFF]">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <span>
                    <span className="block text-[13px] font-semibold text-[#0C1220]">Setup reward for new sellers</span>
                    <span className="block text-[12px] text-[#6B7280]">Unlocked when a seller finishes setup: agreement, KYC, bank, Shopify, first listing, first order and first delivery.</span>
                  </span>
                  <input id="rw-setup" type="checkbox" checked={config.setup.enabled} onChange={e => setConfig({ ...config, setup: { ...config.setup, enabled: e.target.checked } })} className="w-5 h-5 accent-[#1D5CFF]" />
                </label>
                {config.setup.enabled && (
                  <input id="rw-setup-reward" value={config.setup.reward} onChange={e => setConfig({ ...config, setup: { ...config.setup, reward: e.target.value } })} placeholder="e.g. ₹500 ad credit" className={input} maxLength={120} />
                )}
              </div>

              <div className="space-y-2">
                {config.milestones.length === 0 && <p className="text-[12.5px] text-[#9CA3AF]">No milestones yet. Add the first one below.</p>}
                {config.milestones.map((m, i) => (
                  <div key={m.id ?? i} className="flex items-start gap-2">
                    <div className="w-[130px]">
                      <label htmlFor={`rw-o-${i}`} className="sr-only">Delivered orders</label>
                      <div className="flex items-center rounded-lg border border-[#E8EDF6] focus-within:border-[#1D5CFF] bg-white">
                        <input id={`rw-o-${i}`} inputMode="numeric" value={m.orders} onChange={e => setMs(i, { orders: e.target.value.replace(/\D/g, "") })} className="w-full px-3 py-2 text-[13px] text-right tabular-nums outline-none rounded-lg" />
                        <span className="pr-3 text-[11.5px] text-[#9CA3AF] whitespace-nowrap">orders</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <label htmlFor={`rw-r-${i}`} className="sr-only">Reward</label>
                      <input id={`rw-r-${i}`} value={m.reward} onChange={e => setMs(i, { reward: e.target.value })} placeholder="Reward, e.g. ₹1,000 ad credit" className={input} maxLength={120} />
                      <input id={`rw-n-${i}`} aria-label="Note for sellers (optional)" value={m.note ?? ""} onChange={e => setMs(i, { note: e.target.value })} placeholder="Note for sellers (optional), e.g. credited within 7 days" className={`${input} text-[12px]`} maxLength={200} />
                    </div>
                    <button onClick={() => setConfig({ ...config, milestones: config.milestones.filter((_, j) => j !== i) })} aria-label="Remove milestone" className="p-2 mt-0.5 rounded-lg text-[#9CA3AF] hover:bg-[#FEF2F2] hover:text-[#B91C1C]"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setConfig({ ...config, milestones: [...config.milestones, { orders: "", reward: "" }] })} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold border border-[#E8EDF6] text-[#374151] hover:border-[#BFD3FF]"><Plus className="w-3.5 h-3.5" /> Add milestone</button>
                <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12.5px] font-bold text-white disabled:opacity-60" style={{ background: BLUE }}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save milestones
                </button>
              </div>
              {msg && <p className="text-[12.5px] rounded-lg px-3 py-2" style={{ background: msg.ok ? "#ECFDF5" : "#FEF2F2", color: msg.ok ? "#047857" : "#B91C1C" }}>{msg.text}</p>}
            </section>

            <section className="bg-white rounded-xl border border-[#E8EDF6] p-5">
              <h2 className="text-[15px] font-bold text-[#0C1220]">How sellers see it</h2>
              <p className="text-[12px] text-[#9CA3AF] mt-0.5 mb-5">Preview of the journey on the seller dashboard.</p>
              {sortedPreview.length === 0 && !config.setup.enabled ? <p className="text-[12.5px] text-[#9CA3AF] py-8 text-center">Add a milestone to see the journey.</p> : (
                <ol className="relative ml-3 border-l-2 border-dashed border-[#D3DEF7] space-y-4">
                  {config.setup.enabled && (
                    <li className="ml-5">
                      <span className="absolute -left-[11px] w-5 h-5 rounded-full flex items-center justify-center text-white" style={{ background: BLUE }}><Flag className="w-3 h-3" /></span>
                      <p className="text-[13px] font-semibold text-[#0C1220]">Finish setup</p>
                      <p className="text-[12px] text-[#6B7280]">Unlocks <b className="text-[#0C1220]">{config.setup.reward || "your reward"}</b></p>
                    </li>
                  )}
                  {sortedPreview.map((m, i) => (
                    <li key={i} className="ml-5">
                      <span className="absolute -left-[11px] w-5 h-5 rounded-full flex items-center justify-center bg-white border-2" style={{ borderColor: BLUE, color: BLUE }}>
                        {i === sortedPreview.length - 1 ? <Trophy className="w-2.5 h-2.5" /> : <span className="w-1.5 h-1.5 rounded-full" style={{ background: BLUE }} />}
                      </span>
                      <p className="text-[13px] font-semibold text-[#0C1220]">{Number(m.orders).toLocaleString("en-IN")} delivered orders</p>
                      <p className="text-[12px] text-[#6B7280]">Unlocks <b className="text-[#0C1220]">{m.reward}</b>{m.note ? ` · ${m.note}` : ""}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <section className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
            <div className="flex items-center gap-2 flex-wrap px-4 py-3 bg-[#FAFBFF] border-b border-[#F3F4F6]">
              {([["pending", "Rewards to hand out"], ["new", "Still setting up"], ["all", "All sellers"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setView(k)} className={`px-3 py-1.5 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5 ${view === k ? "bg-[#E6EEFF] text-[#1D5CFF]" : "text-[#6B7280] hover:bg-[#F0F5FF]"}`}>
                  {l}<span className={`text-[10.5px] px-1.5 rounded-full tabular-nums ${k === "pending" && counts.pending ? "bg-[#FEF3C7] text-[#B45309]" : "bg-[#F3F4F6] text-[#6B7280]"}`}>{counts[k]}</span>
                </button>
              ))}
              <div className="relative ml-auto w-full sm:w-[240px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
                <input id="rw-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search sellers" className="pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#1D5CFF] w-full" />
              </div>
            </div>
            {list.length === 0 ? <p className="py-16 text-center text-[13px] text-[#9CA3AF]">{view === "pending" ? "No rewards waiting to be handed out." : "No sellers here."}</p> : (
              <div className="divide-y divide-[#F3F4F6]">
                {list.map(r => (
                  <div key={r.id} className="px-4 py-3.5 flex items-start gap-4 flex-wrap">
                    <div className="w-[220px] min-w-[180px]">
                      <Link href={`/admin/sellers/${r.id}`} className="block text-[13px] font-semibold text-[#0C1220] hover:text-[#1D5CFF] truncate">{r.name}</Link>
                      <p className="text-[11.5px] text-[#9CA3AF] truncate">{r.email} · joined {fmt(r.joined)}</p>
                    </div>
                    <div className="w-[170px]">
                      <p className="text-[12.5px] text-[#0C1220]"><b className="tabular-nums">{r.delivered.toLocaleString("en-IN")}</b> delivered{config.countFrom && r.deliveredAll !== r.delivered ? <span className="text-[11px] text-[#9CA3AF]"> ({r.deliveredAll} all time)</span> : null}</p>
                      {config.rto.enabled && r.rtoPct != null && <p className="text-[11.5px] font-semibold" style={{ color: r.rtoOk ? "#047857" : "#B91C1C" }}>RTO {r.rtoPct}%{r.rtoOk ? "" : " · not eligible"}</p>}
                      <p className="text-[11.5px] text-[#6B7280]">{r.setupDone ? (r.next ? `${r.next.left} to ${r.next.orders}` : "All milestones reached") : `Setup ${r.stepsDone}/${r.stepsTotal}`}</p>
                    </div>
                    <div className="flex-1 min-w-[240px] flex flex-wrap gap-2">
                      {r.reached.length === 0 && <span className="text-[12px] text-[#9CA3AF]">No rewards reached yet</span>}
                      {r.reached.map(m => {
                        const k = `${r.id}:${m.id}`;
                        return m.given ? (
                          <button key={m.id} onClick={() => { if (confirm(`Undo "given" for ${m.reward}?`)) markGiven(r, m, false); }} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] bg-[#ECFDF5] text-[#047857]" title={m.givenAt ? `Given ${fmt(m.givenAt)}` : undefined}>
                            <CheckCircle2 className="w-3.5 h-3.5" /> {m.reward}
                          </button>
                        ) : (
                          <button key={m.id} onClick={() => { if (!r.rtoOk && !confirm(`${r.name}'s RTO is ${r.rtoPct}%, above your limit. Give the reward anyway?`)) return; markGiven(r, m, true); }} disabled={busy === k} title={r.rtoOk ? undefined : "RTO above your limit"} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border disabled:opacity-50 ${r.rtoOk ? "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E] hover:border-[#F59E0B]" : "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]"}`}>
                            {busy === k ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />} {m.reward} · <span className="underline">Mark given</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
