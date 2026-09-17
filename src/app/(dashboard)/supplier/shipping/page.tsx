"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Package, Search, Warehouse, Send, Loader2, Zap, AlertCircle } from "lucide-react";
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from "@/lib/order-status";
import { WarehouseTab } from "@/components/supplier/warehouse-tab";

interface Shipment {
  id: string;
  externalOrderId: string;
  status: string;
  supplierStatus: string | null;
  customerName: string | null;
  customerAddress: Record<string, string> | null;
  awbNumber: string | null;
  courier: string | null;
  trackingUrl: string | null;
  totalAmount: number;
  createdAt: string;
  seller: { name: string };
  items: { name: string; quantity: number }[];
}

type StatKey = "total" | "active" | "pickup" | "transit" | "outDeliver" | "delivered" | "rto" | "issues";
const STAT_CARDS: { key: StatKey; label: string; sub: string; border: string; text: string; bg: string }[] = [
  { key: "total",      label: "Total Shipments",  sub: "All time",                 border: "border-blue-400",   text: "text-blue-500",   bg: "bg-blue-50/60" },
  { key: "active",     label: "Active Orders",     sub: "Currently iterating",      border: "border-yellow-400", text: "text-yellow-500", bg: "bg-yellow-50/60" },
  { key: "pickup",     label: "Pickup Initiated",  sub: "Pickup scheduled/started", border: "border-cyan-400",   text: "text-cyan-500",   bg: "bg-cyan-50/60" },
  { key: "transit",    label: "In Transit",        sub: "Picked & moving",          border: "border-purple-400", text: "text-purple-500", bg: "bg-purple-50/60" },
  { key: "outDeliver", label: "Out for Delivery",  sub: "Courier with rider",       border: "border-teal-400",   text: "text-teal-500",   bg: "bg-teal-50/60" },
  { key: "delivered",  label: "Delivered",         sub: "Completed drops",          border: "border-green-400",  text: "text-green-500",  bg: "bg-green-50/60" },
  { key: "rto",        label: "RTO / Returns",     sub: "Return to origin",         border: "border-orange-400", text: "text-orange-500", bg: "bg-orange-50/60" },
  { key: "issues",     label: "Issues / Alerts",   sub: "Undelivered / errors",     border: "border-red-400",    text: "text-red-500",    bg: "bg-red-50/60" },
];

export default function SupplierShippingPage() {
  const [shipments, setShipments]   = useState<Shipment[]>([]);
  const [pending, setPending]       = useState<Shipment[]>([]);
  const [loading, setLoading]       = useState(true);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab]   = useState<"pending" | "shipments" | "warehouse">("pending");
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // AWB creation state
  const [creatingAwb, setCreatingAwb]   = useState<string | null>(null);
  const [awbError, setAwbError]         = useState<Record<string, string>>({});
  const [awbSuccess, setAwbSuccess]     = useState<Record<string, string>>({});

  // Dispatch modal (for auto-dispatch via provider)
  const [showDispatch, setShowDispatch]             = useState<string | null>(null);
  const [shippingProviders, setShippingProviders]   = useState<{ id: string; label: string; provider: string }[]>([]);
  const [loadingProviders, setLoadingProviders]     = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [autoDispatching, setAutoDispatching]       = useState(false);
  const [autoDispatchError, setAutoDispatchError]   = useState("");
  const [shipmentMode, setShipmentMode]             = useState<"Surface" | "Express">("Surface");

  const fetchPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const res  = await fetch("/api/supplier/orders?supplierStatus=READY_TO_SHIP");
      const data = await res.json();
      setPending(data.orders || []);
    } catch { setPending([]); }
    setPendingLoading(false);
  }, []);

  const fetchShipments = useCallback(async () => {
    try {
      const params = new URLSearchParams({ shippedOnly: "1" });
      const res = await fetch(`/api/supplier/orders?${params}`);
      const data = await res.json();
      setShipments(data.orders || []);
    } catch { setShipments([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPending();
    fetchShipments();
  }, [fetchPending, fetchShipments]);

  const openDispatch = async (orderId: string) => {
    setShowDispatch(orderId);
    setAutoDispatchError("");
    setLoadingProviders(true);
    try {
      const res  = await fetch("/api/supplier/shipping-providers");
      const d    = await res.json();
      const active = (d.providers ?? []).filter((p: { isActive: boolean }) => p.isActive);
      setShippingProviders(active);
      if (active.length > 0) setSelectedProviderId(active[0].id);
    } finally {
      setLoadingProviders(false);
    }
  };

  const handleAutoDispatch = async () => {
    if (!showDispatch || !selectedProviderId) return;
    setAutoDispatching(true);
    setAutoDispatchError("");
    try {
      const res = await fetch(`/api/supplier/orders/${showDispatch}/create-shipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: selectedProviderId, shipmentMode, weight: 0.5, length: 23, breadth: 13, height: 4 }),
      });
      const d = await res.json();
      if (!res.ok) { setAutoDispatchError(d.error || "Failed"); return; }
      setShowDispatch(null);
      setShippingProviders([]);
      setAwbSuccess(p => ({ ...p, [showDispatch]: d.awb }));
      await fetchPending();
      await fetchShipments();
    } finally {
      setAutoDispatching(false);
    }
  };

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([fetchPending(), fetchShipments()]);
    setRefreshing(false);
  }

  const counts = {
    total:       shipments.length,
    active:      shipments.filter(s => ["SHIPPED", "IN_TRANSIT"].includes(s.status)).length,
    pickup:      shipments.filter(s => s.status === "PROCESSING").length,
    transit:     shipments.filter(s => s.status === "IN_TRANSIT").length,
    outDeliver:  shipments.filter(s => s.status === "SHIPPED").length,
    delivered:   shipments.filter(s => s.status === "DELIVERED").length,
    rto:         shipments.filter(s => s.status === "CANCELLED").length,
    issues:      0,
  };

  const filtered = shipments.filter(s => {
    const matchSearch = !search ||
      s.externalOrderId.toLowerCase().includes(search.toLowerCase()) ||
      s.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      s.awbNumber?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });


  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Shipments</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage your warehouse and track shipments</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 bg-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* 8 Stat Cards */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-5">
        {STAT_CARDS.map((card) => (
          <div
            key={card.key}
            className={`${card.bg} border-2 ${card.border} rounded-xl p-3 flex flex-col min-w-0`}
          >
            <p className={`text-2xl font-bold ${card.text}`}>
              {counts[card.key]}
            </p>
            <p className="text-xs font-semibold text-gray-700 mt-1 leading-tight">{card.label}</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-tight">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-100 mb-5">
        <button
          onClick={() => setActiveTab("pending")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === "pending"
              ? "border-indigo-500 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Send className="w-4 h-4" />
          Delhivery Pending
          {pending.length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
              {pending.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("shipments")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === "shipments"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Package className="w-4 h-4" />
          Shipments ({shipments.length})
        </button>
        <button
          onClick={() => setActiveTab("warehouse")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === "warehouse"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Warehouse className="w-4 h-4" />
          My Warehouse (0)
        </button>
      </div>

      {/* Delhivery Pending Tab */}
      {activeTab === "pending" && (
        <div className="bg-white rounded-xl border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-800">Delhivery Pending</h3>
              <p className="text-xs text-gray-400 mt-0.5">Orders pushed to Delhivery queue — create AWB to dispatch</p>
            </div>
            <span className="text-xs text-gray-400">{pending.length} order{pending.length !== 1 ? "s" : ""}</span>
          </div>

          {pendingLoading ? (
            <div className="py-16 flex items-center justify-center gap-2 text-gray-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : pending.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-2 text-center">
              <Send className="w-10 h-10 text-gray-200" />
              <p className="text-gray-500 font-medium text-sm">No orders pending</p>
              <p className="text-xs text-gray-400">Push orders from Order Queue → "Push to Delhivery"</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {["Order", "Customer", "Address", "Product", "Amount", "Action"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pending.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50/40">
                      <td className="px-5 py-3.5">
                        <p className="font-mono text-xs font-semibold text-indigo-600">#{order.externalOrderId}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium text-gray-800">{order.customerName || "—"}</p>
                        <p className="text-xs text-gray-400 font-mono">
                          {(order.customerAddress as Record<string,string>)?.phone || ""}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-500 max-w-[160px]">
                        {[
                          (order.customerAddress as Record<string,string>)?.address,
                          (order.customerAddress as Record<string,string>)?.city,
                          (order.customerAddress as Record<string,string>)?.state,
                          (order.customerAddress as Record<string,string>)?.pincode,
                        ].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-600 max-w-[140px] truncate">
                        {order.items?.map(i => `${i.name} ×${i.quantity}`).join(", ") || "—"}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-gray-800">
                        ₹{order.totalAmount.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5">
                        {awbSuccess[order.id] ? (
                          <div className="text-xs text-green-600 font-semibold">
                            AWB: {awbSuccess[order.id]}
                          </div>
                        ) : awbError[order.id] ? (
                          <div className="flex flex-col gap-1">
                            <p className="text-xs text-red-500">{awbError[order.id]}</p>
                            <button onClick={() => openDispatch(order.id)}
                              className="text-xs text-indigo-600 underline">Retry</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => openDispatch(order.id)}
                            disabled={creatingAwb === order.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                            style={{ background: "#4361EE" }}>
                            {creatingAwb === order.id
                              ? <><Loader2 className="w-3 h-3 animate-spin" /> Creating...</>
                              : <><Zap className="w-3 h-3" /> Create AWB</>}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Shipments Tab */}
      {activeTab === "shipments" && (
        <div className="bg-white rounded-xl border border-gray-100">
          {/* Table Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800">My Shipments</h3>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search orders..."
                  className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-52"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="all">All Status</option>
                <option value="SHIPPED">Shipped</option>
                <option value="IN_TRANSIT">In Transit</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">RTO/Cancelled</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400 text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center">
              <Package className="w-12 h-12 text-gray-200 mb-3" />
              <p className="text-gray-500 font-medium">No shipments found</p>
              <p className="text-sm text-blue-400 mt-1">Shipments will appear here once orders are shipped</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {["Order ID", "Customer", "Seller", "AWB Number", "Courier", "Amount", "Status", "Date"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3.5 font-mono text-xs text-blue-600">#{s.externalOrderId}</td>
                      <td className="px-5 py-3.5 text-gray-700">{s.customerName || "—"}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{s.seller.name}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-600">{s.awbNumber || "—"}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{s.courier || "—"}</td>
                      <td className="px-5 py-3.5 font-semibold text-gray-800">₹{s.totalAmount.toLocaleString()}</td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${ORDER_STATUS_COLOR[s.status] || "bg-gray-50 text-gray-600"}`}>
                          {ORDER_STATUS_LABEL[s.status] || s.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs">
                        {new Date(s.createdAt).toLocaleDateString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}
        </div>
      )}

      {/* Warehouse Tab */}
      {activeTab === "warehouse" && <WarehouseTab />}

      {/* AWB Creation Modal */}
      {showDispatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-2xl w-full max-w-md shadow-2xl bg-white">
            <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Create AWB — Delhivery</h3>
              <button onClick={() => { setShowDispatch(null); setShippingProviders([]); setAutoDispatchError(""); }}
                className="text-2xl leading-none text-gray-400">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {autoDispatchError && (
                <div className="px-4 py-3 rounded-xl text-sm bg-red-50 text-red-600 border border-red-100 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {autoDispatchError}
                </div>
              )}
              {loadingProviders ? (
                <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
              ) : shippingProviders.length === 0 ? (
                <p className="text-sm text-center text-gray-400">
                  No shipping provider connected.{" "}
                  <a href="/supplier/profile" className="underline text-indigo-600">Add one in Profile → Shipping</a>
                </p>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1.5">Shipping Provider</label>
                    <select value={selectedProviderId} onChange={e => setSelectedProviderId(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                      {shippingProviders.map(p => (
                        <option key={p.id} value={p.id}>{p.label} ({p.provider})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1.5">Mode</label>
                    <div className="flex gap-2">
                      {(["Surface", "Express"] as const).map(mode => (
                        <button key={mode} type="button" onClick={() => setShipmentMode(mode)}
                          className="flex-1 py-2 rounded-xl text-sm font-semibold border transition-all"
                          style={{
                            background:  shipmentMode === mode ? "#4361EE" : "#fff",
                            color:       shipmentMode === mode ? "#fff" : "#4361EE",
                            borderColor: shipmentMode === mode ? "#4361EE" : "#C7D2FE",
                          }}>
                          {mode === "Surface" ? "🚚 Surface" : "✈️ Express"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleAutoDispatch} disabled={autoDispatching || !selectedProviderId}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: "#4361EE" }}>
                    {autoDispatching
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating AWB...</>
                      : <><Zap className="w-4 h-4" /> Create AWB & Dispatch</>}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
