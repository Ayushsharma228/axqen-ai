"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Loader2, RefreshCw, Search, Truck, Warehouse, PackageCheck, PackageX, AlertTriangle, Percent, IndianRupee,
  ChevronDown, ChevronUp, MapPin, CheckCircle2, ShieldAlert,
} from "lucide-react";

type Stage = "IN_TRANSIT" | "BACK_AT_WAREHOUSE" | "RECEIVED" | "DAMAGED" | "MISSING";
type Tab = "IN_TRANSIT" | "BACK_AT_WAREHOUSE" | "RECEIVED" | "DAMAGED_LOST" | "OVERDUE" | "ALL";
interface Scan { status: string; location: string; message: string; time: string }
interface Rto {
  id: string; externalOrderId: string; stage: Stage;
  paymentMode: string; totalAmount: number; rtoCharge: number | null;
  customerName: string | null; city: string | null; state: string | null; pincode: string | null;
  products: string; courier: string; awb: string | null; returnAwb: string | null; reason: string;
  startedAt: string; daysInReturn: number; overdue: boolean;
  lastScan: Scan | null; returnScans: Scan[];
  received: { time: string; condition: "GOOD" | "DAMAGED" | "MISSING"; note: string | null; by: string } | null;
  claim: { time: string; status: "RAISED" | "SETTLED" | "REJECTED"; amount: number | null; note: string | null } | null;
  seller?: { id: string; name: string | null; brandName: string | null } | null;
}
interface Insight { label: string; rto: number; total: number; pct: number }
interface Insights { byState: Insight[]; byPincode: Insight[]; byProduct: Insight[]; byCourier: Insight[]; byReason: { label: string; count: number }[] }

const STAGE: Record<Stage, { label: string; color: string; bg: string }> = {
  IN_TRANSIT:        { label: "Return in transit",  color: "#B45309", bg: "#FFFBEB" },
  BACK_AT_WAREHOUSE: { label: "Back at warehouse",  color: "#2563EB", bg: "#EFF6FF" },
  RECEIVED:          { label: "Received · good",    color: "#047857", bg: "#ECFDF5" },
  DAMAGED:           { label: "Received · damaged", color: "#DC2626", bg: "#FEF2F2" },
  MISSING:           { label: "Missing",            color: "#7F1D1D", bg: "#FEE2E2" },
};
const RANGES = [{ k: "30", l: "30d" }, { k: "90", l: "90d" }, { k: "180", l: "6m" }, { k: "all", l: "All" }];

const fmt = (d: string) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const fmtD = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const pretty = (s: string) => { const t = (s || "").replace(/[_-]+/g, " ").trim(); return t ? t[0].toUpperCase() + t.slice(1).toLowerCase() : "Update"; };

export function RtoBoard({ mode }: { mode: "admin" | "seller" }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: "IN_TRANSIT", label: "Return in transit" },
    { key: "BACK_AT_WAREHOUSE", label: mode === "admin" ? "Back · to check" : "Back at warehouse" },
    { key: "RECEIVED", label: "Received" },
    { key: "DAMAGED_LOST", label: "Damaged / missing" },
    { key: "OVERDUE", label: `Overdue 15d+` },
    { key: "ALL", label: "All" },
  ];
  const [tab, setTab] = useState<Tab>(mode === "admin" ? "BACK_AT_WAREHOUSE" : "IN_TRANSIT");
  const [range, setRange] = useState("90");
  const [sellerId, setSellerId] = useState("");
  const [sellers, setSellers] = useState<{ id: string; name: string | null; brandName: string | null; email: string }[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Rto[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [rtoRate, setRtoRate] = useState<number | null>(null);
  const [charges, setCharges] = useState(0);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const p = new URLSearchParams({ tab });
    if (range !== "all") p.set("days", range);
    if (search) p.set("search", search);
    if (mode === "admin" && sellerId) p.set("sellerId", sellerId);
    const d = await fetch(`${mode === "admin" ? "/api/admin/rto" : "/api/seller/rto"}?${p}`).then(r => r.json());
    setRows(d.rtos ?? []);
    setCounts(d.counts ?? {});
    setRtoRate(d.rtoRate ?? null);
    setCharges(d.rtoCharges ?? 0);
    setInsights(d.insights ?? null);
    setLoading(false);
  }, [mode, tab, range, search, sellerId]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useEffect(() => {
    if (mode !== "admin") return;
    fetch("/api/admin/sellers").then(r => r.json()).then(d => setSellers(d.sellers ?? [])).catch(() => {});
  }, [mode]);

  const tiles = [
    { tab: "IN_TRANSIT" as Tab,        label: "Return in transit", value: String(counts.IN_TRANSIT ?? 0),        color: "#B45309", icon: Truck },
    { tab: "BACK_AT_WAREHOUSE" as Tab, label: "Back at warehouse", value: String(counts.BACK_AT_WAREHOUSE ?? 0), color: "#2563EB", icon: Warehouse },
    { tab: "RECEIVED" as Tab,          label: "Received",          value: String(counts.RECEIVED ?? 0),          color: "#047857", icon: PackageCheck },
    { tab: "DAMAGED_LOST" as Tab,      label: "Damaged / missing", value: String(counts.DAMAGED_LOST ?? 0),      color: "#DC2626", icon: PackageX },
    { tab: null,                       label: "RTO rate",          value: rtoRate != null ? `${rtoRate}%` : "—", color: "#4361EE", icon: Percent },
    { tab: null,                       label: "RTO charges",       value: inr(charges),                          color: "#7C3AED", icon: IndianRupee },
  ];

  return (
    <div className="px-3 py-4 md:p-8 space-y-5" style={{ background: "#F7F8FC", minHeight: "100vh" }}>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-black text-[#0C1220]">{mode === "admin" ? "RTO Returns" : "RTO"}</h1>
          <p className="text-[12.5px] text-[#6B7280] mt-1 max-w-[70ch]">
            {mode === "admin"
              ? "Every return on its way back. Mark parcels received with their condition, and track courier claims for damaged or missing ones."
              : "Orders coming back to the warehouse, every return scan, the condition they arrived in, and where your RTOs come from."}
          </p>
        </div>
        <button onClick={() => { setLoading(true); load(); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-white border border-[#E8EDF6] text-[#6B7280] hover:text-[#0C1220]">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.map(t => {
          const Icon = t.icon;
          const active = t.tab && tab === t.tab;
          return (
            <button key={t.label} type="button" disabled={!t.tab} onClick={() => t.tab && setTab(t.tab)}
              className="text-left bg-white rounded-xl border px-4 py-3.5 disabled:cursor-default"
              style={{ borderColor: active ? t.color : "#E8EDF6", boxShadow: active ? `inset 0 0 0 1px ${t.color}` : "none" }}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{t.label}</p>
                <Icon className="w-3.5 h-3.5" style={{ color: t.color }} />
              </div>
              <p className="text-[22px] font-black leading-none tabular-nums text-[#0C1220]">{loading ? "…" : t.value}</p>
            </button>
          );
        })}
      </div>

      {(counts.OVERDUE ?? 0) > 0 && (
        <button onClick={() => setTab("OVERDUE")}
          className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-left text-[13px] bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B]">
          <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
          <b>{counts.OVERDUE}</b> return{counts.OVERDUE > 1 ? "s have" : " has"} been in transit for 15+ days. They may be lost; check with the courier.
        </button>
      )}

      {/* List */}
      <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
        <div className="flex items-center border-b border-[#F3F4F6] overflow-x-auto px-2" style={{ scrollbarWidth: "none" }}>
          {tabs.map(t => {
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
        <div className="flex items-center gap-2 flex-wrap px-3 md:px-4 py-3 bg-[#FAFBFF] border-b border-[#F3F4F6]">
          <div className="flex items-center bg-white border border-[#E8EDF6] rounded-lg p-0.5">
            {RANGES.map(r => (
              <button key={r.k} onClick={() => setRange(r.k)} className="px-2.5 py-1 text-[12px] font-semibold rounded-md"
                style={{ background: range === r.k ? "#4361EE" : "transparent", color: range === r.k ? "white" : "#6B7280" }}>{r.l}</button>
            ))}
          </div>
          {mode === "admin" && (
            <select id="rto-seller" aria-label="Seller" value={sellerId} onChange={e => setSellerId(e.target.value)}
              className="bg-white border border-[#E8EDF6] rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-[#374151] max-w-[220px] focus:outline-none focus:border-[#4361EE]">
              <option value="">All sellers</option>
              {sellers.map(s => <option key={s.id} value={s.id}>{s.brandName || s.name || s.email}</option>)}
            </select>
          )}
          <form className="relative flex-1 min-w-[200px] md:max-w-[280px] md:ml-auto" onSubmit={e => { e.preventDefault(); setSearch(searchInput.trim()); }}>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
            <input id="rto-search" value={searchInput} onChange={e => { setSearchInput(e.target.value); if (!e.target.value) setSearch(""); }}
              placeholder="Order ID, AWB or name"
              className="pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] w-full" />
          </form>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[#9CA3AF]">
            <Loader2 className="w-5 h-5 animate-spin text-[#4361EE]" /> Loading returns…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-[13px] text-[#9CA3AF]">No returns here for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-[#FAFBFF] border-b border-[#F3F4F6] text-left text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                  <th className="px-4 py-3">Order</th>
                  <th className="px-3 py-3">Customer &amp; product</th>
                  <th className="px-3 py-3">Why it came back</th>
                  <th className="px-3 py-3">Return status</th>
                  <th className="px-3 py-3">Days</th>
                  <th className="px-3 py-3">RTO charge</th>
                  <th className="px-3 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const st = STAGE[r.stage];
                  const isOpen = open === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr onClick={() => setOpen(isOpen ? null : r.id)} className="align-top cursor-pointer hover:bg-[#FAFBFF]"
                        style={{ borderBottom: isOpen ? "none" : "1px solid #F3F4F6" }}>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {mode === "seller"
                            ? <Link href={`/seller/orders/${r.id}`} onClick={e => e.stopPropagation()} className="text-[13px] font-bold text-[#4361EE] hover:underline">{r.externalOrderId.startsWith("#") ? r.externalOrderId : `#${r.externalOrderId}`}</Link>
                            : <span className="text-[13px] font-bold text-[#0C1220]">{r.externalOrderId.startsWith("#") ? r.externalOrderId : `#${r.externalOrderId}`}</span>}
                          <p className="text-[11px] text-[#9CA3AF] mt-0.5">{r.courier}{r.awb ? ` · ${r.awb}` : ""}</p>
                          {r.returnAwb && <p className="text-[11px] text-[#6B7280]">Return AWB {r.returnAwb}</p>}
                          {mode === "admin" && r.seller && <p className="text-[11px] text-[#6B7280]">{r.seller.brandName || r.seller.name}</p>}
                        </td>
                        <td className="px-3 py-3.5 max-w-[220px]">
                          <p className="text-[13px] font-semibold text-[#0C1220] truncate">{r.customerName ?? "—"}</p>
                          <p className="text-[11px] text-[#9CA3AF] truncate">{[r.city, r.state, r.pincode].filter(Boolean).join(", ")}</p>
                          <p className="text-[11.5px] text-[#6B7280] truncate mt-0.5">{r.products}</p>
                        </td>
                        <td className="px-3 py-3.5 max-w-[220px] text-[12px] text-[#374151]">{r.reason}</td>
                        <td className="px-3 py-3.5 max-w-[260px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                            {r.overdue && <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-[#FEF2F2] text-[#DC2626]">15D+</span>}
                            {r.claim && <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-[#F5F3FF] text-[#7C3AED]">CLAIM {r.claim.status}</span>}
                          </div>
                          {r.lastScan && !r.received && (
                            <p className="text-[11.5px] text-[#374151] mt-1.5">
                              {pretty(r.lastScan.status)}{r.lastScan.location && <> · <MapPin className="inline w-3 h-3 -mt-0.5 text-[#9CA3AF]" /> {r.lastScan.location}</>}
                              <span className="text-[#9CA3AF]"> · {fmtD(r.lastScan.time)}</span>
                            </p>
                          )}
                          {r.received && <p className="text-[11.5px] text-[#6B7280] mt-1.5">Checked {fmtD(r.received.time)} by {r.received.by}</p>}
                        </td>
                        <td className="px-3 py-3.5 text-[12.5px] font-semibold tabular-nums whitespace-nowrap" style={{ color: r.overdue ? "#DC2626" : "#374151" }}>{r.daysInReturn}d</td>
                        <td className="px-3 py-3.5 text-[12.5px] font-semibold tabular-nums whitespace-nowrap text-[#374151]">{r.rtoCharge != null ? inr(r.rtoCharge) : "—"}</td>
                        <td className="px-3 py-3.5">{isOpen ? <ChevronUp className="w-4 h-4 text-[#9CA3AF]" /> : <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />}</td>
                      </tr>
                      {isOpen && (
                        <tr style={{ borderBottom: "1px solid #F3F4F6", background: "rgba(67,97,238,0.02)" }}>
                          <td colSpan={7} className="px-4 pb-5 pt-1">
                            <RtoDetail r={r} mode={mode} onSaved={() => { setLoading(true); load(); }} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Insights */}
      {insights && (insights.byState.length > 0 || insights.byReason.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-[15px] font-bold text-[#0C1220]">Where RTOs come from</h2>
          <p className="text-[12px] text-[#9CA3AF] -mt-2">RTO % = returned ÷ (delivered + returned), for groups with at least 3 completed orders</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <InsightCard title="By state" rows={insights.byState} />
            <InsightCard title="By pincode" rows={insights.byPincode} />
            <InsightCard title="By product" rows={insights.byProduct} />
            <InsightCard title="By courier" rows={insights.byCourier} />
            <div className="bg-white rounded-xl border border-[#E8EDF6] p-4">
              <p className="text-[12px] font-bold uppercase tracking-wide text-[#9CA3AF] mb-3">By reason</p>
              {insights.byReason.length === 0 ? <p className="text-[12px] text-[#9CA3AF]">No returns yet</p> : (
                <div className="space-y-2">
                  {insights.byReason.map(r => {
                    const total = insights.byReason.reduce((s, x) => s + x.count, 0);
                    const pct = Math.round((r.count / total) * 100);
                    return (
                      <div key={r.label} className="grid grid-cols-[minmax(0,1fr)_90px_48px] items-center gap-2 text-[12px]">
                        <span className="text-[#374151] truncate">{r.label}</span>
                        <div className="h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden"><div className="h-full bg-[#F59E0B]" style={{ width: `${pct}%` }} /></div>
                        <span className="text-right tabular-nums text-[#6B7280]">{r.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function InsightCard({ title, rows }: { title: string; rows: Insight[] }) {
  return (
    <div className="bg-white rounded-xl border border-[#E8EDF6] p-4">
      <p className="text-[12px] font-bold uppercase tracking-wide text-[#9CA3AF] mb-3">{title}</p>
      {rows.length === 0 ? <p className="text-[12px] text-[#9CA3AF]">Not enough data yet</p> : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.label} className="grid grid-cols-[minmax(0,1fr)_90px_80px] items-center gap-2 text-[12px]">
              <span className="text-[#374151] truncate" title={r.label}>{r.label}</span>
              <div className="h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                <div className="h-full" style={{ width: `${r.pct}%`, background: r.pct >= 30 ? "#DC2626" : r.pct >= 15 ? "#F59E0B" : "#10B981" }} />
              </div>
              <span className="text-right tabular-nums text-[#6B7280]"><b className="text-[#0C1220]">{r.pct}%</b> · {r.rto}/{r.total}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RtoDetail({ r, mode, onSaved }: { r: Rto; mode: "admin" | "seller"; onSaved: () => void }) {
  const [condition, setCondition] = useState<"GOOD" | "DAMAGED" | "MISSING">("GOOD");
  const [note, setNote] = useState("");
  const [charge, setCharge] = useState(r.rtoCharge != null ? String(r.rtoCharge) : "");
  const [claimStatus, setClaimStatus] = useState<"RAISED" | "SETTLED" | "REJECTED">(r.claim?.status === "RAISED" ? "SETTLED" : "RAISED");
  const [claimAmount, setClaimAmount] = useState("");
  const [claimNote, setClaimNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function post(body: Record<string, unknown>, ok: string) {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/admin/rto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: r.id, ...body }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? "Couldn't save" }); return; }
    setMsg({ ok: true, text: ok });
    setTimeout(onSaved, 900);
  }

  const input = "w-full px-3 py-2 text-[12.5px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE]";
  const needsClaim = r.received && r.received.condition !== "GOOD";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-[#F3F4F6]">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF] mb-2">Return journey</p>
        {r.returnScans.length === 0 ? (
          <p className="text-[12px] text-[#9CA3AF]">No return scans yet. Return started around {fmtD(r.startedAt)}.</p>
        ) : (
          <ol className="space-y-2.5 max-h-[280px] overflow-y-auto pr-2">
            {r.returnScans.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-[12px]">
                <span className="mt-1 w-2 h-2 rounded-full flex-shrink-0" style={{ background: i === 0 ? "#4361EE" : "#D1D5DB" }} />
                <div>
                  <p className="font-semibold text-[#0C1220]">{pretty(s.status)}</p>
                  <p className="text-[#9CA3AF]">{fmt(s.time)}{s.location ? ` · ${s.location}` : ""}</p>
                  {s.message && s.message !== s.status && <p className="text-[#6B7280]">{s.message}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
        {r.received && (
          <div className="mt-4 rounded-lg px-3 py-2.5 text-[12.5px]" style={{ background: STAGE[r.stage].bg, color: STAGE[r.stage].color }}>
            <b>{STAGE[r.stage].label}</b> · {fmt(r.received.time)} · by {r.received.by}
            {r.received.note && <p className="text-[#374151] mt-0.5">{r.received.note}</p>}
          </div>
        )}
        {r.claim && (
          <div className="mt-2 rounded-lg px-3 py-2.5 text-[12.5px] bg-[#F5F3FF] text-[#5B21B6]">
            Courier claim <b>{r.claim.status.toLowerCase()}</b>{r.claim.amount != null ? ` · ${inr(r.claim.amount)}` : ""} · {fmtD(r.claim.time)}
            {r.claim.note && <p className="text-[#374151] mt-0.5">{r.claim.note}</p>}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {mode === "admin" ? (
          <>
            {!r.received && (
              <div className="space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">Mark return received</p>
                <div className="grid grid-cols-3 gap-2">
                  {([["GOOD", "Good", "#047857"], ["DAMAGED", "Damaged", "#DC2626"], ["MISSING", "Missing", "#7F1D1D"]] as const).map(([k, l, c]) => (
                    <button key={k} type="button" onClick={() => setCondition(k)}
                      className="py-2 rounded-lg border text-[12.5px] font-bold"
                      style={condition === k ? { background: c, borderColor: c, color: "white" } : { background: "white", borderColor: "#E8EDF6", color: "#374151" }}>
                      {l}
                    </button>
                  ))}
                </div>
                <label className="block">
                  <span className="text-[11px] font-semibold text-[#6B7280]">RTO charge ₹ (optional, deducted in remittance)</span>
                  <input id={`rto-charge-${r.id}`} inputMode="decimal" value={charge} onChange={e => setCharge(e.target.value)} className={input} />
                </label>
                <textarea id={`rto-note-${r.id}`} rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Note for the seller (e.g. box torn, item intact)" className={input + " resize-none"} />
                <button type="button" disabled={busy} onClick={() => post({ action: "receive", condition, note, rtoCharge: charge }, "Saved")}
                  className="w-full py-2.5 rounded-lg text-[13px] font-bold text-white bg-[#4361EE] disabled:opacity-60 flex items-center justify-center gap-1.5">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Save
                </button>
              </div>
            )}
            {(needsClaim || r.claim || r.overdue) && (
              <div className="space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">Courier claim</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["RAISED", "SETTLED", "REJECTED"] as const).map(k => (
                    <button key={k} type="button" onClick={() => setClaimStatus(k)}
                      className="py-2 rounded-lg border text-[12px] font-bold"
                      style={claimStatus === k ? { background: "#7C3AED", borderColor: "#7C3AED", color: "white" } : { background: "white", borderColor: "#E8EDF6", color: "#374151" }}>
                      {k === "RAISED" ? "Raised" : k === "SETTLED" ? "Settled" : "Rejected"}
                    </button>
                  ))}
                </div>
                {claimStatus === "SETTLED" && (
                  <input id={`claim-amt-${r.id}`} inputMode="decimal" value={claimAmount} onChange={e => setClaimAmount(e.target.value)} placeholder="Amount received from courier ₹" className={input} />
                )}
                <input id={`claim-note-${r.id}`} value={claimNote} onChange={e => setClaimNote(e.target.value)} placeholder="Claim ID / note" className={input} />
                <button type="button" disabled={busy} onClick={() => post({ action: "claim", status: claimStatus, amount: claimAmount, note: claimNote }, "Claim updated")}
                  className="w-full py-2.5 rounded-lg text-[13px] font-bold text-[#5B21B6] bg-[#F5F3FF] border border-[#DDD6FE] disabled:opacity-60 flex items-center justify-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" /> Update claim
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-lg bg-[#F5F7FB] px-3 py-2.5 text-[12.5px] text-[#374151]">
            {r.stage === "IN_TRANSIT" && "The parcel is on its way back. The AXQEN team checks it when it arrives."}
            {r.stage === "BACK_AT_WAREHOUSE" && "The parcel is back at the warehouse and waiting to be checked."}
            {r.stage === "RECEIVED" && "Received back in good condition."}
            {r.stage === "DAMAGED" && "Received back damaged. The AXQEN team handles the courier claim."}
            {r.stage === "MISSING" && "The parcel did not come back. The AXQEN team handles the courier claim."}
          </div>
        )}
        {r.awb && mode === "seller" && (
          <Link href={`/seller/tracking/${encodeURIComponent(r.awb)}`} className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[12.5px] font-bold bg-[#EEF2FF] text-[#155EEF] border border-[#C7D2FE]">
            <Truck className="w-3.5 h-3.5" /> Full tracking history
          </Link>
        )}
        {msg && <p className="text-[12px] font-semibold px-3 py-2 rounded-lg" style={{ background: msg.ok ? "#ECFDF5" : "#FEF2F2", color: msg.ok ? "#047857" : "#B91C1C" }}>{msg.text}</p>}
      </div>
    </div>
  );
}
