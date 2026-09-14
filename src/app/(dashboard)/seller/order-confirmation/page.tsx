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
const RISK_CFG: Record<string, { color: string; label: string; dot: string }> = {
  LOW:       { color: "#15803D", label: "Low Risk",       dot: "#86EFAC" },
  MEDIUM:    { color: "#B45309", label: "Medium Risk",    dot: "#FCD34D" },
  HIGH:      { color: "#C2410C", label: "High Risk",      dot: "#FB923C" },
  VERY_HIGH: { color: "#DC2626", label: "Very High Risk", dot: "#FCA5A5" },
};

const CONF_LABEL: Record<string, string> = {
  NOT_REQUIRED: "Not sent",
  PENDING:      "Awaiting",
  CONFIRMED:    "Confirmed ✓",
  FAILED:       "Rejected ✗",
  CANCELLED:    "No answer",
};

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

// ── Shared UI primitives (match Dashboard style) ───────────────────────────
function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#9CA3AF" }}>
      {children}
    </p>
  );
}

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
    const [ordersRes, hillteckRes] = await Promise.all([
      fetch("/api/seller/orders?status=NEW"),
      fetch("/api/admin/hillteck").catch(() => null),
    ]);
    const data = await ordersRes.json();
    const fetched: Order[] = data.orders || [];
    setOrders(fetched);

    if (hillteckRes?.ok) {
      const hd = await hillteckRes.json();
      setHillteckOk(hd.connected && hd.enabled);
    }
    setLoading(false);

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
      setOrders(prev => prev.map(o => o.id === orderId
        ? { ...o, customerAddress: d.customerAddress }
        : o
      ));
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
  const highRisk = orders.filter(o => ["HIGH", "VERY_HIGH"].includes(rtoScores[o.id]?.level ?? "")).length;
  const medRisk  = orders.filter(o => rtoScores[o.id]?.level === "MEDIUM").length;
  const pending  = orders.filter(o => o.confirmationStatus === "PENDING").length;

  return (
    <div className="px-3 py-4 md:p-8 space-y-6" style={{ background: "#F7F8FC", minHeight: "100vh" }}>

      {/* ── Header ── */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <SubLabel>Review &amp; action</SubLabel>
          <h1 className="text-[22px] font-black mt-0.5" style={{ color: "#0C1220" }}>
            Order Confirmation
          </h1>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold bg-white border border-[#E8EDF6] transition-colors"
          style={{ color: "#6B7280" }}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* ── Stat tiles (Dashboard StatTile style) ── */}
      {!loading && orders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "New Orders",   value: orders.length, icon: ShoppingCart, iconColor: "#4361EE" },
            { label: "Pending Call", value: pending,       icon: Clock,        iconColor: "#C2410C" },
            { label: "Medium Risk",  value: medRisk,       icon: AlertTriangle,iconColor: "#B45309" },
            { label: "High Risk",    value: highRisk,      icon: XCircle,      iconColor: "#DC2626" },
          ].map(({ label, value, icon: Icon, iconColor }) => (
            <div
              key={label}
              className="rounded-lg border px-4 py-3.5"
              style={{ background: "#FAFBFF", borderColor: "#E8EDF6" }}
            >
              <div className="flex items-center justify-between mb-2">
                <SubLabel>{label}</SubLabel>
                <Icon className="w-3.5 h-3.5" style={{ color: iconColor }} />
              </div>
              <p className="text-[22px] font-black leading-none" style={{ color: "#0C1220" }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Orders section card ── */}
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#4361EE" }} />
          <p className="text-[13px]" style={{ color: "#9CA3AF" }}>Loading orders…</p>
        </div>
      ) : orders.length === 0 ? (
        <section className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #E8EDF6" }}>
          <div className="py-20 flex flex-col items-center gap-2">
            <CheckCircle className="w-10 h-10" style={{ color: "#D1D5DB" }} />
            <p className="text-[14px] font-semibold" style={{ color: "#6B7280" }}>All caught up</p>
            <p className="text-[12px]" style={{ color: "#9CA3AF" }}>No new orders waiting for confirmation</p>
          </div>
        </section>
      ) : (
        <section className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #E8EDF6" }}>

          {/* Card header */}
          <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid #F3F4F6" }}>
            <h2 className="text-[14px] font-bold" style={{ color: "#0C1220" }}>Pending Orders</h2>
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "#EEF2FF", color: "#4361EE" }}
            >
              {orders.length}
            </span>
          </div>

          {/* Order rows */}
          {orders.map((order, idx) => {
            const addr  = order.customerAddress;
            const rto   = rtoScores[order.id];
            const rCfg  = rto ? (RISK_CFG[rto.level] ?? RISK_CFG.LOW) : null;
            const msg   = actionMsg?.id === order.id ? actionMsg : null;
            const isEditing = editOrderId === order.id;

            const addrLine = addr
              ? [addr.houseNo, addr.street, addr.landmark, addr.city, addr.state, addr.pincode]
                  .filter(Boolean).join(", ") ||
                [addr.address, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ")
              : "";

            return (
              <div
                key={order.id}
                style={idx < orders.length - 1 ? { borderBottom: "1px solid #F3F4F6" } : undefined}
              >
                <div className="px-5 py-4">

                  {/* Line 1: order ID + payment badge + date — amount floats right */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <Link
                        href={`/seller/orders/${order.id}`}
                        className="text-[13px] font-bold hover:underline"
                        style={{ color: "#4361EE" }}
                      >
                        #{order.externalOrderId}
                      </Link>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{
                          background: order.paymentMode === "COD" ? "#FFF7ED" : "#EEF2FF",
                          color: order.paymentMode === "COD" ? "#C2410C" : "#4361EE",
                        }}
                      >
                        {order.paymentMode}
                      </span>
                      <span className="text-[11px] hidden sm:inline" style={{ color: "#9CA3AF" }}>
                        {new Date(order.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-[16px] font-black flex-shrink-0" style={{ color: "#0C1220" }}>
                      {inr(order.totalAmount)}
                    </p>
                  </div>

                  {/* Date on mobile (second line) */}
                  <p className="text-[11px] mb-1 sm:hidden" style={{ color: "#9CA3AF" }}>
                    {new Date(order.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>

                  {/* Line 2: customer name */}
                  <p className="text-[13px] font-semibold mb-1" style={{ color: "#0C1220" }}>
                    {order.customerName || "Unknown customer"}
                  </p>

                  {/* Line 3: phone + edit toggle — RTO badge floats right */}
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {addr?.phone && (
                        <span className="text-[12px]" style={{ color: "#6B7280" }}>{addr.phone}</span>
                      )}
                      <button
                        onClick={() => isEditing ? setEditOrderId(null) : openEdit(order)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors"
                        style={{
                          background: isEditing ? "#EEF2FF" : "#F9FAFB",
                          color: isEditing ? "#4361EE" : "#9CA3AF",
                          border: "1px solid",
                          borderColor: isEditing ? "#C7D2FE" : "#E5E7EB",
                        }}
                      >
                        {isEditing ? <X className="w-2.5 h-2.5" /> : <Pencil className="w-2.5 h-2.5" />}
                        {isEditing ? "Cancel edit" : "Edit address"}
                      </button>
                    </div>
                    {/* RTO badge inline — works on both mobile and desktop */}
                    {rCfg && rto ? (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded flex-shrink-0"
                        style={{ background: "#F9FAFB", color: rCfg.color, border: "1px solid #E5E7EB" }}
                        title={rto.signals.join(" · ")}
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: rCfg.dot }} />
                        {rCfg.label} · {rto.score}/100
                      </span>
                    ) : (
                      <span
                        className="text-[11px] px-2 py-0.5 rounded flex-shrink-0"
                        style={{ background: "#F9FAFB", color: "#9CA3AF", border: "1px solid #E5E7EB" }}
                      >
                        Scoring…
                      </span>
                    )}
                  </div>

                  {/* Address */}
                  {addrLine && !isEditing && (
                    <p className="text-[11px] break-words mb-0.5" style={{ color: "#9CA3AF" }}>{addrLine}</p>
                  )}

                  {/* Items + conf status */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-[11px]" style={{ color: "#6B7280" }}>
                      {order.items.map(i => `${i.name} ×${i.quantity}`).join(" · ")}
                    </p>
                    <span className="text-[11px] flex-shrink-0" style={{ color: "#9CA3AF" }}>
                      {CONF_LABEL[order.confirmationStatus] ?? "Not sent"}
                    </span>
                  </div>

                  {/* ── Edit address form ── */}
                  {isEditing && (
                    <div
                      className="mt-4 rounded-lg p-4 space-y-3"
                      style={{ background: "#FAFBFF", border: "1px solid #E8EDF6" }}
                    >
                      <SubLabel>Edit Delivery Address</SubLabel>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {([
                          { key: "houseNo",  label: "House / Flat No.",  placeholder: "e.g. H.No. 12, Flat 4B" },
                          { key: "street",   label: "Street / Locality", placeholder: "e.g. MG Road, Sector 5" },
                          { key: "landmark", label: "Nearby Landmark",   placeholder: "e.g. Near City Mall" },
                          { key: "city",     label: "City",              placeholder: "e.g. Mumbai" },
                          { key: "state",    label: "State",             placeholder: "e.g. Maharashtra" },
                          { key: "pincode",  label: "Pincode",           placeholder: "6-digit pincode" },
                          { key: "phone",    label: "Phone Number",      placeholder: "10-digit mobile" },
                        ] as { key: keyof EditAddr; label: string; placeholder: string }[]).map(f => (
                          <div key={f.key}>
                            <label className="block text-[10px] font-semibold mb-0.5" style={{ color: "#6B7280" }}>
                              {f.label}
                            </label>
                            <input
                              type={f.key === "pincode" || f.key === "phone" ? "tel" : "text"}
                              value={editAddr[f.key]}
                              onChange={e => setEditAddr(prev => ({ ...prev, [f.key]: e.target.value }))}
                              placeholder={f.placeholder}
                              className="w-full px-3 py-2 rounded-lg text-[12px] border outline-none"
                              style={{ background: "white", borderColor: "#E8EDF6", color: "#0C1220" }}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => saveEdit(order.id)}
                          disabled={editSaving}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-bold text-white disabled:opacity-50"
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

                  {/* RTO signals — only medium/high */}
                  {rto && rto.signals.length > 0 && ["MEDIUM", "HIGH", "VERY_HIGH"].includes(rto.level) && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {rto.signals.map((s, i) => (
                        <span
                          key={i}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
                          style={{ background: "#F9FAFB", color: "#6B7280", border: "1px solid #E5E7EB" }}
                        >
                          <Info className="w-2.5 h-2.5 flex-shrink-0" />
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Flash message */}
                  {msg && (
                    <div
                      className="mt-3 px-3 py-2 rounded-lg text-[12px] font-medium"
                      style={{ background: msg.ok ? "#F0FDF4" : "#FEF2F2", color: msg.ok ? "#15803D" : "#DC2626" }}
                    >
                      {msg.msg}
                    </div>
                  )}

                  {/* ── Actions ── */}
                  <div className="mt-3 grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                    <button
                      onClick={() => hillteckOk && handleHillteck(order.id, "IVR")}
                      disabled={!hillteckOk || calling === order.id || order.confirmationStatus === "CONFIRMED"}
                      title={!hillteckOk ? "HillTeck not configured yet" : "Initiate IVR call"}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: "#EEF2FF", color: "#4361EE", border: "1px solid #C7D2FE" }}
                    >
                      {calling === order.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Phone className="w-3 h-3" />}
                      {hillteckOk ? "Call to Confirm" : "IVR (soon)"}
                    </button>

                    <button
                      onClick={() => hillteckOk && handleHillteck(order.id, "WHATSAPP")}
                      disabled={!hillteckOk || whatsapping === order.id || order.confirmationStatus === "CONFIRMED"}
                      title={!hillteckOk ? "HillTeck not configured yet" : "Send WhatsApp"}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: "#F0FDF4", color: "#15803D", border: "1px solid #BBF7D0" }}
                    >
                      {whatsapping === order.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <MessageSquare className="w-3 h-3" />}
                      {hillteckOk ? "WhatsApp" : "WhatsApp (soon)"}
                    </button>

                    <button
                      onClick={() => handleConfirm(order.id)}
                      disabled={confirming === order.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-opacity disabled:opacity-50"
                      style={{ background: "#059669" }}
                    >
                      {confirming === order.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <CheckCircle className="w-3 h-3" />}
                      Confirm
                    </button>

                    <button
                      onClick={() => handleCancel(order.id)}
                      disabled={cancelling === order.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-opacity disabled:opacity-50"
                      style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}
                    >
                      {cancelling === order.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <XCircle className="w-3 h-3" />}
                      Cancel
                    </button>
                  </div>

                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
