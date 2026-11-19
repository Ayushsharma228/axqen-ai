"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Trash2, RefreshCw, Check, Search, AlertTriangle, ChevronUp, ChevronDown, ArrowUpDown } from "lucide-react";
import { AdRechargesPanel } from "@/components/admin/ad-recharges-panel";

interface Seller { id: string; name: string | null; email: string; brandName: string | null }
interface Entry { id: string; sellerId: string; date: string; amount: number; note: string | null; campaignId: string | null; campaignName: string | null; clicks: number | null; seller: Seller }
interface Row {
  id: string; name: string; email: string; connection: "CONNECTED" | "EXPIRING" | "EXPIRED" | "AXQEN_CAMPAIGNS" | "NONE";
  adAccountId: string | null; tokenExpiresAt: string | null; recharged: number; spent: number; clicks: number; impressions: number; balance: number;
  lastSpend: string | null; delivered: number; deliveredValue: number; costPerDelivered: number | null; roas: number | null;
}
interface Overview { sellers: Row[]; totals: { spent: number; recharged: number; balance: number; lowBalance: number; roas: number | null; costPerDelivered: number | null; tokenIssues: number } }
interface MetaCampaign { id: string; name: string; spend: number }
type Tab = "sellers" | "ledger" | "recharges" | "sync";
type SortKey = "name" | "spent" | "recharged" | "balance" | "roas" | "costPerDelivered";

const RANGES: { label: string; days: number | null }[] = [{ label: "7 days", days: 7 }, { label: "30 days", days: 30 }, { label: "90 days", days: 90 }, { label: "All time", days: null }];
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "—");
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); };
const CONN: Record<Row["connection"], [string, string, string]> = {
  CONNECTED: ["Own account", "#DCFCE7", "#047857"], EXPIRING: ["Expires soon", "#FEF3C7", "#B45309"], EXPIRED: ["Expired", "#FEE2E2", "#B91C1C"],
  AXQEN_CAMPAIGNS: ["AXQEN campaigns", "#E8EDFF", "#4361EE"], NONE: ["Manual", "#F3F4F6", "#6B7280"],
};

export default function AdminMetaAdsPage() {
  const [tab, setTab] = useState<Tab>("sellers");
  const [days, setDays] = useState<number | null>(30);
  const [ov, setOv] = useState<Overview | null>(null);
  const [ovLoading, setOvLoading] = useState(true);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "spent", dir: -1 });
  const [q, setQ] = useState("");
  const [syncingSeller, setSyncingSeller] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Ledger
  const [ledgerSeller, setLedgerSeller] = useState("");
  const [form, setForm] = useState({ sellerId: "", date: new Date().toISOString().slice(0, 10), amount: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Campaign sync (AXQEN ad account → sellers)
  const [syncFrom, setSyncFrom] = useState(yesterday());
  const [syncTo, setSyncTo] = useState(yesterday());
  const [fetching, setFetching] = useState(false);
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);

  const loadOverview = useCallback(() => {
    setOvLoading(true);
    fetch(`/api/admin/meta/overview${days ? `?days=${days}` : ""}`).then(r => r.json()).then(d => { if (d.sellers) setOv(d); }).finally(() => setOvLoading(false));
  }, [days]);
  useEffect(() => { loadOverview(); }, [loadOverview]);
  const loadEntries = () => fetch("/api/admin/ad-spend").then(r => r.json()).then(d => setEntries(d.entries ?? []));
  useEffect(() => {
    loadEntries();
    fetch("/api/admin/sellers").then(r => r.json()).then(d => { const s = d.sellers ?? []; setSellers(s); setForm(f => ({ ...f, sellerId: s[0]?.id ?? "" })); });
    fetch("/api/admin/meta/campaign-mappings").then(r => r.json()).then(d => setMappings(d.mappings ?? {}));
  }, []);

  async function syncSeller(r: Row) {
    setSyncingSeller(r.id); setMsg(null);
    const res = await fetch("/api/admin/meta/sync-seller", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sellerId: r.id }) });
    const d = await res.json().catch(() => ({}));
    setSyncingSeller(null);
    setMsg(res.ok ? { ok: true, text: `${r.name}: synced ${d.synced ?? 0} days of spend from their Meta account.` } : { ok: false, text: `${r.name}: ${d.error ?? "sync failed"}` });
    if (res.ok) { loadOverview(); loadEntries(); }
  }

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!form.sellerId || !(Number(form.amount) > 0)) { setMsg({ ok: false, text: "Pick a seller and enter an amount above zero" }); return; }
    setSaving(true); setMsg(null);
    const res = await fetch("/api/admin/ad-spend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? "Couldn't save" }); return; }
    setEntries(prev => [d.entry, ...prev]); setForm(f => ({ ...f, amount: "", note: "" }));
    setMsg({ ok: true, text: "Spend entry added." }); loadOverview();
  }
  async function deleteEntry(en: Entry) {
    if (!confirm(`Remove this ${inr(en.amount)} entry for ${en.seller.brandName || en.seller.name || en.seller.email}? Only do this for an entry added by mistake.`)) return;
    setDeleting(en.id);
    await fetch("/api/admin/ad-spend", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: en.id }) });
    setEntries(prev => prev.filter(x => x.id !== en.id)); setDeleting(null); loadOverview();
  }

  async function fetchCampaigns() {
    setFetching(true); setMsg(null); setCampaigns([]);
    const res = await fetch(`/api/admin/meta/insights?from=${syncFrom}&to=${syncTo}`);
    const d = await res.json().catch(() => ({}));
    setFetching(false);
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? "Couldn't fetch campaigns from Meta" }); return; }
    setCampaigns(d.campaigns ?? []);
  }
  async function importCampaigns() {
    const toImport = campaigns.filter(c => mappings[c.id] && c.spend > 0);
    if (!toImport.length) { setMsg({ ok: false, text: "Assign at least one campaign to a seller" }); return; }
    setImporting(true); setMsg(null);
    await fetch("/api/admin/meta/campaign-mappings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mappings }) });
    let saved = 0;
    for (const c of toImport) {
      const res = await fetch("/api/admin/ad-spend", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId: mappings[c.id], date: syncTo, amount: c.spend, note: `Meta: ${c.name} (${syncFrom} – ${syncTo})` }),
      });
      if (res.ok) saved++;
    }
    setImporting(false);
    setMsg({ ok: saved === toImport.length, text: `Imported ${saved} of ${toImport.length} campaigns into the ledger.` });
    loadEntries(); loadOverview();
  }

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = (ov?.sellers ?? []).filter(r => !s || r.name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s));
    const val = (r: Row): number | string => (sort.key === "name" ? r.name.toLowerCase() : r[sort.key] ?? -1e9);
    return [...list].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [ov, q, sort]);
  const ledger = useMemo(() => entries.filter(e => !ledgerSeller || e.sellerId === ledgerSeller).slice(0, 300), [entries, ledgerSeller]);
  const sellerName = (s: Seller) => s.brandName || s.name || s.email;

  const th = (label: string, k?: SortKey, right = true) => (
    <th className={`px-3 py-2.5 whitespace-nowrap ${right ? "text-right" : ""}`}>
      {k ? (
        <button onClick={() => setSort(s => (s.key === k ? { key: k, dir: s.dir === 1 ? -1 : 1 } : { key: k, dir: k === "name" ? 1 : -1 }))} className={`inline-flex items-center gap-1 hover:text-[#4361EE] ${sort.key === k ? "text-[#4361EE]" : ""}`}>
          {label}{sort.key === k ? (sort.dir === 1 ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
        </button>
      ) : label}
    </th>
  );
  const chip = (on: boolean) => `px-2.5 py-1 rounded-lg text-[12px] font-semibold ${on ? "bg-[#E8EDFF] text-[#4361EE]" : "text-[#6B7280] hover:bg-[#F3F6FF]"}`;
  const input = "w-full px-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE]";
  const label = "block text-[11.5px] font-semibold text-[#374151] mb-1";
  const t = ov?.totals;

  return (
    <div className="px-4 py-5 md:p-8 space-y-5" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-black text-[#0C1220]">Meta Ads</h1>
          <p className="text-[12.5px] text-[#6B7280] mt-1">Ad wallet recharges, spend per seller, what&apos;s left, and what the spend brought back in delivered orders.</p>
        </div>
        <div className="flex items-center gap-1 bg-white rounded-lg border border-[#E8EDF6] p-1">
          {ovLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9CA3AF] mx-1" />}
          {RANGES.map(r => <button key={r.label} onClick={() => setDays(r.days)} className={chip(days === r.days)}>{r.label}</button>)}
        </div>
      </div>

      {t && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { l: "Ad spend", v: inr(t.spent), s: days ? `Last ${days} days` : "All time", c: "#0C1220" },
            { l: "Recharges received", v: inr(t.recharged), s: days ? `Last ${days} days` : "All time", c: "#047857" },
            { l: "Ad wallet balance", v: inr(t.balance), s: t.lowBalance ? `${t.lowBalance} seller${t.lowBalance > 1 ? "s" : ""} in minus` : "Recharges − spend, all time", c: t.balance < 0 ? "#B91C1C" : "#0C1220" },
            { l: "ROAS", v: t.roas != null ? `${t.roas}×` : "—", s: "Delivered value ÷ spend", c: t.roas != null && t.roas < 2 ? "#B45309" : "#0C1220" },
            { l: "Cost per delivered order", v: t.costPerDelivered != null ? inr(t.costPerDelivered) : "—", s: t.tokenIssues ? `${t.tokenIssues} Meta connection${t.tokenIssues > 1 ? "s" : ""} need attention` : "Spend ÷ delivered orders", c: t.tokenIssues ? "#B45309" : "#0C1220" },
          ].map(x => (
            <div key={x.l} className="bg-white rounded-xl border border-[#E8EDF6] p-4">
              <p className="text-[11.5px] font-semibold text-[#6B7280]">{x.l}</p>
              <p className="text-[22px] font-black leading-tight tabular-nums mt-1" style={{ color: x.c }}>{x.v}</p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">{x.s}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 overflow-x-auto bg-white rounded-xl border border-[#E8EDF6] p-1.5">
        {([["sellers", "Sellers"], ["ledger", `Spend ledger (${entries.length})`], ["recharges", "Recharges"], ["sync", "Import from AXQEN ad account"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-lg text-[12.5px] font-semibold whitespace-nowrap ${tab === k ? "bg-[#E8EDFF] text-[#4361EE]" : "text-[#6B7280] hover:bg-[#F3F6FF]"}`}>{l}</button>
        ))}
      </div>

      {msg && <div className="px-4 py-2.5 rounded-xl text-[13px]" style={{ background: msg.ok ? "#ECFDF5" : "#FEF2F2", color: msg.ok ? "#047857" : "#B91C1C" }}>{msg.text}</div>}

      {tab === "sellers" && (
        <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-[#FAFBFF] border-b border-[#F3F4F6]">
            <div className="relative flex-1 min-w-[200px] md:max-w-[300px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
              <input id="ma-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search sellers" className="pl-8 pr-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] w-full" />
            </div>
            <span className="text-[12px] text-[#9CA3AF] ml-auto">{rows.length} sellers running ads</span>
          </div>
          {!ov ? <div className="py-20 flex items-center justify-center gap-2 text-[13px] text-[#9CA3AF]"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
            : rows.length === 0 ? <p className="py-20 text-center text-[13px] text-[#9CA3AF]">No ad spend or recharges yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1060px] text-[12.5px]">
                <thead><tr className="bg-[#FAFBFF] text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                  {th("Seller", "name", false)}{th("Spend from", undefined, false)}{th("Recharged", "recharged")}{th("Spent", "spent")}{th("Balance", "balance")}
                  {th("Delivered", undefined)}{th("Cost / delivered", "costPerDelivered")}{th("ROAS", "roas")}{th("Last spend", undefined, false)}{th("", undefined)}
                </tr></thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {rows.map(r => {
                    const c = CONN[r.connection];
                    return (
                      <tr key={r.id} className="hover:bg-[#FAFBFF]">
                        <td className="px-3 py-2.5"><Link href={`/admin/sellers/${r.id}`} className="block font-semibold text-[#0C1220] hover:text-[#4361EE]">{r.name}</Link><span className="block text-[11px] text-[#9CA3AF]">{r.email}</span></td>
                        <td className="px-3 py-2.5">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap" style={{ background: c[1], color: c[2] }}>{c[0]}</span>
                          {r.adAccountId && <span className="block text-[10.5px] text-[#9CA3AF] font-mono mt-0.5">{r.adAccountId}</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[#047857]">{r.recharged ? inr(r.recharged) : "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[#0C1220]">{r.spent ? inr(r.spent) : "—"}{r.clicks > 0 && <span className="block text-[10.5px] font-normal text-[#9CA3AF]">{r.clicks.toLocaleString("en-IN")} clicks</span>}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-bold" style={{ color: r.balance < 0 ? "#B91C1C" : r.balance < 1000 ? "#B45309" : "#0C1220" }}>{inr(r.balance)}{r.balance < 0 && <span className="block text-[10.5px] font-semibold">needs recharge</span>}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.delivered}<span className="block text-[10.5px] text-[#9CA3AF]">{inr(r.deliveredValue)}</span></td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.costPerDelivered != null ? inr(r.costPerDelivered) : "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: r.roas == null ? "#9CA3AF" : r.roas < 2 ? "#B91C1C" : r.roas < 3 ? "#B45309" : "#047857" }}>{r.roas != null ? `${r.roas}×` : "—"}</td>
                        <td className="px-3 py-2.5 text-[#6B7280] whitespace-nowrap">{fmt(r.lastSpend)}</td>
                        <td className="px-3 py-2.5 text-right">
                          {(r.connection === "CONNECTED" || r.connection === "EXPIRING") ? (
                            <button onClick={() => syncSeller(r)} disabled={syncingSeller !== null} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-bold bg-[#E8EDFF] text-[#4361EE] disabled:opacity-40">
                              <RefreshCw className={`w-3 h-3 ${syncingSeller === r.id ? "animate-spin" : ""}`} /> Sync
                            </button>
                          ) : r.connection === "EXPIRED" ? <span className="text-[11px] text-[#B91C1C] inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Seller must reconnect</span> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="px-4 py-3 text-[11px] text-[#9CA3AF] border-t border-[#F3F4F6]">Delivered orders are by order date in the selected period and include orders from every channel, so ROAS is a guide, not exact attribution. Per-campaign results are on each seller&apos;s Ad Spend page.</p>
        </div>
      )}

      {tab === "ledger" && (
        <div className="space-y-5">
          <form onSubmit={addEntry} className="bg-white rounded-xl border border-[#E8EDF6] p-5 space-y-3">
            <p className="text-[14px] font-bold text-[#0C1220]">Add spend manually</p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div><label htmlFor="sp-seller" className={label}>Seller</label>
                <select id="sp-seller" value={form.sellerId} onChange={e => setForm(f => ({ ...f, sellerId: e.target.value }))} className={input}>{sellers.map(s => <option key={s.id} value={s.id}>{sellerName(s)}</option>)}</select>
              </div>
              <div><label htmlFor="sp-date" className={label}>Date</label><input id="sp-date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={input} /></div>
              <div><label htmlFor="sp-amt" className={label}>Amount ₹</label><input id="sp-amt" inputMode="decimal" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={input} /></div>
              <div><label htmlFor="sp-note" className={label}>Note</label><input id="sp-note" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="e.g. Diwali campaign" className={input} /></div>
            </div>
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold text-white bg-[#4361EE] disabled:opacity-60">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add entry</button>
          </form>
          <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-[#FAFBFF] border-b border-[#F3F4F6]">
              <select id="lg-seller" aria-label="Seller" value={ledgerSeller} onChange={e => setLedgerSeller(e.target.value)} className="px-2.5 py-2 text-[12.5px] rounded-lg border border-[#E8EDF6] bg-white outline-none max-w-[240px]">
                <option value="">All sellers</option>{sellers.map(s => <option key={s.id} value={s.id}>{sellerName(s)}</option>)}
              </select>
              <span className="text-[12px] text-[#9CA3AF] ml-auto">Showing {ledger.length}{entries.length > ledger.length ? " (latest 300)" : ""}</span>
            </div>
            {ledger.length === 0 ? <p className="py-16 text-center text-[13px] text-[#9CA3AF]">No spend entries.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-[12.5px]">
                  <thead><tr className="bg-[#FAFBFF] text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                    <th className="px-4 py-2.5">Date</th><th className="px-3 py-2.5">Seller</th><th className="px-3 py-2.5">Campaign / note</th><th className="px-3 py-2.5">Source</th><th className="px-3 py-2.5 text-right">Amount</th><th className="px-3 py-2.5"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {ledger.map(en => (
                      <tr key={en.id}>
                        <td className="px-4 py-2.5 text-[#374151] whitespace-nowrap">{fmt(en.date)}</td>
                        <td className="px-3 py-2.5 text-[#0C1220] font-medium">{sellerName(en.seller)}</td>
                        <td className="px-3 py-2.5 text-[#4B5563] max-w-[320px] truncate" title={en.campaignName ?? en.note ?? ""}>{en.campaignName ?? en.note ?? "—"}</td>
                        <td className="px-3 py-2.5 text-[11.5px]">{en.campaignId ? <span className="text-[#047857] font-semibold">Synced from Meta</span> : en.note?.startsWith("Meta:") ? <span className="text-[#4361EE] font-semibold">Imported</span> : <span className="text-[#6B7280]">Manual</span>}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{inr(en.amount)}</td>
                        <td className="px-3 py-2.5 text-right">
                          {!en.campaignId && (
                            <button onClick={() => deleteEntry(en)} disabled={deleting === en.id} aria-label="Remove entry" title="Remove an entry added by mistake" className="p-1.5 rounded-lg text-[#C4C9D4] hover:bg-[#FEF2F2] hover:text-[#B91C1C] disabled:opacity-50">
                              {deleting === en.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "recharges" && <AdRechargesPanel sellers={sellers} />}

      {tab === "sync" && (
        <div className="bg-white rounded-xl border border-[#E8EDF6] p-5 space-y-4">
          <div>
            <p className="text-[14px] font-bold text-[#0C1220]">Import spend from AXQEN&apos;s Meta ad account</p>
            <p className="text-[12px] text-[#6B7280]">For campaigns your team runs for sellers. Fetch campaign spend for a date range, assign each campaign to a seller once (remembered), and import it into the ledger.</p>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <div><label htmlFor="cs-from" className={label}>From</label><input id="cs-from" type="date" value={syncFrom} onChange={e => setSyncFrom(e.target.value)} className={input} /></div>
            <div><label htmlFor="cs-to" className={label}>To</label><input id="cs-to" type="date" value={syncTo} onChange={e => setSyncTo(e.target.value)} className={input} /></div>
            <button onClick={fetchCampaigns} disabled={fetching} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold text-white bg-[#4361EE] disabled:opacity-60">
              {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Fetch campaigns
            </button>
          </div>
          {campaigns.length > 0 && (
            <>
              <div className="border border-[#E8EDF6] rounded-xl overflow-x-auto">
                <table className="w-full min-w-[560px] text-[12.5px]">
                  <thead><tr className="bg-[#FAFBFF] text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                    <th className="px-4 py-2.5">Campaign</th><th className="px-3 py-2.5 text-right">Spend</th><th className="px-3 py-2.5">Seller</th>
                  </tr></thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {campaigns.map(c => (
                      <tr key={c.id}>
                        <td className="px-4 py-2.5 text-[#0C1220] max-w-[360px] truncate" title={c.name}>{c.name}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{inr(c.spend)}</td>
                        <td className="px-3 py-2.5">
                          <select id={`map-${c.id}`} aria-label={`Seller for ${c.name}`} value={mappings[c.id] ?? ""} onChange={e => setMappings(p => ({ ...p, [c.id]: e.target.value }))} className="w-full px-2 py-1.5 text-[12.5px] rounded-lg border border-[#E8EDF6] outline-none focus:border-[#4361EE]">
                            <option value="">Skip</option>{sellers.map(s => <option key={s.id} value={s.id}>{sellerName(s)}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={importCampaigns} disabled={importing || campaigns.every(c => !mappings[c.id])} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold text-white bg-[#059669] disabled:opacity-50">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Import to ledger
              </button>
              <p className="text-[11.5px] text-[#9CA3AF]">Each campaign is imported as one entry dated {syncTo}. Don&apos;t import the same date range twice.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
