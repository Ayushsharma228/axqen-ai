"use client";

import { useState, useEffect, useCallback } from "react";
import {
  IndianRupee, CheckSquare, Square, Calculator, Send,
  ChevronRight, History, Clock, CheckCircle2, BadgeCheck, RotateCcw,
  ArrowLeft, Search, Store,
} from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";

interface Seller { id: string; name: string | null; email: string; brandName: string | null; }

interface Order {
  id: string; externalOrderId: string; status: string; courier?: string | null;
  customerName: string | null; totalAmount: number; productCost: number | null;
  shippingCharge: number | null; packingCharge: number | null; rtoCharge: number | null;
  createdAt: string; items: { name: string; quantity: number }[];
}

interface ChargeRow {
  orderId: string; productCost: string; shippingCharge: string;
  packingCharge: string; rtoCharge: string; include: boolean;
}

interface HistoryOrder {
  id: string; externalOrderId: string; customerName: string | null; status: string; courier?: string | null;
  totalAmount: number; productCost: number | null; shippingCharge: number | null;
  packingCharge: number | null; rtoCharge: number | null;
}

interface HistoryEntry {
  transaction: {
    id: string; type: string; amount: number; note: string | null;
    remittanceDate: string | null; bankTxId: string | null; createdAt: string;
  };
  orders: HistoryOrder[];
}

function fmt(n: number) { return `₹${n.toFixed(2)}`; }

function netForHistoryOrder(o: HistoryOrder) {
  const rto = o.status === "RTO";
  const pc = o.productCost ?? 0; const sc = o.shippingCharge ?? 0;
  const pac = o.packingCharge ?? 0; const rtc = o.rtoCharge ?? 0;
  return rto ? -(pc + rtc + pac) : o.totalAmount - pc - sc - pac;
}

function OrderBreakdownTable({ orders }: { orders: HistoryOrder[] }) {
  return (
    <div className="overflow-x-auto border-t border-gray-100">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50/60">
            <th className="px-4 py-2 text-left text-gray-500">Order #</th>
            <th className="px-4 py-2 text-left text-gray-500">Type</th>
            <th className="px-4 py-2 text-left text-gray-500">Customer</th>
            <th className="px-4 py-2 text-right text-gray-500">Order Amt</th>
            <th className="px-4 py-2 text-right text-purple-600">Product</th>
            <th className="px-4 py-2 text-right text-blue-600">Shipping</th>
            <th className="px-4 py-2 text-right text-orange-500">Platform</th>
            <th className="px-4 py-2 text-right text-red-500">RTO</th>
            <th className="px-4 py-2 text-right text-green-600 font-semibold">Net</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {orders.map((o) => {
            const rto = o.status === "RTO";
            const net = netForHistoryOrder(o);
            return (
              <tr key={o.id} className="hover:bg-gray-50/40">
                <td className="px-4 py-2 font-mono text-blue-600">{o.externalOrderId}</td>
                <td className="px-4 py-2">
                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${rto ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600"}`}>
                    {rto ? "RTO" : "Delivered"}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-600">{o.customerName || "—"}</td>
                <td className="px-4 py-2 text-right font-semibold text-gray-700">{rto ? "—" : fmt(o.totalAmount)}</td>
                <td className="px-4 py-2 text-right text-purple-700">{o.productCost != null ? fmt(o.productCost) : "—"}</td>
                <td className="px-4 py-2 text-right text-blue-700">{o.shippingCharge != null ? fmt(o.shippingCharge) : "—"}</td>
                <td className="px-4 py-2 text-right text-orange-600">{o.packingCharge != null ? fmt(o.packingCharge) : "—"}</td>
                <td className="px-4 py-2 text-right text-red-600">{o.rtoCharge != null ? fmt(o.rtoCharge) : "—"}</td>
                <td className="px-4 py-2 text-right font-bold">
                  <span className={net >= 0 ? "text-green-600" : "text-red-500"}>{fmt(net)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 border-t border-gray-200">
            <td colSpan={8} className="px-4 py-2 text-right font-semibold text-gray-600 text-xs">Total Net</td>
            <td className="px-4 py-2 text-right font-bold text-sm">
              {(() => { const t = orders.reduce((s, o) => s + netForHistoryOrder(o), 0); return <span className={t >= 0 ? "text-green-600" : "text-red-500"}>{fmt(t)}</span>; })()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function AdminRemittancePage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sellerId, setSellerId] = useState("");
  const [sellerSearch, setSellerSearch] = useState("");
  const [tab, setTab] = useState<"pending" | "history">("pending");

  // Pending
  const [orders, setOrders] = useState<Order[]>([]);
  const [charges, setCharges] = useState<Record<string, ChargeRow>>({});
  const [defaults, setDefaults] = useState({ platformCharge: 20, shippingCharge: 50 });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [remittanceDate, setRemittanceDate] = useState("");
  const [note, setNote] = useState("");
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [paidBankTxId, setPaidBankTxId] = useState("");
  const [success, setSuccess] = useState<{ total: number; paid: boolean } | null>(null);

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Mark as paid state
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [bankTxInput, setBankTxInput] = useState<Record<string, string>>({});
  const [savingPaid, setSavingPaid] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [bulkFill, setBulkFill] = useState({ productCost: "", shippingCharge: "", packingCharge: "", rtoCharge: "" });

  useEffect(() => {
    fetch("/api/admin/sellers").then((r) => r.json()).then((d) => setSellers(d.sellers ?? []));
  }, []);

  const fetchPending = useCallback(async () => {
    if (!sellerId) return;
    setLoading(true); setSuccess(null);
    const res = await fetch(`/api/admin/remittance?sellerId=${sellerId}`);
    const data = await res.json();
    const fetched: Order[] = data.orders ?? [];
    const cfgDefaults = data.defaults ?? { platformCharge: 20, shippingCharge: 50 };
    setOrders(fetched);
    setDefaults(cfgDefaults);
    const rows: Record<string, ChargeRow> = {};
    fetched.forEach((o) => {
      const isRTO = o.status === "RTO";
      rows[o.id] = {
        orderId: o.id,
        productCost:   o.productCost    != null ? o.productCost.toString()   : "",
        shippingCharge: isRTO ? "0"
          : o.shippingCharge != null ? o.shippingCharge.toString()
          : cfgDefaults.shippingCharge.toString(),
        packingCharge: o.packingCharge  != null ? o.packingCharge.toString()
          : cfgDefaults.platformCharge.toString(),
        rtoCharge:     o.rtoCharge     != null ? o.rtoCharge.toString()     : "",
        include: true,
      };
    });
    setCharges(rows); setLoading(false);
  }, [sellerId]);

  const fetchHistory = useCallback(async () => {
    if (!sellerId) return;
    setHistoryLoading(true);
    const res = await fetch(`/api/admin/remittance?sellerId=${sellerId}&mode=history`);
    const data = await res.json();
    setHistory(data.history ?? []); setHistoryLoading(false);
  }, [sellerId]);

  useEffect(() => { if (!sellerId) return; fetchPending(); fetchHistory(); }, [sellerId, fetchPending, fetchHistory]);

  function isRTO(o: Order) { return o.status === "RTO"; }

  function netForOrder(order: Order) {
    const row = charges[order.id];
    if (!row || !row.include) return null;
    const pc = parseFloat(row.productCost) || 0; const sc = parseFloat(row.shippingCharge) || 0;
    const pac = parseFloat(row.packingCharge) || 0; const rtc = parseFloat(row.rtoCharge) || 0;
    return isRTO(order) ? -(pc + rtc + pac) : order.totalAmount - pc - sc - pac;
  }

  const selectedOrders = orders.filter((o) => charges[o.id]?.include);
  const totalNet = selectedOrders.reduce((s, o) => s + (netForOrder(o) ?? 0), 0);
  const totalOrderAmt = selectedOrders.filter((o) => !isRTO(o)).reduce((s, o) => s + o.totalAmount, 0);
  const totalProductCost = selectedOrders.reduce((s, o) => s + (parseFloat(charges[o.id]?.productCost) || 0), 0);
  const totalShipping = selectedOrders.filter((o) => !isRTO(o)).reduce((s, o) => s + (parseFloat(charges[o.id]?.shippingCharge) || 0), 0);
  const totalPacking = selectedOrders.reduce((s, o) => s + (parseFloat(charges[o.id]?.packingCharge) || 0), 0);
  const totalRTO = selectedOrders.filter((o) => isRTO(o)).reduce((s, o) => s + (parseFloat(charges[o.id]?.rtoCharge) || 0), 0);
  const allSelected = orders.length > 0 && orders.every((o) => charges[o.id]?.include);

  function setCharge(orderId: string, field: keyof ChargeRow, value: string | boolean) {
    setCharges((p) => ({ ...p, [orderId]: { ...p[orderId], [field]: value } }));
  }
  function toggleAll() {
    setCharges((p) => { const n = { ...p }; orders.forEach((o) => { n[o.id] = { ...n[o.id], include: !allSelected }; }); return n; });
  }

  function applyBulkFill() {
    setCharges((prev) => {
      const next = { ...prev };
      selectedOrders.forEach((order) => {
        const rto = isRTO(order);
        if (bulkFill.productCost   !== "") next[order.id] = { ...next[order.id], productCost:    bulkFill.productCost };
        if (bulkFill.shippingCharge !== "" && !rto) next[order.id] = { ...next[order.id], shippingCharge: bulkFill.shippingCharge };
        if (bulkFill.packingCharge  !== "") next[order.id] = { ...next[order.id], packingCharge:  bulkFill.packingCharge };
        if (bulkFill.rtoCharge      !== "" && rto)  next[order.id] = { ...next[order.id], rtoCharge:      bulkFill.rtoCharge };
      });
      return next;
    });
    setBulkFill({ productCost: "", shippingCharge: "", packingCharge: "", rtoCharge: "" });
  }

  async function handleSubmit() {
    if (!sellerId || selectedOrders.length === 0) return;
    if (alreadyPaid && !remittanceDate) return alert("Set the paid-on date");
    if (alreadyPaid && !paidBankTxId.trim()) return alert("Enter bank/UPI transaction ID");
    setSubmitting(true);
    const payload = {
      sellerId, remittanceDate, note,
      bankTxId: alreadyPaid ? paidBankTxId.trim() : undefined,
      orders: orders.map((o) => ({ id: o.id, orderAmount: o.totalAmount, isRTO: isRTO(o), include: charges[o.id]?.include ?? false, productCost: charges[o.id]?.productCost ?? "0", shippingCharge: charges[o.id]?.shippingCharge ?? "0", packingCharge: charges[o.id]?.packingCharge ?? "0", rtoCharge: charges[o.id]?.rtoCharge ?? "0" })),
    };
    const res = await fetch("/api/admin/remittance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (res.ok) {
      setSuccess({ total: data.totalRemittance, paid: alreadyPaid });
      setNote(""); setRemittanceDate(""); setPaidBankTxId(""); setAlreadyPaid(false);
      await fetchPending(); await fetchHistory();
    } else alert(data.error || "Failed");
    setSubmitting(false);
  }

  async function handleReset(txId: string) {
    if (!confirm("Reset this remittance? The orders will return to Pending and can be recalculated.")) return;
    setResetting(txId);
    const res = await fetch(`/api/admin/remittance?txId=${txId}`, { method: "DELETE" });
    if (res.ok) { await fetchPending(); await fetchHistory(); }
    else { const d = await res.json(); alert(d.error || "Failed to reset"); }
    setResetting(null);
  }

  async function handleMarkPaid(txId: string) {
    const bankTxId = bankTxInput[txId]?.trim();
    if (!bankTxId) return alert("Enter bank/UPI transaction ID");
    setSavingPaid(txId);
    const res = await fetch("/api/admin/remittance", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ txId, bankTxId }) });
    if (res.ok) { setMarkingPaid(null); setBankTxInput((p) => { const n = { ...p }; delete n[txId]; return n; }); await fetchHistory(); }
    else alert("Failed to mark as paid");
    setSavingPaid(null);
  }

  // Split history into upcoming and completed
  const upcomingHistory = history.filter((e) => e.transaction.bankTxId === null && e.transaction.remittanceDate !== null);
  const completedHistory = history.filter((e) => e.transaction.bankTxId !== null);
  const otherHistory = history.filter((e) => e.transaction.bankTxId === null && e.transaction.remittanceDate === null);

  function HistoryCard({ entry, showMarkPaid }: { entry: HistoryEntry; showMarkPaid: boolean }) {
    const isOpen = expanded === entry.transaction.id;
    const hasOrders = entry.orders.length > 0;
    const net = entry.transaction.type === "CREDIT" ? entry.transaction.amount : -entry.transaction.amount;
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <button onClick={() => setExpanded(isOpen ? null : entry.transaction.id)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left">
          <div className="flex items-center gap-3">
            {hasOrders ? (isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />) : <span className="w-4" />}
            <div>
              <p className="text-sm font-semibold text-gray-900">{entry.transaction.note || "Remittance"}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                {entry.transaction.remittanceDate ? (
                  <span className={`text-xs font-medium ${entry.transaction.bankTxId ? "text-green-600" : "text-blue-500"}`}>
                    {entry.transaction.bankTxId ? "Paid on: " : "Expected: "}
                    {new Date(entry.transaction.remittanceDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">Created: {new Date(entry.transaction.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                )}
                {entry.transaction.bankTxId && (
                  <span className="text-xs text-green-600 font-medium font-mono">Tx ID: {entry.transaction.bankTxId}</span>
                )}
                {hasOrders && <span className="text-xs text-gray-400">{entry.orders.length} order(s)</span>}
              </div>
            </div>
          </div>
          <p className={`text-lg font-bold flex-shrink-0 ml-4 ${net >= 0 ? "text-green-600" : "text-red-500"}`}>
            {net >= 0 ? "+" : ""}{fmt(net)}
          </p>
        </button>

        {/* Mark as paid inline */}
        {showMarkPaid && (
          <div className="border-t border-gray-100 px-5 py-3 bg-yellow-50/50">
            {markingPaid === entry.transaction.id ? (
              <div className="flex items-center gap-2">
                <input type="text" placeholder="Enter bank / UPI transaction ID"
                  value={bankTxInput[entry.transaction.id] ?? ""}
                  onChange={(e) => setBankTxInput((p) => ({ ...p, [entry.transaction.id]: e.target.value }))}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-500 font-mono" />
                <button onClick={() => handleMarkPaid(entry.transaction.id)} disabled={savingPaid === entry.transaction.id}
                  className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 flex items-center gap-1">
                  <BadgeCheck className="w-3.5 h-3.5" /> {savingPaid === entry.transaction.id ? "Saving..." : "Confirm Paid"}
                </button>
                <button onClick={() => setMarkingPaid(null)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <button onClick={() => setMarkingPaid(entry.transaction.id)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-900">
                  <CheckCircle2 className="w-4 h-4" /> Mark as Paid — attach bank/UPI transaction ID
                </button>
                <button onClick={() => handleReset(entry.transaction.id)} disabled={resetting === entry.transaction.id}
                  className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-50 ml-auto">
                  <RotateCcw className="w-3.5 h-3.5" />
                  {resetting === entry.transaction.id ? "Resetting..." : "Reset & Recalculate"}
                </button>
              </div>
            )}
          </div>
        )}

        {isOpen && hasOrders && <OrderBreakdownTable orders={entry.orders} />}
        {isOpen && !hasOrders && (
          <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-400">Manual wallet adjustment — no order breakdown available</div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page)" }}>
      <PageHero title="Remittance" subtitle="Calculate and generate remittance for sellers" />

      <div className="px-8 py-6 space-y-5">

      {/* ── No seller selected — show card grid ── */}
      {!sellerId && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search sellers…"
              value={sellerSearch}
              onChange={e => setSellerSearch(e.target.value)}
              className="pl-9 pr-4 py-2 w-full text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {sellers.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">Loading sellers…</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {sellers
                .filter(s => {
                  const q = sellerSearch.toLowerCase();
                  return !q || (s.brandName || "").toLowerCase().includes(q) || (s.name || "").toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
                })
                .map(s => (
                  <button key={s.id}
                    onClick={() => { setSellerId(s.id); setTab("pending"); }}
                    className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-sm transition-all group">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                      <Store className="w-4 h-4 text-blue-500" />
                    </div>
                    <p className="text-sm font-semibold text-gray-900 truncate">{s.brandName || s.name || s.email}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{s.email}</p>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── Seller selected — show header + tabs ── */}
      {sellerId && (() => {
        const sel = sellers.find(s => s.id === sellerId);
        return (
          <div className="flex items-center gap-3">
            <button onClick={() => { setSellerId(""); setTab("pending"); }}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <ArrowLeft className="w-4 h-4 text-gray-500" />
            </button>
            <div className="flex items-center gap-2 flex-1">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Store className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{sel?.brandName || sel?.name || sel?.email}</p>
                <p className="text-xs text-gray-400">{sel?.email}</p>
              </div>
            </div>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
              <button onClick={() => setTab("pending")} className={`px-4 py-2 transition-colors ${tab === "pending" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>Pending</button>
              <button onClick={() => setTab("history")} className={`px-4 py-2 border-l border-gray-200 flex items-center gap-1.5 transition-colors ${tab === "history" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                <History className="w-3.5 h-3.5" /> History
                {upcomingHistory.length > 0 && <span className="bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">{upcomingHistory.length}</span>}
              </button>
            </div>
          </div>
        );
      })()}

      {success && (
        <div className={`rounded-xl p-4 text-sm font-semibold border ${success.total >= 0 ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
          {success.paid
            ? `Remittance of ${fmt(Math.abs(success.total))} recorded as paid successfully!`
            : `Remittance of ${fmt(Math.abs(success.total))} scheduled. Mark it as paid once transferred.`}
        </div>
      )}

      {/* HISTORY TAB */}
      {sellerId && tab === "history" && (
        historyLoading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Loading...</div>
        ) : history.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 text-sm">No remittance history yet</div>
        ) : (
          <div className="space-y-6">
            {/* Upcoming */}
            {upcomingHistory.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  <h2 className="font-semibold text-gray-800">Upcoming Remittances ({upcomingHistory.length})</h2>
                  <span className="text-xs text-gray-400">— scheduled but not yet paid</span>
                </div>
                {upcomingHistory.map((e) => <HistoryCard key={e.transaction.id} entry={e} showMarkPaid={true} />)}
              </div>
            )}

            {/* Completed */}
            {completedHistory.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <h2 className="font-semibold text-gray-800">Completed Remittances ({completedHistory.length})</h2>
                  <span className="text-xs text-gray-400">— paid with transaction ID</span>
                </div>
                {completedHistory.map((e) => <HistoryCard key={e.transaction.id} entry={e} showMarkPaid={false} />)}
              </div>
            )}

            {/* Old manual entries */}
            {otherHistory.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-gray-400" />
                  <h2 className="font-semibold text-gray-700">Manual Adjustments</h2>
                </div>
                {otherHistory.map((e) => <HistoryCard key={e.transaction.id} entry={e} showMarkPaid={true} />)}
              </div>
            )}
          </div>
        )
      )}

      {/* PENDING TAB */}
      {sellerId && tab === "pending" && (
        loading ? <div className="py-12 text-center text-gray-400 text-sm">Loading orders...</div>
          : orders.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 text-sm">No pending orders to remit</div>
          ) : (
            <>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-gray-400" />
                    <span className="font-semibold text-sm text-gray-900">Orders Pending Remittance ({orders.length})</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-medium">
                      Platform ₹{defaults.platformCharge} · Shipping ₹{defaults.shippingCharge} (auto-filled)
                    </span>
                  </div>
                  <button onClick={toggleAll} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800">
                    {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    {allSelected ? "Deselect All" : "Select All"}
                  </button>
                </div>
                {selectedOrders.length > 0 && (
                  <div className="px-5 py-3 flex items-center gap-3 flex-wrap" style={{ background: "#EFF6FF", borderBottom: "1px solid #BFDBFE" }}>
                    <span className="text-xs font-semibold text-blue-700 whitespace-nowrap">{selectedOrders.length} selected — bulk fill:</span>
                    <input type="number" min="0" placeholder="Product Cost" value={bulkFill.productCost}
                      onChange={(e) => setBulkFill((p) => ({ ...p, productCost: e.target.value }))}
                      className="w-28 text-right px-2 py-1 text-xs border border-purple-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-400 bg-white" />
                    <input type="number" min="0" placeholder="Shipping" value={bulkFill.shippingCharge}
                      onChange={(e) => setBulkFill((p) => ({ ...p, shippingCharge: e.target.value }))}
                      className="w-24 text-right px-2 py-1 text-xs border border-blue-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" />
                    <input type="number" min="0" placeholder="Platform" value={bulkFill.packingCharge}
                      onChange={(e) => setBulkFill((p) => ({ ...p, packingCharge: e.target.value }))}
                      className="w-24 text-right px-2 py-1 text-xs border border-orange-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white" />
                    <input type="number" min="0" placeholder="RTO Charge" value={bulkFill.rtoCharge}
                      onChange={(e) => setBulkFill((p) => ({ ...p, rtoCharge: e.target.value }))}
                      className="w-24 text-right px-2 py-1 text-xs border border-red-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-400 bg-white" />
                    <button onClick={applyBulkFill}
                      className="px-4 py-1.5 text-white text-xs font-semibold rounded-lg"
                      style={{ background: "#2563EB" }}>
                      Apply to {selectedOrders.length} orders
                    </button>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/60 border-b border-gray-100">
                        <th className="px-3 py-3 w-8 text-center">
                          <button onClick={toggleAll} title={allSelected ? "Deselect all" : "Select all"}>
                            {allSelected ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4 text-gray-400" />}
                          </button>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">Order #</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">Type</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">Customer</th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">Order Amt</th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-purple-600">Product Cost</th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-blue-600">Shipping</th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-orange-500">Platform</th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-red-500">RTO</th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-green-600">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {orders.map((order) => {
                        const row = charges[order.id]; const rto = isRTO(order); const net = netForOrder(order);
                        return (
                          <tr key={order.id} className={`hover:bg-gray-50/50 ${!row?.include ? "opacity-40" : ""}`}>
                            <td className="px-3 py-2 text-center">
                              <button onClick={() => setCharge(order.id, "include", !row?.include)}>
                                {row?.include ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4 text-gray-300" />}
                              </button>
                            </td>
                            <td className="px-3 py-2 font-mono text-xs text-blue-600 whitespace-nowrap">{order.externalOrderId}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rto ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600"}`}>{rto ? "RTO" : "Delivered"}</span>
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{order.customerName || "—"}</td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-800 whitespace-nowrap">{rto ? <span className="text-gray-400 text-xs">N/A</span> : fmt(order.totalAmount)}</td>
                            <td className="px-3 py-2"><input type="number" min="0" placeholder="0" value={row?.productCost ?? ""} onChange={(e) => setCharge(order.id, "productCost", e.target.value)} className="w-20 text-right px-2 py-1 text-xs border border-purple-200 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-400" /></td>
                            <td className="px-3 py-2"><input type="number" min="0" placeholder="0" value={row?.shippingCharge ?? ""} onChange={(e) => setCharge(order.id, "shippingCharge", e.target.value)} disabled={rto} className="w-20 text-right px-2 py-1 text-xs border border-blue-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-400" /></td>
                            <td className="px-3 py-2"><input type="number" min="0" placeholder="0" value={row?.packingCharge ?? ""} onChange={(e) => setCharge(order.id, "packingCharge", e.target.value)} className="w-20 text-right px-2 py-1 text-xs border border-orange-200 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-400" /></td>
                            <td className="px-3 py-2"><input type="number" min="0" placeholder="0" value={row?.rtoCharge ?? ""} onChange={(e) => setCharge(order.id, "rtoCharge", e.target.value)} disabled={!rto} className="w-20 text-right px-2 py-1 text-xs border border-red-200 rounded-md focus:outline-none focus:ring-1 focus:ring-red-400 disabled:bg-gray-50 disabled:text-gray-400" /></td>
                            <td className="px-3 py-2 text-right font-bold whitespace-nowrap">
                              {net === null ? <span className="text-gray-300 text-xs">—</span> : <span className={net >= 0 ? "text-green-600" : "text-red-500"}>{fmt(net)}</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2"><IndianRupee className="w-4 h-4" />Remittance Summary ({selectedOrders.length} selected)</h2>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Order Amount</p><p className="font-bold text-gray-800 mt-0.5">{fmt(totalOrderAmt)}</p></div>
                  <div className="bg-purple-50 rounded-lg p-3"><p className="text-xs text-purple-600">Product Cost</p><p className="font-bold text-purple-700 mt-0.5">- {fmt(totalProductCost)}</p></div>
                  <div className="bg-blue-50 rounded-lg p-3"><p className="text-xs text-blue-600">Shipping</p><p className="font-bold text-blue-700 mt-0.5">- {fmt(totalShipping)}</p></div>
                  <div className="bg-orange-50 rounded-lg p-3"><p className="text-xs text-orange-500">Platform Charges</p><p className="font-bold text-orange-600 mt-0.5">- {fmt(totalPacking)}</p></div>
                  <div className="bg-red-50 rounded-lg p-3"><p className="text-xs text-red-500">RTO Charges</p><p className="font-bold text-red-600 mt-0.5">- {fmt(totalRTO)}</p></div>
                  <div className={`rounded-lg p-3 ${totalNet >= 0 ? "bg-green-50" : "bg-red-50"}`}><p className={`text-xs font-semibold ${totalNet >= 0 ? "text-green-600" : "text-red-500"}`}>Net Remittance</p><p className={`text-xl font-bold mt-0.5 ${totalNet >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(totalNet)}</p></div>
                </div>
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  {/* Already Paid toggle */}
                  <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <button onClick={() => setAlreadyPaid((p) => !p)} className="flex items-center gap-2 text-sm font-medium text-green-800">
                      {alreadyPaid ? <CheckSquare className="w-5 h-5 text-green-600" /> : <Square className="w-5 h-5 text-green-600" />}
                      Already Paid — record past remittance
                    </button>
                    <span className="text-xs text-green-600 ml-auto">For February or older payments</span>
                  </div>

                  <div className={alreadyPaid ? "grid grid-cols-2 gap-3" : ""}>
                    {alreadyPaid && (
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Paid on Date *</label>
                        <input type="date" value={remittanceDate} onChange={(e) => setRemittanceDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Note (optional)</label>
                      <input type="text" placeholder="e.g. February remittance" value={note} onChange={(e) => setNote(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                  </div>

                  {alreadyPaid && (
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Bank / UPI Transaction ID *</label>
                      <input type="text" placeholder="UTR / UPI Ref No. / IMPS ID"
                        value={paidBankTxId} onChange={(e) => setPaidBankTxId(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-green-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-500 font-mono bg-green-50" />
                    </div>
                  )}
                </div>

                <button onClick={handleSubmit} disabled={submitting || selectedOrders.length === 0 || (alreadyPaid && (!remittanceDate || !paidBankTxId.trim()))}
                  className={`flex items-center gap-2 px-6 py-2.5 text-white text-sm font-semibold rounded-lg disabled:opacity-50 ${alreadyPaid ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}`}>
                  {alreadyPaid ? <BadgeCheck className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  {submitting ? "Saving..." : alreadyPaid ? `Mark as Paid — ${fmt(totalNet)}` : `Schedule Remittance — ${fmt(totalNet)}`}
                </button>
              </div>
            </>
          )
      )}
      </div>
    </div>
  );
}
