"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  RefreshCw, Download, ShoppingCart, CheckCircle, XCircle,
  Loader2, ExternalLink, Copy, CopyCheck, Search, X,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface OrderItem { id: string; name: string; sku: string | null; quantity: number; price: number; }
interface Order {
  id: string; externalOrderId: string; source: string; status: string;
  customerName: string | null; customerEmail: string | null;
  customerAddress: { phone?: string; address?: string; city?: string; state?: string; pincode?: string } | null;
  totalAmount: number; awbNumber: string | null; createdAt: string; items: OrderItem[];
  supplierStatus: string | null; customerOrderCount: number;
  ndrStatus?: string | null;
}
interface Stats { totalOrders: number; totalRevenue: number; totalItems: number; topProduct: string | null; }

// ── Config ─────────────────────────────────────────────────────────────────
const SUPPLIER_LABEL: Record<string, string> = {
  PENDING_ASSIGNMENT: "Pending Supplier",
  ASSIGNED: "Supplier Assigned",
  ACCEPTED: "Supplier Accepted",
  REJECTED: "Supplier Rejected",
  PROCESSING: "Supplier Processing",
  PACKED: "Packed",
  READY_TO_SHIP: "Ready to Ship",
  DISPATCHED: "Supplier Dispatched",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  NEW:        { label: "New",        color: "#4361EE", bg: "#EEF2FF" },
  PROCESSING: { label: "Processing", color: "#D97706", bg: "#FFF7ED" },
  SHIPPED:    { label: "Shipped",    color: "#7C3AED", bg: "#F5F3FF" },
  IN_TRANSIT: { label: "In Transit", color: "#0369A1", bg: "#E0F2FE" },
  DELIVERED:  { label: "Delivered",  color: "#059669", bg: "#ECFDF5" },
  RTO:        { label: "RTO",        color: "#EF4444", bg: "#FEF2F2" },
  CANCELLED:  { label: "Cancelled",  color: "#6B7280", bg: "#F3F4F6" },
};

// Tab definitions — pre-delivery orders only (NEW goes to Order Confirmation, post-ship goes to Fulfilment)
const TABS = [
  { label: "All",       value: "ALL" },
  { label: "Confirmed", value: "PROCESSING" },
  { label: "Shipped",   value: "SHIPPED" },
  { label: "Cancelled", value: "CANCELLED" },
];

function formatDate(d: Date) { return d.toISOString().split("T")[0]; }
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const num = (n: number) => Math.round(n).toLocaleString("en-IN");

// ── Main ───────────────────────────────────────────────────────────────────
export default function SellerOrdersPage() {
  const today   = new Date();
  const yearAgo = new Date(today); yearAgo.setFullYear(today.getFullYear() - 1);

  const [orders,       setOrders]       = useState<Order[]>([]);
  const [stats,        setStats]        = useState<Stats>({ totalOrders: 0, totalRevenue: 0, totalItems: 0, topProduct: null });
  const [rtoScores,    setRtoScores]    = useState<Record<string, {
    score: number; level: string; signals: string[];
    breakdown?: { phone: number; address: number; pincode: number; history: number; velocity: number; payment: number };
    pincodeStats?: { rtoRate: number; sampleSize: number } | null;
  }>>({});
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [search,       setSearch]       = useState("");
  const [tab,          setTab]          = useState("ALL");
  const [confirming,   setConfirming]   = useState<string | null>(null);
  const [cancelling,   setCancelling]   = useState<string | null>(null);
  const [copiedId,     setCopiedId]     = useState<string | null>(null);
  const [syncError,    setSyncError]    = useState("");
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [showImport,   setShowImport]   = useState(false);
  const [importFile,   setImportFile]   = useState<File | null>(null);
  const [importing,    setImporting]    = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: { row: number; message: string }[] } | null>(null);

  const searchParams = useSearchParams();
  const [from] = useState(formatDate(yearAgo));
  const [to]   = useState(formatDate(today));

  useEffect(() => {
    if (searchParams.get("import") === "1") setShowImport(true);
  }, [searchParams]);

  const fetchOrders = useCallback(async () => {
    const params = new URLSearchParams({ from, to });
    if (search) params.set("search", search);
    const res  = await fetch(`/api/seller/orders?${params}`);
    const data = await res.json();
    const fetchedOrders: Order[] = data.orders || [];
    setOrders(fetchedOrders);
    setStats(data.stats || { totalOrders: 0, totalRevenue: 0, totalItems: 0, topProduct: null });
    setLoading(false);

    // Fetch RTO risk scores for actionable (non-terminal) orders
    const toScore = fetchedOrders
      .filter(o => !["DELIVERED", "CANCELLED"].includes(o.status))
      .map(o => o.id);
    if (toScore.length > 0) {
      fetch("/api/seller/orders/rto-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: toScore }),
      }).then(r => r.ok ? r.json() : null).then(d => {
        if (d?.scores) setRtoScores(d.scores);
      }).catch(() => {});
    }
  }, [from, to, search]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Silent Shopify sync every 2 min
  useEffect(() => {
    const sync = () => fetch("/api/seller/shopify/sync-orders", { method: "POST" }).catch(() => {});
    sync();
    const id = setInterval(async () => { await sync(); fetchOrders(); }, 120_000);
    return () => clearInterval(id);
  }, [fetchOrders]);

  // ── Actions ────────────────────────────────────────────────────────────
  async function handleRefresh() {
    setRefreshing(true); setSyncError("");
    try {
      const res  = await fetch("/api/seller/shopify/sync-orders", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setSyncError(data.error || "Sync failed. Check your Shopify connection.");
    } catch { setSyncError("Network error. Please try again."); }
    await fetchOrders();
    setRefreshing(false);
  }

  async function handleConfirm(orderId: string) {
    setConfirming(orderId);
    const res = await fetch("/api/seller/orders/ship", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    if (!res.ok) { const d = await res.json(); setSyncError(d.error || "Failed to confirm order"); }
    await fetchOrders(); setConfirming(null);
  }

  async function handleCancel(orderId: string) {
    setCancelling(orderId);
    await fetch("/api/seller/orders/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    await fetchOrders(); setCancelling(null);
  }

  function downloadTemplate() {
    const csv = [
      "order_id,customer_name,phone,address,city,state,pincode,product_name,sku,quantity,unit_price,total_amount,courier,awb,status,order_date",
      "ORD-001,Rahul Sharma,9876543210,123 MG Road,Mumbai,Maharashtra,400001,Blue T-Shirt,SKU-001,2,499,998,Delhivery,AWB123,,2024-01-15",
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = "order-import-template.csv"; a.click();
  }

  async function handleImport() {
    if (!importFile) return;
    setImporting(true); setImportResult(null);
    const text = await importFile.text();
    const res  = await fetch("/api/seller/orders/import", {
      method: "POST", headers: { "Content-Type": "text/plain" }, body: text,
    });
    const data = await res.json();
    setImportResult(data); setImporting(false);
    if (data.created > 0) fetchOrders();
  }

  function handleExport() {
    const toExport = selected.size > 0 ? displayed.filter(o => selected.has(o.id)) : displayed;
    const csv = [
      ["Order #","Customer","Phone","Email","Products","Address","City","State","Pincode","Qty","Amount","AWB","Status","Date"].join(","),
      ...toExport.map(o => {
        const addr = o.customerAddress;
        return [
          o.externalOrderId, o.customerName || "", addr?.phone || "", o.customerEmail || "",
          o.items.map(i => `${i.name} x${i.quantity}`).join("; "),
          addr?.address || "", addr?.city || "", addr?.state || "", addr?.pincode || "",
          o.items.reduce((s, i) => s + i.quantity, 0), o.totalAmount, o.awbNumber || "",
          o.status, new Date(o.createdAt).toLocaleDateString("en-IN"),
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
      }),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = selected.size > 0 ? `orders-selected-${selected.size}.csv` : "orders.csv";
    a.click();
  }

  // ── Filtering ──────────────────────────────────────────────────────────
  // Orders page scope: confirmed + shipped + cancelled only
  // NEW → Order Confirmation  |  IN_TRANSIT/DELIVERED/RTO/NDR → Fulfilment
  const filterOrders = (o: Order) => {
    if (!["PROCESSING", "SHIPPED", "CANCELLED"].includes(o.status)) return false;
    if (tab === "ALL") return true;
    return o.status === tab;
  };
  const displayed   = orders.filter(filterOrders);
  const allSelected = displayed.length > 0 && displayed.every(o => selected.has(o.id));
  const someSelected = selected.size > 0;

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(displayed.map(o => o.id)));
  }

  // ── Stat card counts ──────────────────────────────────────────────────
  const confirmedCount = orders.filter(o => o.status === "PROCESSING").length;
  const shippedCount   = orders.filter(o => o.status === "SHIPPED").length;
  const cancelledCount = orders.filter(o => o.status === "CANCELLED").length;

  const STAT_CARDS = [
    { label: "Confirmed",  value: num(confirmedCount), color: "#D97706", sub: "Awaiting dispatch",      tab: "PROCESSING" },
    { label: "Shipped",    value: num(shippedCount),   color: "#7C3AED", sub: "Dispatched by supplier",  tab: "SHIPPED" },
    { label: "Cancelled",  value: num(cancelledCount), color: "#6B7280", sub: "Cancelled orders",        tab: "CANCELLED" },
  ];

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="px-3 py-4 md:p-8 space-y-5" style={{ background: "#F7F8FC", minHeight: "100vh" }}>

      {/* ── Page header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[18px] font-black text-[#0C1220]">Orders</h1>
          <p className="text-[12px] text-[#9CA3AF] mt-0.5">
            {stats.totalOrders} total · last 12 months
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRefresh} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-white border border-[#E8EDF6] text-[#6B7280] hover:text-[#0C1220] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Syncing…" : "Refresh"}
          </button>
          <button
            onClick={() => { setShowImport(true); setImportResult(null); setImportFile(null); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-white border border-[#E8EDF6] text-[#6B7280] hover:text-[#0C1220] transition-colors"
          >
            <Download className="w-3.5 h-3.5 rotate-180" /> Import CSV
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-bold text-white transition-colors"
            style={{ background: "#4361EE" }}
          >
            <Download className="w-3.5 h-3.5" />
            {someSelected ? `Export (${selected.size})` : "Export"}
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {STAT_CARDS.map(card => (
          <button
            key={card.tab}
            onClick={() => setTab(card.tab)}
            className="text-left rounded-xl border px-4 py-3.5 transition-all"
            style={{
              background: tab === card.tab ? card.color : "white",
              borderColor: tab === card.tab ? card.color : "#E8EDF6",
            }}
          >
            <p className="text-[11px] font-bold uppercase tracking-wide mb-1"
              style={{ color: tab === card.tab ? "rgba(255,255,255,0.75)" : "#9CA3AF" }}>
              {card.label}
            </p>
            <p className="text-[22px] font-black leading-none"
              style={{ color: tab === card.tab ? "white" : card.color }}>
              {card.value}
            </p>
            <p className="text-[11px] mt-1"
              style={{ color: tab === card.tab ? "rgba(255,255,255,0.65)" : "#9CA3AF" }}>
              {card.sub}
            </p>
          </button>
        ))}
      </div>

      {/* ── Error banner ── */}
      {syncError && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          {syncError}
          <button className="ml-auto" onClick={() => setSyncError("")}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── Orders card ── */}
      <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">

        {/* Mobile search — full-width row above tabs */}
        <div className="flex md:hidden px-3 py-2 border-b border-[#F3F4F6]">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search orders…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && fetchOrders()}
              className="pl-8 pr-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] bg-[#FAFBFF] text-[#0C1220] placeholder-[#9CA3AF] outline-none focus:border-[#4361EE] w-full transition-colors"
            />
          </div>
        </div>

        {/* Tab bar + desktop search */}
        <div className="flex items-center gap-0 border-b border-[#F3F4F6] overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className="px-2.5 md:px-4 py-2.5 md:py-3 text-[12px] md:text-[13px] font-semibold whitespace-nowrap flex-shrink-0 border-b-2 transition-colors"
              style={{
                borderColor: tab === t.value ? "#4361EE" : "transparent",
                color: tab === t.value ? "#4361EE" : "#9CA3AF",
                background: tab === t.value ? "#FAFBFF" : "transparent",
              }}
            >
              {t.label}
              {t.value !== "ALL" && (() => {
                const c =
                  t.value === "PROCESSING" ? confirmedCount :
                  t.value === "SHIPPED"    ? shippedCount :
                  t.value === "CANCELLED"  ? cancelledCount :
                  orders.filter(o => o.status === t.value).length;
                return c > 0 ? (
                  <span
                    className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                    style={{
                      background: tab === t.value ? "#4361EE" : "#EEF2FF",
                      color: tab === t.value ? "white" : "#4361EE",
                    }}
                  >{c}</span>
                ) : null;
              })()}
            </button>
          ))}
          {/* Desktop search */}
          <div className="hidden md:block ml-auto pr-4 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="Search orders…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && fetchOrders()}
                className="pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-[#E8EDF6] bg-[#FAFBFF] text-[#0C1220] placeholder-[#9CA3AF] outline-none focus:border-[#4361EE] w-44 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-12 flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#4361EE]" />
            <p className="text-[13px] text-[#9CA3AF]">Loading orders…</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <ShoppingCart className="w-10 h-10 text-[#E8EDF6]" />
            <p className="text-[13px] font-medium text-[#9CA3AF]">No orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F3F4F6]" style={{ background: "#FAFBFF" }}>
                  <th className="px-4 py-3 w-8">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 rounded cursor-pointer accent-[#4361EE]" />
                  </th>
                  {[
                    { label: "ORDER #",   cls: "" },
                    { label: "CUSTOMER",  cls: "" },
                    { label: "PRODUCTS",  cls: "hidden md:table-cell" },
                    { label: "ADDRESS",   cls: "hidden md:table-cell" },
                    { label: "QTY",       cls: "hidden md:table-cell" },
                    { label: "AMOUNT",    cls: "" },
                    { label: "STATUS",    cls: "" },
                    { label: "RTO RISK",  cls: "hidden md:table-cell" },
                    { label: "DATE",      cls: "hidden md:table-cell" },
                    { label: "ACTIONS",   cls: "" },
                  ].map(h => (
                    <th key={h.label} className={`px-3 py-3 text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide whitespace-nowrap ${h.cls}`}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F9FAFB]">
                {displayed.map(order => {
                  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.NEW;
                  const addr = order.customerAddress;
                  const canConfirm = order.status === "NEW";
                  const canCancel  = order.status !== "CANCELLED" && order.status !== "DELIVERED";
                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-[#FAFBFF] transition-colors"
                      style={{ background: selected.has(order.id) ? "rgba(67,97,238,0.03)" : undefined }}
                    >
                      <td className="px-4 py-3 w-8">
                        <input type="checkbox" checked={selected.has(order.id)} onChange={() => toggleSelect(order.id)}
                          className="w-3.5 h-3.5 rounded cursor-pointer accent-[#4361EE]" />
                      </td>
                      {/* Order # */}
                      <td className="px-3 py-3">
                        <Link href={`/seller/orders/${order.id}`}
                          className="text-[13px] font-bold text-[#4361EE] hover:underline">
                          #{order.externalOrderId}
                        </Link>
                      </td>
                      {/* Customer */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[13px] font-semibold text-[#0C1220]">{order.customerName || "—"}</p>
                          {order.customerOrderCount > 1 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#EDE9FE] text-[#7C3AED]">
                              ×{order.customerOrderCount}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#9CA3AF]">{addr?.phone || order.customerEmail || "—"}</p>
                      </td>
                      {/* Products */}
                      <td className="hidden md:table-cell px-3 py-3 max-w-[160px]">
                        <p className="text-[12px] text-[#6B7280] line-clamp-2">
                          {order.items.map(i => `${i.name} ×${i.quantity}`).join(", ")}
                        </p>
                      </td>
                      {/* Address */}
                      <td className="hidden md:table-cell px-3 py-3 max-w-[160px]">
                        <p className="text-[12px] text-[#6B7280] line-clamp-2">
                          {[addr?.address, addr?.city, addr?.state, addr?.pincode].filter(Boolean).join(", ") || "—"}
                        </p>
                      </td>
                      {/* Qty */}
                      <td className="hidden md:table-cell px-3 py-3 text-[13px] font-medium text-[#374151] text-center">
                        {order.items.reduce((s, i) => s + i.quantity, 0)}
                      </td>
                      {/* Amount */}
                      <td className="px-3 py-3 text-[13px] font-bold text-[#0C1220] whitespace-nowrap">
                        {inr(order.totalAmount)}
                      </td>
                      {/* Status */}
                      <td className="px-3 py-3">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap"
                          style={{ background: cfg.bg, color: cfg.color }}>
                          {cfg.label}
                        </span>
                        {order.supplierStatus && (
                          <p className="text-[10px] mt-1 text-[#9CA3AF]" style={{
                            color: order.supplierStatus === "REJECTED" ? "#DC2626"
                              : order.supplierStatus === "DISPATCHED" ? "#059669" : undefined,
                          }}>
                            {SUPPLIER_LABEL[order.supplierStatus] ?? order.supplierStatus}
                          </p>
                        )}
                        {order.ndrStatus && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#F5F3FF] text-[#7C3AED]">
                            NDR
                          </span>
                        )}
                      </td>
                      {/* RTO Risk */}
                      <td className="hidden md:table-cell px-3 py-3">
                        {(() => {
                          const r = rtoScores[order.id];
                          if (!r) return null;
                          const RISK: Record<string, { bg: string; color: string; label: string }> = {
                            LOW:       { bg: "#F0FDF4", color: "#15803D", label: "Low" },
                            MEDIUM:    { bg: "#FFFBEB", color: "#B45309", label: "Medium" },
                            HIGH:      { bg: "#FFF7ED", color: "#C2410C", label: "High" },
                            VERY_HIGH: { bg: "#FEF2F2", color: "#DC2626", label: "Very High" },
                          };
                          const cfg = RISK[r.level] ?? RISK.LOW;
                          const bd  = r.breakdown;
                          const breakdown = bd
                            ? `\nBreakdown:\n  Phone:    ${bd.phone}/30\n  Address:  ${bd.address}/35\n  Pin code: ${bd.pincode}/20\n  History:  ${bd.history}/35\n  Velocity: ${bd.velocity}/10\n  Payment:  ${bd.payment}/20`
                            : "";
                          const signals = r.signals.length
                            ? `\n\nSignals:\n${r.signals.map(s => "  • " + s).join("\n")}`
                            : "";
                          return (
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold cursor-help whitespace-nowrap"
                              style={{ background: cfg.bg, color: cfg.color }}
                              title={`RTO Risk — ${r.score}/100 (${r.level.replace("_", " ")})${breakdown}${signals}`}
                            >
                              {cfg.label}
                            </span>
                          );
                        })()}
                      </td>
                      {/* Date */}
                      <td className="hidden md:table-cell px-3 py-3 text-[12px] text-[#9CA3AF] whitespace-nowrap">
                        {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </td>
                      {/* Actions */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <a href={`/track?id=${order.id}`} target="_blank" rel="noopener noreferrer"
                            title="Track order"
                            className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#EEF2FF] text-[#4361EE] hover:bg-[#4361EE] hover:text-white transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            title="Copy tracking link"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/track?id=${order.id}`);
                              setCopiedId(order.id);
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{
                              background: copiedId === order.id ? "#ECFDF5" : "#F3F4F6",
                              color: copiedId === order.id ? "#059669" : "#6B7280",
                            }}>
                            {copiedId === order.id ? <CopyCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          {canConfirm && (
                            <button
                              onClick={() => handleConfirm(order.id)}
                              disabled={confirming === order.id}
                              title="Confirm Order"
                              className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#ECFDF5] text-[#059669] hover:bg-[#059669] hover:text-white transition-colors disabled:opacity-40">
                              {confirming === order.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <CheckCircle className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {canCancel && (
                            <button
                              onClick={() => handleCancel(order.id)}
                              disabled={cancelling === order.id}
                              title="Cancel Order"
                              className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#FEF2F2] text-[#EF4444] hover:bg-[#EF4444] hover:text-white transition-colors disabled:opacity-40">
                              {cancelling === order.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <XCircle className="w-3.5 h-3.5" />}
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

        {/* Footer row count */}
        {!loading && displayed.length > 0 && (
          <div className="px-4 py-3 border-t border-[#F3F4F6] flex items-center justify-between">
            <p className="text-[12px] text-[#9CA3AF]">
              Showing {displayed.length} order{displayed.length !== 1 ? "s" : ""}
              {someSelected && <> · <span className="text-[#4361EE] font-semibold">{selected.size} selected</span></>}
            </p>
            {someSelected && (
              <button onClick={() => setSelected(new Set())}
                className="text-[12px] text-[#9CA3AF] hover:text-[#EF4444] transition-colors">
                Clear selection
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Import CSV Modal ── */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-[#E8EDF6]">
            <div className="px-6 py-4 flex items-center justify-between border-b border-[#F3F4F6]">
              <div>
                <h2 className="text-[15px] font-bold text-[#0C1220]">Import Orders from CSV</h2>
                <p className="text-[12px] text-[#9CA3AF] mt-0.5">Bulk-create orders from a CSV file</p>
              </div>
              <button onClick={() => setShowImport(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#F3F4F6] text-[#9CA3AF] hover:text-[#0C1220] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between rounded-xl p-4 bg-[#FAFBFF] border border-[#E8EDF6]">
                <div>
                  <p className="text-[13px] font-semibold text-[#0C1220]">Download Template</p>
                  <p className="text-[11px] text-[#9CA3AF] mt-0.5">Required: order_id, product_name</p>
                </div>
                <button onClick={downloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#4361EE] border border-[#E8EDF6] bg-white hover:bg-[#EEF2FF] transition-colors">
                  <Download className="w-3.5 h-3.5" /> Template
                </button>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#6B7280] mb-1.5">Select CSV File</label>
                <input type="file" accept=".csv,text/csv"
                  onChange={e => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null); }}
                  className="w-full text-[13px] rounded-xl px-3 py-2 border border-[#E8EDF6] bg-[#FAFBFF] text-[#0C1220] outline-none focus:border-[#4361EE]" />
                {importFile && (
                  <p className="text-[11px] text-[#9CA3AF] mt-1">{importFile.name} · {(importFile.size / 1024).toFixed(1)} KB</p>
                )}
              </div>

              {importResult && (
                <div className="rounded-xl p-4"
                  style={{
                    background: importResult.created > 0 ? "#ECFDF5" : "#FEF2F2",
                    border: `1px solid ${importResult.created > 0 ? "#BBF7D0" : "#FECACA"}`,
                  }}>
                  <div className="flex items-center gap-4">
                    <span className="text-[13px] font-bold text-[#059669]">✓ {importResult.created} created</span>
                    {importResult.skipped > 0 && <span className="text-[13px] text-[#D97706]">{importResult.skipped} skipped</span>}
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {importResult.errors.map((e, i) => (
                        <p key={i} className="text-[11px] text-[#DC2626]">Row {e.row}: {e.message}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button onClick={() => setShowImport(false)}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[#F3F4F6] text-[#6B7280] hover:text-[#0C1220] transition-colors">
                  Close
                </button>
                <button onClick={handleImport} disabled={!importFile || importing}
                  className="px-4 py-2 rounded-lg text-[13px] font-bold text-white disabled:opacity-50 transition-opacity"
                  style={{ background: "#4361EE" }}>
                  {importing ? "Importing…" : "Import Orders"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
