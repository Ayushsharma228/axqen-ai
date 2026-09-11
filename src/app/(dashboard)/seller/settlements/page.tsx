"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Receipt, ChevronLeft, ChevronRight, RefreshCw, Download,
  Search, AlertTriangle, CheckCircle, Clock, TrendingUp,
  ChevronDown, ChevronUp, Calendar, Loader2,
} from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";

interface Order {
  id: string; externalOrderId: string; customerName: string | null;
  source: string; createdAt: string;
}

interface Settlement {
  id: string; status: string; sellingPrice: number; platformFee: number;
  gstOnFees: number; netPayable: number; supplierPayable: number;
  shippingCharge: number; packingCharge: number; codFee: number;
  adSpend: number; marketplaceFee: number; otherDeductions: number;
  grossProfit: number | null; netProfit: number | null;
  createdAt: string; settledAt: string | null; notes: string | null;
  marketplace: string | null; order: Order | null;
}

interface SettlementData {
  settlements: Settlement[];
  total: number; page: number; pages: number;
  summary: {
    grossRevenue: number; platformFee: number; gstOnFees: number;
    netPayable: number; shippingCharge: number; packingCharge: number;
    codFee: number; adSpend: number; marketplaceFee: number;
    grossProfit: number; netProfit: number;
  };
  upcomingPayout: { amount: number; count: number; nextDate: string | null };
  inPipeline:     { amount: number; count: number };
}

function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
function fmtDate(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  PENDING:    { bg: "#FFF7ED", color: "#D97706" },
  PROCESSING: { bg: "#EFF6FF", color: "#2563EB" },
  SETTLED:    { bg: "#F5F3FF", color: "#7C3AED" },
  PAID:       { bg: "#F0FDF4", color: "#15803D" },
  REVERSED:   { bg: "#FEF2F2", color: "#DC2626" },
  DISPUTED:   { bg: "#FEF3C7", color: "#B45309" },
};

const DISPUTE_REASONS = [
  "Incorrect amount",
  "Wrong deductions applied",
  "Order not delivered but marked delivered",
  "Duplicate settlement",
  "Missing payment",
  "Incorrect RTO charge",
  "Other",
];

const DISPUTABLE_STATUSES = ["PENDING", "PROCESSING", "SETTLED", "PAID"];

export default function SellerSettlementsPage() {
  const [data, setData]         = useState<SettlementData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch]     = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Export date range
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo,   setExportTo]   = useState("");
  const [showExport, setShowExport] = useState(false);

  // Dispute state per settlement
  const [disputeOpen,   setDisputeOpen]   = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState(DISPUTE_REASONS[0]);
  const [disputeNote,   setDisputeNote]   = useState("");
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [disputeError,   setDisputeError]   = useState("");
  const [disputeOk,      setDisputeOk]      = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (statusFilter) params.set("status", statusFilter);
    if (search)       params.set("search", search);
    const r = await fetch(`/api/seller/settlements?${params}`);
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, [page, statusFilter, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleDispute(settlementId: string) {
    setDisputeLoading(true); setDisputeError(""); setDisputeOk(null);
    const res = await fetch("/api/seller/settlements/dispute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settlementId, reason: disputeReason, description: disputeNote }),
    });
    const json = await res.json();
    if (!res.ok) { setDisputeError(json.error || "Failed to raise dispute"); setDisputeLoading(false); return; }
    setDisputeOk(settlementId);
    setDisputeOpen(null);
    setDisputeNote("");
    setDisputeReason(DISPUTE_REASONS[0]);
    await fetchData();
    setDisputeLoading(false);
  }

  function openDispute(id: string) {
    setDisputeOpen(id); setDisputeError(""); setDisputeNote(""); setDisputeReason(DISPUTE_REASONS[0]);
  }

  const s   = data?.summary;
  const up  = data?.upcomingPayout;
  const pip = data?.inPipeline;

  const exportUrl = (() => {
    const params = new URLSearchParams();
    if (exportFrom) params.set("from", exportFrom);
    if (exportTo)   params.set("to", exportTo);
    return `/api/seller/settlements/export${params.toString() ? "?" + params : ""}`;
  })();

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page)" }}>
      <PageHero
        title="My Settlements"
        subtitle="Per-order financial breakdown and payout history"
        cards={
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Gross Revenue", value: s ? fmt(s.grossRevenue) : "—", color: "#16A34A", sub: null },
              { label: "Platform Fee",  value: s ? fmt(s.platformFee)  : "—", color: "#3B82F6", sub: null },
              { label: "Net Payable",   value: s ? fmt(s.netPayable)   : "—", color: "#A78BFA", sub: null },
              { label: "Net Profit",    value: s ? fmt(s.netProfit)    : "—", color: "#F59E0B", sub: null },
              {
                label: "Upcoming Payout",
                value: up ? fmt(up.amount) : "—",
                color: "#7C3AED",
                sub: up?.count ? `${up.count} order${up.count !== 1 ? "s" : ""} settled${up.nextDate ? " · " + fmtDate(up.nextDate) : ""}` : null,
              },
              {
                label: "In Pipeline",
                value: pip ? fmt(pip.amount) : "—",
                color: "#2563EB",
                sub: pip?.count ? `${pip.count} pending/processing` : null,
              },
            ].map(({ label, value, color, sub }) => (
              <div key={label} className="rounded-2xl px-4 py-3"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-medium uppercase tracking-wide mb-1"
                  style={{ color: "var(--text-muted)" }}>{label}</p>
                <p className="text-xl font-bold" style={{ color }}>{value}</p>
                {sub && <p className="text-xs mt-0.5" style={{ color: "var(--text-400)" }}>{sub}</p>}
              </div>
            ))}
          </div>
        }
      />

      <div className="px-4 md:px-8 py-6 space-y-4">
        {/* Upcoming payout banner if there's a scheduled date */}
        {up && up.amount > 0 && up.nextDate && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border"
            style={{ background: "#F5F3FF", borderColor: "#DDD6FE" }}>
            <Clock className="w-4 h-4 flex-shrink-0" style={{ color: "#7C3AED" }} />
            <p className="text-sm font-medium" style={{ color: "#5B21B6" }}>
              Next payout of <strong>{fmt(up.amount)}</strong> across {up.count} order{up.count !== 1 ? "s" : ""} scheduled for{" "}
              <strong>{fmtDate(up.nextDate)}</strong>
            </p>
          </div>
        )}
        {up && up.amount > 0 && !up.nextDate && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border"
            style={{ background: "#F5F3FF", borderColor: "#DDD6FE" }}>
            <Clock className="w-4 h-4 flex-shrink-0" style={{ color: "#7C3AED" }} />
            <p className="text-sm font-medium" style={{ color: "#5B21B6" }}>
              <strong>{fmt(up.amount)}</strong> across {up.count} settled order{up.count !== 1 ? "s" : ""} is pending release — typically credited within 24–48 hours.
            </p>
          </div>
        )}

        <div className="card overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-3 flex items-center gap-3 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: "var(--bg-muted)", border: "1px solid var(--border)" }}>
              <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-300)" }} />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search order or customer…"
                className="text-xs outline-none w-40"
                style={{ background: "transparent", color: "var(--text-900)" }} />
            </div>

            {/* Status filter */}
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="text-xs rounded-lg px-3 py-1.5 border outline-none"
              style={{ background: "var(--bg-card)", color: "var(--text-900)", borderColor: "var(--border)" }}>
              <option value="">All Status</option>
              {["PENDING","PROCESSING","SETTLED","PAID","REVERSED","DISPUTED"].map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>

            {data && (
              <span className="text-xs" style={{ color: "var(--text-400)" }}>
                {data.total} settlements
              </span>
            )}

            {/* Export */}
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setShowExport(p => !p)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ border: "1px solid var(--border)", color: "var(--text-400)", background: "var(--bg-card)" }}>
                <Download className="w-3.5 h-3.5" /> Export CSV
                {showExport ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Export date range panel */}
          {showExport && (
            <div className="px-5 py-3 flex items-center gap-3 flex-wrap"
              style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-muted)" }}>
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-400)" }} />
              <span className="text-xs" style={{ color: "var(--text-400)" }}>Date range:</span>
              <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)}
                className="text-xs border rounded-lg px-2 py-1 outline-none"
                style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-900)" }} />
              <span className="text-xs" style={{ color: "var(--text-300)" }}>→</span>
              <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)}
                className="text-xs border rounded-lg px-2 py-1 outline-none"
                style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-900)" }} />
              <a href={exportUrl} download
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ background: "#2563EB" }}>
                <Download className="w-3.5 h-3.5" /> Download
              </a>
              {!exportFrom && !exportTo && (
                <span className="text-xs" style={{ color: "var(--text-300)" }}>Leave blank to export all</span>
              )}
            </div>
          )}

          {loading ? (
            <div className="p-8 flex justify-center">
              <RefreshCw className="w-5 h-5 animate-spin" style={{ color: "var(--text-300)" }} />
            </div>
          ) : !data || data.settlements.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-2">
              <Receipt className="w-10 h-10" style={{ color: "var(--border)" }} />
              <p className="text-sm" style={{ color: "var(--text-400)" }}>No settlements found</p>
              <p className="text-xs" style={{ color: "var(--text-300)" }}>
                Settlements are generated automatically when orders are marked delivered.
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {data.settlements.map((s) => {
                  const badge   = STATUS_BADGE[s.status] ?? STATUS_BADGE.PENDING;
                  const isOpen  = expanded === s.id;
                  const isDisputePanel = disputeOpen === s.id;
                  const canDispute = DISPUTABLE_STATUSES.includes(s.status);
                  const isDisputed = s.status === "DISPUTED";

                  return (
                    <div key={s.id}>
                      {/* Summary row */}
                      <div className="px-5 py-3.5 flex items-center gap-4 cursor-pointer hover:bg-gray-50/40"
                        onClick={() => { setExpanded(isOpen ? null : s.id); setDisputeOpen(null); }}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-mono font-semibold" style={{ color: "var(--text-900)" }}>
                              #{s.order?.externalOrderId ?? s.id.slice(-8)}
                            </p>
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                              style={{ background: badge.bg, color: badge.color }}>
                              {s.status === "SETTLED" ? "Under Review" : s.status}
                            </span>
                            {s.marketplace && (
                              <span className="px-1.5 py-0.5 rounded text-xs"
                                style={{ background: "var(--bg-muted)", color: "var(--text-400)" }}>
                                {s.marketplace}
                              </span>
                            )}
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-400)" }}>
                            {s.order?.customerName ?? "—"} ·{" "}
                            {fmtDate(s.createdAt)}
                            {s.settledAt && <> · settled {fmtDate(s.settledAt)}</>}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold" style={{ color: "#16A34A" }}>{fmt(s.sellingPrice)}</p>
                          <p className="text-xs" style={{ color: "#A78BFA" }}>→ {fmt(s.netPayable)} to you</p>
                        </div>
                        {isOpen ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-300)" }} />
                                : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-300)" }} />}
                      </div>

                      {/* Expanded detail */}
                      {isOpen && (
                        <div className="px-5 pb-5 pt-3 space-y-4"
                          style={{ background: "var(--bg-muted)", borderTop: "1px solid var(--border)" }}>

                          {/* Dispute note if already disputed */}
                          {isDisputed && s.notes && (
                            <div className="flex items-start gap-2 px-3 py-2 rounded-lg border"
                              style={{ background: "#FEF3C7", borderColor: "#FDE68A" }}>
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-amber-700">{s.notes}</p>
                            </div>
                          )}

                          {/* Dispute success */}
                          {disputeOk === s.id && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-200 bg-green-50">
                              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                              <p className="text-xs text-green-700 font-medium">Dispute raised — our team will review within 2 business days.</p>
                            </div>
                          )}

                          {/* Breakdown grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                              { label: "Selling Price",   value: fmt(s.sellingPrice),        color: "#16A34A" },
                              { label: "Platform Fee",    value: fmt(s.platformFee),          color: "#3B82F6" },
                              { label: "GST (18%)",       value: fmt(s.gstOnFees),            color: "#6366F1" },
                              { label: "Shipping",        value: fmt(s.shippingCharge),       color: "#8B5CF6" },
                              { label: "Packing",         value: fmt(s.packingCharge),        color: "#EC4899" },
                              { label: "COD Fee",         value: fmt(s.codFee),               color: "#F97316" },
                              { label: "Ad Spend",        value: fmt(s.adSpend),              color: "#EF4444" },
                              { label: "Marketplace Fee", value: fmt(s.marketplaceFee),       color: "#DC2626" },
                              { label: "Other Deductions",value: fmt(s.otherDeductions ?? 0), color: "#9CA3AF" },
                              { label: "Net Payable",     value: fmt(s.netPayable),           color: "#A78BFA" },
                              { label: "Net Profit",      value: fmt(s.netProfit ?? 0),       color: (s.netProfit ?? 0) >= 0 ? "#16A34A" : "#EF4444" },
                              ...(s.settledAt ? [{ label: "Settled On", value: fmtDate(s.settledAt) ?? "—", color: "var(--text-500)" }] : []),
                            ].map(({ label, value, color }) => (
                              <div key={label} className="rounded-xl p-3"
                                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                                <p className="text-xs" style={{ color: "var(--text-400)" }}>{label}</p>
                                <p className="text-sm font-bold mt-0.5" style={{ color }}>{value}</p>
                              </div>
                            ))}
                          </div>

                          {/* Raise dispute button / form */}
                          {canDispute && !isDisputed && (
                            <div>
                              {!isDisputePanel ? (
                                <button onClick={(e) => { e.stopPropagation(); openDispute(s.id); }}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border"
                                  style={{ borderColor: "#FDE68A", background: "#FEF3C7", color: "#B45309" }}>
                                  <AlertTriangle className="w-3.5 h-3.5" /> Raise a Dispute
                                </button>
                              ) : (
                                <div className="rounded-xl border p-4 space-y-3"
                                  style={{ borderColor: "#FDE68A", background: "#FFFBEB" }}>
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold text-amber-700">Raise a Dispute</p>
                                    <button onClick={() => setDisputeOpen(null)}
                                      className="text-xs text-amber-500 hover:text-amber-700">Cancel</button>
                                  </div>

                                  {disputeError && (
                                    <p className="text-xs text-red-600">{disputeError}</p>
                                  )}

                                  <div>
                                    <label className="block text-xs font-medium text-amber-700 mb-1">Reason *</label>
                                    <select value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
                                      className="w-full text-xs rounded-lg px-3 py-2 border outline-none"
                                      style={{ background: "white", borderColor: "#FDE68A", color: "#374151" }}>
                                      {DISPUTE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-xs font-medium text-amber-700 mb-1">Details (optional)</label>
                                    <textarea value={disputeNote} onChange={e => setDisputeNote(e.target.value)}
                                      rows={2} placeholder="Describe the issue in detail…"
                                      className="w-full text-xs rounded-lg px-3 py-2 border outline-none resize-none"
                                      style={{ background: "white", borderColor: "#FDE68A", color: "#374151" }} />
                                  </div>

                                  <button onClick={() => handleDispute(s.id)} disabled={disputeLoading}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                                    style={{ background: "#D97706" }}>
                                    {disputeLoading
                                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting…</>
                                      : <><AlertTriangle className="w-3.5 h-3.5" /> Submit Dispute</>
                                    }
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {data.pages > 1 && (
                <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)" }}>
                  <span className="text-xs" style={{ color: "var(--text-400)" }}>
                    Page {data.page} of {data.pages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                      className="p-1 rounded-lg disabled:opacity-30"
                      style={{ border: "1px solid var(--border)" }}>
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}
                      className="p-1 rounded-lg disabled:opacity-30"
                      style={{ border: "1px solid var(--border)" }}>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
