"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ListChecks, Clock, CheckCircle, XCircle, Loader2,
  Package, ExternalLink, RefreshCw, AlertCircle,
  Sparkles, Upload, ChevronDown, ChevronUp, Copy, Check, AlertTriangle,
  Search, RotateCcw, MessageCircle,
} from "lucide-react";
import { WA_LINK } from "@/components/landing/constants";

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

// ─── Listing requests (Shopify pushes + marketplace requests) ────────────────

interface Listing {
  id: string;
  platform: string;
  status: string;
  adminNote: string | null;
  listedUrl: string | null;
  createdAt: string;
  product: { id: string; name: string; sku: string | null; images: string[]; price: number };
}
type Row = Listing & { attempts: number };

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  PENDING:     { label: "Pending",     bg: "#FFF7ED", color: "#D97706" },
  IN_PROGRESS: { label: "In progress", bg: "#EFF6FF", color: "#2563EB" },
  LISTED:      { label: "Live",        bg: "#ECFDF5", color: "#047857" },
  FAILED:      { label: "Failed",      bg: "#FEF2F2", color: "#DC2626" },
};
const PLATFORM_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  SHOPIFY:  { label: "Shopify",  bg: "#ECFDF5", color: "#047857" },
  AMAZON:   { label: "Amazon",   bg: "#FFF7ED", color: "#EA580C" },
  FLIPKART: { label: "Flipkart", bg: "#EFF6FF", color: "#2563EB" },
  MEESHO:   { label: "Meesho",   bg: "#FDF2F8", color: "#DB2777" },
  EBAY:     { label: "eBay",     bg: "#EFF6FF", color: "#3B82F6" },
  ETSY:     { label: "Etsy",     bg: "#FDF2F8", color: "#DB2777" },
  WALMART:  { label: "Walmart",  bg: "#F0F9FF", color: "#0284C7" },
  OTHER:    { label: "Other",    bg: "#F3F4F6", color: "#6B7280" },
};
const STATUS_FILTERS = ["ALL", "LISTED", "PENDING", "IN_PROGRESS", "FAILED"] as const;

export default function SellerListingsPage() {
  const [raw, setRaw] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"SHOPIFY" | "AMAZON" | "ALL">("SHOPIFY");
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("ALL");
  const [search, setSearch] = useState("");
  const [amazonConnected, setAmazonConnected] = useState<boolean | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/seller/listings")
      .then(r => r.json())
      .then(d => setRaw(d.listings ?? []))
      .catch(() => setRaw([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    fetch("/api/seller/amazon/status")
      .then(r => r.json())
      .then(d => setAmazonConnected(!!d.connected))
      .catch(() => setAmazonConnected(false));
  }, [load]);

  // One row per product + platform: the latest attempt wins, older ones are counted.
  const rows: Row[] = (() => {
    const map = new Map<string, Row>();
    for (const l of [...raw].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      const k = `${l.product.id}|${l.platform}`;
      const cur = map.get(k);
      if (cur) cur.attempts++;
      else map.set(k, { ...l, attempts: 1 });
    }
    return [...map.values()];
  })();

  const inTab = rows.filter(r => tab === "ALL" || r.platform === tab);
  const q = search.trim().toLowerCase();
  const shown = inTab
    .filter(r => status === "ALL" || r.status === status)
    .filter(r => !q || r.product.name.toLowerCase().includes(q) || (r.product.sku ?? "").toLowerCase().includes(q));
  const count = (s: string) => inTab.filter(r => r.status === s).length;
  const tabCount = (t: string) => rows.filter(r => t === "ALL" || r.platform === t).length;

  async function retry(r: Row) {
    setRetrying(r.id); setFlash(null);
    const isShopify = r.platform === "SHOPIFY";
    const res = await fetch(isShopify ? "/api/seller/push-shopify" : "/api/seller/list-marketplace", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isShopify ? { productId: r.product.id } : { productId: r.product.id, platform: r.platform }),
    });
    const d = await res.json().catch(() => ({}));
    setRetrying(null);
    if (!res.ok) { setFlash({ ok: false, text: d.error ?? "Couldn't retry. Check your store connection." }); return; }
    setFlash({ ok: true, text: d.message ?? "Sent again" });
    load();
  }

  const tiles = [
    { key: "LISTED" as const,      label: "Live",        color: "#047857", icon: CheckCircle },
    { key: "PENDING" as const,     label: "Pending",     color: "#D97706", icon: Clock },
    { key: "IN_PROGRESS" as const, label: "In progress", color: "#2563EB", icon: Loader2 },
    { key: "FAILED" as const,      label: "Failed",      color: "#DC2626", icon: XCircle },
  ];

  return (
    <div className="px-3 py-4 md:p-8 space-y-5" style={{ background: "#F7F8FC", minHeight: "100vh" }}>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-black text-[#0C1220]">My Listings</h1>
          <p className="text-[12.5px] text-[#6B7280] mt-1">Products you have put on your Shopify store or asked us to list on a marketplace.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/seller/catalog" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-bold text-white bg-[#4361EE]">
            <Package className="w-3.5 h-3.5" /> List a product
          </Link>
          <button onClick={load} aria-label="Refresh" className="p-2 rounded-lg bg-white border border-[#E8EDF6] text-[#6B7280] hover:text-[#0C1220]">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Platform tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit bg-[#E8EBFF]">
        {(["SHOPIFY", "AMAZON", "ALL"] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setStatus("ALL"); }}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-all"
            style={{ background: tab === t ? "white" : "transparent", color: tab === t ? "#4361EE" : "#6B7280", boxShadow: tab === t ? "0 1px 4px rgba(67,97,238,0.15)" : "none" }}>
            {t === "ALL" ? "All" : PLATFORM_CONFIG[t].label}
            <span className="ml-1.5 text-[11px] font-bold opacity-70 tabular-nums">{tabCount(t)}</span>
          </button>
        ))}
      </div>

      {/* Status tiles for the current tab */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map(t => {
          const Icon = t.icon;
          const active = status === t.key;
          return (
            <button key={t.key} onClick={() => setStatus(active ? "ALL" : t.key)}
              className="text-left bg-white rounded-xl border px-4 py-3.5"
              style={{ borderColor: active ? t.color : "#E8EDF6", boxShadow: active ? `inset 0 0 0 1px ${t.color}` : "none" }}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{t.label}</p>
                <Icon className="w-3.5 h-3.5" style={{ color: t.color }} />
              </div>
              <p className="text-[22px] font-black leading-none tabular-nums" style={{ color: t.key === "FAILED" && count("FAILED") > 0 ? "#DC2626" : "#0C1220" }}>
                {loading ? "…" : count(t.key)}
              </p>
            </button>
          );
        })}
      </div>

      {flash && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium"
          style={{ background: flash.ok ? "#ECFDF5" : "#FEF2F2", color: flash.ok ? "#047857" : "#B91C1C", border: `1px solid ${flash.ok ? "#BBF7D0" : "#FECACA"}` }}>
          {flash.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {flash.text}
        </div>
      )}

      {/* Listing list */}
      <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
        <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-b border-[#F3F4F6] bg-[#FAFBFF]">
          <div className="flex items-center gap-1 flex-wrap">
            {STATUS_FILTERS.map(f => (
              <button key={f} onClick={() => setStatus(f)}
                className="px-3 py-1 rounded-full text-[12px] font-semibold"
                style={status === f
                  ? { background: "#4361EE", color: "white" }
                  : { background: "white", color: "#6B7280", border: "1px solid #E8EDF6" }}>
                {f === "ALL" ? "All" : STATUS_CONFIG[f].label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[180px] md:max-w-[260px] md:ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
            <input id="listing-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Product name or SKU"
              className="pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] w-full" />
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-[13px] text-[#9CA3AF]">
            <Loader2 className="w-5 h-5 animate-spin text-[#4361EE]" /> Loading listings…
          </div>
        ) : shown.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2 px-4 text-center">
            <ListChecks className="w-10 h-10 text-[#E8EDF6]" />
            <p className="text-[13px] font-semibold text-[#6B7280]">
              {inTab.length === 0
                ? (tab === "SHOPIFY" ? "Nothing pushed to Shopify yet" : tab === "AMAZON" ? "No Amazon listing requests yet" : "No listings yet")
                : "Nothing matches these filters"}
            </p>
            {inTab.length === 0 && (
              <p className="text-[12px] text-[#9CA3AF] max-w-sm">
                Open the <Link href="/seller/catalog" className="text-[#4361EE] font-semibold">Product Catalogue</Link> and use
                {tab === "AMAZON" ? " “List on Marketplace” " : " “Push to Shopify” "}on any product.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="bg-[#FAFBFF] border-b border-[#F3F4F6] text-left text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-3 py-3">Platform</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Note from AXQEN</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {shown.map(r => {
                  const st = STATUS_CONFIG[r.status] ?? { label: r.status, bg: "#F3F4F6", color: "#6B7280" };
                  const pf = PLATFORM_CONFIG[r.platform] ?? PLATFORM_CONFIG.OTHER;
                  return (
                    <tr key={r.id} className="hover:bg-[#FAFBFF] align-top">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#F3F4F6] flex-shrink-0 overflow-hidden">
                            {r.product.images?.[0]
                              ? <img src={r.product.images[0]} alt="" className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center"><Package className="w-4 h-4 text-[#D1D5DB]" /></div>}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[#0C1220] truncate max-w-[240px]">{r.product.name}</p>
                            <p className="text-[11.5px] text-[#9CA3AF]">{r.product.sku ?? "—"} · ₹{Math.round(r.product.price).toLocaleString("en-IN")}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: pf.bg, color: pf.color }}>{pf.label}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                        {r.attempts > 1 && <p className="text-[10.5px] text-[#9CA3AF] mt-1">{r.attempts} attempts</p>}
                      </td>
                      <td className="px-3 py-3 max-w-[240px] text-[12px]" style={{ color: r.status === "FAILED" ? "#B91C1C" : "#374151" }}>
                        {r.adminNote || (r.status === "FAILED" && r.platform === "SHOPIFY" ? "Shopify rejected the product. Check your store connection, then retry." : "—")}
                      </td>
                      <td className="px-3 py-3 text-[12px] text-[#9CA3AF] whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.listedUrl && (
                            <a href={r.listedUrl} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold bg-[#EEF2FF] text-[#4361EE] hover:bg-[#4361EE] hover:text-white">
                              <ExternalLink className="w-3.5 h-3.5" /> View on store
                            </a>
                          )}
                          {r.status === "FAILED" && (
                            <button onClick={() => retry(r)} disabled={retrying === r.id}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold bg-[#FEF2F2] text-[#DC2626] hover:bg-[#DC2626] hover:text-white disabled:opacity-50">
                              {retrying === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Retry
                            </button>
                          )}
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

      {/* Amazon live listings */}
      {tab === "AMAZON" && (
        amazonConnected ? (
          <section className="space-y-3">
            <div>
              <h2 className="text-[15px] font-bold text-[#0C1220]">Live on your Amazon account</h2>
              <p className="text-[12px] text-[#9CA3AF] mt-0.5">Pulled from Amazon, with an AI health check and title suggestions for each listing.</p>
            </div>
            <AmazonListingsTab />
          </section>
        ) : amazonConnected === false ? (
          <div className="bg-white rounded-xl border border-[#E8EDF6] p-5 flex items-start gap-4 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-[#FFF7ED] flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-[#EA580C]" />
            </div>
            <div className="flex-1 min-w-[220px]">
              <p className="text-[14px] font-bold text-[#0C1220]">Sell on Amazon with AXQEN</p>
              <p className="text-[12.5px] text-[#6B7280] mt-1">Amazon is not connected on your account. Our Marketplace plan handles your Amazon account, listings and orders. Talk to us to get started.</p>
            </div>
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold text-white bg-[#16A34A]">
              <MessageCircle className="w-4 h-4" /> Talk to us
            </a>
          </div>
        ) : null
      )}
    </div>
  );
}
