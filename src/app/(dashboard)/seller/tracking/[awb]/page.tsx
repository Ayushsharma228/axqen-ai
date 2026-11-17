"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Truck, Package, Hash, CalendarDays, Activity, Check, MapPin, AlertTriangle, RotateCcw, ExternalLink, Loader2, RefreshCw,
} from "lucide-react";

type Event = { status: string; message: string; location: string; time: string };
type Tracking = {
  awb: string; orderId: string; orderNumber: string; orderDate: string; dispatchedAt: string | null;
  status: string; liveStatus: string | null; courier: string | null; edd: string | null; deliveredDate: string | null;
  paymentMode: string; amount: number;
  customer: { name: string | null; city: string; state: string; pincode: string };
  ndr: { status: string; reason: string | null } | null;
  externalTrackingUrl: string | null;
  events: Event[]; live: boolean; liveError: string | null;
};

const STEPS = [
  { label: "Placed",           icon: Check },
  { label: "Picked up",        icon: Package },
  { label: "In transit",       icon: Truck },
  { label: "Out for delivery", icon: MapPin },
  { label: "Delivered",        icon: Check },
];

/** Which step the shipment has reached, from AXQEN status plus the latest courier event. */
function currentStep(t: Tracking) {
  if (t.status === "DELIVERED") return 4;
  const latest = `${t.liveStatus ?? ""} ${t.events[0]?.status ?? ""} ${t.events[0]?.message ?? ""}`.toLowerCase();
  if (/out for delivery|\bofd\b/.test(latest)) return 3;
  if (t.status === "IN_TRANSIT" || /transit|picked|reached|arrived|dispatched/.test(latest)) return 2;
  if (t.status === "SHIPPED" || /pickup/.test(latest)) return 1;
  return 0;
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  SHIPPED:    { label: "Shipped",    color: "#4338CA", bg: "#EEF2FF" },
  IN_TRANSIT: { label: "In transit", color: "#0369A1", bg: "#E0F2FE" },
  DELIVERED:  { label: "Delivered",  color: "#047857", bg: "#ECFDF5" },
  RTO:        { label: "RTO",        color: "#B91C1C", bg: "#FEF2F2" },
  CANCELLED:  { label: "Cancelled",  color: "#4B5563", bg: "#F3F4F6" },
};

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtTime = (s: string) => {
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T"));
  return isNaN(d.getTime()) ? s : d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function TrackingPage({ params }: { params: Promise<{ awb: string }> }) {
  const { awb } = use(params);
  const [data, setData] = useState<Tracking | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/seller/tracking/${encodeURIComponent(awb)}`);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setError(d.error || "Couldn't load tracking");
    else { setData(d); setError(""); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [awb]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !data) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--text-300)" }} /></div>;
  }
  if (error || !data) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Link href="/seller/deliveries" className="inline-flex items-center gap-1.5 text-sm mb-6" style={{ color: "var(--text-600)" }}><ArrowLeft className="w-4 h-4" /> Back</Link>
        <div className="card p-8 text-center"><p className="text-sm" style={{ color: "var(--text-600)" }}>{error || "Shipment not found"}</p></div>
      </div>
    );
  }

  const step = currentStep(data);
  const isRto = data.status === "RTO";
  const badge = STATUS_LABEL[data.status] ?? { label: data.status.replace(/_/g, " ").toLowerCase(), color: "#4B5563", bg: "#F3F4F6" };
  const statusText = data.liveStatus ? data.liveStatus.replace(/[_-]+/g, " ") : badge.label;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link href="/seller/deliveries" className="inline-flex items-center gap-1.5 text-sm" style={{ color: "var(--text-600)" }}>
          <ArrowLeft className="w-4 h-4" /> Fulfilment
        </Link>
        <button onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--border)", color: "var(--text-600)" }}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Header */}
      <div className="rounded-2xl p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 text-white"
        style={{ background: isRto ? "linear-gradient(135deg,#991B1B,#7F1D1D)" : "linear-gradient(135deg,#155EEF,#0B2A80)" }}>
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mb-3 capitalize" style={{ background: "rgba(255,255,255,0.16)" }}>
            <Truck className="w-3.5 h-3.5" /> {statusText}
          </span>
          <h1 className="text-2xl md:text-3xl font-bold font-mono break-all">{data.awb}</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.8)" }}>
            Order <Link href={`/seller/orders/${data.orderId}`} className="underline underline-offset-2 font-semibold">#{data.orderNumber.replace(/^#+/, "")}</Link>
          </p>
        </div>
        <div className="rounded-xl bg-white px-5 py-4 min-w-[220px]" style={{ color: "var(--text-900)" }}>
          <p className="text-xs" style={{ color: "var(--text-400)" }}>Courier partner</p>
          <p className="text-base font-bold mb-2">{data.courier || "—"}</p>
          <p className="text-xs" style={{ color: "var(--text-400)" }}>{data.status === "DELIVERED" ? "Delivered on" : "Estimated delivery"}</p>
          <p className="text-sm font-semibold">{data.status === "DELIVERED" ? fmtDate(data.deliveredDate) : fmtDate(data.edd)}</p>
        </div>
      </div>

      {/* Info tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Hash,         label: "Tracking ID",    value: data.awb, mono: true },
          { icon: Package,      label: "Order number",   value: `#${data.orderNumber.replace(/^#+/, "")}` },
          { icon: CalendarDays, label: "Order date",     value: fmtDate(data.orderDate) },
          { icon: Activity,     label: "Current status", value: badge.label, color: badge.color },
        ].map(({ icon: Icon, label, value, mono, color }) => (
          <div key={label} className="card p-4 flex items-start gap-3">
            <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#EAF2FF" }}>
              <Icon className="w-4 h-4" style={{ color: "#155EEF" }} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px]" style={{ color: "var(--text-400)" }}>{label}</p>
              <p className={`text-sm font-semibold truncate ${mono ? "font-mono" : ""}`} style={{ color: color ?? "var(--text-900)" }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {data.ndr && data.status !== "DELIVERED" && !isRto && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
          <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: "#B45309" }} />
          <div className="text-sm" style={{ color: "#78350F" }}>
            <p className="font-semibold">Delivery attempt failed</p>
            <p>{data.ndr.reason || data.ndr.status}. Contact the customer and request a re-attempt from the NDR page.</p>
          </div>
        </div>
      )}
      {isRto && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
          <RotateCcw className="w-5 h-5 flex-shrink-0" style={{ color: "#B91C1C" }} />
          <p className="text-sm" style={{ color: "#7F1D1D" }}><strong>Returning to origin.</strong> This shipment is on its way back to the warehouse.</p>
        </div>
      )}

      {/* Progress */}
      {!isRto && data.status !== "CANCELLED" && (
        <div className="card p-5 md:p-6">
          <h2 className="text-sm font-semibold mb-6" style={{ color: "var(--text-900)" }}>Shipment status</h2>
          <ol className="grid grid-cols-5 relative">
            <span aria-hidden className="absolute top-[18px] left-[10%] right-[10%] h-[3px] rounded" style={{ background: "#E5E7EB" }} />
            <span aria-hidden className="absolute top-[18px] left-[10%] h-[3px] rounded transition-all" style={{ background: "#16A34A", width: `${(step / (STEPS.length - 1)) * 80}%` }} />
            {STEPS.map((s, i) => {
              const done = i < step || (i === step && i === STEPS.length - 1);
              const active = i === step && !done;
              const Icon = s.icon;
              return (
                <li key={s.label} className="relative flex flex-col items-center text-center gap-2">
                  <span className="w-9 h-9 rounded-full flex items-center justify-center z-10"
                    style={done ? { background: "#16A34A", color: "#fff" } : active ? { background: "#155EEF", color: "#fff", boxShadow: "0 0 0 5px #EAF2FF" } : { background: "#F3F4F6", color: "#9CA3AF" }}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="text-[11px] md:text-xs font-semibold" style={{ color: done || active ? "var(--text-900)" : "var(--text-400)" }}>{s.label}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Timeline */}
        <div className="card p-5 md:p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-900)" }}>Tracking timeline</h2>
            {data.live
              ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#ECFDF5", color: "#047857" }}>Live from courier</span>
              : data.liveError ? <span className="text-[11px]" style={{ color: "var(--text-400)" }}>Live tracking unavailable</span> : null}
          </div>
          {data.events.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-400)" }}>No tracking updates yet. Updates appear once the courier picks up the parcel.</p>
          ) : (
            <ol className="relative">
              {data.events.map((e, i) => (
                <li key={i} className="relative pl-7 pb-5 last:pb-0">
                  {i < data.events.length - 1 && <span aria-hidden className="absolute left-[7px] top-4 bottom-0 w-[2px]" style={{ background: "#E5E7EB" }} />}
                  <span aria-hidden className="absolute left-0 top-1 w-4 h-4 rounded-full border-[3px] bg-white" style={{ borderColor: i === 0 ? "#155EEF" : "#16A34A" }} />
                  <div className="rounded-lg px-3 py-2.5" style={{ background: i === 0 ? "#F5F8FF" : "transparent" }}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <p className="text-sm font-semibold" style={{ color: "var(--text-900)" }}>{e.status}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-400)" }}>{fmtTime(e.time)}</p>
                    </div>
                    {(e.message || e.location) && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-600)" }}>
                        {e.message && e.message.toLowerCase() !== e.status.toLowerCase() ? e.message : ""}
                        {e.location ? `${e.message && e.message.toLowerCase() !== e.status.toLowerCase() ? " · " : ""}${e.location}` : ""}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Details */}
        <div className="card p-5 md:p-6">
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-900)" }}>Shipment details</h2>
          <dl className="text-sm divide-y" style={{ borderColor: "var(--border)" }}>
            {[
              ["Courier", data.courier || "—"],
              ["Tracking ID", data.awb],
              ["Order number", `#${data.orderNumber.replace(/^#+/, "")}`],
              ["Payment", data.paymentMode === "COD" ? `COD · ₹${data.amount.toLocaleString("en-IN")}` : data.paymentMode === "PREPAID" ? "Prepaid" : "—"],
              ["Shipped on", fmtDate(data.dispatchedAt)],
              ["Deliver to", [data.customer.name, [data.customer.city, data.customer.state].filter(Boolean).join(", "), data.customer.pincode].filter(Boolean).join(" · ") || "—"],
              ["EDD", fmtDate(data.edd)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5">
                <dt style={{ color: "var(--text-400)" }}>{k}</dt>
                <dd className="font-semibold text-right break-words min-w-0" style={{ color: "var(--text-900)" }}>{v}</dd>
              </div>
            ))}
          </dl>
          {data.externalTrackingUrl && (
            <a href={data.externalTrackingUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#155EEF" }}>
              Courier website <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
