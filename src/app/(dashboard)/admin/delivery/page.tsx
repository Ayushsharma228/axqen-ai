"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Truck, Save, Loader2, Upload, ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
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
  NEW: "bg-gray-100 text-gray-600",
  PROCESSING: "bg-purple-50 text-purple-600",
  SHIPPED: "bg-blue-50 text-blue-600",
  IN_TRANSIT: "bg-yellow-50 text-yellow-600",
  DELIVERED: "bg-green-50 text-green-600",
  CANCELLED: "bg-red-50 text-red-600",
  RTO: "bg-orange-50 text-orange-600",
};

const STATUSES = ["PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "CANCELLED", "RTO"];

export default function AdminDeliveryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sellerFilter, setSellerFilter] = useState("");
  const [awbInputs,     setAwbInputs]     = useState<Record<string, string>>({});
  const [courierInputs, setCourierInputs] = useState<Record<string, string>>({});
  const [statusInputs,  setStatusInputs]  = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [gettingAwb, setGettingAwb] = useState<string | null>(null);
  const [awbError, setAwbError] = useState<string | null>(null);
  const [syncingDelhivery, setSyncingDelhivery] = useState(false);
  const [syncResult, setSyncResult] = useState<{ updated: number; errors: string[] } | null>(null);

  // Bulk import state
  const [bulkOpen,     setBulkOpen]     = useState(false);
  const [csvText,      setCsvText]      = useState("");
  const [csvColOrderId, setCsvColOrderId] = useState(0);
  const [csvColAwb,    setCsvColAwb]    = useState(1);
  const [csvColCourier,setCsvColCourier]= useState(-1);
  const [csvHeaders,   setCsvHeaders]   = useState<string[]>([]);
  const [csvPreview,   setCsvPreview]   = useState<{ orderId: string; awb: string; courier: string }[]>([]);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkResult,   setBulkResult]   = useState<{ updated: number; notFound: string[] } | null>(null);

  function parseCsv(text: string): string[][] {
    return text.trim().split(/\r?\n/).map((line) =>
      line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""))
    );
  }

  function handleCsvParse() {
    if (!csvText.trim()) return;
    const rows = parseCsv(csvText);
    if (rows.length < 2) return;
    const headers = rows[0];
    setCsvHeaders(headers);
    // Auto-detect columns by common header names
    const detectCol = (keywords: string[]) => {
      const idx = headers.findIndex((h) =>
        keywords.some((k) => h.toLowerCase().includes(k))
      );
      return idx >= 0 ? idx : 0;
    };
    const orderCol   = detectCol(["order", "id", "external"]);
    const awbCol     = detectCol(["awb", "waybill", "tracking", "consignment"]);
    const courierCol = detectCol(["courier", "carrier", "shipper"]);
    setCsvColOrderId(orderCol);
    setCsvColAwb(awbCol !== orderCol ? awbCol : Math.min(1, headers.length - 1));
    setCsvColCourier(courierCol !== orderCol && courierCol !== awbCol ? courierCol : -1);
    const preview = rows.slice(1).map((r) => ({
      orderId: r[orderCol] ?? "",
      awb:     r[awbCol]     ?? "",
      courier: courierCol >= 0 ? (r[courierCol] ?? "") : "",
    })).filter((r) => r.orderId && r.awb);
    setCsvPreview(preview);
    setBulkResult(null);
  }

  async function handleBulkApply() {
    if (!csvPreview.length) return;
    setBulkApplying(true);
    const res = await fetch("/api/admin/orders/bulk-set-awb", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        rows: csvPreview.map((r) => ({
          externalOrderId: r.orderId,
          awbNumber:       r.awb,
          courier:         r.courier || "Delhivery",
          markShipped:     true,
        })),
      }),
    });
    const data = await res.json();
    setBulkResult(data);
    if (res.ok) { setCsvText(""); setCsvPreview([]); setCsvHeaders([]); await fetchOrders(); }
    setBulkApplying(false);
  }

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
    // Exclude cancelled orders that were never shipped (no AWB) — nothing to manage delivery-wise
    const fetched: Order[] = (data.orders ?? []).filter(
      (o: Order) => o.status !== "CANCELLED" || o.awbNumber
    );
    setOrders(fetched);
    // Pre-fill AWB + courier inputs with existing values (only on first load)
    setAwbInputs((prev) => {
      const next = { ...prev };
      fetched.forEach((o) => {
        if (o.awbNumber && next[o.id] === undefined) next[o.id] = o.awbNumber;
      });
      return next;
    });
    setCourierInputs((prev) => {
      const next = { ...prev };
      fetched.forEach((o) => {
        if (o.courier && next[o.id] === undefined) next[o.id] = o.courier;
      });
      return next;
    });
    setLoading(false);
  }, [search, statusFilter, sellerFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function handleBulkSave() {
    const dirtyOrders = orders.filter((o) => statusInputs[o.id] !== undefined && statusInputs[o.id] !== o.status);
    if (dirtyOrders.length === 0) return;
    setBulkSaving(true);
    await Promise.all(dirtyOrders.map((order) =>
      fetch("/api/admin/orders/set-awb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          awb: (awbInputs[order.id] ?? order.awbNumber ?? "").trim(),
          status: statusInputs[order.id],
        }),
      })
    ));
    setStatusInputs({});
    await fetchOrders();
    setBulkSaving(false);
  }

  async function handleRefreshTracking() {
    setRefreshing(true);
    await fetch("/api/seller/deliveries/refresh-tracking", { method: "POST" });
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

  async function handleSaveAwb(order: Order) {
    const status  = statusInputs[order.id] || order.status;
    const awb     = (awbInputs[order.id] ?? "").trim() || order.awbNumber || "";
    const courier = (courierInputs[order.id] ?? "").trim() || order.courier || "Delhivery";
    if (status !== "CANCELLED" && !awb) return alert("Enter AWB number");
    setSaving(order.id);
    const res = await fetch("/api/admin/orders/set-awb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, awb, status, courier }),
    });
    if (res.ok) {
      await fetchOrders();
    } else {
      const d = await res.json();
      alert(d.error || "Failed");
    }
    setSaving(null);
  }

  async function handleGetAwb(orderId: string) {
    setGettingAwb(orderId); setAwbError(null);
    const res = await fetch("/api/admin/deliveries/create-awb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    const data = await res.json();
    if (!res.ok) setAwbError(data.error || "Failed to get AWB");
    else await fetchOrders();
    setGettingAwb(null);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page)" }}>
      <PageHero
        title="Delivery Management"
        subtitle="Manage AWB numbers and delivery status for all orders"
        searchValue={search}
        searchPlaceholder="Search by order #, customer, AWB..."
        onSearchChange={setSearch}
        onSearchSubmit={fetchOrders}
        actions={
          <div className="flex items-center gap-2">
            {Object.keys(statusInputs).some((id) => statusInputs[id] !== orders.find(o => o.id === id)?.status) && (
              <button onClick={handleBulkSave} disabled={bulkSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ background: "#16A34A", color: "var(--text-primary)" }}>
                <Save className="w-4 h-4" />
                {bulkSaving ? "Saving..." : `Save All Changes`}
              </button>
            )}
            <button onClick={handleSyncDelhivery} disabled={syncingDelhivery}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--bg-muted)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              title="Poll Delhivery tracking API and auto-update all active shipment statuses">
              <Truck className={`w-4 h-4 ${syncingDelhivery ? "animate-pulse" : ""}`} />
              {syncingDelhivery ? "Syncing..." : "Sync Delhivery"}
            </button>
            <button onClick={handleRefreshTracking} disabled={refreshing}
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
              className="px-3 py-2 text-sm rounded-xl outline-none" style={{ color: "var(--text-primary)", background: "var(--bg-muted)", border: "1px solid var(--border)" }}>
              <option value="" className="text-gray-900 bg-white">All Sellers</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id} className="text-gray-900 bg-white">
                  {s.brandName || s.name || s.email}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl outline-none" style={{ color: "var(--text-primary)", background: "var(--bg-muted)", border: "1px solid var(--border)" }}>
              <option value="" className="text-gray-900 bg-white">All Statuses</option>
              {STATUSES.map((s) => <option key={s} value={s} className="text-gray-900 bg-white">{s}</option>)}
            </select>
          </div>
        }
      />

      <div className="px-8 py-6">
      {awbError && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
          <Truck className="w-4 h-4 flex-shrink-0" /> {awbError}
        </div>
      )}
      {syncResult && (
        <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm border ${
          syncResult.errors.length ? "bg-yellow-50 border-yellow-200 text-yellow-700" : "bg-green-50 border-green-200 text-green-700"
        }`}>
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>
            Delhivery sync complete — <strong>{syncResult.updated} order{syncResult.updated !== 1 ? "s" : ""} updated</strong>
            {syncResult.errors.length > 0 && ` · ${syncResult.errors.length} error(s): ${syncResult.errors[0]}`}
          </span>
          <button onClick={() => setSyncResult(null)} className="ml-auto text-lg leading-none opacity-60">×</button>
        </div>
      )}
      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <Truck className="w-4 h-4" style={{ color: "var(--text-400)" }} />
          <span className="font-semibold text-sm" style={{ color: "var(--text-900)" }}>Orders ({orders.length})</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {["Order #", "Seller", "Customer", "Phone", "Product", "Amount", "Status", "AWB", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.length === 0 ? (
                  <tr><td colSpan={9} className="py-12 text-center text-gray-400 text-sm">No orders found</td></tr>
                ) : orders.map((order) => {
                  const selectedStatus = statusInputs[order.id] ?? order.status;
                  const isCancelled = selectedStatus === "CANCELLED";
                  return (
                    <tr key={order.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-mono text-xs text-blue-600">{order.externalOrderId}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{order.seller.name || order.seller.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{order.customerName || "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{order.customerAddress?.phone || "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-[140px] truncate">
                        {order.items.map((i) => `${i.name} x${i.quantity}`).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-800">₹{order.totalAmount.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <select
                          value={selectedStatus}
                          onChange={(e) => setStatusInputs((p) => ({ ...p, [order.id]: e.target.value }))}
                          className={`text-xs px-2 py-1 rounded-full font-medium border-0 outline-none cursor-pointer ${STATUS_COLOR[selectedStatus] ?? "bg-gray-100 text-gray-600"}`}>
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {isCancelled ? (
                          <span className="text-xs text-gray-300">—</span>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {!order.awbNumber && (
                              <button
                                onClick={() => handleGetAwb(order.id)}
                                disabled={gettingAwb === order.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
                                style={{ background: "#EFF6FF", color: "#3B82F6" }}>
                                {gettingAwb === order.id
                                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Getting...</>
                                  : <><Truck className="w-3 h-3" /> Get AWB</>}
                              </button>
                            )}
                            <input
                              type="text"
                              placeholder="AWB number"
                              value={awbInputs[order.id] ?? order.awbNumber ?? ""}
                              onChange={(e) => setAwbInputs((p) => ({ ...p, [order.id]: e.target.value }))}
                              className="w-32 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                            />
                            <select
                              value={courierInputs[order.id] ?? order.courier ?? "Delhivery"}
                              onChange={(e) => setCourierInputs((p) => ({ ...p, [order.id]: e.target.value }))}
                              className="w-32 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                              {["Delhivery","Delhivery Lite","Ekart","Ekart Surface","Amazon","Blue Dart","DTDC","Xpressbees","Shadowfax","Ecom Express","Smartr","FedEx","DHL","Shiprocket","Other"].map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                            {order.trackingUrl && (
                              <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="text-blue-500 text-xs hover:underline">Track →</a>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleSaveAwb(order)}
                          disabled={saving === order.id}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 whitespace-nowrap">
                          {saving === order.id ? "..." : "Save"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Bulk AWB Import ── */}
      <div className="mt-4 card overflow-hidden">
        <button
          onClick={() => setBulkOpen((p) => !p)}
          className="w-full px-5 py-3.5 flex items-center gap-2 text-left"
          style={{ borderBottom: bulkOpen ? "1px solid var(--border)" : "none" }}>
          <Upload className="w-4 h-4" style={{ color: "var(--accent)" }} />
          <span className="font-semibold text-sm flex-1" style={{ color: "var(--text-900)" }}>
            Bulk AWB Import
          </span>
          <span className="text-xs mr-2" style={{ color: "var(--text-400)" }}>
            Paste courier manifest CSV to update multiple AWBs at once
          </span>
          {bulkOpen ? <ChevronUp className="w-4 h-4" style={{ color: "var(--text-400)" }} />
                    : <ChevronDown className="w-4 h-4" style={{ color: "var(--text-400)" }} />}
        </button>

        {bulkOpen && (
          <div className="p-5 space-y-4">
            {/* Paste area */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-400)" }}>
                Paste CSV (first row = headers, must include Order ID and AWB columns)
              </label>
              <textarea
                value={csvText}
                onChange={(e) => { setCsvText(e.target.value); setCsvPreview([]); setBulkResult(null); }}
                rows={5}
                placeholder={"Order ID,AWB Number,Courier\n1001,123456789,Delhivery\n1002,987654321,Delhivery"}
                className="w-full px-3 py-2 text-xs font-mono rounded-xl resize-none outline-none"
                style={{ background: "var(--bg-muted)", border: "1px solid var(--border)", color: "var(--text-900)" }}
              />
            </div>

            <button
              onClick={handleCsvParse}
              disabled={!csvText.trim()}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: "var(--accent)", color: "#fff" }}>
              Parse & Preview
            </button>

            {/* Column mapping */}
            {csvHeaders.length > 0 && (
              <div className="flex items-center gap-4 flex-wrap text-xs">
                <span style={{ color: "var(--text-400)" }}>Column mapping:</span>
                {[
                  { label: "Order ID", val: csvColOrderId, set: setCsvColOrderId },
                  { label: "AWB",      val: csvColAwb,     set: setCsvColAwb },
                ].map(({ label, val, set }) => (
                  <label key={label} className="flex items-center gap-1.5">
                    <span className="font-medium" style={{ color: "var(--text-900)" }}>{label}:</span>
                    <select
                      value={val}
                      onChange={(e) => { set(Number(e.target.value)); setCsvPreview([]); }}
                      className="rounded-lg px-2 py-1 text-xs outline-none"
                      style={{ background: "var(--bg-muted)", border: "1px solid var(--border)", color: "var(--text-900)" }}>
                      {csvHeaders.map((h, i) => <option key={i} value={i}>{h || `Col ${i + 1}`}</option>)}
                    </select>
                  </label>
                ))}
                <label className="flex items-center gap-1.5">
                  <span className="font-medium" style={{ color: "var(--text-900)" }}>Courier:</span>
                  <select
                    value={csvColCourier}
                    onChange={(e) => { setCsvColCourier(Number(e.target.value)); setCsvPreview([]); }}
                    className="rounded-lg px-2 py-1 text-xs outline-none"
                    style={{ background: "var(--bg-muted)", border: "1px solid var(--border)", color: "var(--text-900)" }}>
                    <option value={-1}>— (use Delhivery)</option>
                    {csvHeaders.map((h, i) => <option key={i} value={i}>{h || `Col ${i + 1}`}</option>)}
                  </select>
                </label>
                {csvHeaders.length > 0 && (
                  <button onClick={handleCsvParse}
                    className="px-3 py-1 rounded-lg text-xs font-medium"
                    style={{ background: "var(--bg-muted)", border: "1px solid var(--border)", color: "var(--text-900)" }}>
                    Re-parse
                  </button>
                )}
              </div>
            )}

            {/* Preview table */}
            {csvPreview.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold" style={{ color: "var(--text-900)" }}>
                    Preview — {csvPreview.length} rows
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-400)" }}>
                    All will be marked SHIPPED + AWB saved
                  </span>
                </div>
                <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: "var(--bg-muted)", borderBottom: "1px solid var(--border)" }}>
                        {["Order ID", "AWB Number", "Courier"].map((h) => (
                          <th key={h} className="px-4 py-2 text-left font-semibold" style={{ color: "var(--text-400)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.slice(0, 20).map((row, i) => (
                        <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                          <td className="px-4 py-2 font-mono" style={{ color: "var(--text-900)" }}>{row.orderId}</td>
                          <td className="px-4 py-2 font-mono" style={{ color: "#3B82F6" }}>{row.awb}</td>
                          <td className="px-4 py-2" style={{ color: "var(--text-400)" }}>{row.courier || "Delhivery"}</td>
                        </tr>
                      ))}
                      {csvPreview.length > 20 && (
                        <tr style={{ borderTop: "1px solid var(--border)" }}>
                          <td colSpan={3} className="px-4 py-2 text-center" style={{ color: "var(--text-400)" }}>
                            … and {csvPreview.length - 20} more rows
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <button
                  onClick={handleBulkApply}
                  disabled={bulkApplying}
                  className="mt-3 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{ background: "#16A34A", color: "#fff" }}>
                  {bulkApplying
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Applying…</>
                    : <><Upload className="w-4 h-4" /> Apply {csvPreview.length} AWBs</>
                  }
                </button>
              </div>
            )}

            {/* Result */}
            {bulkResult && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
                  <CheckCircle2 className="w-4 h-4" />
                  {bulkResult.updated} order{bulkResult.updated !== 1 ? "s" : ""} updated successfully
                </div>
                {bulkResult.notFound.length > 0 && (
                  <div className="flex items-start gap-2 text-xs text-orange-600">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      Not found ({bulkResult.notFound.length}): {bulkResult.notFound.join(", ")}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
