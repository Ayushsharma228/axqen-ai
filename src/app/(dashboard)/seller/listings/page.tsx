"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ListChecks, Clock, CheckCircle, XCircle, Loader2,
  Package, ExternalLink, RefreshCw, AlertCircle,
  Sparkles, Upload, ChevronDown, ChevronUp, Copy, Check, AlertTriangle,
} from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";

// ─── Amazon Live Listings ─────────────────────────────────────────────────────

interface AmazonListing {
  sku: string; asin?: string; title?: string; productType?: string;
  status?: string[]; price?: number; currency?: string;
  quantity?: number; image?: string; lastUpdated?: string;
}
interface Analysis {
  healthScore: number; grade: string; issues: string[];
  optimizedTitle: string; titleTips: string[];
  keywordSuggestions: string[]; summary: string;
}

function HealthBadge({ score }: { score: number }) {
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : score >= 40 ? "#f97316" : "#ef4444";
  const label = score >= 80 ? "Good" : score >= 60 ? "Fair" : score >= 40 ? "Poor" : "Critical";
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: `${color}18`, color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {score} · {label}
    </span>
  );
}

function AmazonListingsTab() {
  const [listings,    setListings]    = useState<AmazonListing[]>([]);
  const [syncing,     setSyncing]     = useState(false);
  const [syncStatus,  setSyncStatus]  = useState<string | null>(null);
  const [syncError,   setSyncError]   = useState<string | null>(null);
  const [analyses,   setAnalyses]   = useState<Record<string, Analysis>>({});
  const [analyzing,  setAnalyzing]  = useState<Record<string, boolean>>({});
  const [expanded,   setExpanded]   = useState<Record<string, boolean>>({});
  const [pushing,    setPushing]    = useState<Record<string, boolean>>({});
  const [pushResult, setPushResult] = useState<Record<string, "ok" | "err">>({});
  const [copied,     setCopied]     = useState<string | null>(null);

  const syncListings = useCallback(async () => {
    setSyncing(true); setSyncError(null); setSyncStatus("Requesting report from Amazon…");
    try {
      // Step 1: request report
      const startRes  = await fetch("/api/seller/amazon/listings", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const startData = await startRes.json() as { reportId?: string; error?: string };
      if (!startRes.ok || startData.error) throw new Error(startData.error ?? "Failed to start report");
      const reportId = startData.reportId!;

      setSyncStatus("Amazon is generating report… (this can take up to 5 minutes)");

      // Step 2: poll until DONE (frontend polling, 5s interval, max 8 minutes)
      for (let i = 0; i < 96; i++) {
        await new Promise(r => setTimeout(r, 5000));
        setSyncStatus(`Checking report status… (${Math.round((i + 1) * 5 / 60)}m ${((i + 1) * 5) % 60}s)`);
        const pollRes  = await fetch(`/api/seller/amazon/listings?reportId=${reportId}`);
        const pollData = await pollRes.json() as { status?: string; listings?: AmazonListing[]; error?: string };
        if (pollData.error) throw new Error(pollData.error);
        if (pollData.status === "DONE") {
          setSyncStatus(null);
          setListings(pollData.listings ?? []);
          if ((pollData.listings ?? []).length === 0) setSyncError("No active listings found on this Amazon account.");
          return;
        }
        if (pollData.status === "FATAL" || pollData.status === "CANCELLED") throw new Error("Report failed on Amazon side");
      }
      throw new Error("Sync timed out — Amazon report took too long. Please try again.");
    } catch (e) { setSyncError(String(e)); setSyncStatus(null); }
    finally { setSyncing(false); }
  }, []);

  const analyze = useCallback(async (l: AmazonListing) => {
    setAnalyzing(a => ({ ...a, [l.sku]: true }));
    setExpanded(e => ({ ...e, [l.sku]: true }));
    try {
      const res  = await fetch("/api/seller/amazon/listings/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: l.sku, title: l.title, asin: l.asin, price: l.price, quantity: l.quantity, status: l.status }),
      });
      const data = await res.json() as Analysis;
      setAnalyses(a => ({ ...a, [l.sku]: data }));
    } catch (e) { console.error(e); }
    finally { setAnalyzing(a => ({ ...a, [l.sku]: false })); }
  }, []);

  const pushToAmazon = useCallback(async (l: AmazonListing) => {
    const analysis = analyses[l.sku];
    if (!analysis?.optimizedTitle) return;
    setPushing(p => ({ ...p, [l.sku]: true }));
    try {
      const res  = await fetch("/api/seller/amazon/listings/push", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: l.sku, newTitle: analysis.optimizedTitle, productType: l.productType }),
      });
      const data = await res.json() as { ok?: boolean };
      setPushResult(r => ({ ...r, [l.sku]: data.ok ? "ok" : "err" }));
      if (data.ok) setListings(ls => ls.map(x => x.sku === l.sku ? { ...x, title: analysis.optimizedTitle } : x));
    } catch { setPushResult(r => ({ ...r, [l.sku]: "err" })); }
    finally { setPushing(p => ({ ...p, [l.sku]: false })); }
  }, [analyses]);

  const copyTitle = useCallback((title: string, key: string) => {
    navigator.clipboard.writeText(title);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "#6B7280" }}>
          {listings.length > 0 ? `${listings.length} live listings from Amazon.in` : "Sync to see your live Amazon listings"}
        </p>
        <button onClick={syncListings} disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{ background: syncing ? "#E8EBFF" : "#4361EE", color: syncing ? "#4361EE" : "white" }}>
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync from Amazon"}
        </button>
      </div>

      {syncStatus && (
        <div className="px-4 py-3 rounded-xl flex items-center gap-2 text-sm"
          style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }}>
          <RefreshCw className="w-4 h-4 flex-shrink-0 animate-spin" />{syncStatus}
        </div>
      )}

      {syncError && (
        <div className="px-4 py-3 rounded-xl flex items-center gap-2 text-sm"
          style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />{syncError}
        </div>
      )}

      {listings.length === 0 && !syncing && (
        <div className="bg-white rounded-2xl p-10 text-center" style={{ border: "1px solid var(--border)" }}>
          <Package className="w-10 h-10 mx-auto mb-3" style={{ color: "#C7D2FE" }} />
          <p className="font-semibold text-sm" style={{ color: "#1e1b4b" }}>No listings synced yet</p>
          <p className="text-xs mt-1 mb-4" style={{ color: "#9CA3AF" }}>Click "Sync from Amazon" to pull your live listings</p>
          <button onClick={syncListings}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "#4361EE" }}>
            Sync Now
          </button>
        </div>
      )}

      {listings.map((listing) => {
        const analysis   = analyses[listing.sku];
        const isExpanded = expanded[listing.sku];
        const active     = listing.status?.[0] === "BUYABLE";
        return (
          <div key={listing.sku} className="bg-white rounded-2xl overflow-hidden"
            style={{ border: "1px solid var(--border)" }}>
            <div className="p-4 md:p-5">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center"
                  style={{ background: "#F1F5FF", border: "1px solid #E8EBFF" }}>
                  {listing.image
                    ? <img src={listing.image} alt="" className="w-full h-full object-contain" />
                    : <Package className="w-6 h-6" style={{ color: "#C7D2FE" }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: "#1e1b4b" }}>
                    {listing.title ?? "No title"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="text-xs font-mono" style={{ color: "#9CA3AF" }}>SKU: {listing.sku}</span>
                    {listing.asin && <span className="text-xs font-mono" style={{ color: "#9CA3AF" }}>ASIN: {listing.asin}</span>}
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: active ? "#22c55e18" : "#ef444418", color: active ? "#16a34a" : "#dc2626" }}>
                      {listing.status?.[0] ?? "Unknown"}
                    </span>
                    {analysis && <HealthBadge score={analysis.healthScore} />}
                  </div>
                  <div className="flex gap-4 mt-1.5">
                    {listing.price !== undefined && (
                      <span className="text-sm font-bold" style={{ color: "#1e1b4b" }}>₹{listing.price.toLocaleString("en-IN")}</span>
                    )}
                    {listing.quantity !== undefined && (
                      <span className="text-xs" style={{ color: listing.quantity < 5 ? "#ef4444" : "#6B7280" }}>
                        Stock: {listing.quantity}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => analyze(listing)} disabled={analyzing[listing.sku]}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                    style={{ background: "rgba(67,97,238,0.08)", color: "#4361EE" }}>
                    <Sparkles className={`w-3.5 h-3.5 ${analyzing[listing.sku] ? "animate-pulse" : ""}`} />
                    {analyzing[listing.sku] ? "Analyzing…" : "AI Analyze"}
                  </button>
                  <button onClick={() => setExpanded(e => ({ ...e, [listing.sku]: !isExpanded }))}
                    className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#F1F5FF" }}>
                    {isExpanded ? <ChevronUp className="w-4 h-4" style={{ color: "#6B7280" }} />
                                : <ChevronDown className="w-4 h-4" style={{ color: "#6B7280" }} />}
                  </button>
                </div>
              </div>
            </div>

            {isExpanded && analysis && (
              <div className="border-t px-5 py-4 space-y-4" style={{ borderColor: "#F1F5FF", background: "#FAFBFF" }}>
                {/* Score */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold" style={{ color: "#1e1b4b" }}>Health · Grade {analysis.grade}</span>
                    <HealthBadge score={analysis.healthScore} />
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "#E8EBFF" }}>
                    <div className="h-2 rounded-full transition-all" style={{
                      width: `${analysis.healthScore}%`,
                      background: analysis.healthScore >= 80 ? "#22c55e" : analysis.healthScore >= 60 ? "#f59e0b" : "#ef4444",
                    }} />
                  </div>
                  <p className="text-xs mt-1.5" style={{ color: "#6B7280" }}>{analysis.summary}</p>
                </div>

                {/* Issues */}
                {analysis.issues.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: "#ef4444" }}>Issues</p>
                    {analysis.issues.map((issue, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs mb-1" style={{ color: "#6B7280" }}>
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#f97316" }} />
                        {issue}
                      </div>
                    ))}
                  </div>
                )}

                {/* Optimized title */}
                <div className="p-3 rounded-xl" style={{ background: "rgba(67,97,238,0.05)", border: "1px solid rgba(67,97,238,0.12)" }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-semibold" style={{ color: "#4361EE" }}>
                      <Sparkles className="w-3 h-3 inline mr-1" />AI Optimized Title
                    </p>
                    <button onClick={() => copyTitle(analysis.optimizedTitle, listing.sku)}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                      style={{ color: "#4361EE", background: "rgba(67,97,238,0.08)" }}>
                      {copied === listing.sku ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                    </button>
                  </div>
                  <p className="text-sm" style={{ color: "#1e1b4b" }}>{analysis.optimizedTitle}</p>
                  <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>{analysis.optimizedTitle.length} chars</p>
                </div>

                {/* Tips */}
                {analysis.titleTips.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: "#1e1b4b" }}>Tips</p>
                    {analysis.titleTips.map((tip, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs mb-1" style={{ color: "#6B7280" }}>
                        <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#22c55e" }} />{tip}
                      </div>
                    ))}
                  </div>
                )}

                {/* Keywords */}
                {analysis.keywordSuggestions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: "#1e1b4b" }}>Suggested Keywords</p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.keywordSuggestions.map((kw, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{ background: "rgba(67,97,238,0.08)", color: "#4361EE" }}>{kw}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Push */}
                <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: "#E8EBFF" }}>
                  <button onClick={() => pushToAmazon(listing)} disabled={pushing[listing.sku]}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white"
                    style={{ background: pushing[listing.sku] ? "#A5B4FC" : "#4361EE" }}>
                    <Upload className={`w-3.5 h-3.5 ${pushing[listing.sku] ? "animate-bounce" : ""}`} />
                    {pushing[listing.sku] ? "Pushing…" : "Push Optimized Title to Amazon"}
                  </button>
                  {pushResult[listing.sku] === "ok" && (
                    <span className="text-xs flex items-center gap-1" style={{ color: "#22c55e" }}>
                      <CheckCircle className="w-3.5 h-3.5" /> Pushed!
                    </span>
                  )}
                  {pushResult[listing.sku] === "err" && (
                    <span className="text-xs flex items-center gap-1" style={{ color: "#ef4444" }}>
                      <XCircle className="w-3.5 h-3.5" /> Failed — check Seller Central
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface Listing {
  id: string;
  platform: string;
  status: string;
  adminNote: string | null;
  listedUrl: string | null;
  createdAt: string;
  product: { id: string; name: string; sku: string | null; images: string[]; price: number };
}

interface Stats {
  total: number; pending: number; inProgress: number; listed: number; failed: number;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  PENDING:     { label: "Pending",     bg: "#FFF7ED", color: "#D97706" },
  IN_PROGRESS: { label: "In Progress", bg: "#EFF6FF", color: "#3B82F6" },
  LISTED:      { label: "Listed",      bg: "#F0FDF4", color: "#16A34A" },
  FAILED:      { label: "Failed",      bg: "#FEF2F2", color: "#DC2626" },
};

const PLATFORM_CONFIG: Record<string, { bg: string; color: string }> = {
  AMAZON:  { bg: "#FFF7ED", color: "#EA580C" },
  EBAY:    { bg: "#EFF6FF", color: "#3B82F6" },
  ETSY:    { bg: "#FDF2F8", color: "#DB2777" },
  WALMART: { bg: "#F0F9FF", color: "#0284C7" },
  SHOPIFY: { bg: "#F0FDF4", color: "#16A34A" },
  OTHER:   { bg: "#F9FAFB", color: "#6B7280" },
};

const FILTERS = ["ALL", "PENDING", "IN_PROGRESS", "LISTED", "FAILED"];

export default function SellerListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, inProgress: 0, listed: 0, failed: 0 });
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"requests" | "amazon">("requests");

  useEffect(() => {
    fetch("/api/seller/listings")
      .then(r => r.json())
      .then(d => {
        setListings(d.listings ?? []);
        if (d.stats) setStats(d.stats);
      })
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "ALL" ? listings : listings.filter(l => l.status === filter);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page)" }}>
      <PageHero
        title="My Listings"
        subtitle="Track your marketplace listing requests and their status"
        cards={
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Total",       value: stats.total,      icon: ListChecks,  color: "#7C3AED" },
              { label: "Pending",     value: stats.pending,    icon: Clock,       color: "#D97706" },
              { label: "In Progress", value: stats.inProgress, icon: Loader2,     color: "#3B82F6" },
              { label: "Listed",      value: stats.listed,     icon: CheckCircle, color: "#16A34A" },
              { label: "Failed",      value: stats.failed,     icon: XCircle,     color: "#DC2626" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-2xl px-4 py-4 flex items-center gap-3"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--bg-muted)" }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
                  <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        }
      />

      <div className="px-4 md:px-8 py-6 space-y-5">

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "#E8EBFF" }}>
          {([["requests", "Listing Requests"], ["amazon", "Amazon Live"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: tab === key ? "white" : "transparent",
                color:      tab === key ? "#4361EE" : "#6B7280",
                boxShadow:  tab === key ? "0 1px 4px rgba(67,97,238,0.15)" : "none",
              }}>
              {label}
            </button>
          ))}
        </div>

        {tab === "amazon" && <AmazonListingsTab />}

        {tab === "requests" && <>

        {/* Failed alert */}
        {stats.failed > 0 && (
          <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl"
            style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 font-medium">
              {stats.failed} listing{stats.failed > 1 ? "s" : ""} failed — check admin notes below for details.
            </p>
          </div>
        )}

        {/* Status filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map(f => {
            const cfg = STATUS_CONFIG[f];
            const isActive = filter === f;
            return (
              <button key={f} onClick={() => setFilter(f)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={isActive
                  ? { background: cfg ? cfg.color : "var(--bg-sidebar)", color: "var(--text-primary)" }
                  : { background: cfg ? cfg.bg : "#F3F4F6", color: cfg ? cfg.color : "var(--text-600)" }}>
                {f === "ALL" ? "All" : STATUS_CONFIG[f]?.label ?? f}
              </button>
            );
          })}
        </div>

        {/* Listings */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <ListChecks className="w-4 h-4" style={{ color: "var(--text-400)" }} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-900)" }}>
                Listing Requests ({filtered.length})
              </h2>
            </div>
          </div>

          {loading ? (
            <div className="py-16 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin" style={{ color: "var(--text-400)" }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <ListChecks className="w-10 h-10" style={{ color: "var(--border)" }} />
              <p className="text-sm" style={{ color: "var(--text-400)" }}>
                {filter === "ALL" ? "No listing requests yet" : `No ${STATUS_CONFIG[filter]?.label.toLowerCase()} listings`}
              </p>
              <p className="text-xs text-center max-w-xs" style={{ color: "var(--text-400)" }}>
                To list a product on a marketplace, go to your Product Catalog and click &quot;List on Marketplace&quot;.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "#FAFAFA" }}>
                  {["Product", "Platform", "Status", "Admin Note", "Requested"].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--text-400)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                {filtered.map(l => {
                  const statusCfg = STATUS_CONFIG[l.status] ?? { label: l.status, bg: "#F9FAFB", color: "#6B7280" };
                  const platformCfg = PLATFORM_CONFIG[l.platform] ?? PLATFORM_CONFIG.OTHER;
                  return (
                    <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                            {l.product.images?.[0] ? (
                              <img src={l.product.images[0]} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-4 h-4 text-gray-300" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate max-w-[180px]"
                              style={{ color: "var(--text-900)" }}>{l.product.name}</p>
                            <p className="text-xs mt-0.5" style={{ color: "var(--text-400)" }}>
                              {l.product.sku ?? "—"} · ₹{l.product.price.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{ background: platformCfg.bg, color: platformCfg.color }}>
                          {l.platform}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{ background: statusCfg.bg, color: statusCfg.color }}>
                          {statusCfg.label}
                        </span>
                        {l.listedUrl && (
                          <a href={l.listedUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs mt-1"
                            style={{ color: "var(--green-500)" }}>
                            <ExternalLink className="w-3 h-3" /> View listing
                          </a>
                        )}
                      </td>

                      <td className="px-5 py-3.5 max-w-[220px]">
                        {l.adminNote ? (
                          <p className="text-xs leading-relaxed"
                            style={{ color: l.status === "FAILED" ? "#DC2626" : "var(--text-600)" }}>
                            {l.adminNote}
                          </p>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--text-400)" }}>—</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-xs whitespace-nowrap" style={{ color: "var(--text-400)" }}>
                        {new Date(l.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </div>
        </>}
      </div>
    </div>
  );
}
