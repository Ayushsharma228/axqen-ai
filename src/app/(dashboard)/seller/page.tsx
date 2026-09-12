"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from "recharts";
import { RefreshCw } from "lucide-react";

// ── date helpers ──────────────────────────────────────────────────────────
function toISO(d: Date) { return d.toISOString().split("T")[0]; }
function daysAgoISO(n: number) { return toISO(new Date(Date.now() - (n - 1) * 86400000)); }

const DATE_PRESETS = [
  { label: "7d",  days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

// ── Types ─────────────────────────────────────────────────────────────────
interface Trend {
  date: string; total: number; delivered: number; rto: number; cancelled: number;
}
interface ETrend {
  date: string; gmv: number; netProfit: number;
  platformFee: number; productCost: number; adSpend: number;
}

interface AnalyticsData {
  totalOrders: number;
  deliveredCount: number;
  rtoCount: number;
  cancelledCount: number;
  inTransitCount: number;
  deliveryRate: number;
  rtoRate: number;
  totalRevenue: number;
  trend: Trend[];
  topProducts: { name: string; sku: string; orders: number; units: number; delPct: number; rtoPct: number }[];
  rtoByState: { state: string; total: number; rto: number; rtoPct: number }[];
  store: { lastSyncAt: string | null; lastSyncError: string | null } | null;
  earnings: {
    totalGMV: number;
    totalPlatformFee: number;
    totalProductCost: number;
    totalShipping: number;
    totalPackingCost: number;
    totalRtoCharge: number;
    totalAdSpend: number;
    netProfit: number;
    margin: number;
    platformFeePerOrder: number;
    deliveredCount: number;
    productCostTracked: number;
    shippingTracked: number;
    earningsTrend?: ETrend[];
  };
  pipeline?: { new: number };
  computedAt?: string;
}

interface WalletData { balance: number }

// ── Format helpers ─────────────────────────────────────────────────────────
const inr  = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const num  = (n: number) => Math.round(n).toLocaleString("en-IN");
const kInr = (v: number) => `₹${(v / 1000).toFixed(0)}k`;

function delta(curr: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((curr - prev) / Math.abs(prev)) * 100);
}

// ── Shared components ──────────────────────────────────────────────────────

function SectionCard({ title, sub, children }: {
  title: string; sub?: string; children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F3F4F6]">
        <h2 className="text-[15px] font-bold text-[#0C1220]">{title}</h2>
        {sub && <p className="text-[12px] text-[#9CA3AF] mt-0.5">{sub}</p>}
      </div>
      <div className="p-5 space-y-5">{children}</div>
    </section>
  );
}

function StatTile({ label, value, sub, valueColor = "#0C1220" }: {
  label: string; value: string; sub?: string; valueColor?: string;
}) {
  return (
    <div className="rounded-lg border border-[#E8EDF6] bg-[#FAFBFF] px-4 py-3.5">
      <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">{label}</p>
      <p className="text-[22px] font-black leading-none" style={{ color: valueColor }}>{value}</p>
      {sub && <p className="text-[11px] text-[#9CA3AF] mt-0.5">{sub}</p>}
    </div>
  );
}

function DeltaBadge({ value, goodDir = "up" }: { value: number | null; goodDir?: "up" | "down" }) {
  if (value === null || value === 0) return null;
  const isGood = goodDir === "up" ? value > 0 : value < 0;
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 inline-block"
      style={{
        background: isGood ? "#DCFCE7" : "#FEE2E2",
        color: isGood ? "#15803D" : "#DC2626",
      }}
    >
      {value > 0 ? "+" : ""}{value}%
    </span>
  );
}

function WeekCompareRow({ label, thisWeek, lastWeek, goodDir = "up", isInr = false }: {
  label: string; thisWeek: number; lastWeek: number;
  goodDir?: "up" | "down"; isInr?: boolean;
}) {
  const d = delta(thisWeek, lastWeek);
  const fmt = isInr ? inr : num;
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#F3F4F6] last:border-0">
      <span className="text-[13px] text-[#6B7280]">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-[#9CA3AF]">{fmt(lastWeek)} last wk</span>
        <span className="text-[13px] font-bold text-[#0C1220]">{fmt(thisWeek)}</span>
        <DeltaBadge value={d} goodDir={goodDir} />
      </div>
    </div>
  );
}

function SubLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide mb-3">{children}</p>
  );
}

const TOOLTIP_STYLE = {
  contentStyle: { fontSize: 12, border: "1px solid #E8EDF6", borderRadius: 8, boxShadow: "none" },
  cursor: { fill: "rgba(67,97,238,0.04)" },
};

// ── Main ───────────────────────────────────────────────────────────────────

export default function SellerDashboard() {
  const { data: session } = useSession();
  const name = session?.user?.name?.split(" ")[0] ?? "Seller";

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [wallet,    setWallet]    = useState<WalletData | null>(null);
  const [adSpend,   setAdSpend]   = useState(0);
  const [newCount,  setNewCount]  = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [days,      setDays]      = useState(30);
  const [key,       setKey]       = useState(0);

  useEffect(() => {
    setLoading(true);
    const from = daysAgoISO(days);
    const to   = toISO(new Date());
    const p    = `from=${from}&to=${to}`;
    Promise.all([
      fetch(`/api/seller/analytics?${p}`).then(r => r.json()),
      fetch("/api/seller/wallet").then(r => r.json()),
      fetch(`/api/seller/ad-spend?${p}`).then(r => r.json()),
      fetch("/api/seller/orders?status=NEW&limit=1").then(r => r.json()),
    ]).then(([a, w, ads, ord]) => {
      setAnalytics(a);
      setWallet(w);
      setAdSpend(ads.total ?? 0);
      setNewCount(
        a?.pipeline?.new ??
        ord?.stats?.totalOrders ??
        ord?.total ?? 0
      );
    }).finally(() => setLoading(false));
  }, [key, days]);

  // ── Weekly slices ────────────────────────────────────────────────────────
  const trend  = analytics?.trend ?? [];
  const last7  = trend.slice(-7);
  const prior7 = trend.slice(-14, -7);

  const sum = (arr: Trend[], k: keyof Trend) => arr.reduce((s, d) => s + (d[k] as number), 0);

  const wOrd = {
    orders:    { t: sum(last7, "total"),     p: sum(prior7, "total") },
    delivered: { t: sum(last7, "delivered"), p: sum(prior7, "delivered") },
    rto:       { t: sum(last7, "rto"),       p: sum(prior7, "rto") },
    cancelled: { t: sum(last7, "cancelled"), p: sum(prior7, "cancelled") },
  };

  const eTrend = analytics?.earnings?.earningsTrend ?? [];
  const eL7    = eTrend.slice(-7);
  const eP7    = eTrend.slice(-14, -7);
  const eSum   = (arr: ETrend[], k: keyof ETrend) => arr.reduce((s, d) => s + (d[k] as number), 0);

  const wFin = {
    gmv: { t: eSum(eL7, "gmv"), p: eSum(eP7, "gmv") },
    net: { t: eSum(eL7, "netProfit"), p: eSum(eP7, "netProfit") },
  };

  // ── Chart data ───────────────────────────────────────────────────────────

  const ordersChart = useMemo(() =>
    last7.map(d => ({
      day: new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      Orders:    d.total,
      Delivered: d.delivered,
      RTO:       d.rto,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [analytics]
  );

  const finChart = useMemo(() =>
    eL7.map(d => ({
      day: new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      Revenue:    Math.round(d.gmv),
      "Net Profit": Math.round(d.netProfit),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [analytics]
  );

  const e = analytics?.earnings;
  // e.netProfit already includes totalAdSpend deduction from the analytics API
  const netProfit = e ? e.netProfit : 0;

  const plData = e ? [
    { name: "Gross Revenue", v: e.totalGMV,          color: "#4361EE" },
    { name: "Product Cost",  v: e.totalProductCost,  color: "#EF4444" },
    { name: "Shipping",      v: e.totalShipping,     color: "#F59E0B" },
    { name: "Platform Fee",  v: e.totalPlatformFee,  color: "#F59E0B" },
    { name: "RTO Charges",   v: e.totalRtoCharge,    color: "#EF4444" },
    { name: "Ad Spend",      v: e.totalAdSpend,      color: "#7C3AED" },
    { name: netProfit >= 0 ? "Net Profit" : "Net Loss", v: Math.abs(netProfit), color: netProfit >= 0 ? "#059669" : "#EF4444" },
  ] : [];

  // ── Shipping ─────────────────────────────────────────────────────────────
  const stateData = (analytics?.rtoByState ?? []).slice(0, 10).map(r => ({
    state: r.state.length > 10 ? r.state.slice(0, 10) + "…" : r.state,
    Orders: r.total,
    RTO: r.rto,
    total: r.total,
  }));

  // ── Products ─────────────────────────────────────────────────────────────
  const products = analytics?.topProducts ?? [];
  const winner   = [...products].sort((a, b) => b.delPct - a.delPct)[0];

  const productChart = products.slice(0, 6).map(p => ({
    name: p.name.length > 22 ? p.name.slice(0, 22) + "…" : p.name,
    Orders:    p.orders,
    Delivered: Math.round((p.orders * p.delPct) / 100),
    RTO:       Math.round((p.orders * p.rtoPct) / 100),
  }));

  // ── Skeleton ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="px-3 py-4 md:p-8 space-y-6" style={{ background: "#F7F8FC", minHeight: "100vh" }}>
        <div className="h-10 w-48 bg-white rounded-lg border border-[#E8EDF6] animate-pulse" />
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl border border-[#E8EDF6] h-48 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="px-3 py-4 md:p-8 space-y-6" style={{ background: "#F7F8FC", minHeight: "100vh" }}>

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[12px] font-semibold text-[#9CA3AF] mb-0.5">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="text-[22px] font-black text-[#0C1220]">
            {(() => {
              const h = new Date().getHours();
              return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
            })()}, {name} 👋
          </h1>
          {analytics?.computedAt && (
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">
              Data as of {new Date(analytics.computedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-white border border-[#E8EDF6] rounded-lg overflow-hidden">
            {DATE_PRESETS.map(p => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                className="px-3 py-1.5 text-[12px] font-semibold transition-colors"
                style={{
                  background: days === p.days ? "#4361EE" : "white",
                  color: days === p.days ? "white" : "#6B7280",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setLoading(true); setKey(k => k + 1); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-white border border-[#E8EDF6] text-[#6B7280] hover:text-[#0C1220] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. ORDERS                                                           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <SectionCard title="Orders" sub={`Last ${days} days · from your Shopify store`}>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatTile
            label="Total Orders"
            value={num(analytics?.totalOrders ?? 0)}
          />
          <StatTile
            label="Delivered"
            value={num(analytics?.deliveredCount ?? 0)}
            sub={`${(analytics?.deliveryRate ?? 0).toFixed(1)}% delivery rate`}
            valueColor="#059669"
          />
          <StatTile
            label="RTO"
            value={num(analytics?.rtoCount ?? 0)}
            sub={`${(analytics?.rtoRate ?? 0).toFixed(1)}% RTO rate`}
            valueColor="#EF4444"
          />
          <StatTile
            label="Cancelled"
            value={num(analytics?.cancelledCount ?? 0)}
          />
          <StatTile
            label="New Orders"
            value={num(newCount)}
            sub="Awaiting fulfillment"
            valueColor="#4361EE"
          />
        </div>

        {/* Weekly comparison */}
        <div>
          <SubLabel>This Week vs Last Week</SubLabel>
          <WeekCompareRow label="Total Orders" thisWeek={wOrd.orders.t}    lastWeek={wOrd.orders.p} />
          <WeekCompareRow label="Delivered"    thisWeek={wOrd.delivered.t} lastWeek={wOrd.delivered.p} />
          <WeekCompareRow label="RTO"          thisWeek={wOrd.rto.t}       lastWeek={wOrd.rto.p}       goodDir="down" />
          <WeekCompareRow label="Cancelled"    thisWeek={wOrd.cancelled.t} lastWeek={wOrd.cancelled.p} goodDir="down" />
        </div>

        {/* 7-day bar chart */}
        {ordersChart.length > 0 && (
          <div>
            <SubLabel>Daily – Last 7 Days</SubLabel>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ordersChart} barGap={2} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="Orders"    fill="#4361EE" radius={[3,3,0,0]} maxBarSize={16} />
                <Bar dataKey="Delivered" fill="#059669" radius={[3,3,0,0]} maxBarSize={16} />
                <Bar dataKey="RTO"       fill="#EF4444" radius={[3,3,0,0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="flex items-center gap-4 mt-2">
              {[["#4361EE","Orders"],["#059669","Delivered"],["#EF4444","RTO"]].map(([c, l]) => (
                <span key={l} className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: c }} />{l}
                </span>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 2. FINANCE                                                          */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <SectionCard title="Finance" sub={`Revenue, ad spend and wallet — last ${days} days`}>

        {/* Stat tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatTile
            label="Total Revenue"
            value={inr(analytics?.totalRevenue ?? 0)}
            sub="All orders in period"
            valueColor="#4361EE"
          />
          <StatTile
            label="Meta Ads Spent"
            value={inr(adSpend)}
            sub={`Last ${days} days`}
            valueColor="#7C3AED"
          />
          <StatTile
            label="Wallet Balance"
            value={inr(wallet?.balance ?? 0)}
            sub="Available to withdraw"
            valueColor="#059669"
          />
        </div>

        {/* Weekly comparison */}
        {(wFin.gmv.p > 0 || wFin.gmv.t > 0) && (
          <div>
            <SubLabel>This Week vs Last Week</SubLabel>
            <WeekCompareRow label="Revenue (GMV)" thisWeek={wFin.gmv.t} lastWeek={wFin.gmv.p} isInr />
            <WeekCompareRow label="Net Profit"    thisWeek={wFin.net.t} lastWeek={wFin.net.p} isInr />
          </div>
        )}

        {/* 7-day revenue bar chart */}
        {finChart.length > 0 && (
          <div>
            <SubLabel>Daily Revenue – Last 7 Days</SubLabel>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={finChart} barGap={2} barCategoryGap="32%">
                <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={kInr} />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(v: unknown) => [inr(Number(v))]}
                />
                <Bar dataKey="Revenue"    fill="#4361EE" radius={[3,3,0,0]} maxBarSize={18} />
                <Bar dataKey="Net Profit" fill="#059669" radius={[3,3,0,0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2">
              {[["#4361EE","Revenue"],["#059669","Net Profit"]].map(([c, l]) => (
                <span key={l} className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: c }} />{l}
                </span>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3. PRODUCTS                                                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {products.length > 0 && (
        <SectionCard title="Products" sub={`Performance by product — last ${days} days`}>

          {/* Winning product highlight */}
          {winner && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#F0FDF4] border border-[#DCFCE7]">
              <span className="text-lg flex-shrink-0">🏆</span>
              <div>
                <p className="text-[11px] font-bold text-[#15803D] uppercase tracking-wide">Winning Product</p>
                <p className="text-[13px] font-semibold text-[#0C1220]">{winner.name}</p>
                <p className="text-[11px] text-[#6B7280]">
                  {winner.orders} orders · {winner.delPct}% delivery · {winner.rtoPct}% RTO
                </p>
              </div>
            </div>
          )}

          {/* Products bar chart (horizontal) */}
          {productChart.length > 0 && (
            <div>
              <SubLabel>Top Products by Orders</SubLabel>
              <ResponsiveContainer width="100%" height={productChart.length * 42 + 20}>
                <BarChart
                  data={productChart}
                  layout="vertical"
                  barGap={2}
                  barCategoryGap="28%"
                >
                  <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#6B7280" }} width={140} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="Orders"    fill="#4361EE" radius={[0,3,3,0]} maxBarSize={12} />
                  <Bar dataKey="Delivered" fill="#059669" radius={[0,3,3,0]} maxBarSize={12} />
                  <Bar dataKey="RTO"       fill="#EF4444" radius={[0,3,3,0]} maxBarSize={12} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2">
                {[["#4361EE","Orders"],["#059669","Delivered"],["#EF4444","RTO"]].map(([c, l]) => (
                  <span key={l} className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: c }} />{l}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Products table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F3F4F6]">
                  {["Product", "Orders", "Units", "Delivery %", "RTO %"].map(h => (
                    <th
                      key={h}
                      className="px-2 py-2 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide"
                      style={{ textAlign: h === "Product" ? "left" : "right" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F9FAFB]">
                {products.slice(0, 10).map((p, i) => (
                  <tr key={i} className="hover:bg-[#FAFBFF]">
                    <td className="px-2 py-2.5 text-[13px] font-medium text-[#0C1220] max-w-[220px] truncate">{p.name}</td>
                    <td className="px-2 py-2.5 text-[13px] font-semibold text-[#374151] text-right">{p.orders}</td>
                    <td className="px-2 py-2.5 text-[13px] text-[#374151] text-right">{p.units}</td>
                    <td className="px-2 py-2.5 text-right">
                      <span className="text-[12px] font-bold" style={{
                        color: p.delPct >= 70 ? "#059669" : p.delPct >= 50 ? "#D97706" : "#EF4444",
                      }}>
                        {p.delPct}%
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <span className="text-[12px] font-bold" style={{
                        color: p.rtoPct <= 10 ? "#059669" : p.rtoPct <= 25 ? "#D97706" : "#EF4444",
                      }}>
                        {p.rtoPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4. SHIPPING                                                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {(analytics?.rtoByState?.length ?? 0) > 0 && (
        <SectionCard title="Shipping" sub={`State-wise orders, deliveries and RTO — last ${days} days`}>

          {/* Top stat tiles */}
          {(() => {
            const states  = analytics!.rtoByState;
            const topVol  = states[0];
            const highRto = [...states].sort((a, b) => b.rtoPct - a.rtoPct)[0];
            const bestDel = [...states].filter(r => r.total >= 5).sort((a, b) => a.rtoPct - b.rtoPct)[0];
            const totalShip = states.reduce((s, r) => s + r.total, 0);
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatTile label="Total Shipments" value={num(totalShip)} sub={`${states.length} states`} />
                <StatTile label="Top State"         value={topVol?.state ?? "—"} sub={`${num(topVol?.total ?? 0)} orders`} valueColor="#4361EE" />
                <StatTile label="Highest RTO State" value={highRto?.state ?? "—"} sub={`${highRto?.rtoPct ?? 0}% RTO`} valueColor="#EF4444" />
                <StatTile label="Best Delivery"     value={bestDel?.state ?? "—"} sub={bestDel ? `${(100 - bestDel.rtoPct).toFixed(0)}% delivery` : "—"} valueColor="#059669" />
              </div>
            );
          })()}

          {/* State bar chart — stacked delivered + RTO */}
          <div>
            <SubLabel>Orders by State — Top 10 (Orders vs RTO)</SubLabel>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stateData} barGap={0} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="state" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="Orders" stackId="s" fill="#4361EE" maxBarSize={28} />
                <Bar dataKey="RTO"     stackId="s" fill="#EF4444" radius={[3,3,0,0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2">
              {[["#4361EE","Orders"],["#EF4444","RTO"]].map(([c, l]) => (
                <span key={l} className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: c }} />{l}
                </span>
              ))}
            </div>
          </div>

          {/* State table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F3F4F6]">
                  {["State", "Orders", "RTO", "RTO %"].map(h => (
                    <th
                      key={h}
                      className="px-2 py-2 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide"
                      style={{ textAlign: h === "State" ? "left" : "right" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F9FAFB]">
                {analytics!.rtoByState.map((row, i) => {
                  const rtoColor  = row.rtoPct >= 40 ? "#EF4444" : row.rtoPct >= 20 ? "#D97706" : "#059669";
                  return (
                    <tr key={i} className="hover:bg-[#FAFBFF]">
                      <td className="px-2 py-2.5 text-[13px] font-medium text-[#0C1220]">{row.state}</td>
                      <td className="px-2 py-2.5 text-[13px] font-semibold text-[#374151] text-right">{row.total}</td>
                      <td className="px-2 py-2.5 text-[13px] text-[#EF4444] text-right">{row.rto}</td>
                      <td className="px-2 py-2.5 text-right">
                        <span className="text-[12px] font-bold" style={{ color: rtoColor }}>
                          {row.rtoPct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 5. P&L                                                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {e && (
        <SectionCard title="P&L" sub="Gross Revenue − all costs = Net Profit · delivered orders only">

          {/* Stat tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile
              label="Gross Revenue"
              value={inr(e.totalGMV)}
              sub="Delivered orders only"
              valueColor="#4361EE"
            />
            <StatTile
              label="Total Costs"
              value={inr(
                e.totalProductCost +
                e.totalShipping +
                e.totalPlatformFee +
                e.totalRtoCharge +
                e.totalAdSpend
              )}
              sub="All deductions"
              valueColor="#EF4444"
            />
            <StatTile
              label={netProfit >= 0 ? "Net Profit" : "Net Loss"}
              value={inr(Math.abs(netProfit))}
              valueColor={netProfit >= 0 ? "#059669" : "#EF4444"}
            />
            <StatTile
              label="Net Margin"
              value={`${e.margin.toFixed(1)}%`}
              valueColor={e.margin >= 0 ? "#059669" : "#EF4444"}
            />
          </div>

          {/* Weekly P&L comparison */}
          {(wFin.gmv.p > 0 || wFin.gmv.t > 0) && (
            <div>
              <SubLabel>This Week vs Last Week</SubLabel>
              <WeekCompareRow label="Gross Revenue" thisWeek={wFin.gmv.t} lastWeek={wFin.gmv.p} isInr />
              <WeekCompareRow label="Net Profit"    thisWeek={wFin.net.t} lastWeek={wFin.net.p} isInr />
            </div>
          )}

          {/* P&L bar chart — each component as its own bar */}
          <div>
            <SubLabel>P&L Component Breakdown</SubLabel>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={plData} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#9CA3AF" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={kInr}
                />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(v: unknown) => [inr(Number(v))]}
                />
                <Bar dataKey="v" radius={[3,3,0,0]} maxBarSize={36}>
                  {plData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* P&L line items */}
          <div className="border-t border-[#F3F4F6] pt-4 space-y-0">
            {[
              {
                label: "Gross Revenue (delivered orders)",
                value: e.totalGMV, sign: "+", color: "#4361EE",
              },
              {
                label: "− Product Cost",
                value: e.totalProductCost, sign: "−", color: "#EF4444",
                note: e.productCostTracked === 0 ? "not tracked" : undefined,
              },
              {
                label: "− Shipping Charges",
                value: e.totalShipping, sign: "−", color: "#EF4444",
                note: e.shippingTracked === 0 ? "not tracked" : undefined,
              },
              {
                label: `− Platform Fee (₹${e.platformFeePerOrder} × ${e.deliveredCount} delivered)`,
                value: e.totalPlatformFee, sign: "−", color: "#F59E0B",
              },
              {
                label: "− RTO Charges",
                value: e.totalRtoCharge, sign: "−", color: "#EF4444",
              },
              {
                label: "− Ad Spend (Meta)",
                value: e.totalAdSpend, sign: "−", color: "#7C3AED",
              },
            ].map((row, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2.5 border-b border-[#F9FAFB]"
              >
                <p className="text-[13px] text-[#6B7280]">{row.label}</p>
                {row.note ? (
                  <p className="text-[12px] text-[#D1D5DB]">{row.note}</p>
                ) : (
                  <p className="text-[13px] font-bold" style={{ color: row.color }}>
                    {row.sign}₹{num(row.value)}
                  </p>
                )}
              </div>
            ))}

            {/* Net profit total row */}
            <div className="flex items-center justify-between pt-3">
              <p className="text-[14px] font-black text-[#0C1220]">= {netProfit >= 0 ? "Net Profit" : "Net Loss"}</p>
              <p className="text-[14px] font-black" style={{ color: netProfit >= 0 ? "#059669" : "#EF4444" }}>
                {netProfit >= 0 ? "+" : "−"}₹{num(Math.abs(netProfit))}
                <span className="text-[12px] ml-1.5 font-semibold text-[#9CA3AF]">
                  ({e.margin.toFixed(1)}% margin)
                </span>
              </p>
            </div>
          </div>
        </SectionCard>
      )}

      <div className="h-4" />
    </div>
  );
}
