"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Package, MapPin, Phone, User, Receipt,
  Clock, Tag, ChevronRight, RefreshCw, ExternalLink, Truck, Loader2,
  MessageSquare, Flag, Factory, Send, AlertTriangle, History,
} from "lucide-react";

interface OrderItem { id: string; name: string; quantity: number; price: number; }
interface Timeline  { id: string; event: string; details: string | null; actorRole: string; createdAt: string; }
interface CustomerHistoryOrder {
  id: string; externalOrderId: string; status: string; totalAmount: number; createdAt: string;
  items: { name: string; quantity: number }[];
}
interface Settlement {
  id: string; status: string;
  sellingPrice: number; platformFee: number; gstOnFees: number;
  netPayable: number; shippingCharge: number; packingCharge: number;
  codFee: number; rtoCharge: number; adSpend: number;
  createdAt: string;
}
interface OrderDetail {
  id: string; externalOrderId: string; source: string; status: string;
  customerName: string | null; customerEmail: string | null;
  customerAddress: Record<string, string> | null;
  totalAmount: number; awbNumber: string | null; trackingUrl: string | null;
  courier: string | null; createdAt: string;
  items: OrderItem[];
  timeline: Timeline[];
  supplierStatus: string | null;
  supplierNote: string | null;
  expectedDispatchDate: string | null;
  expectedDeliveryDate: string | null;
  dispatchedAt: string | null;
  supplierTrackingNo: string | null;
  supplierCourier: string | null;
}

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  NEW:        { bg: "#EFF6FF", color: "#2563EB" },
  PROCESSING: { bg: "#F5F3FF", color: "#7C3AED" },
  SHIPPED:    { bg: "#F0F9FF", color: "#0369A1" },
  IN_TRANSIT: { bg: "#FFFBEB", color: "#D97706" },
  DELIVERED:  { bg: "#F0FDF4", color: "#15803D" },
  CANCELLED:  { bg: "#FEF2F2", color: "#DC2626" },
  RTO:        { bg: "#FFF7ED", color: "#EA580C" },
};

const SUPPLIER_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  PENDING_ASSIGNMENT: { label: "Pending Assignment", bg: "#F9FAFB", color: "#6B7280" },
  ASSIGNED:           { label: "Assigned to Supplier", bg: "#EFF6FF", color: "#2563EB" },
  ACCEPTED:           { label: "Accepted", bg: "#ECFDF5", color: "#059669" },
  REJECTED:           { label: "Rejected", bg: "#FEF2F2", color: "#DC2626" },
  PROCESSING:         { label: "Processing", bg: "#FFFBEB", color: "#D97706" },
  PACKED:             { label: "Packed", bg: "#F5F3FF", color: "#7C3AED" },
  READY_TO_SHIP:      { label: "Ready to Ship", bg: "#FFF7ED", color: "#EA580C" },
  DISPATCHED:         { label: "Dispatched", bg: "#F0FDF4", color: "#16A34A" },
};

const SUPPLIER_STEPS = ["ASSIGNED", "ACCEPTED", "PROCESSING", "PACKED", "READY_TO_SHIP", "DISPATCHED"];

const FLAG_REASONS = [
  "Wrong item shipped",
  "Damaged item",
  "Customer complaint",
  "Incorrect price",
  "Delivery delay",
  "Missing item",
  "Other",
];

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return `₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <Icon className="w-4 h-4" style={{ color: "var(--accent)" }} />
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-900)" }}>{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between py-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
      <span className="text-xs" style={{ color: "var(--text-400)" }}>{label}</span>
      <span className={`text-xs font-medium text-right max-w-[60%] ${mono ? "font-mono" : ""}`}
        style={{ color: "var(--text-900)" }}>{value ?? "—"}</span>
    </div>
  );
}

export default function SellerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router  = useRouter();

  const [order, setOrder]                       = useState<OrderDetail | null>(null);
  const [settlement, setSettlement]             = useState<Settlement | null>(null);
  const [customerHistory, setCustomerHistory]   = useState<CustomerHistoryOrder[]>([]);
  const [customerOrderCount, setCustomerOrderCount] = useState(1);
  const [loading, setLoading]                   = useState(true);
  const [awbInput, setAwbInput]     = useState("");
  const [courierInput, setCourierInput] = useState("");
  const [trackingInput, setTrackingInput] = useState("");
  const [awbSaving, setAwbSaving]   = useState(false);
  const [awbError, setAwbError]     = useState("");
  const [awbSuccess, setAwbSuccess] = useState(false);

  const [msgInput, setMsgInput]     = useState("");
  const [msgSending, setMsgSending] = useState(false);

  const [showFlagForm, setShowFlagForm] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [flagNote, setFlagNote]     = useState("");
  const [flagging, setFlagging]     = useState(false);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/seller/orders/${id}`);
    if (r.ok) {
      const d = await r.json();
      setOrder(d.order);
      setSettlement(d.settlement ?? null);
      setCustomerHistory(d.customerHistory ?? []);
      setCustomerOrderCount(d.customerOrderCount ?? 1);
      setAwbInput(d.order.awbNumber ?? "");
      setCourierInput(d.order.courier ?? "");
      setTrackingInput(d.order.trackingUrl ?? "");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  async function handleAwbSave() {
    if (!awbInput.trim()) { setAwbError("AWB number is required"); return; }
    setAwbSaving(true); setAwbError(""); setAwbSuccess(false);
    const r = await fetch(`/api/seller/orders/${id}/set-awb`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ awbNumber: awbInput, courier: courierInput, trackingUrl: trackingInput }),
    });
    const d = await r.json();
    if (!r.ok) { setAwbError(d.error ?? "Failed to save"); setAwbSaving(false); return; }
    setAwbSuccess(true);
    setAwbSaving(false);
    fetchOrder();
    setTimeout(() => setAwbSuccess(false), 3000);
  }

  async function handleSendMessage() {
    if (!msgInput.trim()) return;
    setMsgSending(true);
    const r = await fetch(`/api/seller/orders/${id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msgInput.trim() }),
    });
    if (r.ok) { setMsgInput(""); fetchOrder(); }
    setMsgSending(false);
  }

  async function handleFlag() {
    if (!flagReason) return;
    setFlagging(true);
    const r = await fetch(`/api/seller/orders/${id}/flag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: flagReason, note: flagNote }),
    });
    if (r.ok) {
      setFlagReason(""); setFlagNote(""); setShowFlagForm(false);
      fetchOrder();
    }
    setFlagging(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-page)" }}>
        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: "var(--text-300)" }} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-page)" }}>
        <p className="text-sm" style={{ color: "var(--text-400)" }}>Order not found</p>
      </div>
    );
  }

  const addr  = order.customerAddress ?? {};
  const badge = STATUS_COLOR[order.status] ?? STATUS_COLOR.NEW;

  const messages      = order.timeline.filter(e => e.event === "SELLER_MESSAGE" || e.event === "ADMIN_REPLY");
  const flagEvents    = order.timeline.filter(e => e.event === "ORDER_FLAGGED");
  const timelineEvents = order.timeline.filter(e => e.event !== "SELLER_MESSAGE" && e.event !== "ADMIN_REPLY");
  const hasFlags      = flagEvents.length > 0;

  const suppStatus    = order.supplierStatus ? SUPPLIER_STATUS[order.supplierStatus] : null;
  const stepIdx       = order.supplierStatus ? SUPPLIER_STEPS.indexOf(order.supplierStatus) : -1;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page)" }}>
      {/* Breadcrumb */}
      <div className="px-4 md:px-8 pt-6 pb-4 flex items-center gap-3 flex-wrap">
        <button onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm font-medium"
          style={{ color: "var(--text-400)" }}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-300)" }} />
        <span className="text-sm" style={{ color: "var(--text-400)" }}>Orders</span>
        <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-300)" }} />
        <span className="text-sm font-semibold font-mono" style={{ color: "var(--text-900)" }}>
          #{order.externalOrderId}
        </span>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
          style={{ background: badge.bg, color: badge.color }}>
          {order.status}
        </span>
        {hasFlags && (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1"
            style={{ background: "#FEF2F2", color: "#DC2626" }}>
            <Flag className="w-3 h-3" /> Flagged
          </span>
        )}
      </div>

      <div className="px-4 md:px-8 pb-8 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left — main content */}
        <div className="lg:col-span-2 space-y-5">

          {/* Order details */}
          <Section title="Order Details" icon={Package}>
            <div className="grid grid-cols-2 gap-x-8">
              <div>
                <Row label="Order ID"     value={<span className="font-mono">#{order.externalOrderId}</span>} />
                <Row label="Source"       value={order.source} />
                <Row label="Date"         value={new Date(order.createdAt).toLocaleString("en-IN", {
                  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                })} />
                <Row label="Order Value"  value={<span className="font-bold" style={{ color: "#00C67A" }}>{fmt(order.totalAmount)}</span>} />
              </div>
              <div>
                <Row label="Status" value={
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: badge.bg, color: badge.color }}>
                    {order.status}
                  </span>
                } />
                <Row label="AWB"     value={order.awbNumber ?? "—"} mono />
                <Row label="Courier" value={order.courier ?? "—"} />
                {order.trackingUrl && (
                  <Row label="Tracking" value={
                    <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1" style={{ color: "#0369A1" }}>
                      Track <ExternalLink className="w-3 h-3" />
                    </a>
                  } />
                )}
              </div>
            </div>
          </Section>

          {/* Items */}
          <Section title={`Items (${order.items.length})`} icon={Tag}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Product", "Qty", "Unit Price", "Total"].map(h => (
                      <th key={h} className="pb-2 text-left text-xs font-semibold"
                        style={{ color: "var(--text-400)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {order.items.map(item => (
                    <tr key={item.id}>
                      <td className="py-2.5 pr-4 text-sm" style={{ color: "var(--text-900)" }}>{item.name}</td>
                      <td className="py-2.5 pr-4 text-sm text-center" style={{ color: "var(--text-500)" }}>{item.quantity}</td>
                      <td className="py-2.5 pr-4 text-sm" style={{ color: "var(--text-500)" }}>{fmt(item.price)}</td>
                      <td className="py-2.5 text-sm font-semibold" style={{ color: "var(--text-900)" }}>
                        {fmt(item.price * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Settlement */}
          {settlement && (
            <Section title="Settlement Breakdown" icon={Receipt}>
              <div className="grid grid-cols-2 gap-x-8">
                <div>
                  <Row label="Selling Price"    value={<span style={{ color: "#00C67A" }}>{fmt(settlement.sellingPrice)}</span>} />
                  <Row label="Platform Fee"     value={fmt(settlement.platformFee)} />
                  <Row label="GST on Fee (18%)" value={fmt(settlement.gstOnFees)} />
                  <Row label="Shipping"         value={fmt(settlement.shippingCharge)} />
                  <Row label="Packing"          value={fmt(settlement.packingCharge)} />
                  <Row label="COD Fee"          value={fmt(settlement.codFee)} />
                  <Row label="RTO Charge"       value={fmt(settlement.rtoCharge)} />
                  <Row label="Ad Spend"         value={fmt(settlement.adSpend)} />
                </div>
                <div>
                  <Row label="Net Payable to You" value={
                    <span className="text-sm font-bold" style={{ color: "#7C3AED" }}>
                      {fmt(settlement.netPayable)}
                    </span>
                  } />
                  <Row label="Settlement Status" value={
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: "#F0FDF4", color: "#15803D" }}>
                      {settlement.status}
                    </span>
                  } />
                  <Row label="Settled On" value={new Date(settlement.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric"
                  })} />
                </div>
              </div>
            </Section>
          )}

          {/* Support / Message Admin */}
          <Section title="Support — Message Admin" icon={MessageSquare}>
            <div className="space-y-3 mb-4 max-h-72 overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: "var(--text-300)" }}>
                  No messages yet. Send a message below — admin will be notified.
                </p>
              ) : messages.map(m => (
                <div key={m.id} className={`flex ${m.event === "SELLER_MESSAGE" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[80%] rounded-2xl px-3.5 py-2.5 space-y-1"
                    style={m.event === "SELLER_MESSAGE"
                      ? { background: "var(--accent)", color: "#fff" }
                      : { background: "var(--bg-muted)", color: "var(--text-900)", border: "1px solid var(--border)" }}>
                    <p className="text-xs leading-relaxed">{m.details}</p>
                    <p className="text-[10px] opacity-60">
                      {m.event === "SELLER_MESSAGE" ? "You" : "Admin"} · {new Date(m.createdAt).toLocaleString("en-IN", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
              <textarea
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                placeholder="Type a message to admin... (Enter to send)"
                rows={2}
                className="flex-1 px-3 py-2 text-xs rounded-xl border outline-none resize-none"
                style={{ borderColor: "var(--border)", background: "var(--bg-muted)", color: "var(--text-900)" }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
              />
              <button onClick={handleSendMessage}
                disabled={msgSending || !msgInput.trim()}
                className="px-3 rounded-xl text-white disabled:opacity-40 flex items-center justify-center"
                style={{ background: "var(--accent)" }}>
                {msgSending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />}
              </button>
            </div>
          </Section>

          {/* Timeline — filtered (messages shown above) */}
          {timelineEvents.length > 0 && (
            <Section title="Order Timeline" icon={Clock}>
              <div className="space-y-0">
                {timelineEvents.map((event, idx) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                        style={{ background: event.event === "ORDER_FLAGGED" ? "#EF4444" : idx === timelineEvents.length - 1 ? "#00C67A" : "var(--border)" }} />
                      {idx < timelineEvents.length - 1 && (
                        <div className="w-px flex-1 min-h-[24px]" style={{ background: "var(--border)" }} />
                      )}
                    </div>
                    <div className="pb-4 flex-1">
                      <span className="text-xs font-semibold" style={{ color: event.event === "ORDER_FLAGGED" ? "#DC2626" : "var(--text-900)" }}>
                        {event.event === "ORDER_FLAGGED" ? "🚩 Order Flagged" : event.event.replace(/_/g, " ")}
                      </span>
                      {event.details && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-500)" }}>{event.details}</p>
                      )}
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-300)" }}>
                        {new Date(event.createdAt).toLocaleString("en-IN", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Right — sidebar */}
        <div className="space-y-5">
          {/* Customer */}
          <Section title="Customer" icon={MapPin}>
            <div className="space-y-2.5">
              {order.customerName && (
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-300)" }} />
                  <span className="text-sm font-medium" style={{ color: "var(--text-900)" }}>{order.customerName}</span>
                </div>
              )}
              {addr.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-300)" }} />
                  <span className="text-sm" style={{ color: "var(--text-500)" }}>{addr.phone}</span>
                </div>
              )}
              {order.customerEmail && (
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-300)" }} />
                  <span className="text-sm" style={{ color: "var(--text-500)" }}>{order.customerEmail}</span>
                </div>
              )}
              {(addr.address || addr.address1) && (
                <div className="flex gap-2 mt-1">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--text-300)" }} />
                  <div>
                    <p className="text-xs" style={{ color: "var(--text-500)" }}>{addr.address ?? addr.address1}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-400)" }}>
                      {[addr.city, addr.state ?? addr.province, addr.pincode ?? addr.zip].filter(Boolean).join(", ")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Customer Order History */}
          <Section title="Customer History" icon={History}>
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs" style={{ color: "var(--text-400)" }}>
                  {customerOrderCount === 1 ? "First order from this customer" : (
                    <span>
                      <span className="font-bold" style={{ color: "#7C3AED" }}>{customerOrderCount} orders</span> from this customer
                    </span>
                  )}
                </p>
                {customerOrderCount > 1 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "#EDE9FE", color: "#7C3AED" }}>
                    Repeat Customer
                  </span>
                )}
              </div>
              {customerHistory.length === 0 ? (
                <p className="text-xs py-2" style={{ color: "var(--text-300)" }}>No previous orders.</p>
              ) : customerHistory.map((h) => {
                const hBadge = STATUS_COLOR[h.status] ?? STATUS_COLOR.NEW;
                return (
                  <Link key={h.id} href={`/seller/orders/${h.id}`}
                    className="flex items-center justify-between py-2 rounded-lg px-2 -mx-2 transition-colors"
                    style={{ borderBottom: "1px solid var(--border)" }}>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold font-mono" style={{ color: "var(--text-900)" }}>
                        #{h.externalOrderId}
                      </p>
                      <p className="text-[10px] truncate" style={{ color: "var(--text-400)" }}>
                        {h.items[0]?.name ?? "—"}{h.items[0] && ` ×${h.items[0].quantity}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ background: hBadge.bg, color: hBadge.color }}>{h.status}</span>
                      <span className="text-[10px]" style={{ color: "var(--text-300)" }}>
                        {new Date(h.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Section>

          {/* Supplier Fulfillment */}
          {order.supplierStatus && (
            <Section title="Supplier Fulfillment" icon={Factory}>
              <div className="space-y-3">
                {/* Status chip */}
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: suppStatus?.bg ?? "#F9FAFB", color: suppStatus?.color ?? "#6B7280" }}>
                    {suppStatus?.label ?? order.supplierStatus}
                  </span>
                </div>

                {/* Progress track */}
                {order.supplierStatus !== "REJECTED" && (
                  <div className="flex items-center gap-1 mt-1">
                    {SUPPLIER_STEPS.map((step, i) => {
                      const done = stepIdx >= i;
                      const current = stepIdx === i;
                      return (
                        <div key={step} className="flex items-center gap-1 flex-1">
                          <div className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: done ? (current ? "var(--accent)" : "#00C67A") : "var(--border)" }} />
                          {i < SUPPLIER_STEPS.length - 1 && (
                            <div className="h-px flex-1" style={{ background: done && stepIdx > i ? "#00C67A" : "var(--border)" }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {order.supplierStatus === "REJECTED" && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                    style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Supplier rejected this order. Admin will re-assign.
                  </div>
                )}

                {/* Details */}
                <div className="space-y-0 pt-1">
                  {order.supplierCourier && <Row label="Supplier Courier" value={order.supplierCourier} />}
                  {order.supplierTrackingNo && <Row label="Supplier Tracking" value={order.supplierTrackingNo} mono />}
                  {order.expectedDispatchDate && <Row label="Expected Dispatch" value={fmtDate(order.expectedDispatchDate)} />}
                  {order.expectedDeliveryDate && <Row label="Expected Delivery" value={fmtDate(order.expectedDeliveryDate)} />}
                  {order.dispatchedAt && <Row label="Dispatched At" value={fmtDate(order.dispatchedAt)} />}
                </div>

                {order.supplierNote && (
                  <div className="px-3 py-2 rounded-lg text-xs"
                    style={{ background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}>
                    <span className="font-semibold">Supplier Note: </span>{order.supplierNote}
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Report Issue / Flag Order */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4" style={{ color: hasFlags ? "#EF4444" : "var(--text-300)" }} />
                <p className="text-sm font-semibold" style={{ color: "var(--text-900)" }}>
                  {hasFlags ? "Issue Reported" : "Report Issue"}
                </p>
              </div>
              {hasFlags && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: "#FEF2F2", color: "#DC2626" }}>Flagged</span>
              )}
            </div>

            {/* Existing flags */}
            {flagEvents.length > 0 && (
              <div className="space-y-1.5">
                {flagEvents.map(f => (
                  <div key={f.id} className="text-xs px-3 py-2 rounded-lg"
                    style={{ background: "#FFF7ED", color: "#92400E", border: "1px solid #FED7AA" }}>
                    <p className="font-medium">{f.details}</p>
                    <p className="opacity-60 mt-0.5">{fmtDate(f.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Flag form */}
            {showFlagForm ? (
              <div className="space-y-2">
                <select value={flagReason} onChange={e => setFlagReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border outline-none"
                  style={{ borderColor: "var(--border)", background: "var(--bg-muted)", color: "var(--text-900)" }}>
                  <option value="">Select reason...</option>
                  {FLAG_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <textarea value={flagNote} onChange={e => setFlagNote(e.target.value)}
                  placeholder="Additional details (optional)"
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-lg border outline-none resize-none"
                  style={{ borderColor: "var(--border)", background: "var(--bg-muted)", color: "var(--text-900)" }} />
                <div className="flex gap-2">
                  <button onClick={() => { setShowFlagForm(false); setFlagReason(""); setFlagNote(""); }}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: "var(--bg-muted)", color: "var(--text-400)" }}>
                    Cancel
                  </button>
                  <button onClick={handleFlag} disabled={!flagReason || flagging}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                    style={{ background: "#EF4444" }}>
                    {flagging ? "Submitting..." : "Submit Flag"}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowFlagForm(true)}
                className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>
                <Flag className="w-3.5 h-3.5" />
                {hasFlags ? "Report Another Issue" : "Flag this Order"}
              </button>
            )}
          </div>

          {/* Quick tracking card if AWB set */}
          {order.awbNumber && (
            <div className="card p-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-400)" }}>
                Shipment
              </p>
              <a href={`/seller/tracking/${encodeURIComponent(order.awbNumber)}`}
                className="block text-sm font-bold font-mono hover:underline underline-offset-2" style={{ color: "#155EEF" }}>
                {order.awbNumber}
              </a>
              {order.courier && (
                <p className="text-xs" style={{ color: "var(--text-400)" }}>{order.courier.replace(/^Shipdaak · /, "")}</p>
              )}
              <a href={`/seller/tracking/${encodeURIComponent(order.awbNumber)}`}
                className="flex items-center gap-1.5 text-xs font-semibold mt-2"
                style={{ color: "#155EEF" }}>
                Track Shipment <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* AWB input — shown for non-terminal orders */}
          {!["DELIVERED", "CANCELLED", "RTO"].includes(order.status) && (
            <div className="card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4" style={{ color: "var(--accent)" }} />
                <p className="text-sm font-semibold" style={{ color: "var(--text-900)" }}>
                  {order.awbNumber ? "Update Tracking" : "Add Tracking Info"}
                </p>
              </div>

              {awbSuccess && (
                <p className="text-xs font-medium px-3 py-2 rounded-lg"
                  style={{ background: "#F0FDF4", color: "#15803D" }}>
                  Tracking saved — order marked as Shipped
                </p>
              )}
              {awbError && (
                <p className="text-xs px-3 py-2 rounded-lg"
                  style={{ background: "#FEF2F2", color: "#DC2626" }}>{awbError}</p>
              )}

              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-400)" }}>
                    AWB / Tracking No. *
                  </label>
                  <input value={awbInput} onChange={e => setAwbInput(e.target.value)}
                    placeholder="Enter AWB number"
                    className="w-full px-3 py-2 text-xs rounded-lg border outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--bg-muted)", color: "var(--text-900)" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-400)" }}>
                    Courier
                  </label>
                  <input value={courierInput} onChange={e => setCourierInput(e.target.value)}
                    placeholder="e.g. Delhivery, Bluedart"
                    className="w-full px-3 py-2 text-xs rounded-lg border outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--bg-muted)", color: "var(--text-900)" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-400)" }}>
                    Tracking URL (optional)
                  </label>
                  <input value={trackingInput} onChange={e => setTrackingInput(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-xs rounded-lg border outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--bg-muted)", color: "var(--text-900)" }} />
                </div>
              </div>

              <button onClick={handleAwbSave} disabled={awbSaving}
                className="w-full py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
                style={{ background: "var(--green-500)" }}>
                {awbSaving
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                  : <><Truck className="w-3.5 h-3.5" /> {order.awbNumber ? "Update" : "Save & Mark Shipped"}</>
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
