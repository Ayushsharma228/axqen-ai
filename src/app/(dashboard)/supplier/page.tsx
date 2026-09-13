"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from "recharts";
import { RefreshCw } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DashboardData {
  orderCounts: {
    pending: number;
    active: number;
    shipped: number;
    delivered: number;
    rto: number;
    cancelled: number;
    ndr: number;
    total: number;
  };
  productCounts: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
  };
  earnings: {
    deliveredRevenue: number;
    productCosts: number;
    ourEarnings: number;
    paid: number;
    walletBalance: number;
    upcoming: number;
  };
  stateData: Array<{
    state: string;
    total: number;
    delivered: number;
    rto: number;
    deliveryPct: number;
    rtoPct: number;
  }>;
}

// ── Format helpers ─────────────────────────────────────────────────────────────
const inr  = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const num  = (n: number) => Math.round(n).toLocaleString("en-IN");
const kInr = (v: number) => `₹${(v / 1000).toFixed(0)}k`;

// ── Shared components ──────────────────────────────────────────────────────────
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

function SubLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide mb-3">{children}</p>
  );
}

const TOOLTIP_STYLE = {
  contentStyle: { fontSize: 12, border: "1px solid #E8EDF6", borderRadius: 8, boxShadow: "none" },
  cursor: { fill: "rgba(67,97,238,0.04)" },
};

// ── Main ───────────────────────────────────────────────────────────────────────
export default function SupplierDashboard() {
  const { data: session } = useSession();
  const name = session?.user?.name?.split(" ")[0] ?? "Supplier";

  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [key,     setKey]     = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch("/api/supplier/dashboard")
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, [key]);

  const o = data?.orderCounts;
  const p = data?.productCounts;
  const e = data?.earnings;
  const states = data?.stateData ?? [];

  // State chart data — top 10
  const stateChart = useMemo(() =>
    states.slice(0, 10).map(s => ({
      state:     s.state.length > 10 ? s.state.slice(0, 10) + "…" : s.state,
      Delivered: s.delivered,
      RTO:       s.rto,
    })),
    [states]
  );

  // P&L breakdown for chart
  const plData = e ? [
    { name: "Revenue",       v: e.deliveredRevenue, color: "#4361EE" },
    { name: "Product Cost",  v: e.productCosts,     color: "#EF4444" },
    { name: "Our Earnings",  v: Math.max(0, e.ourEarnings), color: "#059669" },
    { name: "Paid",          v: e.paid,             color: "#7C3AED" },
    { name: "Upcoming",      v: e.upcoming,         color: "#F59E0B" },
  ] : [];

  // ── Skeleton ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="px-3 py-4 md:p-8 space-y-6" style={{ background: "#F7F8FC", minHeight: "100vh" }}>
        <div className="h-10 w-48 bg-white rounded-lg border border-[#E8EDF6] animate-pulse" />
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-xl border border-[#E8EDF6] h-48 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="px-3 py-4 md:p-8 space-y-6" style={{ background: "#F7F8FC", minHeight: "100vh" }}>

      {/* ── Page header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
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
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">Supplier Dashboard</p>
        </div>
        <button
          onClick={() => { setLoading(true); setKey(k => k + 1); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-white border border-[#E8EDF6] text-[#6B7280] hover:text-[#0C1220] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 1. ORDERS                                                               */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <SectionCard title="Orders" sub="All-time order status breakdown">

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatTile
            label="Pending Acceptance"
            value={num(o?.pending ?? 0)}
            sub="Awaiting your action"
            valueColor={o?.pending ? "#F59E0B" : "#0C1220"}
          />
          <StatTile
            label="Shipped"
            value={num(o?.shipped ?? 0)}
            sub="Dispatched to courier"
            valueColor="#4361EE"
          />
          <StatTile
            label="Delivered"
            value={num(o?.delivered ?? 0)}
            sub={o && o.delivered + o.rto > 0
              ? `${Math.round((o.delivered / (o.delivered + o.rto)) * 100)}% delivery rate`
              : "—"}
            valueColor="#059669"
          />
          <StatTile
            label="RTO"
            value={num(o?.rto ?? 0)}
            sub={o && o.delivered + o.rto > 0
              ? `${Math.round((o.rto / (o.delivered + o.rto)) * 100)}% RTO rate`
              : "—"}
            valueColor="#EF4444"
          />
          <StatTile
            label="NDR"
            value={num(o?.ndr ?? 0)}
            sub="Failed delivery attempts"
            valueColor={o?.ndr ? "#D97706" : "#0C1220"}
          />
        </div>

        {/* Order funnel table */}
        <div>
          <SubLabel>Order pipeline</SubLabel>
          {[
            { label: "Total Assigned",    value: o?.total ?? 0,     color: "#0C1220" },
            { label: "Active (In Progress)", value: o?.active ?? 0, color: "#3B82F6" },
            { label: "Shipped",           value: o?.shipped ?? 0,   color: "#4361EE" },
            { label: "Delivered",         value: o?.delivered ?? 0, color: "#059669" },
            { label: "RTO",               value: o?.rto ?? 0,       color: "#EF4444" },
            { label: "Cancelled",         value: o?.cancelled ?? 0, color: "#9CA3AF" },
            { label: "NDR",               value: o?.ndr ?? 0,       color: "#D97706" },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between py-2 border-b border-[#F3F4F6] last:border-0">
              <span className="text-[13px] text-[#6B7280]">{row.label}</span>
              <span className="text-[13px] font-bold" style={{ color: row.color }}>
                {num(row.value)}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 2. PRODUCTS                                                             */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <SectionCard title="Products" sub="Your catalogue status on AXQEN">

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile
            label="Total Listed"
            value={num(p?.total ?? 0)}
            valueColor="#0C1220"
          />
          <StatTile
            label="Approved"
            value={num(p?.approved ?? 0)}
            sub="Live on platform"
            valueColor="#059669"
          />
          <StatTile
            label="Pending"
            value={num(p?.pending ?? 0)}
            sub="Under review"
            valueColor={p?.pending ? "#D97706" : "#9CA3AF"}
          />
          <StatTile
            label="Rejected"
            value={num(p?.rejected ?? 0)}
            sub={p?.rejected ? "Action required" : "All clear"}
            valueColor={p?.rejected ? "#EF4444" : "#9CA3AF"}
          />
        </div>

        {/* Products bar chart */}
        {p && p.total > 0 && (
          <div>
            <SubLabel>Product Status Breakdown</SubLabel>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart
                data={[
                  { name: "Approved", v: p.approved, color: "#059669" },
                  { name: "Pending",  v: p.pending,  color: "#D97706" },
                  { name: "Rejected", v: p.rejected, color: "#EF4444" },
                ]}
                barCategoryGap="32%"
              >
                <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="v" radius={[3, 3, 0, 0]} maxBarSize={48}>
                  {[{ color: "#059669" }, { color: "#D97706" }, { color: "#EF4444" }].map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 3. EARNINGS                                                             */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {e && (
        <SectionCard title="Earnings" sub="Based on delivered orders · product cost deducted">

          {/* Stat tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatTile
              label="Wallet Balance"
              value={inr(e.walletBalance)}
              sub="Revenue minus paid out"
              valueColor="#059669"
            />
            <StatTile
              label="Our Earnings"
              value={inr(Math.max(0, e.ourEarnings))}
              sub="Revenue minus product cost"
              valueColor="#4361EE"
            />
            <StatTile
              label="Upcoming"
              value={inr(e.upcoming)}
              sub="Dispatched, not delivered yet"
              valueColor="#F59E0B"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="Paid Out"
              value={inr(e.paid)}
              sub="Total remittances received"
              valueColor="#7C3AED"
            />
            <StatTile
              label="Product Costs"
              value={inr(e.productCosts)}
              sub={e.productCosts === 0 ? "Add cost price to products" : "From delivered orders"}
              valueColor={e.productCosts === 0 ? "#9CA3AF" : "#EF4444"}
            />
          </div>

          {/* Earnings bar chart */}
          {plData.some(d => d.v > 0) && (
            <div>
              <SubLabel>Earnings Breakdown</SubLabel>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={plData} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={kInr} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [inr(Number(v))]} />
                  <Bar dataKey="v" radius={[3, 3, 0, 0]} maxBarSize={40}>
                    {plData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* P&L line items */}
          <div className="border-t border-[#F3F4F6] pt-4 space-y-0">
            {[
              { label: "Delivered Revenue",         value: e.deliveredRevenue, sign: "+", color: "#4361EE" },
              { label: "− Product Costs",           value: e.productCosts,     sign: "−", color: "#EF4444", dim: e.productCosts === 0 },
              { label: "= Our Earnings (gross)",    value: Math.max(0, e.ourEarnings), sign: "=", color: e.ourEarnings >= 0 ? "#059669" : "#EF4444", bold: true },
              { label: "Paid Out (Remittances)",    value: e.paid,             sign: "−", color: "#7C3AED" },
              { label: "= Wallet Balance",          value: e.walletBalance,    sign: "=", color: "#059669", bold: true },
              { label: "Upcoming (Dispatched)",     value: e.upcoming,         sign: "+", color: "#F59E0B" },
            ].map((row, i) => (
              <div key={i} className={`flex items-center justify-between py-2.5 border-b border-[#F9FAFB] ${row.bold ? "bg-[#FAFBFF]" : ""}`}>
                <p className={`text-[13px] ${row.bold ? "font-black text-[#0C1220]" : "text-[#6B7280]"}`}>{row.label}</p>
                {row.dim ? (
                  <p className="text-[12px] text-[#D1D5DB]">not tracked</p>
                ) : (
                  <p className={`text-[13px] ${row.bold ? "font-black" : "font-bold"}`} style={{ color: row.color }}>
                    {row.sign}{inr(row.value)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 4. STATE-WISE DATA                                                      */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {states.length > 0 && (
        <SectionCard title="State-wise Orders" sub="Delivered vs RTO by state · excludes cancelled">

          {/* Summary tiles */}
          {(() => {
            const topVol   = states[0];
            const highRto  = [...states].sort((a, b) => b.rtoPct - a.rtoPct)[0];
            const bestDel  = [...states].filter(s => s.total >= 3).sort((a, b) => b.deliveryPct - a.deliveryPct)[0];
            const totalSh  = states.reduce((s, r) => s + r.total, 0);
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatTile label="Total Shipments"    value={num(totalSh)}         sub={`${states.length} states`} />
                <StatTile label="Top State"          value={topVol?.state ?? "—"} sub={`${num(topVol?.total ?? 0)} orders`}   valueColor="#4361EE" />
                <StatTile label="Highest RTO State"  value={highRto?.state ?? "—"} sub={`${highRto?.rtoPct ?? 0}% RTO`}      valueColor="#EF4444" />
                <StatTile label="Best Delivery"      value={bestDel?.state ?? "—"} sub={bestDel ? `${bestDel.deliveryPct}% delivery` : "—"} valueColor="#059669" />
              </div>
            );
          })()}

          {/* State bar chart */}
          {stateChart.length > 0 && (
            <div>
              <SubLabel>Top 10 States — Delivered vs RTO</SubLabel>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stateChart} barGap={0} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="state" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="Delivered" stackId="s" fill="#4361EE" maxBarSize={28} />
                  <Bar dataKey="RTO"       stackId="s" fill="#EF4444" radius={[3, 3, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2">
                {[["#4361EE", "Delivered"], ["#EF4444", "RTO"]].map(([c, l]) => (
                  <span key={l} className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: c }} />{l}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* State table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F3F4F6]">
                  {["State", "Orders", "Delivered", "RTO", "Delivery %"].map(h => (
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
                {states.map((row, i) => (
                  <tr key={i} className="hover:bg-[#FAFBFF]">
                    <td className="px-2 py-2.5 text-[13px] font-medium text-[#0C1220]">{row.state}</td>
                    <td className="px-2 py-2.5 text-[13px] font-semibold text-[#374151] text-right">{row.total}</td>
                    <td className="px-2 py-2.5 text-[13px] text-[#059669] text-right">{row.delivered}</td>
                    <td className="px-2 py-2.5 text-[13px] text-[#EF4444] text-right">{row.rto}</td>
                    <td className="px-2 py-2.5 text-right">
                      <span className="text-[12px] font-bold" style={{
                        color: row.deliveryPct >= 70 ? "#059669" : row.deliveryPct >= 40 ? "#D97706" : "#EF4444",
                      }}>
                        {row.deliveryPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* ── Empty state ── */}
      {!loading && states.length === 0 && o?.total === 0 && (
        <div className="bg-white rounded-xl border border-[#E8EDF6] p-10 text-center">
          <p className="text-[14px] font-semibold text-[#9CA3AF]">No orders yet</p>
          <p className="text-[12px] text-[#C4C9D4] mt-1">State data will appear once orders are assigned to you.</p>
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}
