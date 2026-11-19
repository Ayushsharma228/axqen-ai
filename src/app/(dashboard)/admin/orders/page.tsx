"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Loader2, CalendarDays, CheckCircle2, Download, ChevronLeft, ChevronRight, Pencil, Truck, Printer, Search } from "lucide-react";
import { OrderDrawer, STATUS_TONE } from "@/components/admin/order-drawer";
import { EnterAwbModal, ShipdaakModal } from "@/components/admin/order-ship-modals";

interface Seller   { id: string; name: string | null; email: string; }
const SOURCES = ["SHOPIFY", "AMAZON", "FLIPKART", "MEESHO", "EBAY", "ETSY", "WALMART", "OTHER"] as const;

interface Order {
  id: string;
  externalOrderId: string;
  source: string;
  status: string;
  awbNumber: string | null;
  courier?: string | null;
  paymentMode?: string;
  customerName: string | null;
  customerAddress: { phone?: string; address?: string; address1?: string; city?: string; state?: string; province?: string; pincode?: string; zip?: string } | null;
  totalAmount: number;
  createdAt: string;
  seller:   { id: string; name: string | null; email: string };
  items: { name: string; quantity: number }[];
}

const STATUSES = ["NEW", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "CANCELLED", "RTO"];

// ── Add Order Modal ───────────────────────────────────────────────────────

function AddOrderModal({ sellers, onClose, onSaved }: {
  sellers: Seller[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [sellerId, setSellerId]           = useState("");
  const [externalOrderId, setExtId]       = useState("");
  const [customerName, setCustName]       = useState("");
  const [customerPhone, setCustPhone]     = useState("");
  const [customerAddress, setCustAddress] = useState("");
  const [totalAmount, setTotal]           = useState("");
  const [status, setStatus]               = useState("NEW");
  const [orderDate, setOrderDate]         = useState(new Date().toISOString().split("T")[0]);
  const [items, setItems]                 = useState([{ name: "", quantity: 1, price: 0 }]);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState("");

  function addItem() { setItems((p) => [...p, { name: "", quantity: 1, price: 0 }]); }
  function removeItem(i: number) { setItems((p) => p.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, field: string, value: string | number) {
    setItems((p) => p.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sellerId || !externalOrderId || !totalAmount) {
      setError("Seller, Order ID and Amount are required"); return;
    }
    setSaving(true); setError("");
    const res = await fetch("/api/admin/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sellerId, externalOrderId, customerName, customerPhone,
        customerAddress, totalAmount, status, orderDate,
        items: items.filter((i) => i.name.trim()),
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed"); setSaving(false); return; }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="font-bold text-gray-900">Add Order Manually</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-xl text-sm bg-red-50 text-red-600 border border-red-100">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Seller *</label>
              <select value={sellerId} onChange={(e) => setSellerId(e.target.value)} required
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="">Select seller...</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name || s.email}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Order ID *</label>
              <input value={externalOrderId} onChange={(e) => setExtId(e.target.value)} required
                placeholder="e.g. #1234" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Order Date</label>
              <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Customer Name</label>
              <input value={customerName} onChange={(e) => setCustName(e.target.value)}
                placeholder="Customer name" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Phone</label>
              <input value={customerPhone} onChange={(e) => setCustPhone(e.target.value)}
                placeholder="+91 98765 43210" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Delivery Address</label>
              <input value={customerAddress} onChange={(e) => setCustAddress(e.target.value)}
                placeholder="Full address" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Total Amount (₹) *</label>
              <input type="number" value={totalAmount} onChange={(e) => setTotal(e.target.value)} required
                placeholder="0" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500">Products / Items</label>
              <button type="button" onClick={addItem}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800">
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={item.name} onChange={(e) => updateItem(i, "name", e.target.value)}
                    placeholder="Product name" className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  <input type="number" value={item.quantity} onChange={(e) => updateItem(i, "quantity", parseInt(e.target.value) || 1)}
                    placeholder="Qty" min={1} className="w-16 px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none text-center" />
                  <input type="number" value={item.price} onChange={(e) => updateItem(i, "price", parseFloat(e.target.value) || 0)}
                    placeholder="₹" className="w-20 px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none text-center" />
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)} className="p-1 text-red-400 hover:text-red-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 flex-shrink-0 bg-gray-50/50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100">
            Cancel
          </button>
          <button onClick={handleSubmit as never} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Plus className="w-4 h-4" /> Add Order</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

const TABS: { key: string; label: string }[] = [
  { key: "", label: "All" }, { key: "NEW", label: "New" }, { key: "PROCESSING", label: "Processing" },
  { key: "SHIPPED", label: "Shipped" }, { key: "IN_TRANSIT", label: "In transit" }, { key: "DELIVERED", label: "Delivered" },
  { key: "RTO", label: "RTO" }, { key: "CANCELLED", label: "Cancelled" },
];
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const fmtTime = (s: string) => new Date(s).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

export default function AdminOrdersPage() {
  const [sellers, setSellers]             = useState<Seller[]>([]);
  const [orders, setOrders]               = useState<Order[]>([]);
  const [totalOrders, setTotalOrders]     = useState(0);
  const [page, setPage]                   = useState(1);
  const [totalPages, setTotalPages]       = useState(1);
  const [counts, setCounts]               = useState<Record<string, number>>({});
  const PAGE_LIMIT = 50;
  const [loading, setLoading]             = useState(true);
  const [searchInput, setSearchInput]     = useState("");
  const [search, setSearch]               = useState("");
  const [sellerFilter, setSellerFilter]   = useState("");
  // Opened from a seller page: /admin/orders?seller=<id>
  useEffect(() => { const s = new URLSearchParams(window.location.search).get("seller"); if (s) setSellerFilter(s); }, []);
  const [statusFilter, setStatusFilter]   = useState("");
  const [sourceFilter, setSourceFilter]   = useState("");
  const [dateFrom, setDateFrom]           = useState("");
  const [dateTo, setDateTo]               = useState("");
  const [selected, setSelected]           = useState<Set<string>>(new Set());
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [showAddModal, setShowAddModal]   = useState(false);
  const [bulkDateModal, setBulkDateModal] = useState(false);
  const [bulkDate, setBulkDate]           = useState("");
  const [bulkSaving, setBulkSaving]       = useState(false);
  const [bulkStatus, setBulkStatus]       = useState("");
  const [bulkUpdating, setBulkUpdating]   = useState(false);
  const [enterAwbOrder, setEnterAwbOrder] = useState<Order | null>(null);
  const [shipOrder, setShipOrder]         = useState<Order | null>(null);
  const [drawerId, setDrawerId]           = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/sellers").then((r) => r.json()).then((d) => setSellers(d.sellers ?? []));
  }, []);

  const filterParams = useCallback(() => {
    const p = new URLSearchParams();
    if (search)       p.set("search",   search);
    if (sellerFilter) p.set("sellerId", sellerFilter);
    if (sourceFilter) p.set("source",   sourceFilter);
    if (dateFrom)     p.set("dateFrom", dateFrom);
    if (dateTo)       p.set("dateTo",   dateTo);
    return p;
  }, [search, sellerFilter, sourceFilter, dateFrom, dateTo]);

  const fetchCounts = useCallback(async () => {
    const d = await fetch(`/api/admin/orders/counts?${filterParams()}`).then(r => r.json()).catch(() => null);
    if (d?.counts) setCounts(d.counts);
  }, [filterParams]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = filterParams();
    if (statusFilter) params.set("status", statusFilter);
    params.set("page",  String(page));
    params.set("limit", String(PAGE_LIMIT));
    const data = await fetch(`/api/admin/orders?${params}`).then(r => r.json()).catch(() => ({}));
    setOrders(data.orders ?? []);
    setTotalOrders(data.total ?? 0);
    setTotalPages(data.pages ?? 1);
    setLoading(false);
  }, [filterParams, statusFilter, page]);

  useEffect(() => { setPage(1); setSelected(new Set()); }, [search, statusFilter, sellerFilter, sourceFilter, dateFrom, dateTo]);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  const refresh = async () => { await Promise.all([fetchOrders(), fetchCounts()]); };

  async function setOrderStatus(orderId: string, status: string) {
    const res = await fetch("/api/admin/orders/update-status", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, status }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Couldn't update the status"); }
    await refresh();
  }

  // Bulk confirm all selected NEW orders → PROCESSING
  async function handleBulkConfirm() {
    const newOrders = Array.from(selected).filter(id => orders.find(o => o.id === id)?.status === "NEW");
    if (newOrders.length === 0) return;
    setBulkConfirming(true);
    await Promise.all(newOrders.map(orderId =>
      fetch("/api/admin/orders/update-status", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, status: "PROCESSING" }),
      })
    ));
    setSelected(new Set());
    await refresh();
    setBulkConfirming(false);
  }

  async function handleBulkDate() {
    if (!bulkDate) return;
    setBulkSaving(true);
    await fetch("/api/admin/orders", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds: Array.from(selected), orderDate: bulkDate }),
    });
    setSelected(new Set()); setBulkDateModal(false); setBulkDate("");
    await refresh();
    setBulkSaving(false);
  }

  async function handleBulkStatusUpdate() {
    if (!bulkStatus) return;
    if (!confirm(`Set ${selected.size} order(s) to ${STATUS_TONE[bulkStatus]?.label ?? bulkStatus}?`)) return;
    setBulkUpdating(true);
    await fetch("/api/admin/orders/bulk-update-status", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds: Array.from(selected), status: bulkStatus }),
    });
    setSelected(new Set()); setBulkStatus("");
    await refresh();
    setBulkUpdating(false);
  }

  async function printLabel(orderId: string) {
    const res = await fetch("/api/admin/shipdaak", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "label", orderId }),
    });
    const d = await res.json();
    if (!res.ok || !d.labelUrl) { alert(d.error || "Label not available"); return; }
    window.open(d.labelUrl, "_blank", "noopener");
  }

  async function handleSaveAwb(orderId: string, awb: string, courier: string) {
    const res = await fetch("/api/admin/orders/set-awb", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, awb, courier, status: "SHIPPED" }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || "Failed to save AWB"); return; }
    setEnterAwbOrder(null);
    await refresh();
  }

  function exportToCSV() {
    const params = new URLSearchParams();
    if (search)       params.set("search",   search);
    if (statusFilter) params.set("status",   statusFilter);
    if (sellerFilter) params.set("sellerId", sellerFilter);
    if (sourceFilter) params.set("source",   sourceFilter);
    if (dateFrom)     params.set("from",     dateFrom);
    if (dateTo)       params.set("to",       dateTo);
    window.location.href = `/api/admin/orders/export?${params}`;
  }

  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll() {
    setSelected(selected.size === orders.length ? new Set() : new Set(orders.map((o) => o.id)));
  }

  const newSelectedCount = Array.from(selected).filter(id => orders.find(o => o.id === id)?.status === "NEW").length;
  const drawerOrder = orders.find(o => o.id === drawerId) ?? null;
  const ctl = "px-2.5 py-2 text-[12.5px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] text-[#374151]";
  const chipBtn = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-50";

  return (
    <div className="px-4 py-5 md:p-8 space-y-5" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-black text-[#0C1220]">Orders</h1>
          <p className="text-[12.5px] text-[#6B7280] mt-1">Every seller order. Click an order for the full story: items, address, calls, courier scans and actions.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportToCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold border border-[#E8EDF6] bg-white text-[#374151] hover:border-[#C7D2FE]">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold text-white bg-[#4361EE]">
            <Plus className="w-3.5 h-3.5" /> Add order
          </button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 overflow-x-auto bg-white rounded-xl border border-[#E8EDF6] p-1.5">
        {TABS.map(t => {
          const n = counts[t.key || "ALL"] ?? 0;
          const on = statusFilter === t.key;
          return (
            <button key={t.key || "all"} onClick={() => setStatusFilter(t.key)}
              className={`px-3 py-1.5 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5 whitespace-nowrap ${on ? "bg-[#E8EDFF] text-[#4361EE]" : "text-[#6B7280] hover:bg-[#F3F6FF]"}`}>
              {t.label}
              <span className={`text-[10.5px] px-1.5 rounded-full tabular-nums ${t.key === "NEW" && n ? "bg-[#FEF3C7] text-[#B45309]" : on ? "bg-white text-[#4361EE]" : "bg-[#F3F4F6] text-[#6B7280]"}`}>{n.toLocaleString("en-IN")}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap px-4 py-3 bg-[#FAFBFF] border-b border-[#F3F4F6]">
          <form className="relative flex-1 min-w-[200px] md:max-w-[300px]" onSubmit={e => { e.preventDefault(); setSearch(searchInput.trim()); }}>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
            <input id="order-search" value={searchInput} onChange={e => { setSearchInput(e.target.value); if (!e.target.value) setSearch(""); }}
              placeholder="Order ID, customer, AWB or product" className="pl-8 pr-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] w-full" />
          </form>
          <select id="f-seller" aria-label="Seller" value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)} className={`${ctl} max-w-[200px]`}>
            <option value="">All sellers</option>
            {sellers.map((s) => <option key={s.id} value={s.id}>{s.name || s.email}</option>)}
          </select>
          <select id="f-source" aria-label="Platform" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className={ctl}>
            <option value="">All platforms</option>
            {SOURCES.map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}
          </select>
          <input id="f-from" type="date" aria-label="From date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={ctl} />
          <span className="text-[12px] text-[#9CA3AF]">to</span>
          <input id="f-to" type="date" aria-label="To date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={ctl} />
          {(dateFrom || dateTo || sellerFilter || sourceFilter || search) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); setSellerFilter(""); setSourceFilter(""); setSearch(""); setSearchInput(""); }}
              className="text-[12px] font-semibold text-[#4361EE] px-2">Clear filters</button>
          )}
          <span className="text-[12px] text-[#9CA3AF] ml-auto">{totalOrders.toLocaleString("en-IN")} orders</span>
        </div>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap px-4 py-2.5 bg-[#EEF2FF] border-b border-[#E0E7FF]">
            <span className="text-[12.5px] font-semibold text-[#3730A3] mr-1">{selected.size} selected</span>
            {newSelectedCount > 0 && (
              <button onClick={handleBulkConfirm} disabled={bulkConfirming} className={`${chipBtn} bg-white text-[#047857] border border-[#BBF7D0]`}>
                <CheckCircle2 className="w-3.5 h-3.5" /> {bulkConfirming ? "Confirming…" : `Confirm new (${newSelectedCount})`}
              </button>
            )}
            <button onClick={() => { setBulkDate(""); setBulkDateModal(true); }} className={`${chipBtn} bg-white text-[#1D4ED8] border border-[#BFDBFE]`}>
              <CalendarDays className="w-3.5 h-3.5" /> Set date
            </button>
            <select id="bulk-status" aria-label="Set status" value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} className="px-2 py-1.5 rounded-lg text-[12px] border border-[#C7D2FE] bg-white outline-none">
              <option value="">Set status…</option>
              {["PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "RTO", "CANCELLED"].map(s => <option key={s} value={s}>{STATUS_TONE[s].label}</option>)}
            </select>
            {bulkStatus && (
              <button onClick={handleBulkStatusUpdate} disabled={bulkUpdating} className={`${chipBtn} bg-[#4361EE] text-white`}>
                {bulkUpdating ? "Updating…" : `Apply to ${selected.size}`}
              </button>
            )}
            <button onClick={() => setSelected(new Set())} className="ml-auto text-[12px] font-semibold text-[#4361EE]">Clear selection</button>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex items-center justify-center gap-2 text-[13px] text-[#9CA3AF]"><Loader2 className="w-4 h-4 animate-spin" /> Loading orders…</div>
        ) : orders.length === 0 ? (
          <p className="py-20 text-center text-[13px] text-[#9CA3AF]">No orders match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] text-[12.5px]">
              <thead>
                <tr className="bg-[#FAFBFF] text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                  <th className="pl-4 pr-2 py-2.5 w-8">
                    <input type="checkbox" aria-label="Select all" checked={selected.size === orders.length && orders.length > 0} onChange={toggleAll} className="rounded cursor-pointer accent-[#4361EE]" />
                  </th>
                  {["Order", "Seller", "Customer", "Products", "Amount", "Courier / AWB", "Status", ""].map((h, i) => (
                    <th key={i} className={`px-3 py-2.5 whitespace-nowrap ${h === "Amount" ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {orders.map((order) => {
                  const isSelected = selected.has(order.id);
                  const a = order.customerAddress ?? {};
                  const place = [a.city, a.pincode ?? a.zip].filter(Boolean).join(" · ");
                  const st = STATUS_TONE[order.status] ?? { bg: "#F3F4F6", fg: "#374151", label: order.status };
                  const open = !["CANCELLED", "DELIVERED", "RTO"].includes(order.status);
                  return (
                    <tr key={order.id} onClick={() => setDrawerId(order.id)} className={`cursor-pointer transition-colors ${isSelected ? "bg-[#F5F7FF]" : "hover:bg-[#FAFBFF]"}`}>
                      <td className="pl-4 pr-2 py-2.5" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" aria-label={`Select ${order.externalOrderId}`} checked={isSelected} onChange={() => toggleSelect(order.id)} className="rounded cursor-pointer accent-[#4361EE]" />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="block font-mono font-semibold text-[#0C1220]">{order.externalOrderId}</span>
                        <span className="block text-[11px] text-[#9CA3AF]">{fmtDate(order.createdAt)}, {fmtTime(order.createdAt)} · {order.source[0] + order.source.slice(1).toLowerCase()}</span>
                      </td>
                      <td className="px-3 py-2.5 text-[#374151] whitespace-nowrap truncate max-w-[150px]">{order.seller.name || order.seller.email}</td>
                      <td className="px-3 py-2.5">
                        <span className="block text-[#0C1220] truncate max-w-[170px]">{order.customerName || "—"}</span>
                        {place && <span className="block text-[11px] text-[#9CA3AF] truncate max-w-[170px]">{place}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-[#4B5563] max-w-[200px]">
                        <span className="block truncate">{order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ") || "—"}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <span className="block font-semibold text-[#0C1220] tabular-nums">₹{order.totalAmount.toLocaleString("en-IN")}</span>
                        {order.paymentMode && order.paymentMode !== "UNKNOWN" && (
                          <span className={`text-[10.5px] font-bold ${order.paymentMode === "COD" ? "text-[#B45309]" : "text-[#047857]"}`}>{order.paymentMode === "COD" ? "COD" : "Prepaid"}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {order.awbNumber ? (
                          <>
                            <span className="block text-[#374151]">{order.courier?.replace("Shipdaak · ", "") ?? "—"}</span>
                            <span className="block text-[11px] font-mono text-[#6B7280]">{order.awbNumber}</span>
                          </>
                        ) : <span className="text-[#C4C9D4]">Not shipped</span>}
                      </td>
                      <td className="px-3 py-2.5"><span className="text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap" style={{ background: st.bg, color: st.fg }}>{st.label}</span></td>
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {open && !order.awbNumber && (
                            <button onClick={() => setShipOrder(order)} title="Ship with Shipdaak" className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11.5px] font-bold text-white bg-[#4361EE]">
                              <Truck className="w-3 h-3" /> Ship
                            </button>
                          )}
                          {open && !order.awbNumber && (
                            <button onClick={() => setEnterAwbOrder(order)} title="Enter AWB" aria-label="Enter AWB" className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F6FF] hover:text-[#4361EE]"><Pencil className="w-3.5 h-3.5" /></button>
                          )}
                          {order.awbNumber && order.courier?.startsWith("Shipdaak · ") && (
                            <button onClick={() => printLabel(order.id)} title="Print label" aria-label="Print label" className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F6FF] hover:text-[#4361EE]"><Printer className="w-3.5 h-3.5" /></button>
                          )}
                          <ChevronRight className="w-4 h-4 text-[#C4C9D4]" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-4 py-3 flex items-center justify-between border-t border-[#F3F4F6]">
            <span className="text-[12px] text-[#9CA3AF]">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Previous page" className="p-1.5 rounded-lg border border-[#E8EDF6] disabled:opacity-30 hover:bg-[#F3F6FF]"><ChevronLeft className="w-4 h-4" /></button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                return (
                  <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-lg text-[12px] font-semibold ${p === page ? "bg-[#E8EDFF] text-[#4361EE]" : "text-[#6B7280] hover:bg-[#F3F6FF]"}`}>{p}</button>
                );
              })}
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} aria-label="Next page" className="p-1.5 rounded-lg border border-[#E8EDF6] disabled:opacity-30 hover:bg-[#F3F6FF]"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {drawerId && (
        <OrderDrawer
          orderId={drawerId}
          onClose={() => setDrawerId(null)}
          onShip={() => drawerOrder && setShipOrder(drawerOrder)}
          onAwb={() => drawerOrder && setEnterAwbOrder(drawerOrder)}
          onLabel={() => printLabel(drawerId)}
          onStatus={(s) => setOrderStatus(drawerId, s)}
        />
      )}

      {showAddModal && <AddOrderModal sellers={sellers} onClose={() => setShowAddModal(false)} onSaved={refresh} />}

      {bulkDateModal && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-[#0C1220]">Set date for {selected.size} orders</h3>
                <p className="text-[12px] text-[#9CA3AF] mt-0.5">All selected orders get this order date</p>
              </div>
              <button onClick={() => setBulkDateModal(false)} aria-label="Close" className="p-1 hover:bg-[#F3F4F6] rounded-lg"><X className="w-4 h-4 text-[#9CA3AF]" /></button>
            </div>
            <label htmlFor="bulk-date" className="block text-[12px] font-semibold text-[#374151] mb-1.5">Order date</label>
            <input id="bulk-date" type="date" value={bulkDate} max={new Date().toISOString().split("T")[0]} onChange={(e) => setBulkDate(e.target.value)}
              className="w-full px-3 py-2 text-[13px] border border-[#E8EDF6] rounded-lg outline-none focus:border-[#4361EE] mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setBulkDateModal(false)} className="flex-1 px-4 py-2 text-[13px] font-medium text-[#374151] border border-[#E8EDF6] rounded-lg hover:bg-[#F9FAFB]">Cancel</button>
              <button onClick={handleBulkDate} disabled={bulkSaving || !bulkDate} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-bold text-white rounded-lg disabled:opacity-50 bg-[#4361EE]">
                {bulkSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : `Apply to ${selected.size}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {shipOrder && (
        <ShipdaakModal order={shipOrder} onClose={() => setShipOrder(null)} onShipped={async () => { setShipOrder(null); await refresh(); }} />
      )}
      {enterAwbOrder && <EnterAwbModal order={enterAwbOrder} onClose={() => setEnterAwbOrder(null)} onSaved={handleSaveAwb} />}
    </div>
  );
}
