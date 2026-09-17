"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Package, Search, Warehouse, Send, Loader2 } from "lucide-react";
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
      const res  = await fetch("/api/supplier/orders?shippedOnly=1");
      const data = await res.json();
      setShipments(data.orders || []);
    } catch { setShipments([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPending();
    fetchShipments();
  }, [fetchPending, fetchShipments]);

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
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 bg-white transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* 8 Stat Cards */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-5">
        {STAT_CARDS.map((card) => (
          <div key={card.key} className={`${card.bg} border-2 ${card.border} rounded-xl p-3 flex flex-col min-w-0`}>
            <p className={`text-2xl font-bold ${card.text}`}>{counts[card.key]}</p>
            <p className="text-xs font-semibold text-gray-700 mt-1 leading-tight">{card.label}</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-tight">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-100 mb-5">
        <button onClick={() => setActiveTab("pending")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === "pending" ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}>
          <Send className="w-4 h-4" />
          Pending to Ship
          {pending.length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
              {pending.length}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab("shipments")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === "shipments" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}>
          <Package className="w-4 h-4" />
          Shipments ({shipments.length})
        </button>
        <button onClick={() => setActiveTab("warehouse")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === "warehouse" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}>
          <Warehouse className="w-4 h-4" />
          My Warehouse (0)
        </button>
      </div>

      {/* Pending to Ship Tab */}
      {activeTab === "pending" && (
        <div className="bg-white rounded-xl border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800">Pending to Ship</h3>
            <p className="text-xs text-gray-400 mt-0.5">These orders are ready — ship them according to the address below</p>
          </div>

          {pendingLoading ? (
            <div className="py-16 flex items-center justify-center gap-2 text-gray-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : pending.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-2 text-center">
              <Send className="w-10 h-10 text-gray-200" />
              <p className="text-gray-500 font-medium text-sm">No pending orders</p>
              <p className="text-xs text-gray-400">Go to Order Queue → click "Push to Delhivery" on accepted orders</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {["Order", "Customer", "Phone", "Address", "Product", "Amount"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pending.map((order) => {
                    const addr = order.customerAddress ?? {};
                    const addressLine = [addr.address, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ");
                    return (
                      <tr key={order.id} className="hover:bg-indigo-50/20">
                        <td className="px-5 py-4">
                          <p className="font-mono text-xs font-semibold text-indigo-600">#{order.externalOrderId}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-gray-800">{order.customerName || "—"}</p>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-gray-600">
                          {addr.phone || "—"}
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-500 max-w-[200px]">
                          {addressLine || "—"}
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-600 max-w-[150px] truncate">
                          {order.items?.map(i => `${i.name} ×${i.quantity}`).join(", ") || "—"}
                        </td>
                        <td className="px-5 py-4 font-semibold text-gray-800">
                          ₹{order.totalAmount.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Shipments Tab */}
      {activeTab === "shipments" && (
        <div className="bg-white rounded-xl border border-gray-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800">My Shipments</h3>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search orders..."
                  className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-52" />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
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
              <table className="w-full text-sm">
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
              </table>
            </div>
          )}
        </div>
      )}

      {/* Warehouse Tab */}
      {activeTab === "warehouse" && <WarehouseTab />}
    </div>
  );
}
