"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PlanDueNotice, useBilling } from "@/components/billing/plan-payments-panel";
import { PincodeRtoCard } from "@/components/dashboard/pincode-rto-card";
import {
  Search, RefreshCw, ArrowUpRight, ArrowDownRight, ClipboardCheck, AlertTriangle, PackageOpen, Store, ChevronRight, Package,
} from "lucide-react";

// ── Palette: blue only ──────────────────────────────────────────────────────
const C = {
  canvas: "#EEF1F6", ink: "#0F1623", muted: "#6B7488", faint: "#9AA3B5", line: "#E7EBF3",
  blue: "#1D5CFF", blue2: "#6E95FF", blue3: "#B9CCFF", blue4: "#E2EAFF", tint: "#EEF3FF",
  up: "#0E9F6E", down: "#E5484D",
};

// ── Dates (same convention as the analytics API) ───────────────────────────
const toISO = (d: Date) => d.toISOString().split("T")[0];
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
type RangeKey = "today" | "7d" | "30d" | "all";
const RANGES: { key: RangeKey; label: string; days: number | null; prevLabel: string }[] = [
  { key: "today", label: "Today", days: 1, prevLabel: "vs yesterday" },
  { key: "7d", label: "7 days", days: 7, prevLabel: "vs previous 7 days" },
  { key: "30d", label: "30 days", days: 30, prevLabel: "vs previous 30 days" },
  { key: "all", label: "All time", days: null, prevLabel: "since you started" },
];
const windowQuery = (days: number, offset = 0) => `?from=${toISO(daysAgo(days + offset - 1))}&to=${toISO(daysAgo(offset))}`;

interface Analytics {
  totalOrders: number; deliveredCount: number; rtoCount: number; cancelledCount: number;
  trend: { date: string; total: number; delivered: number; rto: number; cancelled: number }[];
  store: { storeName?: string | null; lastSyncAt: string | null; lastSyncError: string | null } | null;
  earnings: { netProfit: number };
  pipeline?: { new: number; confirmed: number; processing: number; ndr: number };
}
interface WalletInfo { totalRemittance: number; totalSettled: number; upcomingAmount: number }
interface Payouts { payouts: { id: string; status: string; date: string; net: number }[]; pipeline: { scheduled: { amount: number; nextDate: string | null }; paid: { amount: number } } }
interface Profit { byProduct: { label: string; delivered: number; rto: number; revenue: number; rtoPct: number | null }[] }

const inr = (n: number) => (n < 0 ? "−₹" : "₹") + Math.abs(Math.round(n)).toLocaleString("en-IN");
const compact = (n: number) => {
  const a = Math.abs(n), s = n < 0 ? "−" : "";
  return a >= 1e7 ? `${s}₹${(a / 1e7).toFixed(2)}Cr` : a >= 1e5 ? `${s}₹${(a / 1e5).toFixed(2)}L` : a >= 1e3 ? `${s}₹${(a / 1e3).toFixed(1)}k` : inr(n);
};
const rate = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : null);

// ── KPI card ────────────────────────────────────────────────────────────────
function Kpi({ label, value, prev, delta, deltaUnit = "%", goodWhenUp = true, filled = false, prevLabel }: {
  label: string; value: string; prev?: string; delta: number | null; deltaUnit?: string; goodWhenUp?: boolean; filled?: boolean; prevLabel: string;
}) {
  const good = delta == null ? null : delta === 0 ? null : (delta > 0) === goodWhenUp;
  const Arrow = delta != null && delta < 0 ? ArrowDownRight : ArrowUpRight;
  return (
    <div className="rounded-[20px] p-5 flex flex-col justify-between min-h-[132px]" style={{ background: filled ? C.blue : "#fff", color: filled ? "#fff" : C.ink }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[13.5px] font-medium" style={{ color: filled ? "rgba(255,255,255,0.88)" : C.ink }}>{label}</span>
        {delta != null && (
          <span className="inline-flex items-center gap-0.5 text-[12px] font-semibold tabular-nums"
            style={{ color: filled ? (good === false ? "#FFD1D3" : "#C8F5DF") : good == null ? C.muted : good ? C.up : C.down }}>
            {Math.abs(delta).toFixed(1)}{deltaUnit}<Arrow className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
      <p className="font-black text-[34px] leading-none tabular-nums mt-3" style={{ color: filled ? "#fff" : C.blue }}>{value}</p>
      <div className="flex items-center justify-between mt-3 text-[12px]" style={{ color: filled ? "rgba(255,255,255,0.75)" : C.muted }}>
        <span>{prevLabel}</span>
        {prev && <span className="tabular-nums font-medium" style={{ color: filled ? "#fff" : C.ink }}>{prev}</span>}
      </div>
    </div>
  );
}

// ── Orders chart: stacked, rounded blocks in blues ─────────────────────────
type Bucket = { label: string; sub: string; delivered: number; moving: number; rto: number; cancelled: number; total: number };
const SEGMENTS = [
  { key: "delivered", label: "Delivered", color: C.blue },
  { key: "moving", label: "In progress", color: C.blue2 },
  { key: "rto", label: "RTO", color: C.blue3 },
  { key: "cancelled", label: "Cancelled", color: C.blue4 },
] as const;

function OrdersChart({ buckets }: { buckets: Bucket[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...buckets.map(b => b.total));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step || 1;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(top * f));
  const avg = buckets.reduce((s, b) => s + b.total, 0) / Math.max(1, buckets.length);
  const H = 260;

  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <div className="flex">
        <div className="w-10 flex flex-col-reverse justify-between text-[11.5px] tabular-nums pr-2" style={{ height: H, color: C.faint }}>
          {ticks.map(t => <span key={t} className="leading-none -mb-1.5">{t}</span>)}
        </div>
        <div className="relative flex-1" style={{ height: H }}>
          {ticks.map(t => <div key={t} className="absolute left-0 right-0 border-t" style={{ bottom: `${(t / top) * 100}%`, borderColor: C.line }} />)}
          <div className="absolute left-0 right-0 border-t-2 border-dotted" style={{ bottom: `${(avg / top) * 100}%`, borderColor: C.blue2 }} title={`Average ${avg.toFixed(1)} orders`} />
          <div className="absolute inset-0 flex items-end gap-[3%] px-1">
            {buckets.map((b, i) => {
              const h = (b.total / top) * 100;
              return (
                <button key={i} type="button" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                  aria-label={`${b.sub}: ${b.total} orders, ${b.delivered} delivered, ${b.rto} RTO`}
                  className="relative flex-1 h-full flex flex-col justify-end outline-none rounded-[12px] focus-visible:ring-2 focus-visible:ring-[#1D5CFF]">
                  <div className="flex flex-col-reverse gap-[3px] w-full transition-opacity" style={{ height: `${h}%`, opacity: hover == null || hover === i ? 1 : 0.45 }}>
                    {SEGMENTS.map(s => {
                      const v = b[s.key];
                      if (!v) return null;
                      return (
                        <div key={s.key} className="w-full rounded-[10px] flex items-center justify-center min-h-[6px]" style={{ flex: v, background: s.color }}>
                          {s.key === "delivered" && v / top > 0.12 && <span className="text-[12px] font-semibold text-white tabular-nums">{v}</span>}
                        </div>
                      );
                    })}
                  </div>
                  {b.total === 0 && <div className="w-full h-[6px] rounded-full" style={{ background: C.tint }} />}
                </button>
              );
            })}
          </div>
          {hover != null && buckets[hover] && (() => {
            const b = buckets[hover];
            const left = ((hover + 0.5) / buckets.length) * 100;
            return (
              <div className="absolute z-10 -translate-x-1/2 bg-white rounded-2xl p-4 w-[248px] pointer-events-none"
                style={{ left: `clamp(124px, ${left}%, calc(100% - 124px))`, bottom: `${Math.min(88, (b.total / top) * 100 + 4)}%`, boxShadow: "0 18px 40px rgba(15,22,35,0.16)" }}>
                <p className="text-[13px] font-bold" style={{ color: C.ink }}>Orders</p>
                <p className="text-[11.5px] mb-3" style={{ color: C.muted }}>{b.sub} · {b.total} total</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                  {SEGMENTS.map(s => (
                    <div key={s.key} className="pl-2.5 border-l-[3px]" style={{ borderColor: s.color }}>
                      <p className="text-[11px]" style={{ color: C.muted }}>{s.label}</p>
                      <p className="text-[17px] font-bold tabular-nums leading-tight" style={{ color: C.ink }}>{b[s.key]}<span className="text-[11px] font-medium ml-1" style={{ color: C.faint }}>{b.total ? `${Math.round((b[s.key] / b.total) * 100)}%` : ""}</span></p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
      <div className="flex ml-10 gap-[3%] px-1 mt-3">
        {buckets.map((b, i) => <span key={i} className="flex-1 text-center text-[12px] truncate" style={{ color: hover === i ? C.ink : C.faint }}>{b.label}</span>)}
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function SellerDashboard() {
  const router = useRouter();
  const { data: session } = useSession();
  const { billing } = useBilling();
  const first = session?.user?.name?.split(" ")[0] ?? "";

  const [range, setRange] = useState<RangeKey>("30d");
  const [cur, setCur] = useState<Analytics | null>(null);
  const [prev, setPrev] = useState<Analytics | null>(null);
  const [week, setWeek] = useState<Analytics | null>(null);
  const [allTime, setAllTime] = useState<Analytics | null>(null);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [payouts, setPayouts] = useState<Payouts | null>(null);
  const [profit, setProfit] = useState<Profit | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch("/api/seller/analytics").then(r => r.json()),
      fetch(`/api/seller/analytics${windowQuery(7)}`).then(r => r.json()),
      fetch("/api/seller/wallet").then(r => r.json()).catch(() => null),
      fetch("/api/seller/payouts").then(r => r.json()).catch(() => null),
      fetch("/api/seller/profit?days=30").then(r => r.json()).catch(() => null),
    ]).then(([all, w7, w, p, pr]) => { setAllTime(all); setWeek(w7); setWallet(w); setPayouts(p?.payouts ? p : null); setProfit(pr?.byProduct ? pr : null); })
      .finally(() => setLoading(false));
  }, [reload]);

  const loadRange = useCallback((k: RangeKey) => {
    const d = RANGES.find(r => r.key === k)!.days;
    setBusy(true);
    const curReq = d ? fetch(`/api/seller/analytics${windowQuery(d)}`).then(r => r.json()) : fetch("/api/seller/analytics").then(r => r.json());
    const prevReq = d ? fetch(`/api/seller/analytics${windowQuery(d, d)}`).then(r => r.json()) : Promise.resolve(null);
    Promise.all([curReq, prevReq]).then(([c, p]) => { setCur(c); setPrev(p); }).finally(() => setBusy(false));
  }, []);
  useEffect(() => { loadRange(range); }, [range, loadRange, reload]);

  // Chart buckets for the selected range
  const buckets: Bucket[] = useMemo(() => {
    const src = range === "today" || range === "7d" ? week : range === "30d" ? cur : allTime;
    const trend = src?.trend ?? [];
    const map = new Map(trend.map(t => [t.date, t]));
    const make = (label: string, sub: string, days: string[]): Bucket => {
      const b = { label, sub, delivered: 0, moving: 0, rto: 0, cancelled: 0, total: 0 };
      for (const d of days) {
        const t = map.get(d);
        if (!t) continue;
        b.delivered += t.delivered; b.rto += t.rto; b.cancelled += t.cancelled; b.total += t.total;
      }
      b.moving = Math.max(0, b.total - b.delivered - b.rto - b.cancelled);
      return b;
    };
    const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-IN", o);
    if (range === "today" || range === "7d") {
      return Array.from({ length: 7 }, (_, i) => { const d = daysAgo(6 - i); return make(fmt(d, { weekday: "short" }), fmt(d, { weekday: "long", day: "numeric", month: "short" }), [toISO(d)]); });
    }
    if (range === "30d") {
      return Array.from({ length: 6 }, (_, i) => {
        const days = Array.from({ length: 5 }, (_, j) => toISO(daysAgo(29 - i * 5 - j)));
        const a = daysAgo(29 - i * 5), z = daysAgo(25 - i * 5);
        return make(fmt(a, { day: "numeric", month: "short" }), `${fmt(a, { day: "numeric", month: "short" })} – ${fmt(z, { day: "numeric", month: "short" })}`, days);
      });
    }
    const months = new Map<string, string[]>();
    for (const t of trend) { const k = t.date.slice(0, 7); months.set(k, [...(months.get(k) ?? []), t.date]); }
    return [...months.entries()].sort().slice(-8).map(([k, days]) => {
      const d = new Date(k + "-01T00:00:00");
      return make(fmt(d, { month: "short" }), fmt(d, { month: "long", year: "numeric" }), days);
    });
  }, [range, week, cur, allTime]);

  if (loading) {
    return (
      <div className="px-4 py-5 md:px-8 md:py-7 space-y-5" style={{ background: C.canvas, minHeight: "100vh" }}>
        <div className="h-11 w-full max-w-[420px] bg-white rounded-full animate-pulse" />
        <div className="h-9 w-48 bg-white/70 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-[132px] bg-white rounded-[20px] animate-pulse" />)}</div>
        <div className="h-[420px] bg-white rounded-[20px] animate-pulse" />
      </div>
    );
  }

  const R = RANGES.find(r => r.key === range)!;
  const done = (cur?.deliveredCount ?? 0) + (cur?.rtoCount ?? 0);
  const pDone = (prev?.deliveredCount ?? 0) + (prev?.rtoCount ?? 0);
  const delRate = rate(cur?.deliveredCount ?? 0, done), pDelRate = rate(prev?.deliveredCount ?? 0, pDone);
  const rtoRate = rate(cur?.rtoCount ?? 0, done), pRtoRate = rate(prev?.rtoCount ?? 0, pDone);
  const pctChange = (a?: number, b?: number) => (prev && b ? ((a ?? 0) - b) / Math.abs(b) * 100 : null);
  const pts = (a: number | null, b: number | null) => (prev && a != null && b != null ? a - b : null);

  const p = allTime?.pipeline;
  const attention = [
    { label: "COD orders to confirm", count: p?.new ?? 0, href: "/seller/order-confirmation", icon: ClipboardCheck },
    { label: "Failed deliveries (NDR)", count: p?.ndr ?? 0, href: "/seller/ndr", icon: AlertTriangle },
    { label: "Confirmed, being packed", count: (p?.confirmed ?? 0) + (p?.processing ?? 0), href: "/seller/orders?tab=CONFIRMED", icon: PackageOpen },
  ];
  const store = allTime?.store ?? null;
  const paidList = (payouts?.payouts ?? []).slice(0, 14).reverse();
  const maxPay = Math.max(1, ...paidList.map(x => x.net));
  const tops = (profit?.byProduct ?? []).filter(x => x.delivered + x.rto > 0).slice(0, 4);
  const sums = SEGMENTS.map(s => ({ ...s, n: buckets.reduce((t, b) => t + b[s.key], 0) }));

  return (
    <div className="px-4 py-5 md:px-8 md:py-7 space-y-6" style={{ background: C.canvas, minHeight: "100vh" }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <form onSubmit={e => { e.preventDefault(); if (q.trim()) router.push(`/seller/orders?search=${encodeURIComponent(q.trim())}`); }} className="relative flex-1 min-w-[220px] max-w-[440px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.ink }} />
          <input id="dash-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search orders, customers or AWB"
            className="w-full h-11 pl-11 pr-4 rounded-full bg-white text-[14px] outline-none border border-transparent focus:border-[#1D5CFF]" style={{ color: C.ink }} />
        </form>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setReload(k => k + 1)} aria-label="Refresh" className="w-11 h-11 rounded-full bg-white flex items-center justify-center hover:text-[#1D5CFF]" style={{ color: C.muted }}>
            <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <PlanDueNotice billing={billing} />

      {/* Heading + range */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[32px] font-bold leading-none" style={{ color: C.ink }}>Overview</h1>
          <p className="text-[13.5px] mt-2" style={{ color: C.muted }}>{first ? `Hi ${first}, here's` : "Here's"} how your store is doing.</p>
        </div>
        <div className="flex items-center gap-1 bg-white rounded-full p-1">
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)} className="px-4 h-9 rounded-full text-[13px] font-semibold transition-colors"
              style={range === r.key ? { background: C.ink, color: "#fff" } : { color: C.muted }}>{r.label}</button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi filled label="Orders" value={(cur?.totalOrders ?? 0).toLocaleString("en-IN")} prev={prev ? prev.totalOrders.toLocaleString("en-IN") : undefined}
          delta={pctChange(cur?.totalOrders, prev?.totalOrders)} prevLabel={R.prevLabel} />
        <Kpi label="Delivered" value={delRate != null ? `${delRate.toFixed(1)}%` : "—"} prev={pDelRate != null ? `${pDelRate.toFixed(1)}%` : undefined}
          delta={pts(delRate, pDelRate)} deltaUnit=" pts" prevLabel={`${cur?.deliveredCount ?? 0} orders · ${R.prevLabel}`} />
        <Kpi label="RTO rate" value={rtoRate != null ? `${rtoRate.toFixed(1)}%` : "—"} prev={pRtoRate != null ? `${pRtoRate.toFixed(1)}%` : undefined}
          delta={pts(rtoRate, pRtoRate)} deltaUnit=" pts" goodWhenUp={false} prevLabel={`${cur?.rtoCount ?? 0} returned · ${R.prevLabel}`} />
        <Kpi label="Net profit" value={compact(cur?.earnings?.netProfit ?? 0)} prev={prev ? compact(prev.earnings?.netProfit ?? 0) : undefined}
          delta={pctChange(cur?.earnings?.netProfit, prev?.earnings?.netProfit)} prevLabel={R.prevLabel} />
      </div>

      {/* Chart + money */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4">
        <section className="bg-white rounded-[20px] p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-[20px] font-bold" style={{ color: C.ink }}>Orders</h2>
              <p className="text-[12.5px] mt-1" style={{ color: C.muted }}>{range === "today" ? "Last 7 days" : range === "7d" ? "Last 7 days, by day" : range === "30d" ? "Last 30 days, in 5-day blocks" : "By month"} · hover a bar for the breakdown</p>
            </div>
            <Link href="/seller/orders" className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-[13px] font-semibold" style={{ background: C.tint, color: C.blue }}>
              All orders <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 mt-5 mb-6">
            {sums.map(s => (
              <div key={s.key} className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: C.tint }}>
                  <span className="w-3.5 h-3.5 rounded-[4px]" style={{ background: s.color, boxShadow: s.key === "cancelled" ? `inset 0 0 0 1px ${C.blue3}` : undefined }} />
                </span>
                <div>
                  <p className="text-[12px]" style={{ color: C.muted }}>{s.label}</p>
                  <p className="text-[17px] font-bold tabular-nums leading-tight" style={{ color: C.ink }}>{s.n.toLocaleString("en-IN")}</p>
                </div>
              </div>
            ))}
          </div>
          {buckets.some(b => b.total) ? <OrdersChart buckets={buckets} /> : (
            <div className="h-[260px] flex items-center justify-center text-[13px] rounded-2xl" style={{ background: C.tint, color: C.muted }}>No orders in this period yet.</div>
          )}
        </section>

        <section className="bg-white rounded-[20px] p-6 flex flex-col">
          <h2 className="text-[20px] font-bold" style={{ color: C.ink }}>Money made</h2>
          <p className="font-black text-[38px] leading-none tabular-nums mt-4" style={{ color: C.ink }}>{inr(wallet?.totalRemittance ?? 0)}</p>
          <p className="text-[12.5px] mt-2" style={{ color: C.muted }}>Earned from delivered orders, all time</p>
          <div className="flex-1 min-h-[150px] flex items-end gap-[5px] mt-6 relative">
            {paidList.length ? paidList.map(x => (
              <div key={x.id} className="flex-1 rounded-t-[6px]" title={`${new Date(x.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}: ${inr(x.net)}`}
                style={{ height: `${Math.max(6, (x.net / maxPay) * 100)}%`, background: x.status === "PAID" ? C.blue4 : C.blue }} />
            )) : <div className="w-full h-full rounded-xl flex items-center justify-center text-[12.5px]" style={{ background: C.tint, color: C.muted }}>Payouts will show here</div>}
            <div className="absolute left-0 right-0 bottom-0 h-[3px] rounded-full" style={{ background: C.blue }} />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-5">
            <div>
              <p className="text-[18px] font-bold tabular-nums" style={{ color: C.ink }}>{compact(payouts?.pipeline.paid.amount ?? wallet?.totalSettled ?? 0)}</p>
              <p className="text-[12px]" style={{ color: C.muted }}>Paid to your bank</p>
            </div>
            <div>
              <p className="text-[18px] font-bold tabular-nums" style={{ color: C.blue }}>{compact(payouts?.pipeline.scheduled.amount ?? wallet?.upcomingAmount ?? 0)}</p>
              <p className="text-[12px]" style={{ color: C.muted }}>{payouts?.pipeline.scheduled.nextDate ? `Next payout ${new Date(payouts.pipeline.scheduled.nextDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "Next payout"}</p>
            </div>
          </div>
          <Link href="/seller/wallet" className="mt-5 inline-flex items-center justify-center gap-1.5 h-10 rounded-full text-[13px] font-semibold text-white" style={{ background: C.ink }}>
            Open wallet <ChevronRight className="w-4 h-4" />
          </Link>
        </section>
      </div>

      {/* Lower cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="bg-white rounded-[20px] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[17px] font-bold" style={{ color: C.ink }}>Needs your attention</h2>
            <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ background: C.tint, color: C.blue }}>{attention.reduce((s, a) => s + a.count, 0)}</span>
          </div>
          <div className="space-y-2">
            {attention.map(a => {
              const Icon = a.icon;
              return (
                <Link key={a.label} href={a.href} className="flex items-center gap-3 rounded-2xl px-3.5 py-3 hover:bg-[#F5F8FF] transition-colors" style={{ background: a.count ? C.tint : "#F7F8FB" }}>
                  <span className="w-9 h-9 rounded-xl bg-white flex items-center justify-center"><Icon className="w-4 h-4" style={{ color: a.count ? C.blue : C.faint }} /></span>
                  <span className="flex-1 text-[13.5px]" style={{ color: C.ink }}>{a.label}</span>
                  <span className="text-[18px] font-bold tabular-nums" style={{ color: a.count ? C.blue : C.faint }}>{a.count}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="bg-white rounded-[20px] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[17px] font-bold" style={{ color: C.ink }}>Top products</h2>
            <Link href="/seller/analytics" aria-label="Open Profit & Analytics" className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: C.tint, color: C.blue }}><ArrowUpRight className="w-4 h-4" /></Link>
          </div>
          {tops.length === 0 ? <p className="text-[13px] py-8 text-center" style={{ color: C.muted }}>Your best sellers will show here once orders are delivered.</p> : (
            <div className="space-y-3.5">
              {tops.map((t, i) => {
                const share = (t.revenue / Math.max(1, tops[0].revenue)) * 100;
                return (
                  <div key={t.label}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold" style={{ background: i === 0 ? C.blue : C.tint, color: i === 0 ? "#fff" : C.blue }}>{i + 1}</span>
                      <span className="flex-1 text-[13px] truncate" style={{ color: C.ink }} title={t.label}>{t.label}</span>
                      <span className="text-[12.5px] font-semibold tabular-nums" style={{ color: C.ink }}>{compact(t.revenue)}</span>
                    </div>
                    <div className="h-2 rounded-full ml-8" style={{ background: C.tint }}><div className="h-2 rounded-full" style={{ width: `${share}%`, background: i === 0 ? C.blue : C.blue2 }} /></div>
                    <p className="text-[11.5px] mt-1 ml-8" style={{ color: C.muted }}>{t.delivered} delivered{t.rtoPct != null ? ` · ${t.rtoPct}% RTO` : ""}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-white rounded-[20px] p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[17px] font-bold" style={{ color: C.ink }}>Your store</h2>
            <Link href="/seller/shopify" aria-label="Open Shopify store" className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: C.tint, color: C.blue }}><ArrowUpRight className="w-4 h-4" /></Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: store ? C.blue : C.tint }}><Store className="w-5 h-5" style={{ color: store ? "#fff" : C.blue }} /></span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold truncate" style={{ color: C.ink }}>{store?.storeName ?? "No store connected"}</p>
              <p className="text-[12.5px]" style={{ color: store?.lastSyncError ? C.down : C.muted }}>
                {!store ? "Connect Shopify to start receiving orders" : store.lastSyncError ? "Last sync failed. Reconnect from the store page." : store.lastSyncAt ? `Synced ${new Date(store.lastSyncAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : "Connected"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-auto pt-5">
            <Link href="/seller/catalog" className="flex items-center gap-2 rounded-2xl px-3.5 py-3 text-[13px] font-medium hover:bg-[#F5F8FF]" style={{ background: "#F7F8FB", color: C.ink }}><Package className="w-4 h-4" style={{ color: C.blue }} /> Catalogue</Link>
            <Link href="/seller/listings" className="flex items-center gap-2 rounded-2xl px-3.5 py-3 text-[13px] font-medium hover:bg-[#F5F8FF]" style={{ background: "#F7F8FB", color: C.ink }}><Store className="w-4 h-4" style={{ color: C.blue }} /> My listings</Link>
          </div>
        </section>
      </div>

      <PincodeRtoCard />
    </div>
  );
}
