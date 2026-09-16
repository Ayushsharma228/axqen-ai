"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, Truck, Save, CheckCircle2, ExternalLink,
  RotateCcw, AlertTriangle, Loader2, ChevronLeft, ChevronRight,
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
  { key: "SHIPPED",    label: "Shipped",    sub: "picked up by courier",  color: "#4361EE", border: "rgba(67,97,238,0.2)",   bg: "rgba(67,97,238,0.08)" },
  { key: "IN_TRANSIT", label: "In Transit", sub: "on the way",            color: "#D97706", border: "rgba(245,158,11,0.2)",  bg: "rgba(245,158,11,0.08)" },
  { key: "DELIVERED",  label: "Delivered",  sub: "successfully delivered", color: "#16A34A", border: "rgba(22,163,74,0.2)",   bg: "rgba(22,163,74,0.08)" },
  { key: "RTO",        label: "RTO",        sub: "return to origin",       color: "#F97316", border: "rgba(249,115,22,0.2)",  bg: "rgba(249,115,22,0.08)" },
  { key: "NDR",        label: "NDR",        sub: "delivery exception",     color: "#EF4444", border: "rgba(239,68,68,0.2)",   bg: "rgba(239,68,68,0.08)" },
];

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
    const results = await Promise.all([
      ...statuses.map(s =>
        fetch(`/api/admin/orders?${base}&status=${s}`).then(r => r.json())
      ),
      // NDR: filter by ndrStatus present — reuse search trick; API doesn't have ndr param so we'll count from full fetch
      fetch(`/api/admin/orders?${base}&status=IN_TRANSIT`).then(r => r.json()),
    ]);

    const next: Record<string, number> = {};
    statuses.forEach((s, i) => { next[s] = results[i].total ?? 0; });
    // NDR count will be computed from in-transit/shipped orders with ndrStatus
    // Fetch a rough count via a separate call
    const ndrBase = new URLSearchParams();
    if (sellerFilter) ndrBase.set("sellerId", sellerFilter);
    ndrBase.set("limit", "1");
    ndrBase.set("ndr", "true");
    const ndrRes = await fetch(`/api/admin/orders?${ndrBase}`).then(r => r.json());
    next["NDR"] = ndrRes.total ?? 0;
    setCounts(next);
  }, [sellerFilter]);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

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
      // default: all fulfilment-relevant statuses
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
        courier: order.courier ?? "Delhivery",
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
          courier: o.courier ?? "Delhivery",
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
    await Promise.all([fetchOrders(), fetchCounts()]);
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

        {/* Search + seller filter row */}
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

        {/* ── Status cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {TABS.map(({ key, label, sub, color, border, bg }) => {
            const active = tab === key;
            const count  = key === "NDR" ? (counts["NDR"] ?? 0) : (counts[key] ?? 0);
            return (
              <button key={key} onClick={() => { setTab(key); setPage(1); }}
                className="rounded-2xl p-4 text-left transition-all"
                style={{
                  background: active ? bg : "var(--bg-card)",
                  border: `1px solid ${active ? border : "var(--border)"}`,
                  boxShadow: active ? `0 0 0 2px ${color}20` : "var(--shadow-card)",
                }}>
                <div className="flex items-center gap-2 mb-2">
                  {key === "SHIPPED"    && <Truck     className="w-3.5 h-3.5" style={{ color: active ? color : "var(--text-muted)" }} />}
                  {key === "IN_TRANSIT" && <Truck     className="w-3.5 h-3.5" style={{ color: active ? color : "var(--text-muted)" }} />}
                  {key === "DELIVERED"  && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: active ? color : "var(--text-muted)" }} />}
                  {key === "RTO"        && <RotateCcw className="w-3.5 h-3.5" style={{ color: active ? color : "var(--text-muted)" }} />}
                  {key === "NDR"        && <AlertTriangle className="w-3.5 h-3.5" style={{ color: active ? color : "var(--text-muted)" }} />}
                </div>
                <p className="text-2xl font-black leading-none mb-1"
                  style={{ color: active ? color : "var(--text-primary)" }}>
                  {count.toLocaleString()}
                </p>
                <p className="text-xs font-semibold" style={{ color: active ? color : "var(--text-secondary)" }}>{label}</p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>
              </button>
            );
          })}
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
              AWB auto-synced from Delhivery
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
