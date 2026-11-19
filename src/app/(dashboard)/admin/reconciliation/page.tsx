"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Upload, FileText, CheckCircle2, AlertTriangle, HelpCircle,
  ChevronLeft, ChevronRight, RefreshCw, Play, X, Filter,
} from "lucide-react";

interface Report {
  id: string; marketplace: string; filename: string; status: string;
  totalRows: number; matchedRows: number; unmatchedRows: number;
  discrepancyRows: number; settledRows: number; createdAt: string;
  uploadedBy: { name: string | null; email: string };
  _count: { entries: number };
}

interface Entry {
  id: string; marketplaceOrderId: string; orderId: string | null;
  grossAmount: number; marketplaceFee: number; tds: number; shippingFee: number;
  netAmount: number; ourNetPayable: number | null; discrepancyAmount: number | null;
  discrepancyReason: string | null; status: string; settlementId: string | null;
}

function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

const STATUS_CFG: Record<string, { bg: string; color: string; icon: React.ElementType }> = {
  MATCHED:     { bg: "#F0FDF4", color: "#15803D", icon: CheckCircle2 },
  UNMATCHED:   { bg: "#FEF2F2", color: "#DC2626", icon: HelpCircle },
  DISCREPANCY: { bg: "#FFF7ED", color: "#D97706", icon: AlertTriangle },
  SETTLED:     { bg: "#EFF6FF", color: "#2563EB", icon: CheckCircle2 },
};

const MP_COLOR: Record<string, string> = {
  AMAZON:   "#FF9900", FLIPKART: "#2874F0", MEESHO: "#F43397",
};

const MARKETPLACES = ["AMAZON", "FLIPKART", "MEESHO"] as const;

export default function ReconciliationPage() {
  const [reports, setReports]     = useState<Report[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [pages, setPages]         = useState(1);
  const [loading, setLoading]     = useState(true);
  const [mpFilter, setMpFilter]   = useState("");

  // Upload state
  const [uploading, setUploading]   = useState(false);
  const [uploadMp, setUploadMp]     = useState<string>("AMAZON");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<{ matchedRows: number; unmatchedRows: number; discrepancyRows: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Detail pane
  const [selected, setSelected]     = useState<Report | null>(null);
  const [entries, setEntries]        = useState<Entry[]>([]);
  const [entryTotal, setEntryTotal]  = useState(0);
  const [entryPage, setEntryPage]    = useState(1);
  const [entryPages, setEntryPages]  = useState(1);
  const [entryStatus, setEntryStatus]= useState("");
  const [entryLoading, setEntryLoading] = useState(false);
  const [applying, setApplying]      = useState(false);
  const [applyResult, setApplyResult]= useState<{ settled: number; failed: number } | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: "15" });
    if (mpFilter) p.set("marketplace", mpFilter);
    const r = await fetch(`/api/admin/reconciliation?${p}`);
    if (r.ok) {
      const d = await r.json();
      setReports(d.reports); setTotal(d.total); setPages(d.pages);
    }
    setLoading(false);
  }, [page, mpFilter]);

  const fetchEntries = useCallback(async () => {
    if (!selected) return;
    setEntryLoading(true);
    const p = new URLSearchParams({ page: String(entryPage), limit: "50" });
    if (entryStatus) p.set("status", entryStatus);
    const r = await fetch(`/api/admin/reconciliation/${selected.id}?${p}`);
    if (r.ok) {
      const d = await r.json();
      setEntries(d.entries); setEntryTotal(d.total); setEntryPages(d.pages);
    }
    setEntryLoading(false);
  }, [selected, entryPage, entryStatus]);

  useEffect(() => { fetchReports(); }, [fetchReports]);
  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  async function handleUpload() {
    if (!uploadFile) return;
    setUploading(true);
    setUploadResult(null);
    const fd = new FormData();
    fd.append("file", uploadFile);
    fd.append("marketplace", uploadMp);
    const r = await fetch("/api/admin/reconciliation/upload", { method: "POST", body: fd });
    if (r.ok) {
      const d = await r.json();
      setUploadResult(d);
      setUploadFile(null);
      if (fileRef.current) fileRef.current.value = "";
      fetchReports();
    } else {
      const e = await r.json();
      alert(e.error ?? "Upload failed");
    }
    setUploading(false);
  }

  async function handleApply() {
    if (!selected) return;
    setApplying(true);
    setApplyResult(null);
    const r = await fetch(`/api/admin/reconciliation/${selected.id}/apply`, { method: "POST" });
    if (r.ok) {
      const d = await r.json();
      setApplyResult(d);
      fetchEntries();
      fetchReports();
    }
    setApplying(false);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page)" }}>
      <div className="px-4 pt-5 md:px-8 md:pt-8 space-y-4">
        <div>
          <h1 className="text-[22px] font-black text-[#0C1220]">Reconciliation</h1>
          <p className="text-[12.5px] text-[#6B7280] mt-1">Upload a marketplace settlement CSV (Amazon, Flipkart, Meesho), match it to orders and flag amounts that don&apos;t add up.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Settlement reports", value: String(total) },
            { label: "Marketplaces", value: "Amazon · Flipkart · Meesho" },
            { label: "Money flow", value: "Marketplace → Seller → AXQEN" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-[#E8EDF6] p-4">
              <p className="text-[11.5px] font-semibold text-[#6B7280]">{label}</p>
              <p className="text-[18px] font-black text-[#0C1220] mt-1">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 md:px-8 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Upload + Reports list */}
        <div className="space-y-4 lg:col-span-1">
          {/* Upload card */}
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-900)" }}>
              Upload Settlement CSV
            </h3>

            <div className="flex gap-2">
              {MARKETPLACES.map(mp => (
                <button key={mp} onClick={() => setUploadMp(mp)}
                  className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all"
                  style={uploadMp === mp
                    ? { background: MP_COLOR[mp], color: "var(--text-primary)" }
                    : { background: "var(--bg-muted)", color: "var(--text-400)", border: "1px solid var(--border)" }}>
                  {mp === "AMAZON" ? "Amazon" : mp === "FLIPKART" ? "Flipkart" : "Meesho"}
                </button>
              ))}
            </div>

            <div
              className="rounded-xl p-4 text-center cursor-pointer transition-all"
              style={{ border: "2px dashed var(--border)", background: "var(--bg-muted)" }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setUploadFile(f); }}>
              <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--text-300)" }} />
              {uploadFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4" style={{ color: "var(--accent)" }} />
                  <span className="text-xs font-medium truncate max-w-[140px]"
                    style={{ color: "var(--text-900)" }}>{uploadFile.name}</span>
                  <button onClick={e => { e.stopPropagation(); setUploadFile(null); }}>
                    <X className="w-3 h-3" style={{ color: "var(--text-400)" }} />
                  </button>
                </div>
              ) : (
                <p className="text-xs" style={{ color: "var(--text-400)" }}>
                  Click or drag CSV here
                </p>
              )}
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
                onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
            </div>

            <button
              disabled={!uploadFile || uploading}
              onClick={handleUpload}
              className="w-full py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
              style={{ background: uploadFile ? "var(--accent)" : "var(--bg-muted)" }}>
              {uploading ? "Processing…" : "Upload & Match"}
            </button>

            {uploadResult && (
              <div className="rounded-xl p-3 space-y-1"
                style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                <p className="text-xs font-semibold" style={{ color: "#15803D" }}>Upload complete</p>
                <p className="text-xs" style={{ color: "#16A34A" }}>
                  Matched: {uploadResult.matchedRows} · Unmatched: {uploadResult.unmatchedRows} · Discrepancy: {uploadResult.discrepancyRows}
                </p>
              </div>
            )}
          </div>

          {/* Reports list */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <Filter className="w-3.5 h-3.5" style={{ color: "var(--text-400)" }} />
              <select value={mpFilter} onChange={e => { setMpFilter(e.target.value); setPage(1); }}
                className="text-xs flex-1 rounded-lg px-2 py-1 border"
                style={{ background: "var(--bg-card)", color: "var(--text-900)", borderColor: "var(--border)" }}>
                <option value="">All Marketplaces</option>
                {MARKETPLACES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {loading ? (
              <div className="p-6 flex justify-center">
                <RefreshCw className="w-4 h-4 animate-spin" style={{ color: "var(--text-300)" }} />
              </div>
            ) : reports.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-2">
                <FileText className="w-8 h-8" style={{ color: "var(--border)" }} />
                <p className="text-xs" style={{ color: "var(--text-400)" }}>No reports yet</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {reports.map(r => (
                  <div key={r.id}
                    className={`px-4 py-3 cursor-pointer transition-colors ${selected?.id === r.id ? "bg-green-50/60" : "hover:bg-gray-50/40"}`}
                    onClick={() => { setSelected(r); setEntryPage(1); setEntryStatus(""); setApplyResult(null); }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold" style={{ color: MP_COLOR[r.marketplace] ?? "var(--accent)" }}>
                        {r.marketplace}
                      </span>
                      <span className="text-xs truncate max-w-[120px]" style={{ color: "var(--text-400)" }}>
                        {r.filename}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span style={{ color: "#15803D" }}>✓ {r.matchedRows}</span>
                      <span style={{ color: "#DC2626" }}>✗ {r.unmatchedRows}</span>
                      <span style={{ color: "#D97706" }}>⚠ {r.discrepancyRows}</span>
                      <span className="ml-auto" style={{ color: "var(--text-300)" }}>
                        {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pages > 1 && (
              <div className="px-4 py-2 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)" }}>
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="p-1 rounded disabled:opacity-30"
                  style={{ border: "1px solid var(--border)" }}>
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <span className="text-xs" style={{ color: "var(--text-400)" }}>{page}/{pages}</span>
                <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                  className="p-1 rounded disabled:opacity-30"
                  style={{ border: "1px solid var(--border)" }}>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Entry detail */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="card py-20 flex flex-col items-center gap-3">
              <FileText className="w-10 h-10" style={{ color: "var(--border)" }} />
              <p className="text-sm" style={{ color: "var(--text-400)" }}>Select a report to view entries</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 flex items-center gap-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: MP_COLOR[selected.marketplace] }}>
                      {selected.marketplace}
                    </span>
                    <span className="text-xs truncate" style={{ color: "var(--text-500)" }}>
                      {selected.filename}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs">
                    <span style={{ color: "#15803D" }}>✓ {selected.matchedRows} matched</span>
                    <span style={{ color: "#DC2626" }}>✗ {selected.unmatchedRows} unmatched</span>
                    <span style={{ color: "#D97706" }}>⚠ {selected.discrepancyRows} discrepancy</span>
                    <span style={{ color: "#2563EB" }}>💳 {selected.settledRows} settled</span>
                  </div>
                </div>

                <button
                  onClick={handleApply}
                  disabled={applying || selected.matchedRows === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-40"
                  style={{ background: "#16A34A" }}>
                  {applying
                    ? <><RefreshCw className="w-3 h-3 animate-spin" /> Applying…</>
                    : <><Play className="w-3 h-3" /> Apply Settlements</>}
                </button>
              </div>

              {applyResult && (
                <div className="px-5 py-3 flex items-center gap-3"
                  style={{ background: "#F0FDF4", borderBottom: "1px solid #BBF7D0" }}>
                  <CheckCircle2 className="w-4 h-4" style={{ color: "#15803D" }} />
                  <p className="text-xs" style={{ color: "#15803D" }}>
                    Applied {applyResult.settled} settlements.
                    {applyResult.failed > 0 && ` ${applyResult.failed} failed.`}
                  </p>
                </div>
              )}

              {/* Filter tabs */}
              <div className="px-5 py-2 flex items-center gap-1" style={{ borderBottom: "1px solid var(--border)" }}>
                {["", "MATCHED", "UNMATCHED", "DISCREPANCY", "SETTLED"].map(st => (
                  <button key={st} onClick={() => { setEntryStatus(st); setEntryPage(1); }}
                    className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                    style={entryStatus === st
                      ? { background: "var(--bg-sidebar)", color: "var(--text-primary)" }
                      : { color: "var(--text-400)" }}>
                    {st === "" ? "All" : st === "MATCHED" ? "Matched" : st === "UNMATCHED" ? "Unmatched" : st === "DISCREPANCY" ? "Discrepancy" : "Settled"}
                  </button>
                ))}
                <span className="ml-auto text-xs" style={{ color: "var(--text-400)" }}>
                  {entryTotal} rows
                </span>
              </div>

              {/* Entries table */}
              {entryLoading ? (
                <div className="p-8 flex justify-center">
                  <RefreshCw className="w-5 h-5 animate-spin" style={{ color: "var(--text-300)" }} />
                </div>
              ) : entries.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-2">
                  <FileText className="w-8 h-8" style={{ color: "var(--border)" }} />
                  <p className="text-sm" style={{ color: "var(--text-400)" }}>No entries</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border)", background: "#FAFAFA" }}>
                          {["Marketplace Order ID", "Gross", "Mkt Fee", "TDS", "Net (Mkt)", "Our Net", "Δ Diff", "Status"].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide"
                              style={{ color: "var(--text-400)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                        {entries.map(e => {
                          const cfg = STATUS_CFG[e.status] ?? STATUS_CFG.UNMATCHED;
                          const Icon = cfg.icon;
                          return (
                            <tr key={e.id} className="hover:bg-gray-50/40">
                              <td className="px-3 py-2.5 font-mono font-medium" style={{ color: "var(--text-900)" }}>
                                {e.marketplaceOrderId}
                              </td>
                              <td className="px-3 py-2.5" style={{ color: "#16A34A" }}>{fmt(e.grossAmount)}</td>
                              <td className="px-3 py-2.5" style={{ color: "#EF4444" }}>{fmt(e.marketplaceFee)}</td>
                              <td className="px-3 py-2.5" style={{ color: "#6366F1" }}>{fmt(e.tds)}</td>
                              <td className="px-3 py-2.5 font-semibold" style={{ color: "#3B82F6" }}>{fmt(e.netAmount)}</td>
                              <td className="px-3 py-2.5" style={{ color: "var(--text-500)" }}>
                                {e.ourNetPayable != null ? fmt(e.ourNetPayable) : "—"}
                              </td>
                              <td className="px-3 py-2.5 font-semibold"
                                style={{ color: (e.discrepancyAmount ?? 0) > 0 ? "#15803D" : (e.discrepancyAmount ?? 0) < 0 ? "#DC2626" : "var(--text-400)" }}>
                                {e.discrepancyAmount != null
                                  ? `${e.discrepancyAmount > 0 ? "+" : ""}${fmt(Math.abs(e.discrepancyAmount))}`
                                  : "—"}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-1">
                                  <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                                  <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold"
                                    style={{ background: cfg.bg, color: cfg.color }}>
                                    {e.status}
                                  </span>
                                </div>
                                {e.discrepancyReason && (
                                  <p className="mt-0.5 text-xs leading-tight" style={{ color: "#D97706" }}>
                                    {e.discrepancyReason}
                                  </p>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {entryPages > 1 && (
                    <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)" }}>
                      <span className="text-xs" style={{ color: "var(--text-400)" }}>
                        Page {entryPage} of {entryPages}
                      </span>
                      <div className="flex items-center gap-2">
                        <button disabled={entryPage <= 1} onClick={() => setEntryPage(p => p - 1)}
                          className="p-1 rounded-lg disabled:opacity-30"
                          style={{ border: "1px solid var(--border)" }}>
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button disabled={entryPage >= entryPages} onClick={() => setEntryPage(p => p + 1)}
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
          )}
        </div>
      </div>
    </div>
  );
}
