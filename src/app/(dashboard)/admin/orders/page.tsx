"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ShoppingCart, Trash2, Plus, X, Loader2, CalendarDays, CheckCircle2, XCircle, UserCheck, Download, ChevronLeft, ChevronRight, ExternalLink, Package, Pencil } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";

interface Seller   { id: string; name: string | null; email: string; }
interface Supplier { id: string; name: string | null; email: string; }
const SOURCES = ["SHOPIFY", "AMAZON", "FLIPKART", "MEESHO", "EBAY", "ETSY", "WALMART", "OTHER"] as const;

interface Order {
  id: string;
  externalOrderId: string;
  source: string;
  status: string;
  supplierStatus: string | null;
  supplierId: string | null;
  awbNumber: string | null;
  customerName: string | null;
  customerAddress: { phone?: string; address?: string; address1?: string; city?: string; state?: string; province?: string; pincode?: string; zip?: string } | null;
  totalAmount: number;
  createdAt: string;
  seller:   { id: string; name: string | null; email: string };
  supplier: { id: string; name: string | null; email: string } | null;
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

// ── Assign Supplier Modal ─────────────────────────────────────────────────

function AssignSupplierModal({ order, suppliers, onClose, onSaved }: {
  order: Order;
  suppliers: Supplier[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [supplierId, setSupplierId]         = useState("");
  const [dispatchDate, setDispatchDate]     = useState("");
  const [deliveryDate, setDeliveryDate]     = useState("");
  const [notes, setNotes]                   = useState("");
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId) { setError("Please select a supplier"); return; }
    setSaving(true); setError("");
    const res = await fetch(`/api/admin/orders/${order.id}/assign-supplier`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId,
        expectedDispatchDate: dispatchDate || undefined,
        expectedDeliveryDate: deliveryDate || undefined,
        notes: notes || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed to assign supplier"); setSaving(false); return; }
    onSaved();
    onClose();
  }

  const activeSuppliers = suppliers.filter((s) => s.id !== order.supplierId);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">Assign Supplier</h2>
            <p className="text-xs text-gray-400 mt-0.5">Order #{order.externalOrderId} · {order.customerName ?? "—"}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-xl text-sm bg-red-50 text-red-600 border border-red-100">{error}</div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Supplier *</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400">
              <option value="">Select supplier...</option>
              {activeSuppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name || s.email}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Expected Dispatch</label>
              <input type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Expected Delivery</label>
              <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Instructions or notes for the supplier..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
              style={{ background: "#16A34A" }}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Assigning...</> : <><UserCheck className="w-4 h-4" /> Assign & Create PO</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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

export default function AdminOrdersPage() {
  const [sellers, setSellers]             = useState<Seller[]>([]);
  const [suppliers, setSuppliers]         = useState<Supplier[]>([]);
  const [orders, setOrders]               = useState<Order[]>([]);
  const [totalOrders, setTotalOrders]     = useState(0);
  const [page, setPage]                   = useState(1);
  const [totalPages, setTotalPages]       = useState(1);
  const [counts, setCounts]               = useState({ new: 0, processing: 0, cancelled: 0, total: 0 });
  const PAGE_LIMIT = 50;
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [sellerFilter, setSellerFilter]   = useState("");
  const [statusFilter, setStatusFilter]   = useState("");
  const [sourceFilter, setSourceFilter]   = useState("");
  const [dateFrom, setDateFrom]           = useState("");
  const [dateTo, setDateTo]               = useState("");
  const [dateInputs, setDateInputs]       = useState<Record<string, string>>({});
  const [quickActing, setQuickActing]       = useState<string | null>(null);
  const [selected, setSelected]             = useState<Set<string>>(new Set());
  const [deleting, setDeleting]             = useState(false);
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [showAddModal, setShowAddModal]     = useState(false);
  const [assignOrder, setAssignOrder]       = useState<Order | null>(null);
  const [bulkAssignModal, setBulkAssignModal] = useState(false);
  const [bulkAssignSupplierId, setBulkAssignSupplierId] = useState("");
  const [bulkAssigning, setBulkAssigning]   = useState(false);
  const [bulkDateModal, setBulkDateModal]   = useState(false);
  const [bulkDate, setBulkDate]             = useState("");
  const [bulkSaving, setBulkSaving]         = useState(false);
  const [bulkStatus, setBulkStatus]         = useState("");
  const [bulkUpdating, setBulkUpdating]     = useState(false);
  const [createAwbLoading, setCreateAwbLoading] = useState<Record<string, boolean>>({});
  const [editingStatus, setEditingStatus]       = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/sellers").then((r) => r.json()).then((d) => setSellers(d.sellers ?? []));
    fetch("/api/admin/users?role=SUPPLIER").then((r) => r.json()).then((d) => setSuppliers(d.users ?? []));
  }, []);

  const fetchCounts = useCallback(async () => {
    const base = new URLSearchParams();
    if (sellerFilter) base.set("sellerId", sellerFilter);
    base.set("limit", "1");
    const [n, p, c, all] = await Promise.all([
      fetch(`/api/admin/orders?${base}&status=NEW`).then(r => r.json()),
      fetch(`/api/admin/orders?${base}&status=PROCESSING`).then(r => r.json()),
      fetch(`/api/admin/orders?${base}&status=CANCELLED`).then(r => r.json()),
      fetch(`/api/admin/orders?${base}`).then(r => r.json()),
    ]);
    setCounts({ new: n.total ?? 0, processing: p.total ?? 0, cancelled: c.total ?? 0, total: all.total ?? 0 });
  }, [sellerFilter]);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search)       params.set("search",   search);
    if (statusFilter) params.set("status",   statusFilter);
    if (sellerFilter) params.set("sellerId", sellerFilter);
    if (sourceFilter) params.set("source",   sourceFilter);
    if (dateFrom)     params.set("dateFrom", dateFrom);
    if (dateTo)       params.set("dateTo",   dateTo);
    params.set("page",  String(page));
    params.set("limit", String(PAGE_LIMIT));
    const res = await fetch(`/api/admin/orders?${params}`);
    const data = await res.json();
    setOrders(data.orders ?? []);
    setTotalOrders(data.total ?? 0);
    setTotalPages(data.pages ?? 1);
    setLoading(false);
  }, [search, statusFilter, sellerFilter, sourceFilter, dateFrom, dateTo, page]);

  useEffect(() => { setPage(1); }, [search, statusFilter, sellerFilter, sourceFilter, dateFrom, dateTo]);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Quick confirm: NEW → PROCESSING
  async function handleConfirm(order: Order) {
    setQuickActing(order.id);
    await fetch("/api/admin/orders/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, status: "PROCESSING" }),
    });
    setQuickActing(null);
    await fetchOrders();
  }

  // Quick cancel
  async function handleCancel(order: Order) {
    if (!confirm(`Cancel order ${order.externalOrderId}?`)) return;
    setQuickActing(order.id);
    await fetch("/api/admin/orders/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, status: "CANCELLED" }),
    });
    setQuickActing(null);
    await fetchOrders();
  }

  // Bulk confirm all selected NEW orders → PROCESSING
  async function handleBulkConfirm() {
    const newOrders = Array.from(selected).filter(id => orders.find(o => o.id === id)?.status === "NEW");
    if (newOrders.length === 0) { alert("No NEW orders selected"); return; }
    setBulkConfirming(true);
    await Promise.all(newOrders.map(orderId =>
      fetch("/api/admin/orders/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: "PROCESSING" }),
      })
    ));
    setSelected(new Set());
    await fetchOrders();
    setBulkConfirming(false);
  }

  // Bulk assign supplier to all selected unassigned orders
  async function handleBulkAssign() {
    if (!bulkAssignSupplierId) return;
    const targets = Array.from(selected).filter(id => {
      const o = orders.find(o => o.id === id);
      return o && !o.supplierId && !["DELIVERED", "CANCELLED", "RTO"].includes(o.status);
    });
    if (targets.length === 0) { alert("No unassigned orders selected"); return; }
    setBulkAssigning(true);
    await Promise.allSettled(targets.map(orderId =>
      fetch(`/api/admin/orders/${orderId}/assign-supplier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId: bulkAssignSupplierId }),
      })
    ));
    setSelected(new Set());
    setBulkAssignModal(false);
    setBulkAssignSupplierId("");
    await fetchOrders();
    setBulkAssigning(false);
  }

  async function handleDelete(orderIds: string[]) {
    if (!confirm(`Delete ${orderIds.length} order${orderIds.length > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setDeleting(true);
    await fetch("/api/admin/orders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds }),
    });
    setSelected(new Set());
    await fetchOrders();
    setDeleting(false);
  }

  async function handleBulkDate() {
    if (!bulkDate) return;
    setBulkSaving(true);
    await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds: Array.from(selected), orderDate: bulkDate }),
    });
    setSelected(new Set());
    setBulkDateModal(false);
    setBulkDate("");
    await fetchOrders();
    setBulkSaving(false);
  }

  async function handleBulkStatusUpdate() {
    if (!bulkStatus) return;
    if (!confirm(`Set ${selected.size} order(s) to ${bulkStatus}?`)) return;
    setBulkUpdating(true);
    await fetch("/api/admin/orders/bulk-update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds: Array.from(selected), status: bulkStatus }),
    });
    setSelected(new Set());
    setBulkStatus("");
    await fetchOrders();
    setBulkUpdating(false);
  }

  async function handleCreateAwb(orderId: string) {
    setCreateAwbLoading(p => ({ ...p, [orderId]: true }));
    const res = await fetch("/api/admin/deliveries/create-awb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    const data = await res.json();
    setCreateAwbLoading(p => ({ ...p, [orderId]: false }));
    if (!res.ok) { alert(data.error || "Failed to create AWB"); return; }
    await fetchOrders();
  }

  async function handleStatusUpdate(orderId: string, status: string) {
    await fetch("/api/admin/orders/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, status }),
    });
    setEditingStatus(null);
    await fetchOrders();
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
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelected(selected.size === orders.length ? new Set() : new Set(orders.map((o) => o.id)));
  }

  const newSelectedCount          = Array.from(selected).filter(id => orders.find(o => o.id === id)?.status === "NEW").length;
  const unassignedSelectedCount   = Array.from(selected).filter(id => {
    const o = orders.find(o => o.id === id);
    return o && !o.supplierId && !["DELIVERED", "CANCELLED", "RTO"].includes(o.status);
  }).length;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page)" }}>
      <PageHero
        title="Orders"
        subtitle="View, manage, add or delete seller orders"
        searchValue={search}
        searchPlaceholder="Search order ID, customer..."
        onSearchChange={setSearch}
        onSearchSubmit={fetchOrders}
        actions={
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "#16A34A" }}>
            <Plus className="w-4 h-4" /> Add Order
          </button>
        }
        filters={
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={sellerFilter}
              onChange={(e) => setSellerFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl outline-none" style={{ color: "var(--text-primary)", background: "var(--bg-muted)", border: "1px solid var(--border)" }}>
              <option value="" className="text-gray-900 bg-white">All Sellers</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id} className="text-gray-900 bg-white">{s.name || s.email}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl outline-none" style={{ color: "var(--text-primary)", background: "var(--bg-muted)", border: "1px solid var(--border)" }}>
              <option value="" className="text-gray-900 bg-white">All Statuses</option>
              {STATUSES.map((s) => <option key={s} value={s} className="text-gray-900 bg-white">{s}</option>)}
            </select>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl outline-none" style={{ color: "var(--text-primary)", background: "var(--bg-muted)", border: "1px solid var(--border)" }}>
              <option value="" className="text-gray-900 bg-white">All Platforms</option>
              {SOURCES.map((s) => <option key={s} value={s} className="text-gray-900 bg-white">{s}</option>)}
            </select>
            <input
              type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              title="From date"
              className="px-3 py-2 text-sm rounded-xl outline-none"
              style={{ color: "var(--text-primary)", background: "var(--bg-muted)", border: "1px solid var(--border)", colorScheme: "dark" }}
            />
            <input
              type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              title="To date"
              className="px-3 py-2 text-sm rounded-xl outline-none"
              style={{ color: "var(--text-primary)", background: "var(--bg-muted)", border: "1px solid var(--border)", colorScheme: "dark" }}
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="px-2 py-2 text-xs rounded-xl"
                style={{ background: "rgba(239,68,68,0.2)", color: "#FCA5A5", border: "1px solid rgba(239,68,68,0.3)" }}
                title="Clear dates">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        }
      />

      <div className="px-4 md:px-8 py-6">

        {/* ── Status cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            {
              label: "All Orders", value: counts.total, sub: "total received",
              color: "#4361EE", bg: "rgba(67,97,238,0.08)", border: "rgba(67,97,238,0.2)",
              active: statusFilter === "",
              onClick: () => { setStatusFilter(""); setPage(1); },
            },
            {
              label: "New / Pending", value: counts.new, sub: "awaiting confirmation",
              color: "#D97706", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)",
              active: statusFilter === "NEW",
              onClick: () => { setStatusFilter("NEW"); setPage(1); },
            },
            {
              label: "Confirmed", value: counts.processing, sub: "supplier assigned",
              color: "#16A34A", bg: "rgba(22,163,74,0.08)", border: "rgba(22,163,74,0.2)",
              active: statusFilter === "PROCESSING",
              onClick: () => { setStatusFilter("PROCESSING"); setPage(1); },
            },
            {
              label: "Cancelled", value: counts.cancelled, sub: "by seller or admin",
              color: "#EF4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)",
              active: statusFilter === "CANCELLED",
              onClick: () => { setStatusFilter("CANCELLED"); setPage(1); },
            },
          ].map(({ label, value, sub, color, bg, border, active, onClick }) => (
            <button key={label} onClick={onClick}
              className="rounded-2xl p-4 text-left transition-all"
              style={{
                background: active ? bg : "var(--bg-card)",
                border: `1px solid ${active ? border : "var(--border)"}`,
                boxShadow: active ? `0 0 0 2px ${color}25` : "var(--shadow-card)",
              }}>
              <p className="text-2xl font-black leading-none mb-1" style={{ color: active ? color : "var(--text-primary)" }}>
                {value.toLocaleString()}
              </p>
              <p className="text-xs font-semibold" style={{ color: active ? color : "var(--text-secondary)" }}>{label}</p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>
            </button>
          ))}
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" style={{ color: "var(--text-400)" }} />
              <span className="font-semibold text-sm" style={{ color: "var(--text-900)" }}>
                Orders ({totalOrders})
              </span>
            </div>
            <button
              onClick={() => exportToCSV()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "#F0FDF4", color: "#16A34A", border: "1px solid #D1FAE5" }}>
              <Download className="w-3.5 h-3.5" />
              {`Export CSV (${totalOrders})`}
            </button>
            {selected.size > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {newSelectedCount > 0 && (
                  <button
                    onClick={handleBulkConfirm}
                    disabled={bulkConfirming}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                    style={{ background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0" }}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {bulkConfirming ? "Confirming..." : `Confirm New (${newSelectedCount})`}
                  </button>
                )}
                {unassignedSelectedCount > 0 && (
                  <button
                    onClick={() => { setBulkAssignSupplierId(""); setBulkAssignModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: "#F0FDF4", color: "#15803D", border: "1px solid #BBF7D0" }}>
                    <UserCheck className="w-3.5 h-3.5" />
                    Assign Supplier ({unassignedSelectedCount})
                  </button>
                )}
                <button
                  onClick={() => { setBulkDate(""); setBulkDateModal(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>
                  <CalendarDays className="w-3.5 h-3.5" />
                  Set Date ({selected.size})
                </button>
                <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
                  className="px-2 py-1.5 rounded-lg text-xs border outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-900)", background: "var(--bg-card)" }}>
                  <option value="">Set status...</option>
                  {["PROCESSING","SHIPPED","IN_TRANSIT","DELIVERED","RTO","CANCELLED"].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {bulkStatus && (
                  <button onClick={handleBulkStatusUpdate} disabled={bulkUpdating}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                    style={{ background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0" }}>
                    {bulkUpdating ? "Updating..." : `Apply to ${selected.size}`}
                  </button>
                )}
                <button onClick={() => handleDelete(Array.from(selected))} disabled={deleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                  style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>
                  <Trash2 className="w-3.5 h-3.5" />
                  {deleting ? "Deleting..." : `Delete ${selected.size}`}
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="py-16 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox" checked={selected.size === orders.length && orders.length > 0}
                        onChange={toggleAll} className="rounded cursor-pointer" />
                    </th>
                    {["Order #", "Platform", "Seller", "Customer", "Products", "Amount", "Status", "Supplier", "Date", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.length === 0 ? (
                    <tr><td colSpan={11} className="py-12 text-center text-gray-400 text-sm">No orders found</td></tr>
                  ) : orders.map((order) => {
                    const isSelected = selected.has(order.id);
                    const isActing   = quickActing === order.id;
                    const isNew      = order.status === "NEW";
                    const canAssign  = !order.supplierId && !["DELIVERED", "CANCELLED", "RTO"].includes(order.status);
                    return (
                      <tr key={order.id} className={`hover:bg-gray-50/50 transition-colors ${isSelected ? "bg-blue-50/30" : ""}`}>
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(order.id)} className="rounded cursor-pointer" />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Link href={`/admin/orders/${order.id}`}
                            className="flex items-center gap-1 font-mono text-xs text-blue-600 hover:underline">
                            {order.externalOrderId}
                            <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                          </Link>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                            {order.source || "OTHER"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{order.seller.name || order.seller.email}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{order.customerName || "—"}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-[140px] truncate">
                          {order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-800 whitespace-nowrap">₹{order.totalAmount.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          {editingStatus === order.id ? (
                            <select
                              autoFocus
                              defaultValue={order.status}
                              onChange={e => handleStatusUpdate(order.id, e.target.value)}
                              onBlur={() => setEditingStatus(null)}
                              className="text-xs px-2 py-1 rounded-lg border border-blue-400 outline-none bg-white text-gray-800 cursor-pointer"
                            >
                              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : (
                            <button
                              onClick={() => setEditingStatus(order.id)}
                              title="Click to edit status"
                              className={`group flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[order.status] ?? "bg-gray-100 text-gray-600"} hover:opacity-80`}
                            >
                              {order.status}
                              <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60" />
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {order.supplier ? (
                            <div>
                              <p className="text-xs font-medium text-gray-700">{order.supplier.name ?? order.supplier.email}</p>
                              {order.supplierStatus && (
                                <p className="text-[10px] mt-0.5 font-medium"
                                  style={{ color: order.supplierStatus === "DISPATCHED" ? "#15803D" : order.supplierStatus === "REJECTED" ? "#DC2626" : "#D97706" }}>
                                  {order.supplierStatus.replace(/_/g, " ")}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            type="date"
                            defaultValue={order.createdAt.slice(0, 10)}
                            max={new Date().toISOString().split("T")[0]}
                            onChange={(e) => setDateInputs((p) => ({ ...p, [order.id]: e.target.value }))}
                            className="text-xs text-gray-600 border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400"
                            style={{ width: "8rem" }}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {!order.awbNumber && !["CANCELLED", "DELIVERED", "RTO"].includes(order.status) && (
                              <button
                                onClick={() => handleCreateAwb(order.id)}
                                disabled={createAwbLoading[order.id]}
                                title="Create Delhivery AWB"
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
                                style={{ background: "#EEF2FF", color: "#4338CA", border: "1px solid #C7D2FE" }}>
                                {createAwbLoading[order.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />}
                                AWB
                              </button>
                            )}
                            {order.awbNumber && (
                              <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                {order.awbNumber}
                              </span>
                            )}
                            {canAssign && (
                              <button
                                onClick={() => setAssignOrder(order)}
                                title="Assign supplier"
                                className="p-1.5 rounded-lg transition-colors"
                                style={{ color: "#16A34A", background: "#F0FDF4" }}>
                                <UserCheck className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {isNew ? (
                              <>
                                <button
                                  onClick={() => handleConfirm(order)}
                                  disabled={isActing}
                                  title="Confirm → Processing"
                                  className="p-1.5 rounded-lg text-green-500 hover:bg-green-50 disabled:opacity-40 transition-colors">
                                  {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => handleCancel(order)}
                                  disabled={isActing}
                                  title="Cancel order"
                                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 disabled:opacity-40 transition-colors">
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleDelete([order.id])}
                                disabled={deleting}
                                title="Delete order"
                                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
                                <Trash2 className="w-3.5 h-3.5" />
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)" }}>
              <span className="text-xs" style={{ color: "var(--text-400)" }}>
                Page {page} of {totalPages} · {totalOrders} orders
              </span>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="p-1.5 rounded-lg disabled:opacity-30 transition-colors hover:bg-gray-100"
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
                  className="p-1.5 rounded-lg disabled:opacity-30 transition-colors hover:bg-gray-100"
                  style={{ border: "1px solid var(--border)" }}>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <AddOrderModal
          sellers={sellers}
          onClose={() => setShowAddModal(false)}
          onSaved={fetchOrders}
        />
      )}

      {assignOrder && (
        <AssignSupplierModal
          order={assignOrder}
          suppliers={suppliers}
          onClose={() => setAssignOrder(null)}
          onSaved={fetchOrders}
        />
      )}

      {bulkAssignModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900">Assign Supplier</h3>
                <p className="text-xs text-gray-400 mt-0.5">Assign {unassignedSelectedCount} order{unassignedSelectedCount !== 1 ? "s" : ""} to a supplier</p>
              </div>
              <button onClick={() => setBulkAssignModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Supplier</label>
            <select value={bulkAssignSupplierId} onChange={(e) => setBulkAssignSupplierId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 mb-4 bg-white">
              <option value="">Select supplier...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name || s.email}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setBulkAssignModal(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleBulkAssign} disabled={bulkAssigning || !bulkAssignSupplierId}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
                style={{ background: "#16A34A" }}>
                {bulkAssigning
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Assigning...</>
                  : <><UserCheck className="w-4 h-4" /> Assign {unassignedSelectedCount} Orders</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkDateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900">Set Date for {selected.size} Orders</h3>
                <p className="text-xs text-gray-400 mt-0.5">All selected orders will get this date</p>
              </div>
              <button onClick={() => setBulkDateModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Order Date</label>
            <input type="date" value={bulkDate} max={new Date().toISOString().split("T")[0]}
              onChange={(e) => setBulkDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setBulkDateModal(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleBulkDate} disabled={bulkSaving || !bulkDate}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
                style={{ background: "#1D4ED8" }}>
                {bulkSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : `Apply to ${selected.size} orders`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
