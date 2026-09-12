"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, Truck, Clock, XCircle, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, ExternalLink, Copy, CopyCheck,
  AlertCircle, Flag, Package, MapPin, Send, CalendarDays, Search,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface DeliveryIssue { id: string; event: string; details: string | null; createdAt: string; }
interface Delivery {
  id: string; externalOrderId: string; status: string;
  awbNumber: string | null; trackingUrl: string | null; courier: string | null;
  supplierTrackingNo: string | null; supplierCourier: string | null;
  createdAt: string; updatedAt: string; totalAmount: number;
  expectedDeliveryDate: string | null;
  customerName: string | null;
  customerAddress: { phone?: string; city?: string; state?: string } | null;
  timeline: DeliveryIssue[];
  ndrStatus?: string | null;
}
interface Stats { pending: number; delivered: number; inTransit: number; rto: number; cancelled: number; }

// ── Config ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  SHIPPED:    { label: "Shipped",    color: "#7C3AED", bg: "#F5F3FF" },
  IN_TRANSIT: { label: "In Transit", color: "#0369A1", bg: "#E0F2FE" },
  DELIVERED:  { label: "Delivered",  color: "#059669", bg: "#ECFDF5" },
  CANCELLED:  { label: "Cancelled",  color: "#6B7280", bg: "#F3F4F6" },
  NEW:        { label: "Pending",    color: "#4361EE", bg: "#EEF2FF" },
  PROCESSING: { label: "Processing", color: "#D97706", bg: "#FFF7ED" },
  RTO:        { label: "RTO",        color: "#EF4444", bg: "#FEF2F2" },
};

const TABS = [
  { label: "All",         value: "ALL" },
  { label: "Pending",     value: "NEW" },
  { label: "Processing",  value: "PROCESSING" },
  { label: "Shipped",     value: "SHIPPED" },
  { label: "In Transit",  value: "IN_TRANSIT" },
  { label: "Delivered",   value: "DELIVERED" },
  { label: "RTO",         value: "RTO" },
  { label: "Cancelled",   value: "CANCELLED" },
  { label: "NDR",         value: "NDR" },
];

const STEPS = [
  { key: "NEW",        label: "Ordered"    },
  { key: "PROCESSING", label: "Processing" },
  { key: "SHIPPED",    label: "Shipped"    },
  { key: "IN_TRANSIT", label: "In Transit" },
  { key: "DELIVERED",  label: "Delivered"  },
];
const STEP_RANK: Record<string, number> = {
  NEW: 0, PROCESSING: 1, SHIPPED: 2, IN_TRANSIT: 3, DELIVERED: 4, RTO: 4, CANCELLED: 4,
};

const ISSUE_TYPES = [
  "Delivery attempt failed",
  "Customer not available",
  "Wrong address / incorrect location",
  "Delivery delayed",
  "Package damaged on arrival",
  "Shipment lost in transit",
  "Other",
];

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
const num = (n: number) => n.toLocaleString("en-IN");

// ── Main ───────────────────────────────────────────────────────────────────
export default function ManageDeliveryPage() {
  const [deliveries,  setDeliveries]  = useState<Delivery[]>([]);
  const [stats,       setStats]       = useState<Stats>({ pending: 0, delivered: 0, inTransit: 0, rto: 0, cancelled: 0 });
  const [ndrCount,    setNdrCount]    = useState(0);
  const [search,      setSearch]      = useState("");
  const [tab,         setTab]         = useState("ALL");
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [syncMsg,     setSyncMsg]     = useState("");
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [copiedId,    setCopiedId]    = useState<string | null>(null);

  // Issue form
  const [issueOrderId,  setIssueOrderId]  = useState<string | null>(null);
  const [issueType,     setIssueType]     = useState("");
  const [issueNote,     setIssueNote]     = useState("");
  const [issueSending,  setIssueSending]  = useState(false);
  const [issueSuccess,  setIssueSuccess]  = useState<string | null>(null);

  // Reschedule form
  const [reschedOrderId, setReschedOrderId] = useState<string | null>(null);
  const [reschedDate,    setReschedDate]    = useState("");
  const [reschedNote,    setReschedNote]    = useState("");
  const [reschedSending, setReschedSending] = useState(false);
  const [reschedSuccess, setReschedSuccess] = useState<string | null>(null);

  const fetchDeliveries = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true); else setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      // NDR is client-side filtered — don't pass to API
      if (tab !== "ALL" && tab !== "NDR") params.set("status", tab);
      const [res, ndrRes] = await Promise.all([
        fetch(`/api/seller/deliveries?${params}`),
        fetch("/api/seller/ndr"),
      ]);
      const data    = await res.json();
      const ndrData = await ndrRes.json();
      setDeliveries(data.orders ?? []);
      if (data.stats) setStats(data.stats);
      setNdrCount(ndrData?.total ?? ndrData?.length ?? 0);
    } finally { setLoading(false); setRefreshing(false); }
  }, [search, tab]);

  useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);

  async function handleRefreshTracking() {
    setRefreshing(true); setSyncMsg("");
    const res  = await fetch("/api/seller/deliveries/refresh-tracking", { method: "POST" });
    const data = await res.json();
    setSyncMsg(`Updated ${data.updated ?? 0} tracking status${data.updated !== 1 ? "es" : ""}`);
    await fetchDeliveries(false);
    setRefreshing(false);
  }

  async function submitIssue(orderId: string) {
    if (!issueType) return;
    setIssueSending(true);
    const res = await fetch(`/api/seller/deliveries/${orderId}/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueType, note: issueNote }),
    });
    if (res.ok) {
      setIssueSuccess(orderId);
      setIssueOrderId(null); setIssueType(""); setIssueNote("");
      fetchDeliveries();
      setTimeout(() => setIssueSuccess(null), 4000);
    }
    setIssueSending(false);
  }

  async function submitReschedule(orderId: string) {
    if (!reschedDate) return;
    setReschedSending(true);
    const noteParts = [`Preferred date: ${reschedDate}`];
    if (reschedNote.trim()) noteParts.push(reschedNote.trim());
    const res = await fetch(`/api/seller/deliveries/${orderId}/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueType: "Reschedule Request", note: noteParts.join(" — ") }),
    });
    if (res.ok) {
      setReschedSuccess(orderId);
      setReschedOrderId(null); setReschedDate(""); setReschedNote("");
      fetchDeliveries();
      setTimeout(() => setReschedSuccess(null), 4000);
    }
    setReschedSending(false);
  }

  function copyAwb(awb: string, id: string) {
    navigator.clipboard.writeText(awb);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id);
    setIssueOrderId(null); setIssueType(""); setIssueNote("");
  }

  // NDR client-side filter
  const displayed = tab === "NDR"
    ? deliveries.filter(d => !!d.ndrStatus)
    : deliveries;

  const STAT_CARDS = [
    { label: "Pending",     value: num(stats.pending),   color: "#4361EE", sub: "Awaiting shipment", tab: "NEW" },
    { label: "In Transit",  value: num(stats.inTransit), color: "#0369A1", sub: "On the way",         tab: "IN_TRANSIT" },
    { label: "Delivered",   value: num(stats.delivered), color: "#059669", sub: "Successfully done",  tab: "DELIVERED" },
    { label: "RTO",         value: num(stats.rto),       color: "#EF4444", sub: "Return to origin",   tab: "RTO" },
    { label: "Cancelled",   value: num(stats.cancelled), color: "#6B7280", sub: "Cancelled orders",   tab: "CANCELLED" },
    { label: "NDR",         value: num(ndrCount),        color: "#7C3AED", sub: "Non-delivery report",tab: "NDR" },
  ];

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6 md:p-8 space-y-5" style={{ background: "#F7F8FC", minHeight: "100vh" }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[18px] font-black text-[#0C1220]">Fulfilment</h1>
          <p className="text-[12px] text-[#9CA3AF] mt-0.5">Track shipments, monitor delivery status, and raise issues</p>
        </div>
        <div className="flex items-center gap-2">
          {syncMsg && <span className="text-[12px] font-semibold text-[#059669]">{syncMsg}</span>}
          <button
            onClick={handleRefreshTracking} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-white border border-[#E8EDF6] text-[#6B7280] hover:text-[#0C1220] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Syncing…" : "Refresh Tracking"}
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAT_CARDS.map(card => (
          <button
            key={card.tab}
            onClick={() => setTab(card.tab)}
            className="text-left rounded-xl border px-4 py-3.5 transition-all"
            style={{
              background: tab === card.tab ? card.color : "white",
              borderColor: tab === card.tab ? card.color : "#E8EDF6",
            }}
          >
            <p className="text-[11px] font-bold uppercase tracking-wide mb-1"
              style={{ color: tab === card.tab ? "rgba(255,255,255,0.75)" : "#9CA3AF" }}>
              {card.label}
            </p>
            <p className="text-[22px] font-black leading-none"
              style={{ color: tab === card.tab ? "white" : card.color }}>
              {card.value}
            </p>
            <p className="text-[11px] mt-1"
              style={{ color: tab === card.tab ? "rgba(255,255,255,0.65)" : "#9CA3AF" }}>
              {card.sub}
            </p>
          </button>
        ))}
      </div>

      {/* ── Main card ── */}
      <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">

        {/* Tabs + search */}
        <div className="flex items-center border-b border-[#F3F4F6] overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className="px-4 py-3 text-[13px] font-semibold whitespace-nowrap flex-shrink-0 border-b-2 transition-colors"
              style={{
                borderColor: tab === t.value ? "#4361EE" : "transparent",
                color: tab === t.value ? "#4361EE" : "#9CA3AF",
                background: tab === t.value ? "#FAFBFF" : "transparent",
              }}
            >
              {t.label}
              {(() => {
                const c =
                  t.value === "ALL"        ? deliveries.length :
                  t.value === "NEW"        ? stats.pending :
                  t.value === "IN_TRANSIT" ? stats.inTransit :
                  t.value === "DELIVERED"  ? stats.delivered :
                  t.value === "RTO"        ? stats.rto :
                  t.value === "CANCELLED"  ? stats.cancelled :
                  t.value === "NDR"        ? ndrCount :
                  deliveries.filter(d => d.status === t.value).length;
                return c > 0 ? (
                  <span
                    className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                    style={{
                      background: tab === t.value ? "#4361EE" : "#EEF2FF",
                      color: tab === t.value ? "white" : "#4361EE",
                    }}
                  >{c}</span>
                ) : null;
              })()}
            </button>
          ))}
          {/* search */}
          <div className="ml-auto pr-4 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && fetchDeliveries()}
                className="pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-[#E8EDF6] bg-[#FAFBFF] text-[#0C1220] placeholder-[#9CA3AF] outline-none focus:border-[#4361EE] w-40 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-12 flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-[#4361EE]" />
            <p className="text-[13px] text-[#9CA3AF]">Loading deliveries…</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <Truck className="w-10 h-10 text-[#E8EDF6]" />
            <p className="text-[13px] font-medium text-[#9CA3AF]">No deliveries found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F3F4F6]" style={{ background: "#FAFBFF" }}>
                  {["ORDER #", "CUSTOMER", "STATUS", "EXPECTED BY", "AWB / COURIER", "ISSUES", ""].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map(d => {
                  const cfg        = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.NEW;
                  const awb        = d.awbNumber || d.supplierTrackingNo;
                  const carrier    = d.courier || d.supplierCourier;
                  const isExpanded = expandedId === d.id;
                  const isOverdue  = d.expectedDeliveryDate
                    && new Date(d.expectedDeliveryDate) < new Date()
                    && !["DELIVERED","CANCELLED","RTO"].includes(d.status);
                  const daysShipped = (d.status === "SHIPPED" || d.status === "IN_TRANSIT")
                    ? daysSince(d.updatedAt) : null;
                  const issues = d.timeline ?? [];

                  return (
                    <>
                      <tr
                        key={d.id}
                        className="hover:bg-[#FAFBFF] cursor-pointer transition-colors"
                        style={{
                          borderBottom: isExpanded ? "none" : "1px solid #F9FAFB",
                          background: isExpanded ? "rgba(67,97,238,0.02)" : undefined,
                        }}
                        onClick={() => toggleExpand(d.id)}
                      >
                        {/* Order # */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-bold text-[#4361EE]">#{d.externalOrderId}</span>
                            {issueSuccess === d.id && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-[#ECFDF5] text-[#059669]">
                                Reported
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#9CA3AF] mt-0.5">{fmtDate(d.createdAt)}</p>
                        </td>

                        {/* Customer */}
                        <td className="px-5 py-3.5">
                          <p className="text-[13px] font-semibold text-[#0C1220]">{d.customerName || "—"}</p>
                          <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                            {d.customerAddress?.phone || ""}
                            {d.customerAddress?.city ? ` · ${d.customerAddress.city}` : ""}
                          </p>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                            style={{ background: cfg.bg, color: cfg.color }}>
                            {cfg.label}
                          </span>
                          {daysShipped !== null && (
                            <p className="text-[10px] text-[#9CA3AF] mt-1">{daysShipped}d in transit</p>
                          )}
                          {d.ndrStatus && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#F5F3FF] text-[#7C3AED]">
                              NDR
                            </span>
                          )}
                        </td>

                        {/* Expected By */}
                        <td className="px-5 py-3.5">
                          {d.expectedDeliveryDate ? (
                            <div>
                              <span className="text-[13px] font-medium"
                                style={{ color: isOverdue ? "#DC2626" : "#0C1220" }}>
                                {fmtDate(d.expectedDeliveryDate)}
                              </span>
                              {isOverdue && (
                                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-[#FEF2F2] text-[#DC2626]">
                                  Overdue
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[13px] text-[#9CA3AF]">—</span>
                          )}
                        </td>

                        {/* AWB */}
                        <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                          {awb ? (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[12px] font-semibold text-[#0C1220]">{awb}</span>
                                <button onClick={() => copyAwb(awb, d.id)}
                                  className="opacity-50 hover:opacity-100 transition-opacity">
                                  {copiedId === d.id
                                    ? <CopyCheck className="w-3 h-3 text-[#059669]" />
                                    : <Copy className="w-3 h-3 text-[#9CA3AF]" />}
                                </button>
                              </div>
                              {carrier && <span className="text-[11px] text-[#9CA3AF]">{carrier}</span>}
                              {d.trackingUrl && (
                                <a href={d.trackingUrl} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-0.5 text-[11px] font-semibold text-[#4361EE]">
                                  Track <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold bg-[#FFF7ED] text-[#D97706]">
                              Pending AWB
                            </span>
                          )}
                        </td>

                        {/* Issues */}
                        <td className="px-5 py-3.5">
                          {issues.length > 0 ? (
                            <span className="flex items-center gap-1 text-[12px] font-semibold text-[#DC2626]">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {issues.length} issue{issues.length !== 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="text-[12px] text-[#9CA3AF]">None</span>
                          )}
                        </td>

                        {/* Expand */}
                        <td className="px-5 py-3.5">
                          {isExpanded
                            ? <ChevronUp className="w-4 h-4 text-[#9CA3AF]" />
                            : <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />}
                        </td>
                      </tr>

                      {/* ── Expanded panel ── */}
                      {isExpanded && (
                        <tr key={`${d.id}-exp`} style={{ borderBottom: "1px solid #F3F4F6", background: "rgba(67,97,238,0.02)" }}>
                          <td colSpan={7} className="px-5 pb-6 pt-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#F3F4F6]">

                              {/* LEFT — progress + meta */}
                              <div className="space-y-5">
                                <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide">Delivery Progress</p>

                                {/* Step track */}
                                <div className="flex items-start gap-0">
                                  {(d.status === "RTO" ? [
                                    ...STEPS.slice(0, 3), { key: "RTO", label: "RTO" },
                                  ] : d.status === "CANCELLED" ? [
                                    STEPS[0], { key: "CANCELLED", label: "Cancelled" },
                                  ] : STEPS).map((step, i, arr) => {
                                    const rank   = STEP_RANK[d.status] ?? 0;
                                    const myRank = STEP_RANK[step.key] ?? i;
                                    const isDone = myRank < rank;
                                    const isCurr = myRank === rank || step.key === d.status;
                                    const isRto  = step.key === "RTO";
                                    const isCncl = step.key === "CANCELLED";
                                    const dotColor =
                                      isCncl ? "#6B7280" :
                                      isRto  ? "#EF4444" :
                                      isDone || (isCurr && d.status === "DELIVERED") ? "#059669" :
                                      isCurr ? "#4361EE" : "#E8EDF6";
                                    return (
                                      <div key={step.key} className="flex items-center flex-1">
                                        <div className="flex flex-col items-center gap-1 flex-shrink-0">
                                          <div className="w-3 h-3 rounded-full ring-2 ring-offset-2"
                                            style={{ background: dotColor, ["--tw-ring-color" as string]: dotColor }} />
                                          <p className="text-[10px] font-medium text-center leading-tight max-w-[56px]"
                                            style={{ color: isCurr || isDone ? "#0C1220" : "#9CA3AF" }}>
                                            {step.label}
                                          </p>
                                        </div>
                                        {i < arr.length - 1 && (
                                          <div className="flex-1 h-px mx-1 mb-5"
                                            style={{ background: isDone ? "#059669" : "#E8EDF6" }} />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Meta grid */}
                                <div className="grid grid-cols-2 gap-3">
                                  {[
                                    { icon: Package,  label: "Order Value",  value: `₹${d.totalAmount.toLocaleString("en-IN")}` },
                                    { icon: Truck,    label: "Carrier",      value: carrier || "—" },
                                    { icon: MapPin,   label: "Deliver To",   value: d.customerAddress?.city ? `${d.customerAddress.city}${d.customerAddress.state ? `, ${d.customerAddress.state}` : ""}` : "—" },
                                    { icon: Clock,    label: "Last Updated", value: fmtDate(d.updatedAt) },
                                  ].map(({ icon: Icon, label, value }) => (
                                    <div key={label} className="flex items-center gap-2">
                                      <Icon className="w-3.5 h-3.5 flex-shrink-0 text-[#9CA3AF]" />
                                      <div>
                                        <p className="text-[10px] text-[#9CA3AF]">{label}</p>
                                        <p className="text-[12px] font-semibold text-[#0C1220]">{value}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* Reported issues */}
                                {issues.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide">Reported Issues</p>
                                    {issues.map(issue => (
                                      <div key={issue.id}
                                        className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[#FEF2F2] border border-[#FECACA]">
                                        <Flag className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[#DC2626]" />
                                        <div>
                                          <p className="text-[12px] font-medium text-[#7F1D1D]">{issue.details}</p>
                                          <p className="text-[10px] text-[#B91C1C] mt-0.5">{fmtDate(issue.createdAt)}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* RIGHT — actions */}
                              <div className="space-y-5">

                                {/* Raise Issue */}
                                <div className="space-y-3">
                                  <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide">Raise a Delivery Issue</p>
                                  {issueSuccess === d.id ? (
                                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#ECFDF5] border border-[#BBF7D0]">
                                      <CheckCircle2 className="w-4 h-4 text-[#059669]" />
                                      <p className="text-[12px] font-medium text-[#15803D]">Issue reported. Admin will be notified.</p>
                                    </div>
                                  ) : issueOrderId === d.id ? (
                                    <div className="space-y-3">
                                      <select value={issueType} onChange={e => setIssueType(e.target.value)}
                                        className="w-full px-3 py-2 text-[12px] rounded-xl border border-[#E8EDF6] bg-[#FAFBFF] text-[#0C1220] outline-none focus:border-[#4361EE]">
                                        <option value="">Select issue type…</option>
                                        {ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                      </select>
                                      <textarea value={issueNote} onChange={e => setIssueNote(e.target.value)}
                                        placeholder="Additional details (optional)" rows={3}
                                        className="w-full px-3 py-2 text-[12px] rounded-xl border border-[#E8EDF6] bg-[#FAFBFF] text-[#0C1220] outline-none focus:border-[#4361EE] resize-none" />
                                      <div className="flex gap-2">
                                        <button onClick={() => { setIssueOrderId(null); setIssueType(""); setIssueNote(""); }}
                                          className="flex-1 py-2 rounded-xl text-[12px] font-medium bg-[#F3F4F6] text-[#6B7280]">
                                          Cancel
                                        </button>
                                        <button onClick={() => submitIssue(d.id)}
                                          disabled={!issueType || issueSending}
                                          className="flex-1 py-2 rounded-xl text-[12px] font-bold text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
                                          style={{ background: "#EF4444" }}>
                                          {issueSending ? "Submitting…" : <><Send className="w-3.5 h-3.5" /> Submit Issue</>}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <p className="px-4 py-3 rounded-xl text-[12px] leading-relaxed bg-[#FAFBFF] border border-[#E8EDF6] text-[#6B7280]">
                                        Report problems — wrong address, failed attempt, damaged package, or delays.
                                      </p>
                                      <button
                                        onClick={() => { setIssueOrderId(d.id); setIssueType(""); setIssueNote(""); setReschedOrderId(null); }}
                                        className="w-full py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
                                        <AlertTriangle className="w-3.5 h-3.5" /> Raise Delivery Issue
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Reschedule */}
                                <div className="space-y-3">
                                  <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide">Reschedule Delivery</p>
                                  {reschedSuccess === d.id ? (
                                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#ECFDF5] border border-[#BBF7D0]">
                                      <CheckCircle2 className="w-4 h-4 text-[#059669]" />
                                      <p className="text-[12px] font-medium text-[#15803D]">Reschedule request sent.</p>
                                    </div>
                                  ) : reschedOrderId === d.id ? (
                                    <div className="space-y-3">
                                      <div>
                                        <label className="block text-[11px] font-semibold text-[#6B7280] mb-1">Preferred delivery date</label>
                                        <input type="date" value={reschedDate}
                                          min={new Date().toISOString().split("T")[0]}
                                          onChange={e => setReschedDate(e.target.value)}
                                          className="w-full px-3 py-2 text-[12px] rounded-xl border border-[#E8EDF6] bg-[#FAFBFF] text-[#0C1220] outline-none focus:border-[#4361EE]" />
                                      </div>
                                      <textarea value={reschedNote} onChange={e => setReschedNote(e.target.value)}
                                        placeholder="Instructions for courier (optional)" rows={3}
                                        className="w-full px-3 py-2 text-[12px] rounded-xl border border-[#E8EDF6] bg-[#FAFBFF] text-[#0C1220] outline-none focus:border-[#4361EE] resize-none" />
                                      <div className="flex gap-2">
                                        <button onClick={() => { setReschedOrderId(null); setReschedDate(""); setReschedNote(""); }}
                                          className="flex-1 py-2 rounded-xl text-[12px] font-medium bg-[#F3F4F6] text-[#6B7280]">
                                          Cancel
                                        </button>
                                        <button onClick={() => submitReschedule(d.id)}
                                          disabled={!reschedDate || reschedSending}
                                          className="flex-1 py-2 rounded-xl text-[12px] font-bold text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
                                          style={{ background: "#7C3AED" }}>
                                          {reschedSending ? "Sending…" : <><CalendarDays className="w-3.5 h-3.5" /> Request Reschedule</>}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <p className="px-4 py-3 rounded-xl text-[12px] leading-relaxed bg-[#FAFBFF] border border-[#E8EDF6] text-[#6B7280]">
                                        Ask admin to reschedule to a different date or with special courier instructions.
                                      </p>
                                      <button
                                        onClick={() => { setReschedOrderId(d.id); setReschedDate(""); setReschedNote(""); setIssueOrderId(null); }}
                                        className="w-full py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 bg-[#F5F3FF] text-[#7C3AED] border border-[#DDD6FE]">
                                        <CalendarDays className="w-3.5 h-3.5" /> Request Reschedule
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Live tracking */}
                                {awb && d.trackingUrl && (
                                  <a href={d.trackingUrl} target="_blank" rel="noopener noreferrer"
                                    className="w-full py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 bg-[#EEF2FF] text-[#4361EE] border border-[#C7D2FE]">
                                    <ExternalLink className="w-3.5 h-3.5" /> Open Live Tracking
                                  </a>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {!loading && displayed.length > 0 && (
          <div className="px-5 py-3 border-t border-[#F3F4F6]">
            <p className="text-[12px] text-[#9CA3AF]">
              Showing {displayed.length} delivery{displayed.length !== 1 ? "ies" : "y"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
