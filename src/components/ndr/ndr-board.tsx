"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw, Search, AlertTriangle, RotateCcw, PackageCheck, PackageX, Flame, Percent } from "lucide-react";
import { NdrCard, type NdrCardData, type NdrActionPayload } from "@/components/ndr/ndr-card";

type Tab = "ACTION_NEEDED" | "REATTEMPT" | "DELIVERED" | "RTO" | "ALL";
const TABS: { key: Tab; label: string }[] = [
  { key: "ACTION_NEEDED", label: "Action needed" },
  { key: "REATTEMPT",     label: "Re-attempt requested" },
  { key: "DELIVERED",     label: "Delivered (saved)" },
  { key: "RTO",           label: "Went RTO" },
  { key: "ALL",           label: "All" },
];
const RANGES = [{ k: "7", l: "7d" }, { k: "30", l: "30d" }, { k: "90", l: "90d" }, { k: "all", l: "All" }];

/** NDR board shared by the admin (takes action) and seller (read-only + escalate) pages. */
export function NdrBoard({ mode }: { mode: "admin" | "seller" }) {
  const [tab, setTab] = useState<Tab>("ACTION_NEEDED");
  const [range, setRange] = useState("30");
  const [sellerId, setSellerId] = useState("");
  const [sellers, setSellers] = useState<{ id: string; name: string | null; brandName: string | null; email: string }[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<NdrCardData[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [saveRate, setSaveRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const p = new URLSearchParams({ tab });
    if (range !== "all") p.set("days", range);
    if (mode === "admin") {
      if (sellerId) p.set("sellerId", sellerId);
      if (search) p.set("search", search);
    }
    const res = await fetch(`${mode === "admin" ? "/api/admin/ndr/list" : "/api/seller/ndr/overview"}?${p}`);
    const d = await res.json();
    setRows(d.ndrs ?? []);
    setCounts(d.counts ?? {});
    setSaveRate(d.saveRate ?? null);
    setLoading(false);
  }, [mode, tab, range, sellerId, search]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useEffect(() => {
    if (mode !== "admin") return;
    fetch("/api/admin/sellers").then(r => r.json()).then(d => setSellers(d.sellers ?? [])).catch(() => {});
  }, [mode]);

  async function onAction(p: NdrActionPayload) {
    const res = await fetch("/api/admin/ndr/action", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return d.error ?? "Couldn't send the action";
    setTimeout(load, 1200);
    return null;
  }

  async function onEscalate(orderId: string, note: string) {
    const res = await fetch("/api/seller/ndr/escalate", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, note }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return d.error ?? "Couldn't escalate";
    setTimeout(load, 1200);
    return null;
  }

  const tiles = [
    { key: "ACTION_NEEDED" as Tab, label: "Action needed",     value: counts.ACTION_NEEDED ?? 0, color: "#DC2626", icon: AlertTriangle },
    { key: null,                   label: "Open 24h+",         value: counts.OVERDUE ?? 0,       color: "#B91C1C", icon: Flame },
    { key: "REATTEMPT" as Tab,     label: "Re-attempt sent",   value: counts.REATTEMPT ?? 0,     color: "#2563EB", icon: RotateCcw },
    { key: "DELIVERED" as Tab,     label: "Delivered (saved)", value: counts.DELIVERED ?? 0,     color: "#047857", icon: PackageCheck },
    { key: "RTO" as Tab,           label: "Went RTO",          value: counts.RTO ?? 0,           color: "#B45309", icon: PackageX },
    { key: null,                   label: "NDR save rate",     value: saveRate != null ? `${saveRate}%` : "—", color: "#4361EE", icon: Percent },
  ];

  return (
    <div className="px-3 py-4 md:p-8 space-y-5" style={{ background: "#F7F8FC", minHeight: "100vh" }}>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-black text-[#0C1220]">{mode === "admin" ? "NDR Management" : "NDR"}</h1>
          <p className="text-[12.5px] text-[#6B7280] mt-1 max-w-[70ch]">
            {mode === "admin"
              ? "Failed deliveries across all sellers. Call the customer, then send a re-attempt or return. Actions go straight to Shipdaak or Delhivery."
              : "Failed delivery attempts on your orders. The AXQEN team calls the customer and arranges a re-attempt or return. If nothing happens in 24 hours, you can escalate."}
          </p>
        </div>
        <button onClick={() => { setLoading(true); load(); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-white border border-[#E8EDF6] text-[#6B7280] hover:text-[#0C1220]">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.map(t => {
          const Icon = t.icon;
          const active = t.key && tab === t.key;
          return (
            <button key={t.label} type="button" disabled={!t.key} onClick={() => t.key && setTab(t.key)}
              className="text-left bg-white rounded-xl border px-4 py-3.5 disabled:cursor-default"
              style={{ borderColor: active ? t.color : "#E8EDF6", boxShadow: active ? `inset 0 0 0 1px ${t.color}` : "none" }}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{t.label}</p>
                <Icon className="w-3.5 h-3.5" style={{ color: t.color }} />
              </div>
              <p className="text-[22px] font-black leading-none tabular-nums" style={{ color: t.label === "Open 24h+" && Number(t.value) > 0 ? "#DC2626" : "#0C1220" }}>
                {loading ? "…" : typeof t.value === "number" ? t.value.toLocaleString("en-IN") : t.value}
              </p>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
        <div className="flex items-center border-b border-[#F3F4F6] overflow-x-auto px-2" style={{ scrollbarWidth: "none" }}>
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="px-3 md:px-4 py-3 text-[12.5px] md:text-[13px] font-semibold whitespace-nowrap flex-shrink-0 border-b-2 -mb-px"
                style={{ borderColor: active ? "#4361EE" : "transparent", color: active ? "#4361EE" : "#6B7280" }}>
                {t.label}
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10.5px] font-bold tabular-nums"
                  style={{ background: active ? "#4361EE" : "#F3F4F6", color: active ? "white" : "#9CA3AF" }}>
                  {(counts[t.key] ?? 0).toLocaleString("en-IN")}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 flex-wrap px-3 md:px-4 py-3 bg-[#FAFBFF]">
          <div className="flex items-center bg-white border border-[#E8EDF6] rounded-lg p-0.5">
            {RANGES.map(r => (
              <button key={r.k} onClick={() => setRange(r.k)} className="px-2.5 py-1 text-[12px] font-semibold rounded-md"
                style={{ background: range === r.k ? "#4361EE" : "transparent", color: range === r.k ? "white" : "#6B7280" }}>{r.l}</button>
            ))}
          </div>
          {mode === "admin" && (
            <>
              <select id="ndr-seller" aria-label="Seller" value={sellerId} onChange={e => setSellerId(e.target.value)}
                className="bg-white border border-[#E8EDF6] rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-[#374151] max-w-[220px] focus:outline-none focus:border-[#4361EE]">
                <option value="">All sellers</option>
                {sellers.map(s => <option key={s.id} value={s.id}>{s.brandName || s.name || s.email}</option>)}
              </select>
              <form className="relative flex-1 min-w-[200px] md:max-w-[280px] md:ml-auto" onSubmit={e => { e.preventDefault(); setSearch(searchInput.trim()); }}>
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
                <input id="ndr-search" value={searchInput} onChange={e => { setSearchInput(e.target.value); if (!e.target.value) setSearch(""); }}
                  placeholder="Order ID, AWB, name or phone"
                  className="pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] w-full" />
              </form>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[#9CA3AF]">
          <Loader2 className="w-5 h-5 animate-spin text-[#4361EE]" /> Loading NDRs…
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E8EDF6] py-16 text-center">
          <PackageCheck className="w-10 h-10 mx-auto text-[#D1FAE5]" />
          <p className="text-[13px] font-semibold text-[#6B7280] mt-2">{tab === "ACTION_NEEDED" ? "No failed deliveries waiting" : "Nothing here for this period"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(n => (
            <NdrCard key={`${n.id}:${n.actions.length}:${n.escalations.length}`} n={n} mode={mode}
              onAction={mode === "admin" ? onAction : undefined}
              onEscalate={mode === "seller" ? onEscalate : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
