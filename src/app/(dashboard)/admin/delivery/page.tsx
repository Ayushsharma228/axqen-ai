"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Truck, Save, CheckCircle2, ExternalLink } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";

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
  createdAt: string;
  seller: { name: string | null; email: string };
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

export default function AdminDeliveryPage() {
  const [orders, setOrders]         = useState<Order[]>([]);
  const [sellers, setSellers]       = useState<Seller[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sellerFilter, setSellerFilter] = useState("");
  const [statusInputs, setStatusInputs] = useState<Record<string, string>>({});
  const [saving, setSaving]         = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingDelhivery, setSyncingDelhivery] = useState(false);
  const [syncResult, setSyncResult] = useState<{ updated: number; errors: string[] } | null>(null);

  useEffect(() => {
    fetch("/api/admin/sellers")
      .then(r => r.json())
      .then(d => setSellers(d.sellers || []));
  }, []);

  const fetchOrders = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (sellerFilter) params.set("sellerId", sellerFilter);
    const res = await fetch(`/api/admin/orders?${params}`);
    const data = await res.json();
    const fetched: Order[] = (data.orders ?? []).filter(
      (o: Order) => o.status !== "CANCELLED" || o.awbNumber
    );
    setOrders(fetched);
    setLoading(false);
  }, [search, statusFilter, sellerFilter]);

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
    setBulkSaving(false);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  }

  async function handleSyncDelhivery() {
    setSyncingDelhivery(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/orders/sync-delhivery", { method: "POST" });
      const data = await res.json();
      setSyncResult({ updated: data.updated ?? 0, errors: data.errors ?? [] });
      if (data.updated > 0) await fetchOrders();
    } catch {
      setSyncResult({ updated: 0, errors: ["Network error"] });
    } finally {
      setSyncingDelhivery(false);
    }
  }

  const dirtyCount = orders.filter(
    (o) => statusInputs[o.id] !== undefined && statusInputs[o.id] !== o.status
  ).length;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page)" }}>
      <PageHero
        title="Delivery Management"
        subtitle="Track shipment status — AWB is managed automatically by suppliers"
        searchValue={search}
        searchPlaceholder="Search by order #, customer, AWB..."
        onSearchChange={setSearch}
        onSearchSubmit={fetchOrders}
        actions={
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
              style={{ background: "var(--bg-muted)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              title="Poll Delhivery API and auto-update all active shipment statuses">
              <Truck className={`w-4 h-4 ${syncingDelhivery ? "animate-pulse" : ""}`} />
              {syncingDelhivery ? "Syncing..." : "Sync Delhivery"}
            </button>
            <button onClick={handleRefresh} disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--bg-muted)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        }
        filters={
          <div className="flex items-center gap-2">
            <select value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl outline-none"
              style={{ color: "var(--text-primary)", background: "var(--bg-muted)", border: "1px solid var(--border)" }}>
              <option value="" className="text-gray-900 bg-white">All Sellers</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id} className="text-gray-900 bg-white">
                  {s.brandName || s.name || s.email}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl outline-none"
              style={{ color: "var(--text-primary)", background: "var(--bg-muted)", border: "1px solid var(--border)" }}>
              <option value="" className="text-gray-900 bg-white">All Statuses</option>
              {STATUSES.map((s) => <option key={s} value={s} className="text-gray-900 bg-white">{s}</option>)}
            </select>
          </div>
        }
      />

      <div className="px-8 py-6">
        {syncResult && (
          <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm border ${
            syncResult.errors.length
              ? "bg-yellow-50 border-yellow-200 text-yellow-700"
              : "bg-green-50 border-green-200 text-green-700"
          }`}>
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>
              Delhivery sync complete —{" "}
              <strong>{syncResult.updated} order{syncResult.updated !== 1 ? "s" : ""} updated</strong>
              {syncResult.errors.length > 0 && ` · ${syncResult.errors.length} error(s): ${syncResult.errors[0]}`}
            </span>
            <button onClick={() => setSyncResult(null)} className="ml-auto text-lg leading-none opacity-60">×</button>
          </div>
        )}

        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <Truck className="w-4 h-4" style={{ color: "var(--text-400)" }} />
            <span className="font-semibold text-sm" style={{ color: "var(--text-900)" }}>
              Orders ({orders.length})
            </span>
            <span className="ml-auto text-xs" style={{ color: "var(--text-400)" }}>
              AWB numbers are auto-synced from Delhivery
            </span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm" style={{ color: "var(--text-400)" }}>Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-muted)" }}>
                    {["Order #", "Seller", "Customer", "Phone", "Product", "Amount", "AWB / Courier", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                        style={{ color: "var(--text-400)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-sm" style={{ color: "var(--text-400)" }}>
                        No orders found
                      </td>
                    </tr>
                  ) : orders.map((order) => {
                    const selectedStatus = statusInputs[order.id] ?? order.status;
                    const isDirty = statusInputs[order.id] !== undefined && statusInputs[order.id] !== order.status;
                    return (
                      <tr key={order.id} className="hover:bg-gray-50/30 transition-colors"
                        style={{ background: isDirty ? "rgba(59,130,246,0.03)" : undefined }}>
                        <td className="px-4 py-3.5">
                          <p className="font-mono text-xs font-semibold" style={{ color: "var(--accent)" }}>
                            #{order.externalOrderId}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 text-xs" style={{ color: "var(--text-400)" }}>
                          {order.seller.name || order.seller.email}
                        </td>
                        <td className="px-4 py-3.5 text-sm whitespace-nowrap" style={{ color: "var(--text-900)" }}>
                          {order.customerName || "—"}
                        </td>
                        <td className="px-4 py-3.5 text-xs font-mono" style={{ color: "var(--text-500)" }}>
                          {order.customerAddress?.phone || "—"}
                        </td>
                        <td className="px-4 py-3.5 text-xs max-w-[140px] truncate" style={{ color: "var(--text-600)" }}>
                          {order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3.5 text-sm font-semibold" style={{ color: "var(--text-900)" }}>
                          ₹{order.totalAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5">
                          {order.awbNumber ? (
                            <div className="space-y-0.5">
                              <p className="font-mono text-xs font-medium" style={{ color: "var(--text-900)" }}>
                                {order.awbNumber}
                              </p>
                              <p className="text-xs" style={{ color: "var(--text-400)" }}>
                                {order.courier || "—"}
                              </p>
                              {order.trackingUrl && (
                                <a href={order.trackingUrl} target="_blank" rel="noreferrer"
                                  className="flex items-center gap-1 text-xs"
                                  style={{ color: "var(--accent)" }}>
                                  Track <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs" style={{ color: "var(--text-300)" }}>Not synced yet</span>
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
        </div>
      </div>
    </div>
  );
}
