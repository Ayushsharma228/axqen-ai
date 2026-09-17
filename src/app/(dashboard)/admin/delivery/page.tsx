"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, Truck, Save, ExternalLink,
  Loader2, ChevronLeft, ChevronRight,
  Search, MapPin,
} from "lucide-react";
import { FulfillmentTrendChart } from "@/components/admin/fulfillment-trend-chart";

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

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  NEW:        { label: "New",        color: "#4361EE", bg: "#EEF2FF" },
  PROCESSING: { label: "Processing", color: "#D97706", bg: "#FFF7ED" },
  SHIPPED:    { label: "Shipped",    color: "#0369A1", bg: "#E0F2FE" },
  IN_TRANSIT: { label: "In Transit", color: "#7C3AED", bg: "#F5F3FF" },
  DELIVERED:  { label: "Delivered",  color: "#059669", bg: "#ECFDF5" },
  CANCELLED:  { label: "Cancelled",  color: "#6B7280", bg: "#F3F4F6" },
  RTO:        { label: "RTO",        color: "#EF4444", bg: "#FEF2F2" },
};

const STATUSES = ["NEW", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "CANCELLED", "RTO"];
const PAGE_LIMIT = 50;
type TabKey = "" | "SHIPPED" | "IN_TRANSIT" | "DELIVERED" | "RTO" | "NDR";

const STAT_TABS: { key: TabKey; label: string; sub: string; color: string }[] = [
  { key: "SHIPPED",    label: "Shipped",    sub: "picked up",        color: "#0369A1" },
  { key: "IN_TRANSIT", label: "In Transit", sub: "on the way",       color: "#7C3AED" },
  { key: "DELIVERED",  label: "Delivered",  sub: "successfully done", color: "#059669" },
  { key: "RTO",        label: "RTO",        sub: "return to origin",  color: "#EF4444" },
  { key: "NDR",        label: "NDR",        sub: "delivery exception", color: "#D97706" },
];

function getDateBounds(range: number) {
  const now = new Date();
  const currentEnd = new Date(now); currentEnd.setHours(23, 59, 59, 999);
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - range + 1); currentStart.setHours(0, 0, 0, 0);
  return { currentStart, currentEnd };
}

export default function AdminFulfillmentPage() {
  const [orders,       setOrders]       = useState<Order[]>([]);
  const [sellers,      setSellers]      = useState<Seller[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [tab,          setTab]          = useState<TabKey>("");
  const [sellerFilter, setSellerFilter] = useState("");
  const [page,         setPage]         = useState(1);
  const [totalOrders,  setTotalOrders]  = useState(0);
  const [totalPages,   setTotalPages]   = useState(1);
  const [statusInputs, setStatusInputs] = useState<Record<string, string>>({});
  const [saving,       setSaving]       = useState<string | null>(null);
  const [bulkSaving,   setBulkSaving]   = useState(false);
  const [refreshing,   setRefreshing]   = useState(false);
  const [counts,       setCounts]       = useState<Record<string, number>>({});

  const [dateRange,    setDateRange]    = useState<7 | 14>(7);

  type CourierRow = { courier: string; total: number; delivered: number; rto: number };
  type StateRow   = { state: string;   total: number; delivered: number; rto: number };
  const [couriers,       setCouriers]       = useState<CourierRow[]>([]);
  const [states,         setStates]         = useState<StateRow[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/sellers").then(r => r.json()).then(d => setSellers(d.sellers || []));
  }, []);

  const fetchCounts = useCallback(async () => {
    const base = new URLSearchParams();
    if (sellerFilter) base.set("sellerId", sellerFilter);
    base.set("limit", "1");
    const statuses = ["SHIPPED", "IN_TRANSIT", "DELIVERED", "RTO"];
    const [results, ndrRes] = await Promise.all([
      Promise.all(statuses.map(s => fetch(`/api/admin/orders?${base}&status=${s}`).then(r => r.json()))),
      fetch(`/api/admin/orders?${base}&ndr=true`).then(r => r.json()),
    ]);
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


  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search)       params.set("search",   search);
    if (sellerFilter) params.set("sellerId", sellerFilter);
    if (tab === "NDR") { params.set("ndr", "true"); }
    else if (tab)      { params.set("status", tab); }
    else               { params.set("status", "SHIPPED,IN_TRANSIT,DELIVERED,RTO"); }
    params.set("page",  String(page));
    params.set("limit", String(PAGE_LIMIT));
    const data = await fetch(`/api/admin/orders?${params}`).then(r => r.json());
    setOrders(data.orders ?? []);
    setTotalOrders(data.total ?? 0);
    setTotalPages(data.pages ?? 1);
    setLoading(false);
  }, [search, sellerFilter, tab, page]);

  useEffect(() => { fetchCounts(); },   [fetchCounts]);
  useEffect(() => { fetchInsights(); }, [fetchInsights]);
  useEffect(() => { setPage(1); },       [search, sellerFilter, tab]);
  useEffect(() => { fetchOrders(); },    [fetchOrders]);

  async function handleSaveStatus(order: Order) {
    const status = statusInputs[order.id];
    if (!status || status === order.status) return;
    setSaving(order.id);
    await fetch("/api/admin/orders/set-awb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, awb: order.awbNumber ?? "", status, courier: order.courier ?? "" }),
    });
    setStatusInputs(p => { const n = { ...p }; delete n[order.id]; return n; });
    await fetchOrders();
    setSaving(null);
  }

  async function handleBulkSave() {
    const dirty = orders.filter(o => statusInputs[o.id] !== undefined && statusInputs[o.id] !== o.status);
    if (!dirty.length) return;
    setBulkSaving(true);
    await Promise.all(dirty.map(o =>
      fetch("/api/admin/orders/set-awb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: o.id, awb: o.awbNumber ?? "", status: statusInputs[o.id], courier: o.courier ?? "" }),
      })
    ));
    setStatusInputs({});
    await Promise.all([fetchOrders(), fetchCounts()]);
    setBulkSaving(false);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([fetchOrders(), fetchCounts(), fetchInsights()]);
    setRefreshing(false);
  }

  const dirtyCount = orders.filter(o => statusInputs[o.id] !== undefined && statusInputs[o.id] !== o.status).length;

  return (
    <div className="px-3 py-4 md:p-8 space-y-5" style={{ background: "#F7F8FC", minHeight: "100vh" }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[18px] font-black text-[#0C1220]">Fulfillment</h1>
          <p className="text-[12px] text-[#9CA3AF] mt-0.5">Track shipments, update statuses, monitor delivery performance</p>
        </div>
        <div className="flex items-center gap-2">
          {dirtyCount > 0 && (
            <button onClick={handleBulkSave} disabled={bulkSaving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50"
              style={{ background: "#059669" }}>
              <Save className="w-3.5 h-3.5" />
              {bulkSaving ? "Saving…" : `Save ${dirtyCount}`}
            </button>
          )}
          <button onClick={handleRefresh} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-white border border-[#E8EDF6] text-[#6B7280] hover:text-[#0C1220] transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── Stat cards (tab filters) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STAT_TABS.map(({ key, label, sub, color }) => {
          const active = tab === key;
          const count  = counts[key] ?? 0;
          return (
            <button key={key} onClick={() => { setTab(key); setPage(1); }}
              className="text-left rounded-xl border px-4 py-3.5 transition-all"
              style={{
                background:  active ? color : "white",
                borderColor: active ? color : "#E8EDF6",
              }}>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-1"
                style={{ color: active ? "rgba(255,255,255,0.75)" : "#9CA3AF" }}>
                {label}
              </p>
              <p className="text-[22px] font-black leading-none"
                style={{ color: active ? "white" : color }}>
                {count.toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] mt-1"
                style={{ color: active ? "rgba(255,255,255,0.65)" : "#9CA3AF" }}>
                {sub}
              </p>
            </button>
          );
        })}
      </div>

      {/* ── Trend chart ── */}
      <FulfillmentTrendChart sellerId={sellerFilter || undefined} />

      {/* ── Analytics row ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

        {/* Courier breakdown */}
        <div className="bg-white rounded-xl border border-[#E8EDF6] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Truck className="w-3.5 h-3.5 text-[#9CA3AF]" />
              <div>
                <p className="text-[13px] font-bold text-[#0C1220]">By Courier</p>
                <p className="text-[11px] text-[#9CA3AF]">Last {dateRange} days</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#F3F4F6]">
              {([7, 14] as const).map(r => (
                <button key={r} onClick={() => setDateRange(r)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
                  style={dateRange === r
                    ? { background: "white", color: "#0C1220", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
                    : { color: "#9CA3AF" }}>
                  {r}d
                </button>
              ))}
            </div>
          </div>
          {insightsLoading ? (
            <div className="py-6 flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-[#9CA3AF]" />
            </div>
          ) : couriers.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-[#9CA3AF]">No data for this period</p>
          ) : (
            <div className="space-y-3">
              {couriers.map((c, i) => {
                const delivRate = c.total > 0 ? Math.round(c.delivered / c.total * 100) : 0;
                const rtoRate   = c.total > 0 ? Math.round(c.rto / c.total * 100) : 0;
                const barW      = Math.round(c.total / (couriers[0]?.total ?? 1) * 100);
                return (
                  <div key={c.courier}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-[#D1D5DB] w-3">{i + 1}</span>
                        <span className="text-[12px] font-semibold text-[#0C1220]">{c.courier}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="font-bold text-[#0C1220]">{c.total}</span>
                        <span style={{ color: "#059669" }}>{delivRate}%</span>
                        <span style={{ color: "#EF4444" }}>{rtoRate}% RTO</span>
                      </div>
                    </div>
                    <div className="h-1 rounded-full bg-[#F3F4F6] overflow-hidden">
                      <div className="h-full rounded-full bg-[#4361EE]" style={{ width: `${barW}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* State breakdown */}
        <div className="bg-white rounded-xl border border-[#E8EDF6] p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-3.5 h-3.5 text-[#9CA3AF]" />
            <div>
              <p className="text-[13px] font-bold text-[#0C1220]">By State</p>
              <p className="text-[11px] text-[#9CA3AF]">Last {dateRange} days</p>
            </div>
          </div>
          {insightsLoading ? (
            <div className="py-6 flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-[#9CA3AF]" />
            </div>
          ) : states.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-[#9CA3AF]">No data for this period</p>
          ) : (
            <div className="space-y-3">
              {states.map((s, i) => {
                const delivRate = s.total > 0 ? Math.round(s.delivered / s.total * 100) : 0;
                const rtoRate   = s.total > 0 ? Math.round(s.rto / s.total * 100) : 0;
                const barW      = Math.round(s.total / (states[0]?.total ?? 1) * 100);
                return (
                  <div key={s.state}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-[#D1D5DB] w-3">{i + 1}</span>
                        <span className="text-[12px] font-semibold text-[#0C1220]">{s.state}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="font-bold text-[#0C1220]">{s.total}</span>
                        <span style={{ color: "#059669" }}>{delivRate}%</span>
                        <span style={{ color: "#EF4444" }}>{rtoRate}% RTO</span>
                      </div>
                    </div>
                    <div className="h-1 rounded-full bg-[#F3F4F6] overflow-hidden">
                      <div className="h-full rounded-full bg-[#059669]" style={{ width: `${barW}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Main table card ── */}
      <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">

        {/* Search + filter row */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[#F3F4F6]">
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Order #, customer, AWB…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && fetchOrders()}
              className="pl-8 pr-3 py-1.5 text-[12px] rounded-lg border border-[#E8EDF6] bg-[#FAFBFF] text-[#0C1220] placeholder-[#9CA3AF] outline-none focus:border-[#4361EE] w-full transition-colors"
            />
          </div>
          <select value={sellerFilter} onChange={e => setSellerFilter(e.target.value)}
            className="px-3 py-1.5 text-[12px] rounded-lg border border-[#E8EDF6] bg-[#FAFBFF] text-[#0C1220] outline-none focus:border-[#4361EE]">
            <option value="">All Sellers</option>
            {sellers.map(s => (
              <option key={s.id} value={s.id}>{s.brandName || s.name || s.email}</option>
            ))}
          </select>
          <span className="ml-auto text-[12px] text-[#9CA3AF]">{totalOrders} orders</span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-[#4361EE]" />
            <p className="text-[13px] text-[#9CA3AF]">Loading shipments…</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <Truck className="w-10 h-10 text-[#E8EDF6]" />
            <p className="text-[13px] font-medium text-[#9CA3AF]">No orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F3F4F6]" style={{ background: "#FAFBFF" }}>
                  {["ORDER #", "SELLER", "CUSTOMER", "PRODUCT", "AMOUNT", "AWB / COURIER", "STATUS", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(order => {
                  const selectedStatus = statusInputs[order.id] ?? order.status;
                  const isDirty        = statusInputs[order.id] !== undefined && statusInputs[order.id] !== order.status;
                  const cfg            = STATUS_CFG[selectedStatus] ?? STATUS_CFG.NEW;
                  return (
                    <tr key={order.id}
                      className="border-b border-[#F9FAFB] hover:bg-[#FAFBFF] transition-colors"
                      style={{ background: isDirty ? "rgba(67,97,238,0.02)" : undefined }}>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-bold text-[#4361EE]">#{order.externalOrderId}</span>
                          {order.ndrStatus && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#FFF7ED] text-[#D97706]">NDR</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="text-[12px] text-[#6B7280]">{order.seller.name || order.seller.email}</span>
                        {order.supplier && (
                          <p className="text-[11px] text-[#9CA3AF] mt-0.5">{order.supplier.name || order.supplier.email}</p>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="text-[13px] font-semibold text-[#0C1220]">{order.customerName || "—"}</p>
                        <p className="text-[11px] text-[#9CA3AF] mt-0.5">{order.customerAddress?.phone || ""}</p>
                      </td>

                      <td className="px-4 py-3.5 max-w-[130px]">
                        <span className="text-[12px] text-[#374151] truncate block">
                          {order.items.map(i => `${i.name} ×${i.quantity}`).join(", ") || "—"}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="text-[13px] font-semibold text-[#0C1220]">₹{order.totalAmount.toLocaleString("en-IN")}</span>
                      </td>

                      <td className="px-4 py-3.5">
                        {order.awbNumber ? (
                          <div>
                            <p className="font-mono text-[12px] font-semibold text-[#0C1220]">{order.awbNumber}</p>
                            {order.courier && <p className="text-[11px] text-[#9CA3AF] mt-0.5">{order.courier}</p>}
                            {order.trackingUrl && (
                              <a href={order.trackingUrl} target="_blank" rel="noreferrer"
                                className="flex items-center gap-0.5 text-[11px] font-semibold text-[#4361EE] mt-0.5">
                                Track <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-[#FFF7ED] text-[#D97706]">
                            No AWB
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <select
                          value={selectedStatus}
                          onChange={e => setStatusInputs(p => ({ ...p, [order.id]: e.target.value }))}
                          className="px-2.5 py-1 rounded-full text-[11px] font-bold border-0 outline-none cursor-pointer"
                          style={{ background: cfg.bg, color: cfg.color }}>
                          {STATUSES.map(s => (
                            <option key={s} value={s} className="bg-white text-gray-900">
                              {s.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-4 py-3.5">
                        {isDirty && (
                          <button onClick={() => handleSaveStatus(order)} disabled={saving === order.id}
                            className="px-3 py-1 rounded-lg text-[11px] font-bold text-white disabled:opacity-50"
                            style={{ background: "#059669" }}>
                            {saving === order.id ? "…" : "Save"}
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
        {!loading && totalPages > 1 && (
          <div className="px-5 py-3 flex items-center justify-between border-t border-[#F3F4F6]">
            <span className="text-[12px] text-[#9CA3AF]">Page {page} of {totalPages} · {totalOrders} orders</span>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg border border-[#E8EDF6] disabled:opacity-30 hover:bg-[#FAFBFF] transition-colors">
                <ChevronLeft className="w-3.5 h-3.5 text-[#6B7280]" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className="w-7 h-7 rounded-lg text-[12px] font-semibold transition-colors"
                    style={p === page
                      ? { background: "#4361EE", color: "white" }
                      : { color: "#9CA3AF" }}>
                    {p}
                  </button>
                );
              })}
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg border border-[#E8EDF6] disabled:opacity-30 hover:bg-[#FAFBFF] transition-colors">
                <ChevronRight className="w-3.5 h-3.5 text-[#6B7280]" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
