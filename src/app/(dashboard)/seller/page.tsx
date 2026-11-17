"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  RefreshCw, ClipboardCheck, AlertTriangle, PackageOpen, Store, ChevronRight, Wallet, CalendarClock,
} from "lucide-react";

// ── date helpers (same convention as the analytics API) ───────────────────
function toISO(d: Date) { return d.toISOString().split("T")[0]; }
function daysAgoISO(n: number) { return toISO(new Date(Date.now() - (n - 1) * 86400000)); }

type RangeKey = "today" | "7d" | "30d" | "all";
const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "today", label: "Today",    days: 1 },
  { key: "7d",    label: "7 days",   days: 7 },
  { key: "30d",   label: "30 days",  days: 30 },
  { key: "all",   label: "All time", days: null },
];
function rangeQuery(days: number | null) {
  return days === null ? "" : `?from=${daysAgoISO(days)}&to=${toISO(new Date())}`;
}

// ── Types (subset of /api/seller/analytics) ───────────────────────────────
interface Analytics {
  totalOrders: number;
  deliveredCount: number;
  rtoCount: number;
  cancelledCount: number;
  trend: { date: string; total: number; delivered: number; rto: number; cancelled: number }[];
  store: { storeName?: string | null; lastSyncAt: string | null; lastSyncError: string | null } | null;
  earnings: { netProfit: number };
  pipeline?: { new: number; confirmed: number; processing: number; ndr: number };
}
interface WalletInfo { totalRemittance: number; totalSettled: number; upcomingAmount: number }
interface PayoutInfo { upcomingPayout?: { nextDate: string | null } }

const inr = (n: number) => (n < 0 ? "−₹" : "₹") + Math.abs(Math.round(n)).toLocaleString("en-IN");
const num = (n: number) => Math.round(n).toLocaleString("en-IN");
const pct = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "—");

const TOOLTIP_STYLE = {
  contentStyle: { fontSize: 12, border: "1px solid #E8EDF6", borderRadius: 8, boxShadow: "none" },
  cursor: { fill: "rgba(67,97,238,0.04)" },
};

function SectionTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
      <div>
        <h2 className="text-[15px] font-bold text-[#0C1220]">{title}</h2>
        {sub && <p className="text-[12px] text-[#9CA3AF] mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function SellerDashboard() {
  const { data: session } = useSession();
  const name = session?.user?.name?.split(" ")[0] ?? "Seller";

  const [allTime, setAllTime] = useState<Analytics | null>(null);
  const [last30,  setLast30]  = useState<Analytics | null>(null);
  const [byRange, setByRange] = useState<Partial<Record<RangeKey, Analytics>>>({});
  const [wallet,  setWallet]  = useState<WalletInfo | null>(null);
  const [nextPayoutDate, setNextPayoutDate] = useState<string | null>(null);
  const [range,   setRange]   = useState<RangeKey>("30d");
  const [loading, setLoading] = useState(true);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [key, setKey] = useState(0);

  // Base data: all-time (attention + "All time"), last 30 days (trend + default range), money.
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/seller/analytics").then(r => r.json()),
      fetch(`/api/seller/analytics${rangeQuery(30)}`).then(r => r.json()),
      fetch("/api/seller/wallet").then(r => r.json()).catch(() => null),
      fetch("/api/seller/settlements?limit=1").then(r => r.json()).catch(() => null),
    ]).then(([all, d30, w, s]: [Analytics, Analytics, WalletInfo | null, PayoutInfo | null]) => {
      setAllTime(all);
      setLast30(d30);
      setByRange({ all, "30d": d30 });
      setWallet(w);
      setNextPayoutDate(s?.upcomingPayout?.nextDate ?? null);
    }).finally(() => setLoading(false));
  }, [key]);

  // Today / 7 days are fetched when first selected.
  const pickRange = useCallback((k: RangeKey) => {
    setRange(k);
    if (byRange[k]) return;
    const days = RANGES.find(r => r.key === k)!.days;
    setRangeLoading(true);
    fetch(`/api/seller/analytics${rangeQuery(days)}`)
      .then(r => r.json())
      .then((d: Analytics) => setByRange(prev => ({ ...prev, [k]: d })))
      .finally(() => setRangeLoading(false));
  }, [byRange]);

  // 30-day trend with empty days filled in
  const trendData = useMemo(() => {
    const map = new Map((last30?.trend ?? []).map(t => [t.date, t]));
    return Array.from({ length: 30 }, (_, i) => {
      const date = daysAgoISO(30 - i);
      const t = map.get(date);
      return {
        day: new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        Delivered: t?.delivered ?? 0,
        RTO: t?.rto ?? 0,
      };
    });
  }, [last30]);
  const trendHasData = trendData.some(d => d.Delivered || d.RTO);

  if (loading) {
    return (
      <div className="px-3 py-4 md:p-8 space-y-6" style={{ background: "#F7F8FC", minHeight: "100vh" }}>
        <div className="h-10 w-56 bg-white rounded-lg border border-[#E8EDF6] animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-white rounded-xl border border-[#E8EDF6] animate-pulse" />)}
        </div>
        {[1, 2].map(i => <div key={i} className="bg-white rounded-xl border border-[#E8EDF6] h-56 animate-pulse" />)}
      </div>
    );
  }

  // ── Needs attention ──────────────────────────────────────────────────────
  const p = allTime?.pipeline;
  const store = allTime?.store ?? null;
  const storeState: "error" | "ok" | "none" = !store ? "none" : store.lastSyncError ? "error" : "ok";
  const attention = [
    {
      label: "COD to confirm", count: p?.new ?? 0, href: "/seller/order-confirmation",
      icon: ClipboardCheck, tone: "#D97706", bg: "#FFFBEB", hint: "Call or WhatsApp before shipping",
    },
    {
      label: "NDR — action needed", count: p?.ndr ?? 0, href: "/seller/ndr",
      icon: AlertTriangle, tone: "#DC2626", bg: "#FEF2F2", hint: "Delivery failed, choose re-attempt or RTO",
    },
    {
      label: "Waiting to ship", count: (p?.confirmed ?? 0) + (p?.processing ?? 0), href: "/seller/orders",
      icon: PackageOpen, tone: "#4361EE", bg: "#EEF2FF", hint: "Confirmed, being packed",
    },
  ];

  // ── Key numbers (selected range) ─────────────────────────────────────────
  const r = byRange[range];
  const completed = (r?.deliveredCount ?? 0) + (r?.rtoCount ?? 0);
  const net = r?.earnings?.netProfit ?? 0;

  const moneyMade = wallet?.totalRemittance ?? 0;
  const paidOut   = wallet?.totalSettled ?? 0;
  const nextPay   = wallet?.upcomingAmount ?? 0;

  return (
    <div className="px-3 py-4 md:p-8 space-y-7" style={{ background: "#F7F8FC", minHeight: "100vh" }}>

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold text-[#9CA3AF] mb-0.5">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="text-[22px] font-black text-[#0C1220]">
            {(() => {
              const h = new Date().getHours();
              return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
            })()}, {name}
          </h1>
        </div>
        <button
          onClick={() => setKey(k => k + 1)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-white border border-[#E8EDF6] text-[#6B7280] hover:text-[#0C1220] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* 2. Needs your attention */}
      <section>
        <SectionTitle title="Needs your attention" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {attention.map(a => {
            const Icon = a.icon;
            const clear = a.count === 0;
            return (
              <Link
                key={a.label}
                href={a.href}
                className="group bg-white rounded-xl border border-[#E8EDF6] p-4 hover:border-[#C7D2FE] transition-colors flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: clear ? "#F3F4F6" : a.bg }}>
                    <Icon className="w-4 h-4" style={{ color: clear ? "#9CA3AF" : a.tone }} />
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#C4C9D4] group-hover:text-[#4361EE]" />
                </div>
                <p className="text-[24px] font-black leading-none tabular-nums" style={{ color: clear ? "#9CA3AF" : "#0C1220" }}>
                  {num(a.count)}
                </p>
                <div>
                  <p className="text-[13px] font-semibold text-[#0C1220]">{a.label}</p>
                  <p className="text-[11px] text-[#9CA3AF] mt-0.5">{clear ? "All clear" : a.hint}</p>
                </div>
              </Link>
            );
          })}

          {/* Store connection */}
          <Link
            href="/seller/shopify"
            className="group bg-white rounded-xl border p-4 transition-colors flex flex-col gap-2"
            style={{ borderColor: storeState === "error" ? "#FECACA" : "#E8EDF6" }}
          >
            <div className="flex items-center justify-between">
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: storeState === "error" ? "#FEF2F2" : storeState === "ok" ? "#ECFDF5" : "#F3F4F6" }}
              >
                <Store className="w-4 h-4" style={{ color: storeState === "error" ? "#DC2626" : storeState === "ok" ? "#059669" : "#9CA3AF" }} />
              </span>
              <ChevronRight className="w-4 h-4 text-[#C4C9D4] group-hover:text-[#4361EE]" />
            </div>
            <p
              className="text-[15px] font-black leading-tight"
              style={{ color: storeState === "error" ? "#DC2626" : storeState === "ok" ? "#059669" : "#6B7280" }}
            >
              {storeState === "error" ? "Problem" : storeState === "ok" ? "Connected" : "Not connected"}
            </p>
            <div>
              <p className="text-[13px] font-semibold text-[#0C1220]">Shopify store</p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5 truncate">
                {storeState === "error"
                  ? "Orders aren't syncing, reconnect"
                  : storeState === "ok"
                    ? store?.lastSyncAt
                      ? `Synced ${new Date(store.lastSyncAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                      : store?.storeName ?? "Connected"
                    : "Connect to start receiving orders"}
              </p>
            </div>
          </Link>
        </div>
      </section>

      {/* 3. Key numbers */}
      <section className="bg-white rounded-xl border border-[#E8EDF6] p-5">
        <SectionTitle
          title="Key numbers"
          sub="Delivered % and RTO % are out of completed shipments (delivered + RTO)"
          right={
            <div className="flex items-center bg-[#F5F7FB] rounded-lg p-0.5">
              {RANGES.map(o => (
                <button
                  key={o.key}
                  onClick={() => pickRange(o.key)}
                  className="px-3 py-1.5 text-[12px] font-semibold rounded-md transition-colors"
                  style={{
                    background: range === o.key ? "white" : "transparent",
                    color: range === o.key ? "#4361EE" : "#6B7280",
                    boxShadow: range === o.key ? "0 1px 2px rgba(12,18,32,0.08)" : "none",
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          }
        />
        <div className={`grid grid-cols-2 lg:grid-cols-5 gap-3 transition-opacity ${rangeLoading && !r ? "opacity-50" : ""}`}>
          {[
            { label: "Total orders", value: num(r?.totalOrders ?? 0), sub: "All orders received", color: "#0C1220" },
            { label: "Cancelled",    value: pct(r?.cancelledCount ?? 0, r?.totalOrders ?? 0), sub: `${num(r?.cancelledCount ?? 0)} of ${num(r?.totalOrders ?? 0)} orders`, color: "#6B7280" },
            { label: "Delivered",    value: pct(r?.deliveredCount ?? 0, completed), sub: `${num(r?.deliveredCount ?? 0)} of ${num(completed)} completed`, color: "#059669" },
            { label: "RTO",          value: pct(r?.rtoCount ?? 0, completed), sub: `${num(r?.rtoCount ?? 0)} of ${num(completed)} completed`, color: "#DC2626" },
            { label: net >= 0 ? "Net profit" : "Net loss", value: inr(net), sub: "After all costs", color: net >= 0 ? "#059669" : "#DC2626" },
          ].map(t => (
            <div key={t.label} className="rounded-lg bg-[#FAFBFF] border border-[#EEF1F8] px-4 py-3.5">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1.5">{t.label}</p>
              <p className="text-[22px] font-black leading-none tabular-nums" style={{ color: t.color }}>{t.value}</p>
              <p className="text-[11px] text-[#9CA3AF] mt-1.5">{t.sub}</p>
            </div>
          ))}
        </div>
        <Link href="/seller/analytics" className="inline-flex items-center gap-1 mt-4 text-[12px] font-semibold text-[#4361EE] hover:underline">
          Full profit report <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </section>

      {/* 4. Orders trend */}
      <section className="bg-white rounded-xl border border-[#E8EDF6] p-5">
        <SectionTitle title="Orders trend" sub="Last 30 days · delivered vs RTO, by order date" />
        {trendHasData ? (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trendData} barGap={0} barCategoryGap="22%">
                <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="Delivered" stackId="s" fill="#059669" maxBarSize={14} />
                <Bar dataKey="RTO"       stackId="s" fill="#EF4444" radius={[3, 3, 0, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2">
              {[["#059669", "Delivered"], ["#EF4444", "RTO"]].map(([c, l]) => (
                <span key={l} className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />{l}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-[13px] text-[#9CA3AF] py-10 text-center">No delivered or RTO orders in the last 30 days yet.</p>
        )}
      </section>

      {/* 5. Money snapshot */}
      <section>
        <SectionTitle title="Money" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href="/seller/wallet" className="group bg-white rounded-xl border border-[#E8EDF6] p-5 hover:border-[#C7D2FE] transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-2 text-[12px] font-semibold text-[#6B7280] uppercase tracking-wide">
                <Wallet className="w-4 h-4 text-[#059669]" /> Money made
              </span>
              <ChevronRight className="w-4 h-4 text-[#C4C9D4] group-hover:text-[#4361EE]" />
            </div>
            <p className="text-[28px] font-black leading-none tabular-nums text-[#0C1220]">{inr(moneyMade)}</p>
            <p className="text-[12px] text-[#9CA3AF] mt-2">Your earnings from delivered orders · {inr(paidOut)} already paid to your bank</p>
          </Link>
          <Link href="/seller/wallet" className="group bg-white rounded-xl border border-[#E8EDF6] p-5 hover:border-[#C7D2FE] transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-2 text-[12px] font-semibold text-[#6B7280] uppercase tracking-wide">
                <CalendarClock className="w-4 h-4 text-[#4361EE]" /> Next payout
              </span>
              <ChevronRight className="w-4 h-4 text-[#C4C9D4] group-hover:text-[#4361EE]" />
            </div>
            <p className="text-[28px] font-black leading-none tabular-nums text-[#0C1220]">{inr(nextPay)}</p>
            <p className="text-[12px] text-[#9CA3AF] mt-2">
              {nextPay <= 0
                ? "Nothing pending right now"
                : nextPayoutDate
                  ? `Expected ${new Date(nextPayoutDate).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}`
                  : "Date will be shared once scheduled"}
            </p>
          </Link>
        </div>
      </section>

      <div className="h-4" />
    </div>
  );
}
