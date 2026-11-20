"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  RefreshCw, Download, ShoppingCart, XCircle,
  Loader2, ExternalLink, Copy, CopyCheck, Search, X, AlertTriangle, ChevronLeft, ChevronRight, Eye,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface OrderItem { id: string; name: string; sku: string | null; quantity: number; price: number; }
interface Order {
  id: string; externalOrderId: string; source: string; status: string; paymentMode: string;
  customerName: string | null; customerEmail: string | null;
  customerAddress: { phone?: string; address?: string; city?: string; state?: string; province?: string; pincode?: string; zip?: string } | null;
  totalAmount: number; awbNumber: string | null; courier: string | null; createdAt: string; items: OrderItem[];
  supplierStatus: string | null; customerOrderCount: number;
  ndrStatus?: string | null; ndrActionTaken?: string | null;
  callNote: string | null;
}
type RtoScore = {
  score: number; level: string; signals: string[];
  breakdown?: { phone: number; address: number; pincode: number; history: number; velocity: number; payment: number };
};

// ── Config ─────────────────────────────────────────────────────────────────
const SUPPLIER_LABEL: Record<string, string> = {
  PENDING_ASSIGNMENT: "Pending supplier",
  ASSIGNED: "Supplier assigned",
  ACCEPTED: "Supplier accepted",
  REJECTED: "Supplier rejected",
  PROCESSING: "Being packed",
  PACKED: "Packed",
  READY_TO_SHIP: "Ready to ship",
  DISPATCHED: "Dispatched",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  NEW:        { label: "New",        color: "#4361EE", bg: "#EEF2FF" },
  PROCESSING: { label: "Confirmed",  color: "#D97706", bg: "#FFF7ED" },
  SHIPPED:    { label: "Shipped",    color: "#7C3AED", bg: "#F5F3FF" },
  IN_TRANSIT: { label: "In transit", color: "#0369A1", bg: "#E0F2FE" },
  DELIVERED:  { label: "Delivered",  color: "#059669", bg: "#ECFDF5" },
  RTO:        { label: "RTO",        color: "#EF4444", bg: "#FEF2F2" },
  CANCELLED:  { label: "Cancelled",  color: "#6B7280", bg: "#F3F4F6" },
};

const TABS = [
  { label: "All",       value: "ALL" },
  { label: "New",       value: "NEW",       hint: "Being confirmed" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "Shipped",   value: "SHIPPED" },
  { label: "Delivered", value: "DELIVERED" },
  { label: "RTO",       value: "RTO" },
  { label: "Cancelled", value: "CANCELLED" },
];

const RANGES = [
  { key: "1",   label: "Today" },
  { key: "7",   label: "7d" },
  { key: "30",  label: "30d" },
  { key: "90",  label: "90d" },
  { key: "all", label: "All" },
];

const RISK: Record<string, { bg: string; color: string; label: string }> = {
  LOW:       { bg: "#F0FDF4", color: "#15803D", label: "Low" },
  MEDIUM:    { bg: "#FFFBEB", color: "#B45309", label: "Medium" },
  HIGH:      { bg: "#FFF7ED", color: "#C2410C", label: "High" },
  VERY_HIGH: { bg: "#FEF2F2", color: "#DC2626", label: "Very High" },
};

function formatDate(d: Date) { return d.toISOString().split("T")[0]; }
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const PAGE_SIZE = 50;

// ── Main ───────────────────────────────────────────────────────────────────
export default function SellerOrdersPage() {
  const searchParams = useSearchParams();

  const [orders,       setOrders]       = useState<Order[]>([]);
  const [counts,       setCounts]       = useState<Record<string, number>>({});
  const [total,        setTotal]        = useState(0);
  const [pages,        setPages]        = useState(1);
  const [products,     setProducts]     = useState<string[]>([]);
  const [rtoScores,    setRtoScores]    = useState<Record<string, RtoScore>>({});
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [exporting,    setExporting]    = useState(false);

  // Filters
  const [tab,     setTab]     = useState(searchParams.get("tab")?.toUpperCase() ?? "ALL");
  const [range,   setRange]   = useState("30");
  const [payment, setPayment] = useState("");
  const [source,  setSource]  = useState(searchParams.get("source")?.toUpperCase() ?? "");
  const [product, setProduct] = useState("");
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [search,  setSearch]  = useState(searchParams.get("search") ?? "");
  const [page,    setPage]    = useState(1);

  const [cancelling,   setCancelling]   = useState<string | null>(null);
  const [copiedId,     setCopiedId]     = useState<string | null>(null);
  const [syncError,    setSyncError]    = useState("");
  const [syncStale,    setSyncStale]    = useState<{ lastSyncAt: string | null; lastSyncError: string | null } | null>(null);
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [showImport,   setShowImport]   = useState(false);
  const [importFile,   setImportFile]   = useState<File | null>(null);
  const [importing,    setImporting]    = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: { row: number; message: string }[] } | null>(null);

  useEffect(() => {
    if (searchParams.get("import") === "1") setShowImport(true);
  }, [searchParams]);

  // Any filter change → back to page 1, clear selection
  useEffect(() => { setPage(1); setSelected(new Set()); }, [tab, range, payment, source, product, search]);

  const buildParams = useCallback((extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ tab, ...extra });
    if (range !== "all") {
      p.set("from", formatDate(new Date(Date.now() - (Number(range) - 1) * 86400000)));
      p.set("to", formatDate(new Date()));
    }
    if (payment) p.set("payment", payment);
    if (source)  p.set("source", source);
    if (product) p.set("product", product);
    if (search)  p.set("search", search);
    return p;
  }, [tab, range, payment, source, product, search]);

  const fetchOrders = useCallback(async () => {
    const res = await fetch(`/api/seller/orders/list?${buildParams({ page: String(page), limit: String(PAGE_SIZE) })}`);
    const data = await res.json();
    const fetched: Order[] = data.orders || [];
    setOrders(fetched);
    setCounts(data.counts || {});
    setTotal(data.total ?? 0);
    setPages(data.pages ?? 1);
    if (data.products) setProducts(data.products);
    setLoading(false);

    // RTO risk for orders that haven't finished yet
    const toScore = fetched.filter(o => ["NEW", "PROCESSING", "SHIPPED", "IN_TRANSIT"].includes(o.status)).map(o => o.id);
    if (toScore.length > 0) {
      fetch("/api/seller/orders/rto-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: toScore }),
      }).then(r => r.ok ? r.json() : null).then(d => {
        if (d?.scores) setRtoScores(prev => ({ ...prev, ...d.scores }));
      }).catch(() => {});
    }
  }, [buildParams, page]);

  useEffect(() => { setLoading(true); fetchOrders(); }, [fetchOrders]);

  // Shopify sync freshness (once)
  useEffect(() => {
    fetch("/api/seller/shopify/store").then(r => r.ok ? r.json() : null).then(sd => {
      if (!sd?.store) return;
      const lastSync = sd.store.lastSyncAt ? new Date(sd.store.lastSyncAt) : null;
      const staleHours = lastSync ? (Date.now() - lastSync.getTime()) / 3_600_000 : null;
      const isStale = sd.store.lastSyncError || (staleHours !== null && staleHours > 2);
      setSyncStale(isStale ? { lastSyncAt: sd.store.lastSyncAt, lastSyncError: sd.store.lastSyncError } : null);
    }).catch(() => {});
  }, []);

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

  async function handleCancel(order: Order) {
    if (!confirm(`Cancel order #${order.externalOrderId}? This can't be undone.`)) return;
    setCancelling(order.id);
    const res = await fetch("/api/seller/orders/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setSyncError(d.error || "Couldn't cancel the order"); }
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

  async function handleExport() {
    setExporting(true);
    try {
      let rows: Order[];
      if (selected.size > 0) {
        rows = orders.filter(o => selected.has(o.id));
      } else {
        const res = await fetch(`/api/seller/orders/list?${buildParams({ export: "1" })}`);
        rows = (await res.json()).orders ?? [];
      }
      const csv = [
        ["Order #","Customer","Phone","Email","Products","Address","City","State","Pincode","Qty","Amount","Payment","Courier","AWB","Status","Date"].join(","),
        ...rows.map(o => {
          const addr = o.customerAddress;
          return [
            o.externalOrderId, o.customerName || "", addr?.phone || "", o.customerEmail || "",
            o.items.map(i => `${i.name} x${i.quantity}`).join("; "),
            addr?.address || "", addr?.city || "", addr?.state ?? addr?.province ?? "", addr?.pincode ?? addr?.zip ?? "",
            o.items.reduce((s, i) => s + i.quantity, 0), o.totalAmount, o.paymentMode || "",
            o.courier || "", o.awbNumber || "",
            STATUS_CONFIG[o.status]?.label ?? o.status, new Date(o.createdAt).toLocaleDateString("en-IN"),
          ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
        }),
      ].join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      a.download = selected.size > 0 ? `orders-selected-${selected.size}.csv` : `orders-${tab.toLowerCase()}.csv`;
      a.click();
    } finally {
      setExporting(false);
    }
  }

  const allSelected  = orders.length > 0 && orders.every(o => selected.has(o.id));
  const someSelected = selected.size > 0;
  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(orders.map(o => o.id)));
  }

  const filtersActive = !!(payment || source || product || search);
  const selectCls = "bg-white border border-[#E8EDF6] rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-[#374151] focus:outline-none focus:border-[#4361EE] max-w-[200px]";

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="px-3 py-4 md:p-8 space-y-5" style={{ background: "#F7F8FC", minHeight: "100vh" }}>

      {/* ── Page header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-black text-[#0C1220]">All Orders</h1>
          <p className="text-[12px] text-[#9CA3AF] mt-0.5">
            {(counts.ALL ?? 0).toLocaleString("en-IN")} orders · {RANGES.find(r => r.key === range)?.label === "All" ? "all time" : `last ${RANGES.find(r => r.key === range)?.label}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRefresh} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-white border border-[#E8EDF6] text-[#6B7280] hover:text-[#0C1220] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Syncing…" : "Sync Shopify"}
          </button>
          <button
            onClick={() => { setShowImport(true); setImportResult(null); setImportFile(null); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-white border border-[#E8EDF6] text-[#6B7280] hover:text-[#0C1220] transition-colors"
          >
            <Download className="w-3.5 h-3.5 rotate-180" /> Import CSV
          </button>
          <button
            onClick={handleExport} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-bold text-white transition-colors disabled:opacity-60"
            style={{ background: "#4361EE" }}
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {someSelected ? `Export (${selected.size})` : "Export"}
          </button>
        </div>
      </div>

      {/* ── Shopify sync stale warning ── */}
      {syncStale && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-[13px]"
          style={{ background: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E" }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#D97706" }} />
          <div className="flex-1">
            <span className="font-semibold">Shopify sync issue</span>
            {syncStale.lastSyncError
              ? ` — ${syncStale.lastSyncError}`
              : syncStale.lastSyncAt
                ? ` — last synced ${Math.round((Date.now() - new Date(syncStale.lastSyncAt).getTime()) / 3_600_000)}h ago. Orders may be missing.`
                : " — never synced. Check your Shopify connection."
            }
            <Link href="/seller/shopify" className="ml-2 underline font-semibold">Check connection →</Link>
          </div>
          <button onClick={() => setSyncStale(null)} aria-label="Dismiss"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {syncError && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          {syncError}
          <button className="ml-auto" onClick={() => setSyncError("")} aria-label="Dismiss"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── Orders card ── */}
      <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">

        {/* Tabs */}
        <div className="flex items-center border-b border-[#F3F4F6] overflow-x-auto px-2" style={{ scrollbarWidth: "none" }}>
          {TABS.map(t => {
            const active = tab === t.value;
            const c = counts[t.value] ?? 0;
            return (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                title={t.hint}
                className="px-3 md:px-4 py-3 text-[12.5px] md:text-[13px] font-semibold whitespace-nowrap flex-shrink-0 border-b-2 -mb-px transition-colors"
                style={{ borderColor: active ? "#4361EE" : "transparent", color: active ? "#4361EE" : "#6B7280" }}
              >
                {t.label}
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10.5px] font-bold tabular-nums"
                  style={{ background: active ? "#4361EE" : "#F3F4F6", color: active ? "white" : "#9CA3AF" }}>
                  {c.toLocaleString("en-IN")}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap px-3 md:px-4 py-3 border-b border-[#F3F4F6] bg-[#FAFBFF]">
          <div className="flex items-center bg-white border border-[#E8EDF6] rounded-lg p-0.5">
            {RANGES.map(r => (
              <button key={r.key} onClick={() => setRange(r.key)}
                className="px-2.5 py-1 text-[12px] font-semibold rounded-md transition-colors"
                style={{ background: range === r.key ? "#4361EE" : "transparent", color: range === r.key ? "white" : "#6B7280" }}>
                {r.label}
              </button>
            ))}
          </div>
          <select id="filter-payment" aria-label="Payment" value={payment} onChange={e => setPayment(e.target.value)} className={selectCls}>
            <option value="">All payments</option>
            <option value="COD">COD</option>
            <option value="PREPAID">Prepaid</option>
          </select>
          <select id="filter-source" aria-label="Source" value={source} onChange={e => setSource(e.target.value)} className={selectCls}>
            <option value="">All sources</option>
            <option value="SHOPIFY">Shopify</option>
            <option value="AMAZON">Amazon</option>
            <option value="OTHER">Manual / CSV</option>
          </select>
          <select id="filter-product" aria-label="Product" value={product} onChange={e => setProduct(e.target.value)} className={selectCls}>
            <option value="">All products</option>
            {products.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <form
            className="relative flex-1 min-w-[200px] md:max-w-[300px] md:ml-auto"
            onSubmit={e => { e.preventDefault(); setSearch(searchInput.trim()); }}
          >
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
            <input
              id="orders-search"
              type="text"
              placeholder="Order ID, name, phone or AWB"
              value={searchInput}
              onChange={e => { setSearchInput(e.target.value); if (!e.target.value) setSearch(""); }}
              className="pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-[#E8EDF6] bg-white text-[#0C1220] placeholder-[#9CA3AF] outline-none focus:border-[#4361EE] w-full"
            />
          </form>
          {filtersActive && (
            <button
              onClick={() => { setPayment(""); setSource(""); setProduct(""); setSearch(""); setSearchInput(""); }}
              className="text-[12px] font-semibold text-[#9CA3AF] hover:text-[#EF4444]"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-12 flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#4361EE]" />
            <p className="text-[13px] text-[#9CA3AF]">Loading orders…</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <ShoppingCart className="w-10 h-10 text-[#E8EDF6]" />
            <p className="text-[13px] font-medium text-[#9CA3AF]">No orders match these filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F3F4F6]" style={{ background: "#FAFBFF" }}>
                  <th className="px-4 py-3 w-8">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all"
                      className="w-3.5 h-3.5 rounded cursor-pointer accent-[#4361EE]" />
                  </th>
                  {[
                    { label: "ORDER",     cls: "" },
                    { label: "CUSTOMER",  cls: "" },
                    { label: "PRODUCTS",  cls: "hidden md:table-cell" },
                    { label: "AMOUNT",    cls: "" },
                    { label: "STATUS",    cls: "" },
                    { label: "RTO RISK",  cls: "hidden lg:table-cell" },
                    { label: "ACTIONS",   cls: "" },
                  ].map(h => (
                    <th key={h.label} className={`px-3 py-3 text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide whitespace-nowrap ${h.cls}`}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {orders.map(order => {
                  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.NEW;
                  const addr = order.customerAddress;
                  const prepaid = order.paymentMode === "PREPAID";
                  const canCancel = order.status === "NEW" || order.status === "PROCESSING";
                  const courierName = order.courier?.replace(/^Shipdaak · /, "") ?? null;
                  const detail =
                    order.status === "NEW" ? (order.callNote ?? "Confirmation call pending")
                    : order.status === "PROCESSING" ? (order.supplierStatus ? SUPPLIER_LABEL[order.supplierStatus] ?? order.supplierStatus : "Waiting to ship")
                    : order.awbNumber ? `${courierName ? courierName + " · " : ""}AWB ${order.awbNumber}`
                    : null;
                  const r = rtoScores[order.id];
                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-[#FAFBFF] transition-colors align-top"
                      style={{ background: selected.has(order.id) ? "rgba(67,97,238,0.03)" : undefined }}
                    >
                      <td className="px-4 py-3 w-8">
                        <input type="checkbox" checked={selected.has(order.id)} onChange={() => toggleSelect(order.id)} aria-label={`Select order ${order.externalOrderId}`}
                          className="w-3.5 h-3.5 rounded cursor-pointer accent-[#4361EE]" />
                      </td>
                      {/* Order */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <Link href={`/seller/orders/${order.id}`} className="text-[13px] font-bold text-[#4361EE] hover:underline">
                          #{order.externalOrderId}
                        </Link>
                        <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                          {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          {order.source !== "SHOPIFY" && <> · {order.source === "OTHER" ? "Manual" : order.source.charAt(0) + order.source.slice(1).toLowerCase()}</>}
                        </p>
                      </td>
                      {/* Customer */}
                      <td className="px-3 py-3 max-w-[200px]">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[13px] font-semibold text-[#0C1220] truncate">{order.customerName || "—"}</p>
                          {order.customerOrderCount > 1 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#EDE9FE] text-[#7C3AED]" title="Orders from this customer">
                              ×{order.customerOrderCount}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#9CA3AF] truncate">
                          {[addr?.city, addr?.state ?? addr?.province].filter(Boolean).join(", ") || addr?.phone || "—"}
                        </p>
                      </td>
                      {/* Products */}
                      <td className="hidden md:table-cell px-3 py-3 max-w-[200px]">
                        <p className="text-[12px] text-[#6B7280] line-clamp-2">
                          {order.items.map(i => `${i.name} ×${i.quantity}`).join(", ")}
                        </p>
                      </td>
                      {/* Amount */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <p className="text-[13px] font-bold text-[#0C1220] tabular-nums">{inr(order.totalAmount)}</p>
                        {order.paymentMode !== "UNKNOWN" && (
                          <span className="inline-block mt-1 text-[9.5px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: prepaid ? "#EEF2FF" : "#FFF7ED", color: prepaid ? "#4361EE" : "#C2410C" }}>
                            {prepaid ? "PREPAID" : "COD"}
                          </span>
                        )}
                      </td>
                      {/* Status */}
                      <td className="px-3 py-3 max-w-[220px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap"
                            style={{ background: cfg.bg, color: cfg.color }}>
                            {cfg.label}
                          </span>
                          {order.ndrStatus && !order.ndrActionTaken && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#FEF2F2] text-[#DC2626]">NDR</span>
                          )}
                        </div>
                        {detail && <p className="text-[11px] text-[#6B7280] mt-1 truncate" title={detail}>{detail}</p>}
                      </td>
                      {/* RTO Risk */}
                      <td className="hidden lg:table-cell px-3 py-3">
                        {r ? (() => {
                          const rc = RISK[r.level] ?? RISK.LOW;
                          const bd = r.breakdown;
                          const breakdown = bd
                            ? `\nBreakdown:\n  Phone:    ${bd.phone}/30\n  Address:  ${bd.address}/35\n  Pin code: ${bd.pincode}/20\n  History:  ${bd.history}/35\n  Velocity: ${bd.velocity}/10\n  Payment:  ${bd.payment}/20`
                            : "";
                          const signals = r.signals.length ? `\n\nSignals:\n${r.signals.map(s => "  • " + s).join("\n")}` : "";
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold cursor-help whitespace-nowrap"
                              style={{ background: rc.bg, color: rc.color }}
                              title={`RTO Risk — ${r.score}/100 (${r.level.replace("_", " ")})${breakdown}${signals}`}>
                              {rc.label}
                            </span>
                          );
                        })() : <span className="text-[11px] text-[#D1D5DB]">—</span>}
                      </td>
                      {/* Actions */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <Link href={`/seller/orders/${order.id}`} title="View order"
                            className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#F3F4F6] text-[#6B7280] hover:bg-[#0C1220] hover:text-white transition-colors">
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                          {order.awbNumber && (
                            <Link href={`/seller/tracking/${encodeURIComponent(order.awbNumber)}`} title="Track shipment"
                              className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#EEF2FF] text-[#4361EE] hover:bg-[#4361EE] hover:text-white transition-colors">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          )}
                          <button
                            title="Copy customer tracking link"
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
                          {canCancel && (
                            <button
                              onClick={() => handleCancel(order)}
                              disabled={cancelling === order.id}
                              title="Cancel order (only before it ships)"
                              className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#FEF2F2] text-[#EF4444] hover:bg-[#EF4444] hover:text-white transition-colors disabled:opacity-40">
                              {cancelling === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
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

        {/* Footer: count + pagination */}
        {!loading && orders.length > 0 && (
          <div className="px-4 py-3 border-t border-[#F3F4F6] flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[12px] text-[#9CA3AF]">
              {((page - 1) * PAGE_SIZE + 1).toLocaleString("en-IN")}–{((page - 1) * PAGE_SIZE + orders.length).toLocaleString("en-IN")} of {total.toLocaleString("en-IN")}
              {someSelected && <> · <span className="text-[#4361EE] font-semibold">{selected.size} selected</span>{" "}
                <button onClick={() => setSelected(new Set())} className="hover:text-[#EF4444]">(clear)</button></>}
            </p>
            {pages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Previous page"
                  className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#E8EDF6] text-[#6B7280] disabled:opacity-40 hover:text-[#0C1220]">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[12px] font-semibold text-[#6B7280] px-2 tabular-nums">Page {page} of {pages}</span>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages} aria-label="Next page"
                  className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#E8EDF6] text-[#6B7280] disabled:opacity-40 hover:text-[#0C1220]">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
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
