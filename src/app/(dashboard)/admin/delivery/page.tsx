"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, Truck, Save, CheckCircle2, ExternalLink,
  RotateCcw, AlertTriangle, Loader2, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, Minus,
} from "lucide-react";

interface Seller { id: string; name: string | null; email: string; brandName: string | null; }

interface Order {
  id: string;
  externalOrderId: string;
  status: string;
  awbNumber: string | null;
  trackingUrl: string | null;
  customerName: string | null;
  customerAddress: { phone?: string } | null;
  totalAmount: number;
  courier: string | null;
  ndrStatus: string | null;
  createdAt: string;
  seller: { name: string | null; email: string };
  supplier: { name: string | null; email: string } | null;
  items: { name: string; quantity: number }[];
}

const STATUS_COLOR: Record<string, string> = {
  NEW:        "bg-gray-100 text-gray-600",
  PROCESSING: "bg-purple-50 text-purple-600",
  SHIPPED:    "bg-blue-50 text-blue-600",
  IN_TRANSIT: "bg-yellow-50 text-yellow-600",
  DELIVERED:  "bg-green-50 text-green-600",
  CANCELLED:  "bg-red-50 text-red-600",
  RTO:        "bg-orange-50 text-orange-600",
};

const STATUSES = ["NEW", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "CANCELLED", "RTO"];
const PAGE_LIMIT = 50;

type TabKey = "" | "SHIPPED" | "IN_TRANSIT" | "DELIVERED" | "RTO" | "NDR";

const TABS: { key: TabKey; label: string; sub: string; color: string; border: string; bg: string }[] = [
  { key: "SHIPPED",    label: "Shipped",    sub: "picked up by courier",   color: "#4361EE", border: "rgba(67,97,238,0.2)",   bg: "rgba(67,97,238,0.08)" },
  { key: "IN_TRANSIT", label: "In Transit", sub: "on the way",             color: "#D97706", border: "rgba(245,158,11,0.2)",  bg: "rgba(245,158,11,0.08)" },
  { key: "DELIVERED",  label: "Delivered",  sub: "successfully delivered",  color: "#16A34A", border: "rgba(22,163,74,0.2)",   bg: "rgba(22,163,74,0.08)" },
  { key: "RTO",        label: "RTO",        sub: "return to origin",        color: "#F97316", border: "rgba(249,115,22,0.2)",  bg: "rgba(249,115,22,0.08)" },
  { key: "NDR",        label: "NDR",        sub: "delivery exception",      color: "#EF4444", border: "rgba(239,68,68,0.2)",   bg: "rgba(239,68,68,0.08)" },
];

const COMP_STATUSES: { key: string; label: string; color: string; lightColor: string }[] = [
  { key: "SHIPPED",    label: "Shipped",    color: "#4361EE", lightColor: "#A5B4FC" },
  { key: "IN_TRANSIT", label: "In Transit", color: "#D97706", lightColor: "#FCD34D" },
  { key: "DELIVERED",  label: "Delivered",  color: "#16A34A", lightColor: "#86EFAC" },
  { key: "RTO",        label: "RTO",        color: "#F97316", lightColor: "#FCA5A5" },
  { key: "NDR",        label: "NDR",        color: "#EF4444", lightColor: "#FECACA" },
];

function getDateBounds(range: number) {
  const now = new Date();
  const currentEnd = new Date(now);
  currentEnd.setHours(23, 59, 59, 999);
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - range + 1);
  currentStart.setHours(0, 0, 0, 0);

  const previousEnd = new Date(currentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);
  previousEnd.setHours(23, 59, 59, 999);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - range + 1);
  previousStart.setHours(0, 0, 0, 0);

  return { currentStart, currentEnd, previousStart, previousEnd };
}

// ── Comparison Bar Chart ──────────────────────────────────────────────────────
function ComparisonChart({
  current,
  previous,
  range,
}: {
  current: Record<string, number>;
  previous: Record<string, number>;
  range: number;
}) {
  const maxVal = Math.max(
    1,
    ...COMP_STATUSES.flatMap(({ key }) => [current[key] ?? 0, previous[key] ?? 0])
  );
  const barH = 100;
  const barW = 18;
  const gap  = 6;
  const groupW = barW * 2 + gap + 20;
  const svgW = COMP_STATUSES.length * groupW + 20;
  const svgH = barH + 52;

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: svgW + 40 }}>
        {/* Legend */}
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: "#4361EE" }} />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              This {range}d
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: "#CBD5E1" }} />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Prev {range}d
            </span>
          </div>
        </div>

        <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} className="overflow-visible">
          {/* Horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const y = 4 + barH * (1 - frac);
            return (
              <g key={frac}>
                <line x1={0} y1={y} x2={svgW} y2={y}
                  stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 3" />
                {frac > 0 && (
                  <text x={svgW - 2} y={y - 2} textAnchor="end"
                    fontSize="8" fill="#94A3B8">
                    {Math.round(maxVal * frac)}
                  </text>
                )}
              </g>
            );
          })}

          {COMP_STATUSES.map(({ key, label, color }, gi) => {
            const curr = current[key] ?? 0;
            const prev = previous[key] ?? 0;
            const currH = Math.max(2, (curr / maxVal) * barH);
            const prevH = Math.max(2, (prev / maxVal) * barH);
            const x = gi * groupW + 10;
            const diff = curr - prev;

            return (
              <g key={key}>
                {/* Current bar */}
                <rect
                  x={x}
                  y={4 + barH - currH}
                  width={barW}
                  height={currH}
                  rx={3}
                  fill={color}
                />
                {/* Current value label */}
                {curr > 0 && (
                  <text
                    x={x + barW / 2}
                    y={4 + barH - currH - 3}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="600"
                    fill={color}>
                    {curr}
                  </text>
                )}

                {/* Previous bar */}
                <rect
                  x={x + barW + gap}
                  y={4 + barH - prevH}
                  width={barW}
                  height={prevH}
                  rx={3}
                  fill="#CBD5E1"
                />
                {prev > 0 && (
                  <text
                    x={x + barW + gap + barW / 2}
                    y={4 + barH - prevH - 3}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#94A3B8">
                    {prev}
                  </text>
                )}

                {/* Group label */}
                <text
                  x={x + barW + gap / 2}
                  y={barH + 18}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="600"
                  fill="#64748B">
                  {label}
                </text>

                {/* Delta badge */}
                <text
                  x={x + barW + gap / 2}
                  y={barH + 32}
                  textAnchor="middle"
                  fontSize="8"
                  fill={diff > 0 ? "#16A34A" : diff < 0 ? "#EF4444" : "#94A3B8"}>
                  {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : "—"}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── Delta badge ───────────────────────────────────────────────────────────────
function Delta({ curr, prev }: { curr: number; prev: number }) {
  if (prev === 0 && curr === 0) return null;
  const diff = curr - prev;
  const pct  = prev === 0 ? null : Math.round(Math.abs(diff / prev) * 100);
  if (diff === 0) return (
    <span className="flex items-center gap-0.5 text-[10px] font-semibold" style={{ color: "#94A3B8" }}>
      <Minus className="w-2.5 h-2.5" /> Same
    </span>
  );
  const up = diff > 0;
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-semibold"
      style={{ color: up ? "#16A34A" : "#EF4444" }}>
      {up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {pct !== null ? `${pct}%` : `${diff > 0 ? "+" : ""}${diff}`}
    </span>
  );
}

export default function AdminFulfillmentPage() {
  const [orders, setOrders]         = useState<Order[]>([]);
  const [sellers, setSellers]       = useState<Seller[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [tab, setTab]               = useState<TabKey>("");
  const [sellerFilter, setSellerFilter] = useState("");
  const [page, setPage]             = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusInputs, setStatusInputs] = useState<Record<string, string>>({});
  const [saving, setSaving]         = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingDelhivery, setSyncingDelhivery] = useState(false);
  const [syncResult, setSyncResult] = useState<{ updated: number; errors: string[] } | null>(null);
  const [counts, setCounts]         = useState<Record<string, number>>({});

  // Comparison state
  const [dateRange, setDateRange]   = useState<7 | 14>(7);
  const [compCurrent, setCompCurrent]   = useState<Record<string, number>>({});
  const [compPrevious, setCompPrevious] = useState<Record<string, number>>({});
  const [compLoading, setCompLoading]   = useState(false);

  // Insights
  type CourierRow = { courier: string; total: number; delivered: number; rto: number };
  type StateRow   = { state: string;   total: number; delivered: number; rto: number };
  const [couriers, setCouriers]   = useState<CourierRow[]>([]);
  const [states,   setStates]     = useState<StateRow[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/sellers")
      .then(r => r.json())
      .then(d => setSellers(d.sellers || []));
  }, []);

  const fetchCounts = useCallback(async () => {
    const base = new URLSearchParams();
    if (sellerFilter) base.set("sellerId", sellerFilter);
    base.set("limit", "1");

    const statuses = ["SHIPPED", "IN_TRANSIT", "DELIVERED", "RTO"];
    const results = await Promise.all(
      statuses.map(s =>
        fetch(`/api/admin/orders?${base}&status=${s}`).then(r => r.json())
      )
    );
    const ndrBase = new URLSearchParams();
    if (sellerFilter) ndrBase.set("sellerId", sellerFilter);
    ndrBase.set("limit", "1");
    ndrBase.set("ndr", "true");
    const ndrRes = await fetch(`/api/admin/orders?${ndrBase}`).then(r => r.json());

    const next: Record<string, number> = {};
    statuses.forEach((s, i) => { next[s] = results[i].total ?? 0; });
    next["NDR"] = ndrRes.total ?? 0;
    setCounts(next);
  }, [sellerFilter]);

  const fetchInsights = useCallback(async () => {
    setInsightsLoading(true);
    const { currentStart, currentEnd } = getDateBounds(dateRange);
    const params = new URLSearchParams();
    if (sellerFilter) params.set("sellerId", sellerFilter);
    params.set("dateFrom", currentStart.toISOString());
    params.set("dateTo",   currentEnd.toISOString());
    const data = await fetch(`/api/admin/analytics/delivery?${params}`).then(r => r.json());
    setCouriers(data.couriers ?? []);
    setStates(data.states ?? []);
    setInsightsLoading(false);
  }, [dateRange, sellerFilter]);

  const fetchComparison = useCallback(async () => {
    setCompLoading(true);
    const { currentStart, currentEnd, previousStart, previousEnd } = getDateBounds(dateRange);
    const statuses = ["SHIPPED", "IN_TRANSIT", "DELIVERED", "RTO"];

    const base = new URLSearchParams();
    if (sellerFilter) base.set("sellerId", sellerFilter);
    base.set("limit", "1");

    const [currRes, prevRes, currNdr, prevNdr] = await Promise.all([
      Promise.all(statuses.map(s =>
        fetch(`/api/admin/orders?${base}&status=${s}&dateFrom=${currentStart.toISOString()}&dateTo=${currentEnd.toISOString()}`)
          .then(r => r.json())
      )),
      Promise.all(statuses.map(s =>
        fetch(`/api/admin/orders?${base}&status=${s}&dateFrom=${previousStart.toISOString()}&dateTo=${previousEnd.toISOString()}`)
          .then(r => r.json())
      )),
      fetch(`/api/admin/orders?${base}&ndr=true&dateFrom=${currentStart.toISOString()}&dateTo=${currentEnd.toISOString()}`)
        .then(r => r.json()),
      fetch(`/api/admin/orders?${base}&ndr=true&dateFrom=${previousStart.toISOString()}&dateTo=${previousEnd.toISOString()}`)
        .then(r => r.json()),
    ]);

    const currCounts: Record<string, number> = {};
    const prevCounts: Record<string, number> = {};
    statuses.forEach((s, i) => {
      currCounts[s] = currRes[i].total ?? 0;
      prevCounts[s] = prevRes[i].total ?? 0;
    });
    currCounts["NDR"] = currNdr.total ?? 0;
    prevCounts["NDR"] = prevNdr.total ?? 0;

    setCompCurrent(currCounts);
    setCompPrevious(prevCounts);
    setCompLoading(false);
  }, [dateRange, sellerFilter]);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);
  useEffect(() => { fetchComparison(); }, [fetchComparison]);
  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search)       params.set("search",   search);
    if (sellerFilter) params.set("sellerId", sellerFilter);
    if (tab === "NDR") {
      params.set("ndr", "true");
    } else if (tab) {
      params.set("status", tab);
    } else {
      params.set("status", "SHIPPED,IN_TRANSIT,DELIVERED,RTO");
    }
    params.set("page",  String(page));
    params.set("limit", String(PAGE_LIMIT));

    const res  = await fetch(`/api/admin/orders?${params}`);
    const data = await res.json();
    setOrders(data.orders ?? []);
    setTotalOrders(data.total ?? 0);
    setTotalPages(data.pages ?? 1);
    setLoading(false);
  }, [search, sellerFilter, tab, page]);

  useEffect(() => { setPage(1); }, [search, sellerFilter, tab]);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function handleSaveStatus(order: Order) {
    const status = statusInputs[order.id];
    if (!status || status === order.status) return;
    setSaving(order.id);
    await fetch("/api/admin/orders/set-awb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        awb: order.awbNumber ?? "",
        status,
        courier: order.courier ?? "",
      }),
    });
    setStatusInputs((p) => { const n = { ...p }; delete n[order.id]; return n; });
    await fetchOrders();
    setSaving(null);
  }

  async function handleBulkSave() {
    const dirty = orders.filter(
      (o) => statusInputs[o.id] !== undefined && statusInputs[o.id] !== o.status
    );
    if (!dirty.length) return;
    setBulkSaving(true);
    await Promise.all(dirty.map((o) =>
      fetch("/api/admin/orders/set-awb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: o.id,
          awb: o.awbNumber ?? "",
          status: statusInputs[o.id],
          courier: o.courier ?? "",
        }),
      })
    ));
    setStatusInputs({});
    await fetchOrders();
    await fetchCounts();
    setBulkSaving(false);
  }

  async function handleSyncDelhivery() {
    setSyncingDelhivery(true);
    setSyncResult(null);
    try {
      const res  = await fetch("/api/admin/orders/sync-delhivery", { method: "POST" });
      const data = await res.json();
      setSyncResult({ updated: data.updated ?? 0, errors: data.errors ?? [] });
      if (data.updated > 0) { await fetchOrders(); await fetchCounts(); }
    } catch {
      setSyncResult({ updated: 0, errors: ["Network error"] });
    } finally {
      setSyncingDelhivery(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([fetchOrders(), fetchCounts(), fetchComparison(), fetchInsights()]);
    setRefreshing(false);
  }

  const dirtyCount = orders.filter(
    (o) => statusInputs[o.id] !== undefined && statusInputs[o.id] !== o.status
  ).length;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page)" }}>

      {/* ── Header ── */}
      <div className="px-6 md:px-8 pt-6 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Fulfillment</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Track shipment status — AWB auto-synced from suppliers
            </p>
          </div>
          <div className="flex items-center gap-2">
            {dirtyCount > 0 && (
              <button onClick={handleBulkSave} disabled={bulkSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "#16A34A" }}>
                <Save className="w-4 h-4" />
                {bulkSaving ? "Saving..." : `Save ${dirtyCount} change${dirtyCount !== 1 ? "s" : ""}`}
              </button>
            )}
            <button onClick={handleSyncDelhivery} disabled={syncingDelhivery}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              title="Poll Delhivery API and auto-update all active shipments">
              <Truck className={`w-4 h-4 ${syncingDelhivery ? "animate-pulse" : ""}`} />
              {syncingDelhivery ? "Syncing..." : "Sync Delhivery"}
            </button>
            <button onClick={handleRefresh} disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Search + seller filter */}
        <div className="flex items-center gap-2 mt-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchOrders()}
            placeholder="Search order #, customer, AWB..."
            className="px-3 py-2 text-sm rounded-xl flex-1 max-w-sm outline-none"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
          <select value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl outline-none"
            style={{ color: "var(--text-primary)", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <option value="" className="text-gray-900 bg-white">All Sellers</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id} className="text-gray-900 bg-white">
                {s.brandName || s.name || s.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="px-6 md:px-8 pb-8 space-y-4">

        {/* ── Status cards (all-time totals, used as tab filters) ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {TABS.map(({ key, label, sub, color, border, bg }) => {
            const active = tab === key;
            const count  = counts[key] ?? 0;
            const curr   = compCurrent[key] ?? 0;
            const prev   = compPrevious[key] ?? 0;
            return (
              <button key={key} onClick={() => { setTab(key); setPage(1); }}
                className="rounded-2xl p-4 text-left transition-all"
                style={{
                  background: active ? bg : "var(--bg-card)",
                  border: `1px solid ${active ? border : "var(--border)"}`,
                  boxShadow: active ? `0 0 0 2px ${color}20` : "var(--shadow-card)",
                }}>
                <div className="flex items-center gap-2 mb-2">
                  {key === "SHIPPED"    && <Truck         className="w-3.5 h-3.5" style={{ color: active ? color : "var(--text-muted)" }} />}
                  {key === "IN_TRANSIT" && <Truck         className="w-3.5 h-3.5" style={{ color: active ? color : "var(--text-muted)" }} />}
                  {key === "DELIVERED"  && <CheckCircle2  className="w-3.5 h-3.5" style={{ color: active ? color : "var(--text-muted)" }} />}
                  {key === "RTO"        && <RotateCcw     className="w-3.5 h-3.5" style={{ color: active ? color : "var(--text-muted)" }} />}
                  {key === "NDR"        && <AlertTriangle className="w-3.5 h-3.5" style={{ color: active ? color : "var(--text-muted)" }} />}
                </div>
                <p className="text-2xl font-black leading-none mb-1"
                  style={{ color: active ? color : "var(--text-primary)" }}>
                  {count.toLocaleString()}
                </p>
                <p className="text-xs font-semibold" style={{ color: active ? color : "var(--text-secondary)" }}>{label}</p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>
                {/* Mini delta for date range */}
                <div className="mt-1.5">
                  <Delta curr={curr} prev={prev} />
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Comparison Chart ── */}
        <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Period Comparison</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Current {dateRange}d vs previous {dateRange}d
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "var(--bg-muted)" }}>
              {([7, 14] as const).map((r) => (
                <button key={r} onClick={() => setDateRange(r)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={dateRange === r
                    ? { background: "var(--bg-card)", color: "var(--text-primary)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
                    : { color: "var(--text-muted)" }}>
                  {r}d
                </button>
              ))}
            </div>
          </div>

          {compLoading ? (
            <div className="py-10 flex items-center justify-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
              <Loader2 className="w-4 h-4 animate-spin" /> Loading comparison...
            </div>
          ) : (
            <>
              {/* Summary row */}
              <div className="grid grid-cols-5 gap-2 mb-5">
                {COMP_STATUSES.map(({ key, label, color }) => {
                  const curr = compCurrent[key] ?? 0;
                  const prev = compPrevious[key] ?? 0;
                  return (
                    <div key={key} className="rounded-xl p-3 text-center"
                      style={{ background: "var(--bg-muted)" }}>
                      <p className="text-lg font-black" style={{ color }}>{curr}</p>
                      <p className="text-[10px] font-semibold mt-0.5" style={{ color: "var(--text-secondary)" }}>{label}</p>
                      <div className="flex justify-center mt-1">
                        <Delta curr={curr} prev={prev} />
                      </div>
                      <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>prev: {prev}</p>
                    </div>
                  );
                })}
              </div>

              {/* Bar chart */}
              <ComparisonChart current={compCurrent} previous={compPrevious} range={dateRange} />
            </>
          )}
        </div>

        {/* ── Courier & State Insights ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Courier breakdown */}
          <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>By Courier Partner</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Last {dateRange} days</p>
              </div>
              <Truck className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            </div>
            {insightsLoading ? (
              <div className="py-6 flex items-center justify-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : couriers.length === 0 ? (
              <p className="py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>No data for this period</p>
            ) : (
              <div className="space-y-2">
                {couriers.map((c, i) => {
                  const deliveryRate = c.total > 0 ? Math.round((c.delivered / c.total) * 100) : 0;
                  const rtoRate      = c.total > 0 ? Math.round((c.rto      / c.total) * 100) : 0;
                  const maxTotal     = couriers[0]?.total ?? 1;
                  const barW         = Math.round((c.total / maxTotal) * 100);
                  return (
                    <div key={c.courier}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold w-4 text-right" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
                          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{c.courier}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="font-bold" style={{ color: "var(--text-primary)" }}>{c.total}</span>
                          <span style={{ color: "#16A34A" }}>✓ {deliveryRate}%</span>
                          <span style={{ color: "#F97316" }}>↩ {rtoRate}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-muted)" }}>
                        <div className="h-full rounded-full" style={{ width: `${barW}%`, background: "#4361EE" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* State breakdown */}
          <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>By State</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Last {dateRange} days · delivery &amp; RTO rates</p>
              </div>
              <CheckCircle2 className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            </div>
            {insightsLoading ? (
              <div className="py-6 flex items-center justify-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : states.length === 0 ? (
              <p className="py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>No data for this period</p>
            ) : (
              <div className="space-y-2">
                {states.map((s, i) => {
                  const deliveryRate = s.total > 0 ? Math.round((s.delivered / s.total) * 100) : 0;
                  const rtoRate      = s.total > 0 ? Math.round((s.rto      / s.total) * 100) : 0;
                  const maxTotal     = states[0]?.total ?? 1;
                  const barW         = Math.round((s.total / maxTotal) * 100);
                  return (
                    <div key={s.state}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold w-4 text-right" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
                          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{s.state}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="font-bold" style={{ color: "var(--text-primary)" }}>{s.total}</span>
                          <span style={{ color: "#16A34A" }}>✓ {deliveryRate}%</span>
                          <span style={{ color: "#F97316" }}>↩ {rtoRate}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-muted)" }}>
                        <div className="h-full rounded-full" style={{ width: `${barW}%`, background: "#16A34A" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Sync result banner ── */}
        {syncResult && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm border ${
            syncResult.errors.length
              ? "bg-yellow-50 border-yellow-200 text-yellow-700"
              : "bg-green-50 border-green-200 text-green-700"
          }`}>
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>
              Sync complete —{" "}
              <strong>{syncResult.updated} order{syncResult.updated !== 1 ? "s" : ""} updated</strong>
              {syncResult.errors.length > 0 && ` · ${syncResult.errors[0]}`}
            </span>
            <button onClick={() => setSyncResult(null)} className="ml-auto text-lg leading-none opacity-60">×</button>
          </div>
        )}

        {/* ── Table ── */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <Truck className="w-4 h-4" style={{ color: "var(--text-400)" }} />
            <span className="font-semibold text-sm" style={{ color: "var(--text-900)" }}>
              {tab ? `${tab.replace("_", " ")} Orders` : "All Shipments"} ({totalOrders})
            </span>
            <span className="ml-auto text-xs" style={{ color: "var(--text-400)" }}>
              AWB auto-synced from couriers
            </span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm flex items-center justify-center gap-2" style={{ color: "var(--text-400)" }}>
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-muted)" }}>
                    {["Order #", "Seller", "Supplier", "Customer", "Phone", "Product", "Amount", "AWB / Courier", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                        style={{ color: "var(--text-400)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-sm" style={{ color: "var(--text-400)" }}>
                        No orders found
                      </td>
                    </tr>
                  ) : orders.map((order) => {
                    const selectedStatus = statusInputs[order.id] ?? order.status;
                    const isDirty = statusInputs[order.id] !== undefined && statusInputs[order.id] !== order.status;
                    const hasNdr  = !!order.ndrStatus;
                    return (
                      <tr key={order.id} className="hover:bg-gray-50/30 transition-colors"
                        style={{ background: isDirty ? "rgba(59,130,246,0.03)" : undefined }}>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <p className="font-mono text-xs font-semibold" style={{ color: "var(--accent)" }}>
                              #{order.externalOrderId}
                            </p>
                            {hasNdr && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-500">NDR</span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-xs whitespace-nowrap" style={{ color: "var(--text-400)" }}>
                          {order.seller.name || order.seller.email}
                        </td>

                        <td className="px-4 py-3.5 text-xs whitespace-nowrap" style={{ color: "var(--text-500)" }}>
                          {order.supplier?.name || order.supplier?.email || (
                            <span style={{ color: "var(--text-300)" }}>—</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-sm whitespace-nowrap" style={{ color: "var(--text-900)" }}>
                          {order.customerName || "—"}
                        </td>

                        <td className="px-4 py-3.5 text-xs font-mono" style={{ color: "var(--text-500)" }}>
                          {order.customerAddress?.phone || "—"}
                        </td>

                        <td className="px-4 py-3.5 text-xs max-w-[130px] truncate" style={{ color: "var(--text-600)" }}>
                          {order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ") || "—"}
                        </td>

                        <td className="px-4 py-3.5 text-sm font-semibold whitespace-nowrap" style={{ color: "var(--text-900)" }}>
                          ₹{order.totalAmount.toLocaleString()}
                        </td>

                        <td className="px-4 py-3.5">
                          {order.awbNumber ? (
                            <div className="space-y-0.5">
                              <p className="font-mono text-xs font-medium" style={{ color: "var(--text-900)" }}>
                                {order.awbNumber}
                              </p>
                              <p className="text-[11px]" style={{ color: "var(--text-400)" }}>
                                {order.courier || "—"}
                              </p>
                              {order.trackingUrl && (
                                <a href={order.trackingUrl} target="_blank" rel="noreferrer"
                                  className="flex items-center gap-1 text-[11px]"
                                  style={{ color: "var(--accent)" }}>
                                  Track <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs" style={{ color: "var(--text-300)" }}>Not synced</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <select
                            value={selectedStatus}
                            onChange={(e) => setStatusInputs((p) => ({ ...p, [order.id]: e.target.value }))}
                            className={`text-xs px-2.5 py-1.5 rounded-full font-semibold border-0 outline-none cursor-pointer ${STATUS_COLOR[selectedStatus] ?? "bg-gray-100 text-gray-600"}`}>
                            {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                          </select>
                        </td>

                        <td className="px-4 py-3.5">
                          {isDirty && (
                            <button
                              onClick={() => handleSaveStatus(order)}
                              disabled={saving === order.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                              style={{ background: "#16A34A" }}>
                              {saving === order.id ? "..." : "Save"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)" }}>
              <span className="text-xs" style={{ color: "var(--text-400)" }}>
                Page {page} of {totalPages} · {totalOrders} orders
              </span>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="p-1.5 rounded-lg disabled:opacity-30"
                  style={{ border: "1px solid var(--border)" }}>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className="w-7 h-7 rounded-lg text-xs font-semibold"
                      style={p === page
                        ? { background: "var(--bg-sidebar)", color: "var(--text-primary)" }
                        : { color: "var(--text-400)" }}>
                      {p}
                    </button>
                  );
                })}
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="p-1.5 rounded-lg disabled:opacity-30"
                  style={{ border: "1px solid var(--border)" }}>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
