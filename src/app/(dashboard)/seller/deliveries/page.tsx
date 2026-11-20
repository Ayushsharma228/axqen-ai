"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  RefreshCw, Truck, Clock, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Copy, CopyCheck,
  Flag, MapPin, Send, CalendarDays, Search, Loader2, PackageCheck, PackageOpen, RotateCcw, Bike,
  ChevronLeft, ChevronRight, Timer, PauseCircle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
type Stage = "READY_FOR_PICKUP" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "RTO";
interface Scan { status: string; location: string; message: string; time: string }
interface Shipment {
  id: string; externalOrderId: string; status: string; stage: Stage;
  awb: string | null; courier: string; paymentMode: string; totalAmount: number;
  customerName: string | null; phone: string | null; city: string | null; state: string | null;
  orderDate: string; dispatchedAt: string | null; edd: string | null; deliveredAt: string | null;
  daysInTransit: number; delayed: boolean; stuck: boolean;
  lastScan: Scan | null; scanCount: number;
  issues: { id: string; details: string | null; createdAt: string }[];
}
interface Perf {
  avgDeliveryDays: number | null; onTimePct: number | null;
  byCourier: { courier: string; shipments: number; delivered: number; rto: number; rtoPct: number | null; avgDays: number | null }[];
}

// ── Config ─────────────────────────────────────────────────────────────────
const STAGE: Record<Stage, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  READY_FOR_PICKUP: { label: "Ready for pickup", color: "#B45309", bg: "#FFFBEB", icon: PackageOpen },
  IN_TRANSIT:       { label: "In transit",       color: "#0369A1", bg: "#E0F2FE", icon: Truck },
  OUT_FOR_DELIVERY: { label: "Out for delivery", color: "#7C3AED", bg: "#F5F3FF", icon: Bike },
  DELIVERED:        { label: "Delivered",        color: "#047857", bg: "#ECFDF5", icon: PackageCheck },
  RTO:              { label: "RTO",              color: "#DC2626", bg: "#FEF2F2", icon: RotateCcw },
};
const TABS: { key: "ALL" | Stage; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "READY_FOR_PICKUP", label: "Ready for pickup" },
  { key: "IN_TRANSIT", label: "In transit" },
  { key: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "RTO", label: "RTO" },
];
const RANGES = [
  { key: "7", label: "7d" }, { key: "30", label: "30d" }, { key: "90", label: "90d" }, { key: "all", label: "All" },
];
const ISSUE_TYPES = [
  "Delivery attempt failed",
  "Customer not available",
  "Wrong address / incorrect location",
  "Delivery delayed",
  "Package damaged on arrival",
  "Shipment lost in transit",
  "Other",
];

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const fmtTime = (d: string) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
function ago(d: string) {
  const h = (Date.now() - new Date(d).getTime()) / 3600000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
const pretty = (s: string) => {
  const t = (s || "").replace(/[_-]+/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : "Update";
};

// ── Main ───────────────────────────────────────────────────────────────────
export default function ShipmentsPage() {
  const [rows,     setRows]     = useState<Shipment[]>([]);
  const [counts,   setCounts]   = useState<Record<string, number>>({});
  const [couriers, setCouriers] = useState<string[]>([]);
  const [perf,     setPerf]     = useState<Perf | null>(null);
  const [total,    setTotal]    = useState(0);
  const [pages,    setPages]    = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncMsg,  setSyncMsg]  = useState("");

  const [tab,      setTab]      = useState<"ALL" | Stage>("ALL");
  const [flag,     setFlag]     = useState<"" | "DELAYED" | "STUCK">("");
  const [range,    setRange]    = useState("30");
  const [courier,  setCourier]  = useState("");
  const [payment,  setPayment]  = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search,   setSearch]   = useState("");
  const [page,     setPage]     = useState(1);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId,   setCopiedId]   = useState<string | null>(null);

  const [issueOrderId,  setIssueOrderId]  = useState<string | null>(null);
  const [issueType,     setIssueType]     = useState("");
  const [issueNote,     setIssueNote]     = useState("");
  const [issueSending,  setIssueSending]  = useState(false);
  const [issueSuccess,  setIssueSuccess]  = useState<string | null>(null);
  const [reschedOrderId, setReschedOrderId] = useState<string | null>(null);
  const [reschedDate,    setReschedDate]    = useState("");
  const [reschedNote,    setReschedNote]    = useState("");
  const [reschedSending, setReschedSending] = useState(false);
  const [reschedSuccess, setReschedSuccess] = useState<string | null>(null);

  useEffect(() => { setPage(1); }, [tab, flag, range, courier, payment, search]);

  const load = useCallback(async () => {
    const p = new URLSearchParams({ tab, page: String(page) });
    if (flag) p.set("flag", flag);
    if (range !== "all") p.set("days", range);
    if (courier) p.set("courier", courier);
    if (payment) p.set("payment", payment);
    if (search) p.set("search", search);
    const res = await fetch(`/api/seller/shipments?${p}`);
    const d = await res.json();
    setRows(d.shipments ?? []);
    setCounts(d.counts ?? {});
    setCouriers(d.couriers ?? []);
    setPerf(d.performance ?? null);
    setTotal(d.total ?? 0);
    setPages(d.pages ?? 1);
    setLoading(false);
  }, [tab, flag, range, courier, payment, search, page]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  async function refreshTracking() {
    setRefreshing(true); setSyncMsg("");
    const [a, b] = await Promise.all([
      fetch("/api/seller/shipments/refresh", { method: "POST" }).then(r => r.json()).catch(() => ({})),
      fetch("/api/seller/deliveries/refresh-tracking", { method: "POST" }).then(r => r.json()).catch(() => ({})),
    ]);
    const n = (a.updated ?? 0) + (b.updated ?? 0);
    setSyncMsg(n ? `${n} shipment${n === 1 ? "" : "s"} moved to a new status` : "Tracking is up to date");
    await load();
    setRefreshing(false);
    setTimeout(() => setSyncMsg(""), 5000);
  }

  async function submitIssue(orderId: string) {
    if (!issueType) return;
    setIssueSending(true);
    const res = await fetch(`/api/seller/deliveries/${orderId}/issue`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueType, note: issueNote }),
    });
    if (res.ok) {
      setIssueSuccess(orderId); setIssueOrderId(null); setIssueType(""); setIssueNote("");
      load(); setTimeout(() => setIssueSuccess(null), 4000);
    }
    setIssueSending(false);
  }

  async function submitReschedule(orderId: string) {
    if (!reschedDate) return;
    setReschedSending(true);
    const parts = [`Preferred date: ${reschedDate}`];
    if (reschedNote.trim()) parts.push(reschedNote.trim());
    const res = await fetch(`/api/seller/deliveries/${orderId}/issue`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueType: "Reschedule Request", note: parts.join(" — ") }),
    });
    if (res.ok) {
      setReschedSuccess(orderId); setReschedOrderId(null); setReschedDate(""); setReschedNote("");
      load(); setTimeout(() => setReschedSuccess(null), 4000);
    }
    setReschedSending(false);
  }

  function copyAwb(awb: string, id: string) {
    navigator.clipboard.writeText(awb);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const selectCls = "bg-white border border-[#E8EDF6] rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-[#374151] focus:outline-none focus:border-[#4361EE]";

  const tiles: { key: Stage | "DELAYED"; label: string; color: string; icon: React.ElementType }[] = [
    { key: "READY_FOR_PICKUP", label: "Ready for pickup", color: STAGE.READY_FOR_PICKUP.color, icon: PackageOpen },
    { key: "IN_TRANSIT",       label: "In transit",       color: STAGE.IN_TRANSIT.color,       icon: Truck },
    { key: "OUT_FOR_DELIVERY", label: "Out for delivery", color: STAGE.OUT_FOR_DELIVERY.color, icon: Bike },
    { key: "DELIVERED",        label: "Delivered",        color: STAGE.DELIVERED.color,        icon: PackageCheck },
    { key: "RTO",              label: "RTO",              color: STAGE.RTO.color,              icon: RotateCcw },
    { key: "DELAYED",          label: "Delayed",          color: "#DC2626",                    icon: AlertTriangle },
  ];

  return (
    <div className="px-3 py-4 md:p-8 space-y-5" style={{ background: "#F7F8FC", minHeight: "100vh" }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-black text-[#0C1220]">Shipments</h1>
          <p className="text-[12px] text-[#9CA3AF] mt-0.5">Every courier scan, from pickup to doorstep. Failed deliveries are handled on the NDR page.</p>
        </div>
        <div className="flex items-center gap-2">
          {syncMsg && <span className="text-[12px] font-semibold text-[#059669]">{syncMsg}</span>}
          <button onClick={refreshTracking} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-white border border-[#E8EDF6] text-[#6B7280] hover:text-[#0C1220] disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Checking couriers…" : "Refresh tracking"}
          </button>
        </div>
      </div>

      {/* Stage tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.map(t => {
          const Icon = t.icon;
          const active = t.key === "DELAYED" ? flag === "DELAYED" : tab === t.key && !flag;
          return (
            <button key={t.key}
              onClick={() => {
                if (t.key === "DELAYED") { setTab("ALL"); setFlag(flag === "DELAYED" ? "" : "DELAYED"); }
                else { setFlag(""); setTab(tab === t.key ? "ALL" : t.key); }
              }}
              className="text-left bg-white rounded-xl border px-4 py-3.5 transition-colors"
              style={{ borderColor: active ? t.color : "#E8EDF6", boxShadow: active ? `inset 0 0 0 1px ${t.color}` : "none" }}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{t.label}</p>
                <Icon className="w-3.5 h-3.5" style={{ color: t.color }} />
              </div>
              <p className="text-[22px] font-black leading-none tabular-nums" style={{ color: t.key === "DELAYED" && (counts.DELAYED ?? 0) > 0 ? "#DC2626" : "#0C1220" }}>
                {loading ? "…" : (counts[t.key] ?? 0).toLocaleString("en-IN")}
              </p>
            </button>
          );
        })}
      </div>

      {/* Performance strip */}
      {perf && (perf.avgDeliveryDays !== null || perf.byCourier.length > 0) && (
        <div className="bg-white rounded-xl border border-[#E8EDF6] px-4 py-3 flex items-center gap-x-6 gap-y-2 flex-wrap text-[12.5px]">
          <span className="flex items-center gap-1.5 text-[#6B7280]">
            <Timer className="w-3.5 h-3.5 text-[#4361EE]" /> Avg delivery
            <b className="text-[#0C1220] tabular-nums">{perf.avgDeliveryDays !== null ? `${perf.avgDeliveryDays} days` : "—"}</b>
          </span>
          <span className="flex items-center gap-1.5 text-[#6B7280]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" /> On time
            <b className="text-[#0C1220] tabular-nums">{perf.onTimePct !== null ? `${perf.onTimePct}%` : "—"}</b>
          </span>
          {perf.byCourier.slice(0, 4).map(c => (
            <span key={c.courier} className="text-[#6B7280]">
              <b className="text-[#0C1220]">{c.courier}</b>
              {" · "}{c.avgDays !== null ? `${c.avgDays}d` : "—"}
              {" · RTO "}<b style={{ color: (c.rtoPct ?? 0) >= 25 ? "#DC2626" : "#0C1220" }}>{c.rtoPct !== null ? `${c.rtoPct}%` : "—"}</b>
            </span>
          ))}
        </div>
      )}

      {/* List */}
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

        <div className="flex items-center gap-2 flex-wrap px-3 md:px-4 py-3 border-b border-[#F3F4F6] bg-[#FAFBFF]">
          <div className="flex items-center bg-white border border-[#E8EDF6] rounded-lg p-0.5">
            {RANGES.map(r => (
              <button key={r.key} onClick={() => setRange(r.key)}
                className="px-2.5 py-1 text-[12px] font-semibold rounded-md"
                style={{ background: range === r.key ? "#4361EE" : "transparent", color: range === r.key ? "white" : "#6B7280" }}>
                {r.label}
              </button>
            ))}
          </div>
          {([["DELAYED", "Delayed", AlertTriangle, "#DC2626"], ["STUCK", "No update 3d+", PauseCircle, "#B45309"]] as const).map(([k, l, Icon, c]) => (
            <button key={k} onClick={() => setFlag(flag === k ? "" : k)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-semibold"
              style={flag === k ? { background: c, borderColor: c, color: "white" } : { background: "white", borderColor: "#E8EDF6", color: "#374151" }}>
              <Icon className="w-3.5 h-3.5" style={{ color: flag === k ? "white" : c }} /> {l}
              <span className="tabular-nums opacity-80">{counts[k] ?? 0}</span>
            </button>
          ))}
          <select id="ship-courier" aria-label="Courier" value={courier} onChange={e => setCourier(e.target.value)} className={selectCls}>
            <option value="">All couriers</option>
            {couriers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select id="ship-payment" aria-label="Payment" value={payment} onChange={e => setPayment(e.target.value)} className={selectCls}>
            <option value="">All payments</option>
            <option value="COD">COD</option>
            <option value="PREPAID">Prepaid</option>
          </select>
          <form className="relative flex-1 min-w-[200px] md:max-w-[280px] md:ml-auto"
            onSubmit={e => { e.preventDefault(); setSearch(searchInput.trim()); }}>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
            <input id="ship-search" value={searchInput}
              onChange={e => { setSearchInput(e.target.value); if (!e.target.value) setSearch(""); }}
              placeholder="AWB, order ID, name or phone"
              className="pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] w-full" />
          </form>
        </div>

        {loading ? (
          <div className="p-12 flex items-center justify-center gap-2 text-[13px] text-[#9CA3AF]">
            <Loader2 className="w-5 h-5 animate-spin text-[#4361EE]" /> Loading shipments…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2">
            <Truck className="w-10 h-10 text-[#E8EDF6]" />
            <p className="text-[13px] text-[#9CA3AF]">No shipments match these filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead>
                <tr className="border-b border-[#F3F4F6] bg-[#FAFBFF] text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide">
                  <th className="px-4 py-3">Order / AWB</th>
                  <th className="px-3 py-3">Customer</th>
                  <th className="px-3 py-3">Courier</th>
                  <th className="px-3 py-3">Status &amp; latest scan</th>
                  <th className="px-3 py-3">Expected</th>
                  <th className="px-3 py-3">Days</th>
                  <th className="px-3 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(s => {
                  const st = STAGE[s.stage];
                  const open = expandedId === s.id;
                  const late = s.delayed;
                  return (
                    <Fragment key={s.id}>
                      <tr onClick={() => { setExpandedId(open ? null : s.id); setIssueOrderId(null); setReschedOrderId(null); }}
                        className="align-top cursor-pointer hover:bg-[#FAFBFF] transition-colors"
                        style={{ borderBottom: open ? "none" : "1px solid #F3F4F6", background: open ? "rgba(67,97,238,0.02)" : undefined }}>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <Link href={`/seller/orders/${s.id}`} onClick={e => e.stopPropagation()} className="text-[13px] font-bold text-[#4361EE] hover:underline">
                            {s.externalOrderId.startsWith("#") ? s.externalOrderId : `#${s.externalOrderId}`}
                          </Link>
                          {s.awb && (
                            <div className="flex items-center gap-1 mt-0.5" onClick={e => e.stopPropagation()}>
                              <Link href={`/seller/tracking/${encodeURIComponent(s.awb)}`} className="font-mono text-[11.5px] text-[#374151] hover:text-[#4361EE]">{s.awb}</Link>
                              <button onClick={() => copyAwb(s.awb!, s.id)} aria-label="Copy AWB" className="opacity-60 hover:opacity-100">
                                {copiedId === s.id ? <CopyCheck className="w-3 h-3 text-[#059669]" /> : <Copy className="w-3 h-3 text-[#9CA3AF]" />}
                              </button>
                            </div>
                          )}
                          {issueSuccess === s.id && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-[#ECFDF5] text-[#059669]">Reported</span>}
                        </td>
                        <td className="px-3 py-3.5 max-w-[180px]">
                          <p className="text-[13px] font-semibold text-[#0C1220] truncate">{s.customerName || "—"}</p>
                          <p className="text-[11px] text-[#9CA3AF] truncate">{[s.city, s.state].filter(Boolean).join(", ") || "—"}</p>
                          <span className="inline-block mt-1 text-[9.5px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: s.paymentMode === "PREPAID" ? "#EEF2FF" : "#FFF7ED", color: s.paymentMode === "PREPAID" ? "#4361EE" : "#C2410C" }}>
                            {s.paymentMode === "PREPAID" ? "PREPAID" : "COD"} · ₹{Math.round(s.totalAmount).toLocaleString("en-IN")}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-[12.5px] font-semibold text-[#374151] whitespace-nowrap">{s.courier}</td>
                        <td className="px-3 py-3.5 max-w-[300px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                            {s.stuck && <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-[#FFFBEB] text-[#B45309]">NO UPDATE 3D+</span>}
                            {s.issues.length > 0 && <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-[#FEF2F2] text-[#DC2626]">{s.issues.length} ISSUE{s.issues.length > 1 ? "S" : ""}</span>}
                          </div>
                          {s.lastScan ? (
                            <p className="text-[11.5px] text-[#374151] mt-1.5 leading-snug">
                              <span className="font-semibold">{pretty(s.lastScan.status)}</span>
                              {s.lastScan.location && <> · <MapPin className="inline w-3 h-3 -mt-0.5 text-[#9CA3AF]" /> {s.lastScan.location}</>}
                              <span className="text-[#9CA3AF]"> · {ago(s.lastScan.time)}</span>
                            </p>
                          ) : (
                            <p className="text-[11px] text-[#9CA3AF] mt-1.5">No courier scan yet</p>
                          )}
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap">
                          {s.stage === "DELIVERED" && s.deliveredAt ? (
                            <p className="text-[12.5px] font-semibold text-[#047857]">Delivered {fmtDate(s.deliveredAt)}</p>
                          ) : s.edd ? (
                            <p className="text-[12.5px] font-semibold" style={{ color: late ? "#DC2626" : "#0C1220" }}>
                              {fmtDate(s.edd)}{late && <span className="ml-1.5 text-[9.5px] px-1.5 py-0.5 rounded-full font-bold bg-[#FEF2F2]">LATE</span>}
                            </p>
                          ) : <span className="text-[12px] text-[#9CA3AF]">—</span>}
                        </td>
                        <td className="px-3 py-3.5 text-[12.5px] font-semibold tabular-nums text-[#374151] whitespace-nowrap">
                          {s.stage === "READY_FOR_PICKUP" ? "—" : `${s.daysInTransit}d`}
                        </td>
                        <td className="px-3 py-3.5">
                          {open ? <ChevronUp className="w-4 h-4 text-[#9CA3AF]" /> : <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />}
                        </td>
                      </tr>

                      {open && (
                        <tr style={{ borderBottom: "1px solid #F3F4F6", background: "rgba(67,97,238,0.02)" }}>
                          <td colSpan={7} className="px-4 pb-6 pt-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#F3F4F6]">
                              {/* Left: summary + issues */}
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3 text-[12px]">
                                  {[
                                    { icon: CalendarDays, label: "Ordered",    value: fmtDate(s.orderDate) },
                                    { icon: Truck,        label: "Dispatched", value: s.dispatchedAt ? fmtDate(s.dispatchedAt) : "—" },
                                    { icon: Clock,        label: "Last scan",  value: s.lastScan ? fmtTime(s.lastScan.time) : "—" },
                                    { icon: MapPin,       label: "Deliver to", value: [s.city, s.state].filter(Boolean).join(", ") || "—" },
                                  ].map(({ icon: Icon, label, value }) => (
                                    <div key={label} className="flex items-center gap-2">
                                      <Icon className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" />
                                      <div><p className="text-[10px] text-[#9CA3AF]">{label}</p><p className="font-semibold text-[#0C1220]">{value}</p></div>
                                    </div>
                                  ))}
                                </div>
                                {s.lastScan?.message && (
                                  <p className="text-[12px] text-[#374151] rounded-lg bg-[#F5F7FB] px-3 py-2">Courier remark: {s.lastScan.message}</p>
                                )}
                                {s.awb && (
                                  <Link href={`/seller/tracking/${encodeURIComponent(s.awb)}`}
                                    className="w-full py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 bg-[#EEF2FF] text-[#155EEF] border border-[#C7D2FE]">
                                    <Truck className="w-3.5 h-3.5" /> See all {s.scanCount > 0 ? `${s.scanCount} ` : ""}location updates
                                  </Link>
                                )}
                                {s.issues.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide">Reported issues</p>
                                    {s.issues.map(i => (
                                      <div key={i.id} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[#FEF2F2] border border-[#FECACA]">
                                        <Flag className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[#DC2626]" />
                                        <div>
                                          <p className="text-[12px] font-medium text-[#7F1D1D]">{i.details}</p>
                                          <p className="text-[10px] text-[#B91C1C] mt-0.5">{fmtTime(i.createdAt)}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Right: actions */}
                              <div className="space-y-5">
                                <div className="space-y-2.5">
                                  <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide">Report a delivery issue</p>
                                  {issueSuccess === s.id ? (
                                    <p className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#ECFDF5] text-[12px] font-medium text-[#15803D]"><CheckCircle2 className="w-4 h-4" /> Issue reported. The AXQEN team will look into it.</p>
                                  ) : issueOrderId === s.id ? (
                                    <div className="space-y-2.5">
                                      <select id={`issue-type-${s.id}`} value={issueType} onChange={e => setIssueType(e.target.value)}
                                        className="w-full px-3 py-2 text-[12px] rounded-xl border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE]">
                                        <option value="">Select issue type…</option>
                                        {ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                      </select>
                                      <textarea id={`issue-note-${s.id}`} value={issueNote} onChange={e => setIssueNote(e.target.value)} rows={3}
                                        placeholder="Additional details (optional)"
                                        className="w-full px-3 py-2 text-[12px] rounded-xl border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] resize-none" />
                                      <div className="flex gap-2">
                                        <button onClick={() => setIssueOrderId(null)} className="flex-1 py-2 rounded-xl text-[12px] font-medium bg-[#F3F4F6] text-[#6B7280]">Cancel</button>
                                        <button onClick={() => submitIssue(s.id)} disabled={!issueType || issueSending}
                                          className="flex-1 py-2 rounded-xl text-[12px] font-bold text-white bg-[#EF4444] disabled:opacity-50 flex items-center justify-center gap-1.5">
                                          {issueSending ? "Submitting…" : <><Send className="w-3.5 h-3.5" /> Submit issue</>}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button onClick={() => { setIssueOrderId(s.id); setIssueType(""); setIssueNote(""); setReschedOrderId(null); }}
                                      className="w-full py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
                                      <AlertTriangle className="w-3.5 h-3.5" /> Report issue
                                    </button>
                                  )}
                                </div>

                                {s.stage !== "DELIVERED" && s.stage !== "RTO" && (
                                  <div className="space-y-2.5">
                                    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide">Reschedule delivery</p>
                                    {reschedSuccess === s.id ? (
                                      <p className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#ECFDF5] text-[12px] font-medium text-[#15803D]"><CheckCircle2 className="w-4 h-4" /> Reschedule request sent.</p>
                                    ) : reschedOrderId === s.id ? (
                                      <div className="space-y-2.5">
                                        <input id={`resched-date-${s.id}`} type="date" value={reschedDate} min={new Date().toISOString().split("T")[0]}
                                          onChange={e => setReschedDate(e.target.value)}
                                          className="w-full px-3 py-2 text-[12px] rounded-xl border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE]" />
                                        <textarea id={`resched-note-${s.id}`} value={reschedNote} onChange={e => setReschedNote(e.target.value)} rows={2}
                                          placeholder="Instructions for the courier (optional)"
                                          className="w-full px-3 py-2 text-[12px] rounded-xl border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] resize-none" />
                                        <div className="flex gap-2">
                                          <button onClick={() => setReschedOrderId(null)} className="flex-1 py-2 rounded-xl text-[12px] font-medium bg-[#F3F4F6] text-[#6B7280]">Cancel</button>
                                          <button onClick={() => submitReschedule(s.id)} disabled={!reschedDate || reschedSending}
                                            className="flex-1 py-2 rounded-xl text-[12px] font-bold text-white bg-[#7C3AED] disabled:opacity-50 flex items-center justify-center gap-1.5">
                                            {reschedSending ? "Sending…" : <><CalendarDays className="w-3.5 h-3.5" /> Request reschedule</>}
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <button onClick={() => { setReschedOrderId(s.id); setReschedDate(""); setReschedNote(""); setIssueOrderId(null); }}
                                        className="w-full py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 bg-[#F5F3FF] text-[#7C3AED] border border-[#DDD6FE]">
                                        <CalendarDays className="w-3.5 h-3.5" /> Request reschedule
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
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

        {!loading && rows.length > 0 && (
          <div className="px-4 py-3 border-t border-[#F3F4F6] flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[12px] text-[#9CA3AF]">{((page - 1) * 50 + 1).toLocaleString("en-IN")}–{((page - 1) * 50 + rows.length).toLocaleString("en-IN")} of {total.toLocaleString("en-IN")}</p>
            {pages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Previous page"
                  className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#E8EDF6] text-[#6B7280] disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-[12px] font-semibold text-[#6B7280] px-2 tabular-nums">Page {page} of {pages}</span>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages} aria-label="Next page"
                  className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#E8EDF6] text-[#6B7280] disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
