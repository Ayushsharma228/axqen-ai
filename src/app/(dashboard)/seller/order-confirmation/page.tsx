"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { RefreshCw, Loader2, PhoneCall, CheckCircle2, XCircle, Clock, Inbox, MapPin, StickyNote } from "lucide-react";
import { MAX_ATTEMPTS, outcomeMeta, finalMeta, type ConfirmationState } from "@/lib/order-confirmation";

type View = "IN_PROGRESS" | "CONFIRMED" | "CANCELLED";
interface Row {
  id: string;
  externalOrderId: string;
  paymentMode: string;
  totalAmount: number;
  customerName: string | null;
  city: string | null;
  state: string | null;
  items: { name: string; quantity: number }[];
  createdAt: string;
  view: View;
  doneAt: string | null;
  reason: string | null;
  confirmation: ConfirmationState;
}
interface Stats {
  received: number; inProgress: number; confirmed: number; cancelled: number;
  avgHoursToConfirm: number | null; within24hPct: number | null;
  reasons: { label: string; count: number }[];
}

const RANGES = [
  { key: "1",   label: "Today" },
  { key: "7",   label: "7 days" },
  { key: "30",  label: "30 days" },
  { key: "all", label: "All time" },
];
const TABS: { key: View | "ALL"; label: string }[] = [
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "CONFIRMED",   label: "Confirmed" },
  { key: "CANCELLED",   label: "Cancelled" },
  { key: "ALL",         label: "All" },
];

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
function duration(hours: number) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${hours.toFixed(hours < 10 ? 1 : 0)} hrs`;
  return `${Math.round(hours / 24)} days`;
}

export default function OrderConfirmationPage() {
  const [range, setRange] = useState("7");
  const [tab, setTab] = useState<View | "ALL">("IN_PROGRESS");
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/seller/order-confirmation${range === "all" ? "" : `?days=${range}`}`)
      .then(r => r.json())
      .then(d => { setRows(d.orders ?? []); setStats(d.stats ?? null); })
      .finally(() => setLoading(false));
  }, [range, key]);

  const shown = tab === "ALL" ? rows : rows.filter(r => r.view === tab);
  const counts: Record<string, number> = {
    IN_PROGRESS: stats?.inProgress ?? 0, CONFIRMED: stats?.confirmed ?? 0,
    CANCELLED: stats?.cancelled ?? 0, ALL: stats?.received ?? 0,
  };
  const reasonTotal = (stats?.reasons ?? []).reduce((s, r) => s + r.count, 0);

  return (
    <div className="px-3 py-4 md:p-8 space-y-6" style={{ background: "#F7F8FC", minHeight: "100vh" }}>

      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Orders</p>
          <h1 className="text-[22px] font-black text-[#0C1220] mt-0.5">COD Confirmation</h1>
          <p className="text-[12.5px] text-[#6B7280] mt-1 max-w-[60ch]">
            The AXQEN team calls every customer before shipping. Here you can see each call, the outcome, and why an order was cancelled.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white border border-[#E8EDF6] rounded-lg p-0.5">
            {RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className="px-3 py-1.5 text-[12px] font-semibold rounded-md transition-colors"
                style={{ background: range === r.key ? "#4361EE" : "transparent", color: range === r.key ? "white" : "#6B7280" }}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setKey(k => k + 1)}
            aria-label="Refresh"
            className="p-2 rounded-lg bg-white border border-[#E8EDF6] text-[#6B7280] hover:text-[#0C1220]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Orders received", value: String(stats?.received ?? 0), icon: Inbox, color: "#4361EE", sub: "In this period" },
          { label: "Being called",    value: String(stats?.inProgress ?? 0), icon: PhoneCall, color: "#D97706", sub: "Confirmation in progress" },
          { label: "Confirmed",       value: String(stats?.confirmed ?? 0), icon: CheckCircle2, color: "#059669",
            sub: stats?.received ? `${Math.round(((stats.confirmed) / stats.received) * 100)}% of orders` : "—" },
          { label: "Cancelled",       value: String(stats?.cancelled ?? 0), icon: XCircle, color: "#DC2626",
            sub: stats?.received ? `${Math.round(((stats.cancelled) / stats.received) * 100)}% of orders` : "—" },
          { label: "Avg time to confirm", value: stats?.avgHoursToConfirm != null ? duration(stats.avgHoursToConfirm) : "—", icon: Clock, color: "#0C1220",
            sub: stats?.within24hPct != null ? `${stats.within24hPct}% within 24 hrs` : "No confirmed orders yet" },
        ].map(t => {
          const Icon = t.icon;
          return (
            <div key={t.label} className="bg-white rounded-xl border border-[#E8EDF6] px-4 py-3.5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{t.label}</p>
                <Icon className="w-3.5 h-3.5" style={{ color: t.color }} />
              </div>
              <p className="text-[22px] font-black leading-none tabular-nums text-[#0C1220]">{loading ? "…" : t.value}</p>
              <p className="text-[11px] text-[#9CA3AF] mt-1.5">{t.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Cancel reasons */}
      {!loading && reasonTotal > 0 && (
        <section className="bg-white rounded-xl border border-[#E8EDF6] p-5">
          <h2 className="text-[14px] font-bold text-[#0C1220]">Why orders were cancelled</h2>
          <p className="text-[12px] text-[#9CA3AF] mt-0.5 mb-4">Based on the last call outcome for each cancelled order</p>
          <div className="space-y-2.5">
            {stats!.reasons.map(r => {
              const share = Math.round((r.count / reasonTotal) * 100);
              return (
                <div key={r.label} className="grid grid-cols-[minmax(0,160px)_1fr_auto] items-center gap-3">
                  <span className="text-[12.5px] text-[#374151] truncate">{r.label}</span>
                  <div className="h-2 rounded-full bg-[#F3F4F6] overflow-hidden">
                    <div className="h-full rounded-full bg-[#EF4444]" style={{ width: `${share}%` }} />
                  </div>
                  <span className="text-[12px] font-semibold text-[#6B7280] tabular-nums w-[72px] text-right">{r.count} · {share}%</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Orders */}
      <section className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
        <div className="flex items-center gap-1 px-3 pt-3 border-b border-[#F3F4F6] overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors"
              style={{ borderColor: tab === t.key ? "#4361EE" : "transparent", color: tab === t.key ? "#4361EE" : "#6B7280" }}
            >
              {t.label}
              <span className="ml-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: tab === t.key ? "#EEF2FF" : "#F3F4F6", color: tab === t.key ? "#4361EE" : "#9CA3AF" }}>
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[#9CA3AF]">
            <Loader2 className="w-4 h-4 animate-spin text-[#4361EE]" /> Loading orders…
          </div>
        ) : shown.length === 0 ? (
          <p className="py-16 text-center text-[13px] text-[#9CA3AF]">
            {tab === "IN_PROGRESS" ? "No orders waiting for a call right now." : "No orders here for this period."}
          </p>
        ) : (
          <ul className="divide-y divide-[#F3F4F6]">
            {shown.map(o => <OrderRow key={o.id} o={o} />)}
          </ul>
        )}
      </section>
      <div className="h-4" />
    </div>
  );
}

function OrderRow({ o }: { o: Row }) {
  const c = o.confirmation;
  const prepaid = o.paymentMode?.toUpperCase() === "PREPAID";
  const fm = finalMeta(c.final?.value);
  const product = o.items.map(i => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join(", ");
  const tookHours = o.doneAt ? (new Date(o.doneAt).getTime() - new Date(o.createdAt).getTime()) / 3600000 : null;

  const viewBadge = o.view === "CONFIRMED"
    ? { text: fm?.label ?? "Confirmed", bg: "#ECFDF5", fg: "#047857" }
    : o.view === "CANCELLED"
      ? { text: "Cancelled", bg: "#FEF2F2", fg: "#B91C1C" }
      : { text: fm?.key === "PENDING" ? "Pending" : "Being called", bg: "#FFFBEB", fg: "#B45309" };

  return (
    <li className="px-4 md:px-5 py-4 flex flex-col gap-3">
      {/* Top line */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/seller/orders/${o.id}`} className="text-[14px] font-bold text-[#0C1220] hover:text-[#4361EE]">
              {o.externalOrderId}
            </Link>
            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: prepaid ? "#EEF2FF" : "#FFF7ED", color: prepaid ? "#4361EE" : "#C2410C" }}>
              {prepaid ? "PREPAID" : "COD"}
            </span>
            <span className="text-[13px] font-semibold text-[#374151] tabular-nums">{inr(o.totalAmount)}</span>
          </div>
          <p className="text-[12.5px] text-[#6B7280] mt-1 truncate">
            {o.customerName ?? "Customer"}
            {(o.city || o.state) && <> · <MapPin className="inline w-3 h-3 -mt-0.5" /> {[o.city, o.state].filter(Boolean).join(", ")}</>}
          </p>
          {product && <p className="text-[12px] text-[#9CA3AF] mt-0.5 truncate">{product}</p>}
        </div>
        <div className="text-right">
          <span className="text-[11.5px] font-bold px-2.5 py-1 rounded-full" style={{ background: viewBadge.bg, color: viewBadge.fg }}>
            {viewBadge.text}
          </span>
          <p className="text-[11px] text-[#9CA3AF] mt-1.5">Ordered {when(o.createdAt)}</p>
          {tookHours != null && tookHours >= 0 && (
            <p className="text-[11px] text-[#9CA3AF]">{o.view === "CANCELLED" ? "Cancelled" : "Confirmed"} in {duration(tookHours)}</p>
          )}
        </div>
      </div>

      {/* Calls */}
      <div className="flex items-stretch gap-2 flex-wrap">
        {Array.from({ length: MAX_ATTEMPTS }, (_, i) => {
          const a = c.attempts[i];
          const m = outcomeMeta(a?.outcome);
          return (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-[#EEF1F8] bg-[#FAFBFF] px-2.5 py-1.5 min-w-[150px]">
              <span className="text-[10.5px] font-bold text-[#9CA3AF] uppercase tracking-wide">Call {i + 1}</span>
              {m ? (
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit" style={{ background: m.bg, color: m.fg }}>{m.label}</span>
                  <span className="text-[10.5px] text-[#9CA3AF] mt-0.5">{when(a!.at)}</span>
                </div>
              ) : (
                <span className="text-[11.5px] text-[#C4C9D4]">Not yet</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Notes */}
      {(o.view === "CANCELLED" && o.reason) || c.remark || c.addressCorrectedAt ? (
        <div className="rounded-lg px-3 py-2.5 text-[12.5px] flex gap-2"
          style={{ background: o.view === "CANCELLED" ? "#FEF2F2" : "#F5F7FB", color: "#374151" }}>
          <StickyNote className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: o.view === "CANCELLED" ? "#DC2626" : "#9CA3AF" }} />
          <div className="space-y-0.5">
            {o.view === "CANCELLED" && o.reason && <p><span className="font-semibold">Reason:</span> {o.reason}</p>}
            {c.remark && <p><span className="font-semibold">Team note:</span> {c.remark.text}</p>}
            {c.addressCorrectedAt && <p className="text-[#6B7280]">Address corrected on call · {when(c.addressCorrectedAt)}</p>}
          </div>
        </div>
      ) : null}
    </li>
  );
}
