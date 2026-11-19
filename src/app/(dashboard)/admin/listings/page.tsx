"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search, Package, ExternalLink, X, Play, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

type Status = "PENDING" | "IN_PROGRESS" | "LISTED" | "FAILED";
interface Listing {
  id: string; status: Status; platform: string; adminNote: string | null; listedUrl: string | null; createdAt: string; updatedAt: string;
  seller: { id: string; name: string | null; email: string };
  product: { id: string; name: string; sku: string | null; images: string[]; price: number };
}
interface Stats { total: number; pending: number; inProgress: number; listed: number; failed: number }

const TABS: { key: Status | "ALL"; label: string; stat: keyof Stats }[] = [
  { key: "PENDING", label: "Pending", stat: "pending" }, { key: "IN_PROGRESS", label: "In progress", stat: "inProgress" },
  { key: "LISTED", label: "Listed", stat: "listed" }, { key: "FAILED", label: "Failed", stat: "failed" }, { key: "ALL", label: "All", stat: "total" },
];
const PLATFORMS = ["ALL", "SHOPIFY", "AMAZON", "FLIPKART", "MEESHO", "EBAY", "ETSY", "WALMART"];
const TONE: Record<Status, [string, string, string]> = {
  PENDING: ["Pending", "#FEF3C7", "#B45309"], IN_PROGRESS: ["In progress", "#E0EAFF", "#3538CD"], LISTED: ["Listed", "#DCFCE7", "#047857"], FAILED: ["Failed", "#FEE2E2", "#B91C1C"],
};
const age = (s: string) => { const d = Math.floor((Date.now() - new Date(s).getTime()) / 86400000); return d <= 0 ? "today" : d === 1 ? "1 day ago" : `${d} days ago`; };
const cap = (s: string) => s[0] + s.slice(1).toLowerCase();

export default function ListingRequestsPage() {
  const [tab, setTab] = useState<Status | "ALL">("PENDING");
  const [platform, setPlatform] = useState("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Listing[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<{ l: Listing; status: Status; note: string; url: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ status: tab, platform, ...(search ? { search } : {}) });
    fetch(`/api/admin/listings?${p}`).then(r => r.json()).then(d => { setRows(d.listings ?? []); setStats(d.stats ?? null); }).finally(() => setLoading(false));
  }, [tab, platform, search]);
  useEffect(() => { load(); }, [load]);

  async function save(status: Status, note: string, url: string, l: Listing) {
    if (status === "FAILED" && !note.trim()) { setErr("Add the reason it failed. The seller sees it."); return; }
    setSaving(true); setErr("");
    const res = await fetch("/api/admin/listings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: l.id, status, adminNote: note.trim() || undefined, listedUrl: url.trim() || undefined }) });
    setSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error ?? "Couldn't save"); return; }
    setEdit(null); load();
  }

  const ctl = "px-2.5 py-2 text-[12.5px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] text-[#374151]";
  const btn = "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-bold";

  return (
    <div className="px-4 py-5 md:p-8 space-y-5" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-black text-[#0C1220]">Listing Requests</h1>
          <p className="text-[12.5px] text-[#6B7280] mt-1">Products sellers asked your team to list on their store or marketplace. Every update notifies the seller.</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold border border-[#E8EDF6] bg-white text-[#374151] hover:border-[#C7D2FE] disabled:opacity-60">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto bg-white rounded-xl border border-[#E8EDF6] p-1.5">
        {TABS.map(t => {
          const n = stats?.[t.stat] ?? 0, on = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1.5 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5 whitespace-nowrap ${on ? "bg-[#E8EDFF] text-[#4361EE]" : "text-[#6B7280] hover:bg-[#F3F6FF]"}`}>
              {t.label}
              <span className={`text-[10.5px] px-1.5 rounded-full tabular-nums ${t.key === "PENDING" && n ? "bg-[#FEF3C7] text-[#B45309]" : on ? "bg-white text-[#4361EE]" : "bg-[#F3F4F6] text-[#6B7280]"}`}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
        <div className="flex items-center gap-2 flex-wrap px-4 py-3 bg-[#FAFBFF] border-b border-[#F3F4F6]">
          <form className="relative flex-1 min-w-[200px] md:max-w-[300px]" onSubmit={e => { e.preventDefault(); setSearch(searchInput.trim()); }}>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
            <input id="lr-search" value={searchInput} onChange={e => { setSearchInput(e.target.value); if (!e.target.value) setSearch(""); }} placeholder="Seller or product"
              className="pl-8 pr-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] w-full" />
          </form>
          <select id="lr-platform" aria-label="Platform" value={platform} onChange={e => setPlatform(e.target.value)} className={ctl}>
            {PLATFORMS.map(p => <option key={p} value={p}>{p === "ALL" ? "All platforms" : cap(p)}</option>)}
          </select>
          <span className="text-[12px] text-[#9CA3AF] ml-auto">{rows.length} requests</span>
        </div>

        {loading && rows.length === 0 ? (
          <div className="py-20 flex items-center justify-center gap-2 text-[13px] text-[#9CA3AF]"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : rows.length === 0 ? (
          <p className="py-20 text-center text-[13px] text-[#9CA3AF]">{tab === "PENDING" ? "No pending requests. All caught up." : "Nothing here."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-[12.5px]">
              <thead>
                <tr className="bg-[#FAFBFF] text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                  <th className="px-4 py-2.5">Product</th><th className="px-3 py-2.5">Seller</th><th className="px-3 py-2.5">Platform</th>
                  <th className="px-3 py-2.5">Requested</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {rows.map(l => {
                  const t = TONE[l.status];
                  const waiting = l.status === "PENDING" || l.status === "IN_PROGRESS";
                  const days = Math.floor((Date.now() - new Date(l.createdAt).getTime()) / 86400000);
                  return (
                    <tr key={l.id} className="hover:bg-[#FAFBFF]">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-lg bg-[#F3F4F6] overflow-hidden flex-shrink-0">
                            {l.product.images?.[0] ? <img src={l.product.images[0]} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 m-3 text-[#D1D5DB]" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[#0C1220] truncate max-w-[260px]" title={l.product.name}>{l.product.name}</p>
                            <p className="text-[11px] text-[#9CA3AF] font-mono">{l.product.sku ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><Link href={`/admin/sellers/${l.seller.id}`} className="text-[#374151] hover:text-[#4361EE] font-medium">{l.seller.name || l.seller.email}</Link></td>
                      <td className="px-3 py-2.5 text-[#374151]">{cap(l.platform)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-[#374151]">{new Date(l.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                        <span className={`block text-[11px] ${waiting && days >= 3 ? "text-[#B91C1C] font-semibold" : "text-[#9CA3AF]"}`}>{age(l.createdAt)}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: t[1], color: t[2] }}>{t[0]}</span>
                        {l.listedUrl && <a href={l.listedUrl} target="_blank" rel="noreferrer" className="block text-[11px] text-[#4361EE] mt-0.5 inline-flex items-center gap-0.5">View listing <ExternalLink className="w-3 h-3" /></a>}
                        {l.adminNote && <p className="text-[11px] text-[#6B7280] mt-0.5 max-w-[220px] truncate" title={l.adminNote}>{l.adminNote}</p>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {l.status === "PENDING" && <button onClick={() => save("IN_PROGRESS", l.adminNote ?? "", l.listedUrl ?? "", l)} disabled={saving} className={`${btn} bg-[#E0EAFF] text-[#3538CD]`}><Play className="w-3 h-3" /> Start</button>}
                          {waiting && <button onClick={() => { setErr(""); setEdit({ l, status: "LISTED", note: l.adminNote ?? "", url: l.listedUrl ?? "" }); }} className={`${btn} bg-[#059669] text-white`}><CheckCircle2 className="w-3 h-3" /> Mark listed</button>}
                          {waiting && <button onClick={() => { setErr(""); setEdit({ l, status: "FAILED", note: "", url: "" }); }} className={`${btn} bg-[#FEE2E2] text-[#B91C1C]`}><XCircle className="w-3 h-3" /> Failed</button>}
                          {!waiting && <button onClick={() => { setErr(""); setEdit({ l, status: l.status, note: l.adminNote ?? "", url: l.listedUrl ?? "" }); }} className={`${btn} border border-[#E8EDF6] text-[#374151]`}>Update</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {edit && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[#F3F4F6] flex items-start justify-between">
              <div>
                <p className="text-[15px] font-bold text-[#0C1220]">{edit.status === "LISTED" ? "Mark as listed" : edit.status === "FAILED" ? "Mark as failed" : "Update listing"}</p>
                <p className="text-[12px] text-[#9CA3AF]">{edit.l.product.name} · {edit.l.seller.name || edit.l.seller.email} · {cap(edit.l.platform)}</p>
              </div>
              <button onClick={() => setEdit(null)} aria-label="Close" className="p-1 rounded-lg hover:bg-[#F3F4F6]"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              {err && <p className="text-[12.5px] text-[#B91C1C] bg-[#FEF2F2] rounded-lg px-3 py-2">{err}</p>}
              <label className="block text-[12px] font-semibold text-[#374151]">Status
                <select id="le-status" value={edit.status} onChange={e => setEdit({ ...edit, status: e.target.value as Status })} className="mt-1 w-full px-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] outline-none focus:border-[#4361EE]">
                  {(Object.keys(TONE) as Status[]).map(s => <option key={s} value={s}>{TONE[s][0]}</option>)}
                </select>
              </label>
              {edit.status === "LISTED" && (
                <label className="block text-[12px] font-semibold text-[#374151]">Listing link (optional)
                  <input id="le-url" value={edit.url} onChange={e => setEdit({ ...edit, url: e.target.value })} placeholder="https://…" className="mt-1 w-full px-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] outline-none focus:border-[#4361EE]" />
                </label>
              )}
              <label className="block text-[12px] font-semibold text-[#374151]">{edit.status === "FAILED" ? "Reason (the seller sees this) *" : "Note (optional)"}
                <textarea id="le-note" rows={3} value={edit.note} onChange={e => setEdit({ ...edit, note: e.target.value })} className="mt-1 w-full px-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] outline-none focus:border-[#4361EE] resize-none" />
              </label>
            </div>
            <div className="px-5 py-3 border-t border-[#F3F4F6] flex justify-end gap-2">
              <button onClick={() => setEdit(null)} className="px-4 py-2 rounded-lg text-[13px] text-[#374151] border border-[#E8EDF6]">Cancel</button>
              <button onClick={() => save(edit.status, edit.note, edit.url, edit.l)} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold text-white bg-[#4361EE] disabled:opacity-60">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save and notify seller
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
