"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Phone, MessageSquare, CheckCircle, XCircle, Loader2,
  RefreshCw, ShoppingCart, AlertTriangle, Clock, Info, Pencil, X,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface OrderItem { id: string; name: string; sku: string | null; quantity: number; price: number; }
interface OrderAddress {
  phone?: string; address?: string;
  houseNo?: string; street?: string; landmark?: string;
  city?: string; state?: string; pincode?: string;
}
interface Order {
  id: string;
  externalOrderId: string;
  customerName: string | null;
  customerAddress: OrderAddress | null;
  totalAmount: number;
  paymentMode: string;
  confirmationStatus: string;
  confirmationChannel: string | null;
  confirmationRequestedAt: string | null;
  items: OrderItem[];
  createdAt: string;
}
interface EditAddr {
  houseNo: string; street: string; landmark: string;
  city: string; state: string; pincode: string; phone: string;
}
interface RtoScore {
  score: number;
  level: string;
  signals: string[];
  breakdown?: { phone: number; address: number; pincode: number; history: number; velocity: number; payment: number };
}

// ── Config ─────────────────────────────────────────────────────────────────
const RISK_CFG: Record<string, { bg: string; color: string; border: string; label: string }> = {
  LOW:       { bg: "#F0FDF4", color: "#15803D", border: "#BBF7D0", label: "Low Risk" },
  MEDIUM:    { bg: "#FFFBEB", color: "#B45309", border: "#FDE68A", label: "Medium Risk" },
  HIGH:      { bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA", label: "High Risk" },
  VERY_HIGH: { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA", label: "Very High Risk" },
};

const CONF_CFG: Record<string, { bg: string; color: string; label: string }> = {
  NOT_REQUIRED: { bg: "#F3F4F6", color: "#6B7280", label: "Not sent" },
  PENDING:      { bg: "#FFF7ED", color: "#C2410C", label: "Awaiting response" },
  CONFIRMED:    { bg: "#F0FDF4", color: "#15803D", label: "Customer confirmed ✓" },
  FAILED:       { bg: "#FEF2F2", color: "#DC2626", label: "Customer rejected ✗" },
  CANCELLED:    { bg: "#FFFBEB", color: "#B45309", label: "No answer" },
};

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

// ── Page ───────────────────────────────────────────────────────────────────
export default function OrderConfirmationPage() {
  const [orders,      setOrders]      = useState<Order[]>([]);
  const [rtoScores,   setRtoScores]   = useState<Record<string, RtoScore>>({});
  const [loading,     setLoading]     = useState(true);
  const [confirming,  setConfirming]  = useState<string | null>(null);
  const [cancelling,  setCancelling]  = useState<string | null>(null);
  const [calling,     setCalling]     = useState<string | null>(null);
  const [whatsapping, setWhatsapping] = useState<string | null>(null);
  const [actionMsg,   setActionMsg]   = useState<{ id: string; msg: string; ok: boolean } | null>(null);
  const [hillteckOk,  setHillteckOk]  = useState(false);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [editAddr,    setEditAddr]    = useState<EditAddr>({ houseNo: "", street: "", landmark: "", city: "", state: "", pincode: "", phone: "" });
  const [editSaving,  setEditSaving]  = useState(false);

  const flash = (id: string, msg: string, ok: boolean) => {
    setActionMsg({ id, msg, ok });
    setTimeout(() => setActionMsg(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    // Fetch all NEW orders (no date filter — all pending confirmation)
    const [ordersRes, hillteckRes] = await Promise.all([
      fetch("/api/seller/orders?status=NEW"),
      fetch("/api/admin/hillteck").catch(() => null),
    ]);
    const data = await ordersRes.json();
    const fetched: Order[] = data.orders || [];
    setOrders(fetched);

    // Check if HillTeck is live
    if (hillteckRes?.ok) {
      const hd = await hillteckRes.json();
      setHillteckOk(hd.connected && hd.enabled);
    }

    setLoading(false);

    // Fetch RTO scores in background
    if (fetched.length > 0) {
      fetch("/api/seller/orders/rto-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: fetched.map(o => o.id) }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.scores) setRtoScores(d.scores); })
        .catch(() => {});
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleConfirm(orderId: string) {
    setConfirming(orderId);
    const res = await fetch("/api/seller/orders/ship", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    if (res.ok) {
      setOrders(prev => prev.filter(o => o.id !== orderId));
      flash(orderId, "Order confirmed — sent to processing", true);
    } else {
      const d = await res.json();
      flash(orderId, d.error || "Failed to confirm", false);
    }
    setConfirming(null);
  }

  async function handleCancel(orderId: string) {
    setCancelling(orderId);
    const res = await fetch("/api/seller/orders/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    if (res.ok) {
      setOrders(prev => prev.filter(o => o.id !== orderId));
      flash(orderId, "Order cancelled", true);
    } else {
      flash(orderId, "Failed to cancel", false);
    }
    setCancelling(null);
  }

  async function handleHillteck(orderId: string, channel: "IVR" | "WHATSAPP") {
    const setSending = channel === "IVR" ? setCalling : setWhatsapping;
    setSending(orderId);
    const res = await fetch("/api/seller/orders/hillteck-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, channel }),
    });
    const d = await res.json();
    if (res.ok) {
      flash(orderId, channel === "IVR" ? "IVR call initiated" : "WhatsApp message sent", true);
      setOrders(prev => prev.map(o => o.id === orderId
        ? { ...o, confirmationStatus: "PENDING", confirmationChannel: channel }
        : o
      ));
    } else {
      flash(orderId, d.error || "Request failed", false);
    }
    setSending(null);
  }

  function openEdit(order: Order) {
    const a = order.customerAddress ?? {};
    setEditAddr({
      houseNo:  a.houseNo  ?? "",
      street:   a.street   ?? "",
      landmark: a.landmark ?? "",
      city:     a.city     ?? "",
      state:    a.state    ?? "",
      pincode:  a.pincode  ?? "",
      phone:    a.phone    ?? "",
    });
    setEditOrderId(order.id);
  }

  async function saveEdit(orderId: string) {
    setEditSaving(true);
    const res = await fetch(`/api/seller/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editAddr),
    });
    if (res.ok) {
      const d = await res.json();
      // Update local order address
      setOrders(prev => prev.map(o => o.id === orderId
        ? { ...o, customerAddress: d.customerAddress }
        : o
      ));
      // Re-score just this order
      fetch("/api/seller/orders/rto-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: [orderId] }),
      }).then(r => r.ok ? r.json() : null).then(d => {
        if (d?.scores) setRtoScores(prev => ({ ...prev, ...d.scores }));
      }).catch(() => {});
      flash(orderId, "Address updated — RTO score recalculated", true);
      setEditOrderId(null);
    } else {
      flash(orderId, "Failed to update address", false);
    }
    setEditSaving(false);
  }

  // Stats
  const highRisk   = orders.filter(o => ["HIGH", "VERY_HIGH"].includes(rtoScores[o.id]?.level ?? "")).length;
  const medRisk    = orders.filter(o => rtoScores[o.id]?.level === "MEDIUM").length;
  const lowRisk    = orders.filter(o => rtoScores[o.id]?.level === "LOW").length;
  const pending    = orders.filter(o => o.confirmationStatus === "PENDING").length;

  return (
    <div className="px-3 py-4 md:p-8 space-y-5" style={{ background: "#F7F8FC", minHeight: "100vh" }}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[18px] font-black" style={{ color: "#0C1220" }}>Order Confirmation</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#ECFDF5", color: "#059669" }}>NEW</span>
          </div>
          <p className="text-[12px] mt-0.5" style={{ color: "#9CA3AF" }}>
            Review new orders, check RTO risk, and confirm before dispatch
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-white border border-[#E8EDF6] text-[#6B7280] hover:text-[#0C1220] transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* ── Quick stats ── */}
      {!loading && orders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "New Orders",    value: orders.length, color: "#4361EE", icon: ShoppingCart },
            { label: "Pending Call",  value: pending,       color: "#C2410C", icon: Clock },
            { label: "Medium Risk",   value: medRisk,       color: "#B45309", icon: AlertTriangle },
            { label: "High Risk",     value: highRisk,      color: "#DC2626", icon: XCircle },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="rounded-xl px-4 py-3 flex items-center gap-3 bg-white"
              style={{ border: "1px solid #E8EDF6" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "#F7F8FC" }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#9CA3AF" }}>{label}</p>
                <p className="text-[20px] font-black leading-none" style={{ color: "#0C1220" }}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Order cards ── */}
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#4361EE" }} />
          <p className="text-[13px]" style={{ color: "#9CA3AF" }}>Loading orders…</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-3 bg-white rounded-xl"
          style={{ border: "1px solid #E8EDF6" }}>
          <CheckCircle className="w-10 h-10" style={{ color: "#D1D5DB" }} />
          <p className="text-[14px] font-semibold" style={{ color: "#9CA3AF" }}>All caught up</p>
          <p className="text-[12px]" style={{ color: "#D1D5DB" }}>No new orders waiting for confirmation</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const addr  = order.customerAddress;
            const rto   = rtoScores[order.id];
            const rCfg  = rto ? (RISK_CFG[rto.level] ?? RISK_CFG.LOW) : null;
            const cCfg  = CONF_CFG[order.confirmationStatus] ?? CONF_CFG.NOT_REQUIRED;
            const msg   = actionMsg?.id === order.id ? actionMsg : null;

            const breakdown = rto?.breakdown;
            const tooltipText = rto
              ? `RTO Risk — ${rto.score}/100 (${rto.level.replace("_", " ")})`
                + (breakdown ? `\n\nBreakdown:\n  Phone:    ${breakdown.phone}/30\n  Address:  ${breakdown.address}/35\n  Pin code: ${breakdown.pincode}/20\n  History:  ${breakdown.history}/35\n  Velocity: ${breakdown.velocity}/10\n  Payment:  ${breakdown.payment}/20` : "")
                + (rto.signals.length ? `\n\nSignals:\n${rto.signals.map(s => "  • " + s).join("\n")}` : "")
              : "";

            return (
              <div key={order.id} className="bg-white rounded-xl overflow-hidden"
                style={{ border: `1px solid ${rCfg ? rCfg.border : "#E8EDF6"}` }}>

                {/* Risk colour bar */}
                {rCfg && (
                  <div className="h-1" style={{ background: rCfg.color, opacity: 0.35 }} />
                )}

                <div className="p-4 md:p-5">
                  <div className="flex flex-wrap items-start gap-3 justify-between">

                    {/* Left — order info */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/seller/orders/${order.id}`}
                          className="text-[14px] font-black hover:underline"
                          style={{ color: "#4361EE" }}>
                          #{order.externalOrderId}
                        </Link>
                        <span className="text-[11px]" style={{ color: "#9CA3AF" }}>
                          {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: order.paymentMode === "COD" ? "#FFF7ED" : "#EEF2FF", color: order.paymentMode === "COD" ? "#C2410C" : "#4361EE" }}>
                          {order.paymentMode}
                        </span>
                      </div>

                      <p className="text-[13px] font-semibold" style={{ color: "#0C1220" }}>
                        {order.customerName || "Unknown customer"}
                      </p>
                      <div className="flex items-center gap-2">
                        {addr?.phone && (
                          <p className="text-[12px]" style={{ color: "#6B7280" }}>{addr.phone}</p>
                        )}
                        <button
                          onClick={() => editOrderId === order.id ? setEditOrderId(null) : openEdit(order)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors"
                          style={{ background: editOrderId === order.id ? "#EEF2FF" : "#F3F4F6", color: editOrderId === order.id ? "#4361EE" : "#9CA3AF" }}
                          title="Edit delivery address"
                        >
                          {editOrderId === order.id ? <X className="w-2.5 h-2.5" /> : <Pencil className="w-2.5 h-2.5" />}
                          {editOrderId === order.id ? "Cancel" : "Edit address"}
                        </button>
                      </div>
                      {addr && editOrderId !== order.id && (
                        <p className="text-[11px] max-w-xs" style={{ color: "#9CA3AF" }}>
                          {[addr.houseNo, addr.street, addr.landmark, addr.city, addr.state, addr.pincode]
                            .filter(Boolean).join(", ") ||
                            [addr.address, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ")}
                        </p>
                      )}

                      {/* Items */}
                      <p className="text-[11px] mt-1" style={{ color: "#6B7280" }}>
                        {order.items.map(i => `${i.name} ×${i.quantity}`).join(" · ")}
                      </p>
                    </div>

                    {/* Right — amount + risk */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <p className="text-[18px] font-black" style={{ color: "#0C1220" }}>
                        {inr(order.totalAmount)}
                      </p>

                      {/* RTO risk badge */}
                      {rCfg && rto ? (
                        <span
                          className="px-2.5 py-1 rounded-full text-[11px] font-bold cursor-help"
                          style={{ background: rCfg.bg, color: rCfg.color, border: `1px solid ${rCfg.border}` }}
                          title={tooltipText}
                        >
                          RTO: {rCfg.label} · {rto.score}/100
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium"
                          style={{ background: "#F3F4F6", color: "#9CA3AF" }}>
                          Scoring…
                        </span>
                      )}

                      {/* Confirmation status */}
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold"
                        style={{ background: cCfg.bg, color: cCfg.color }}>
                        {cCfg.label}
                      </span>
                    </div>
                  </div>

                  {/* ── Edit address form ── */}
                  {editOrderId === order.id && (
                    <div className="mt-4 rounded-xl p-4 space-y-3"
                      style={{ background: "#F7F8FC", border: "1px solid #E8EDF6" }}>
                      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#9CA3AF" }}>
                        Edit Delivery Address
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {([
                          { key: "houseNo",  label: "House / Flat No.",    placeholder: "e.g. H.No. 12, Flat 4B" },
                          { key: "street",   label: "Street / Locality",   placeholder: "e.g. MG Road, Sector 5" },
                          { key: "landmark", label: "Nearby Landmark",     placeholder: "e.g. Near City Mall" },
                          { key: "city",     label: "City",                placeholder: "e.g. Mumbai" },
                          { key: "state",    label: "State",               placeholder: "e.g. Maharashtra" },
                          { key: "pincode",  label: "Pincode",             placeholder: "6-digit pincode" },
                        ] as { key: keyof EditAddr; label: string; placeholder: string }[]).map(f => (
                          <div key={f.key}>
                            <label className="block text-[10px] font-semibold mb-0.5" style={{ color: "#6B7280" }}>
                              {f.label}
                            </label>
                            <input
                              type={f.key === "pincode" ? "tel" : "text"}
                              value={editAddr[f.key]}
                              onChange={e => setEditAddr(prev => ({ ...prev, [f.key]: e.target.value }))}
                              placeholder={f.placeholder}
                              className="w-full px-3 py-2 rounded-lg text-[12px] border outline-none transition-colors"
                              style={{ background: "white", borderColor: "#E8EDF6", color: "#0C1220" }}
                            />
                          </div>
                        ))}
                        <div>
                          <label className="block text-[10px] font-semibold mb-0.5" style={{ color: "#6B7280" }}>
                            Phone Number
                          </label>
                          <input
                            type="tel"
                            value={editAddr.phone}
                            onChange={e => setEditAddr(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="10-digit mobile"
                            className="w-full px-3 py-2 rounded-lg text-[12px] border outline-none transition-colors"
                            style={{ background: "white", borderColor: "#E8EDF6", color: "#0C1220" }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => saveEdit(order.id)}
                          disabled={editSaving}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-bold text-white disabled:opacity-50 transition-opacity"
                          style={{ background: "#4361EE" }}
                        >
                          {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          {editSaving ? "Saving…" : "Save & Rescore"}
                        </button>
                        <button
                          onClick={() => setEditOrderId(null)}
                          className="px-3 py-2 rounded-lg text-[12px] font-medium"
                          style={{ background: "#F3F4F6", color: "#6B7280" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* RTO signal list — only if medium/high */}
                  {rto && rto.signals.length > 0 && ["MEDIUM", "HIGH", "VERY_HIGH"].includes(rto.level) && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {rto.signals.map((s, i) => (
                        <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ background: "#F7F8FC", color: "#6B7280", border: "1px solid #E8EDF6" }}>
                          <Info className="w-2.5 h-2.5 flex-shrink-0" />
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Flash message */}
                  {msg && (
                    <div className="mt-3 px-3 py-2 rounded-lg text-[12px] font-medium"
                      style={{ background: msg.ok ? "#F0FDF4" : "#FEF2F2", color: msg.ok ? "#15803D" : "#DC2626" }}>
                      {msg.msg}
                    </div>
                  )}

                  {/* ── Action buttons ── */}
                  <div className="mt-4 flex flex-wrap gap-2">

                    {/* IVR Call */}
                    <button
                      onClick={() => hillteckOk && handleHillteck(order.id, "IVR")}
                      disabled={!hillteckOk || calling === order.id || order.confirmationStatus === "CONFIRMED"}
                      title={!hillteckOk ? "HillTeck not configured yet" : "Initiate IVR verification call to customer"}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: "#EEF2FF", color: "#4361EE", border: "1px solid #C7D2FE" }}
                    >
                      {calling === order.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Phone className="w-3.5 h-3.5" />}
                      {hillteckOk ? "Call to Confirm" : "IVR Call (soon)"}
                    </button>

                    {/* WhatsApp */}
                    <button
                      onClick={() => hillteckOk && handleHillteck(order.id, "WHATSAPP")}
                      disabled={!hillteckOk || whatsapping === order.id || order.confirmationStatus === "CONFIRMED"}
                      title={!hillteckOk ? "HillTeck not configured yet" : "Send WhatsApp confirmation message"}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: "#F0FDF4", color: "#15803D", border: "1px solid #BBF7D0" }}
                    >
                      {whatsapping === order.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <MessageSquare className="w-3.5 h-3.5" />}
                      {hillteckOk ? "WhatsApp" : "WhatsApp (soon)"}
                    </button>

                    {/* Manual confirm */}
                    <button
                      onClick={() => handleConfirm(order.id)}
                      disabled={confirming === order.id}
                      title="Manually confirm and send to processing"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50"
                      style={{ background: "#059669", color: "white" }}
                    >
                      {confirming === order.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <CheckCircle className="w-3.5 h-3.5" />}
                      Confirm
                    </button>

                    {/* Cancel */}
                    <button
                      onClick={() => handleCancel(order.id)}
                      disabled={cancelling === order.id}
                      title="Cancel this order"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50"
                      style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}
                    >
                      {cancelling === order.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <XCircle className="w-3.5 h-3.5" />}
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Low risk info banner */}
      {!loading && lowRisk > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-[12px]"
          style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#15803D" }}>
          <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            <span className="font-semibold">{lowRisk} low-risk order{lowRisk > 1 ? "s" : ""}</span> — good address, reliable customer.
            You can confirm these with confidence.
          </span>
        </div>
      )}
    </div>
  );
}
