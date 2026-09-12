"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import {
  RefreshCw, MousePointer, ChevronDown, ChevronUp, Megaphone, AlertCircle, Wallet,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface Campaign {
  campaignId: string | null;
  campaignName: string;
  totalSpend: number;
  totalClicks: number;
  orderCount: number;
  deliveredCount: number;
  revenue: number;
  allRevenue: number;
  rtoCount: number;
  roas: number | null;
  cpc: number | null;
  cpr: number | null;
  roi: number | null;
  products: { name: string; quantity: number; revenue: number }[];
}

interface Summary {
  totalSpend: number;
  totalRevenue: number;
  totalOrders: number;
  totalDelivered: number;
  totalClicks: number;
  overallRoas: number | null;
  overallCpc: number | null;
  overallCpr: number | null;
  overallRoi: number | null;
  totalRecharged: number;
  rechargeBalance: number;
}

interface AdEntry {
  campaignName: string | null;
  amount: number;
  date: string;
  clicks: number | null;
  impressions: number | null;
}

interface Recharge { amount: number; date: string; note: string | null; }

// ── Helpers ────────────────────────────────────────────────────────────────
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const num = (n: number) => Math.round(n).toLocaleString("en-IN");
// Show "—" for null OR zero (zero ROAS/ROI means no attribution, not 0x)
const showRoas = (n: number | null) => (n !== null && n > 0) ? `${n}x` : "—";
const showPct  = (n: number | null) => (n !== null) ? `${n}%` : "—";
const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

const TOOLTIP_STYLE = {
  contentStyle: { fontSize: 12, border: "1px solid #E8EDF6", borderRadius: 8, boxShadow: "none" },
  cursor: { fill: "rgba(67,97,238,0.04)" },
};

const DATE_PRESETS = [
  { label: "7 days",  days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function MetaAdsPage() {
  const [campaigns,    setCampaigns]    = useState<Campaign[]>([]);
  const [summary,      setSummary]      = useState<Summary | null>(null);
  const [entries,      setEntries]      = useState<AdEntry[]>([]);
  const [recharges,    setRecharges]    = useState<Recharge[]>([]);
  const [connected,    setConnected]    = useState<boolean | null>(null);
  const [storeRevenue, setStoreRevenue] = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [days,         setDays]         = useState(30);
  const [expanded,     setExpanded]     = useState<string | null>(null);
  const [showRecharge, setShowRecharge] = useState(false);

  async function load(d = days) {
    setLoading(true);
    const from = daysAgo(d);
    const to   = new Date().toISOString().split("T")[0];
    const [attrRes, spendRes] = await Promise.all([
      fetch(`/api/seller/ad-spend/attribution?from=${from}&to=${to}`),
      fetch(`/api/seller/ad-spend?from=${from}&to=${to}`),
    ]);
    const attr  = await attrRes.json();
    const spend = await spendRes.json();
    setCampaigns(attr.campaigns      ?? []);
    setSummary(attr.summary          ?? null);
    setRecharges(attr.recharges      ?? []);
    setEntries(spend.entries         ?? []);
    setConnected(spend.metaConnected ?? false);
    setStoreRevenue(spend.last30DaysRevenue ?? 0);
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function changeRange(d: number) { setDays(d); load(d); }

  // ── Blended metrics (store revenue vs ad spend) ────────────────────────
  // last30DaysRevenue = ALL non-cancelled/RTO orders in period (not just attributed)
  const blendedRoas = summary && summary.totalSpend > 0 && storeRevenue > 0
    ? Math.round((storeRevenue / summary.totalSpend) * 100) / 100
    : null;
  const blendedRoi = summary && summary.totalSpend > 0
    ? Math.round(((storeRevenue - summary.totalSpend) / summary.totalSpend) * 10000) / 100
    : null;

  // ── Daily spend chart ──────────────────────────────────────────────────
  const spendChart = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      const day = e.date.split("T")[0];
      map.set(day, (map.get(day) ?? 0) + e.amount);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, spend]) => ({ day: fmt(date), Spend: Math.round(spend) }));
  }, [entries]);

  // ── Campaign spend chart ───────────────────────────────────────────────
  const campaignChart = campaigns.slice(0, 6).map(c => ({
    name:    c.campaignName.length > 14 ? c.campaignName.slice(0, 14) + "…" : c.campaignName,
    Spend:   Math.round(c.totalSpend),
    Revenue: Math.round(c.allRevenue),
  }));

  const hasAttribution = (summary?.totalOrders ?? 0) > 0;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6 md:p-8 space-y-5" style={{ background: "#F7F8FC", minHeight: "100vh" }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[18px] font-black text-[#0C1220]">Meta Ads</h1>
          <p className="text-[12px] text-[#9CA3AF] mt-0.5">Ad spend, campaign performance and attribution</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {connected !== null && (
            <span
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border"
              style={connected
                ? { background: "#ECFDF5", color: "#059669", borderColor: "#BBF7D0" }
                : { background: "#FEF2F2", color: "#EF4444", borderColor: "#FECACA" }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: connected ? "#059669" : "#EF4444" }} />
              {connected ? "Meta Connected" : "Meta Not Connected"}
            </span>
          )}
          <div className="flex items-center bg-white border border-[#E8EDF6] rounded-lg overflow-hidden">
            {DATE_PRESETS.map(p => (
              <button
                key={p.days}
                onClick={() => changeRange(p.days)}
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
            onClick={() => load()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-white border border-[#E8EDF6] text-[#6B7280] hover:text-[#0C1220] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-[#E8EDF6] h-32 animate-pulse" />
          ))}
        </div>
      ) : !summary ? (
        <div className="bg-white rounded-xl border border-[#E8EDF6] p-12 flex flex-col items-center gap-3">
          <Megaphone className="w-10 h-10 text-[#E8EDF6]" />
          <p className="text-[14px] font-semibold text-[#9CA3AF]">No ad spend data found for this period</p>
        </div>
      ) : (
        <>
          {/* ── Summary stat tiles ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              {
                label: "Total Spend",
                value: inr(summary.totalSpend),
                color: "#EF4444",
                sub: `${days}-day period`,
              },
              {
                label: "Store Revenue",
                value: inr(storeRevenue),
                color: "#059669",
                sub: "All non-cancelled orders",
              },
              {
                label: "Blended ROAS",
                value: blendedRoas !== null ? `${blendedRoas}x` : "—",
                color: blendedRoas !== null && blendedRoas >= 2 ? "#059669" : "#D97706",
                sub: "Revenue ÷ ad spend",
              },
              {
                label: "Blended ROI",
                value: blendedRoi !== null ? showPct(blendedRoi) : "—",
                color: blendedRoi !== null && blendedRoi >= 0 ? "#059669" : "#EF4444",
                sub: "(Revenue − Spend) ÷ Spend",
              },
              {
                label: "Attributed Orders",
                value: num(summary.totalOrders),
                color: "#4361EE",
                sub: hasAttribution ? `${summary.totalDelivered} delivered` : "Add UTM tags to track",
              },
              {
                label: "Total Clicks",
                value: num(summary.totalClicks),
                color: "#7C3AED",
                sub: summary.overallCpc !== null ? `${inr(summary.overallCpc)} avg CPC` : "CPC unavailable",
              },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-xl border border-[#E8EDF6] px-4 py-3.5">
                <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide mb-1">{card.label}</p>
                <p className="text-[20px] font-black leading-none" style={{ color: card.color }}>{card.value}</p>
                <p className="text-[11px] text-[#9CA3AF] mt-0.5">{card.sub}</p>
              </div>
            ))}
          </div>

          {/* ── UTM attribution notice ── */}
          {!hasAttribution && summary.totalSpend > 0 && (
            <div className="flex items-start gap-3 bg-[#FFFBEB] border border-[#FEF3C7] rounded-xl px-4 py-3.5">
              <AlertCircle className="w-4 h-4 text-[#D97706] flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-[#92400E]">
                <strong>No campaign attribution found.</strong> The Revenue and ROAS shown above are blended (all store orders vs. ad spend). For per-campaign attribution, add UTM parameters to your Meta Ads — AXQEN matches orders by the <code className="bg-[#FEF3C7] px-1 rounded">utm_campaign</code> parameter.
              </p>
            </div>
          )}

          {/* ── Wallet row ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-[#E8EDF6] px-5 py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center flex-shrink-0">
                <Wallet className="w-5 h-5 text-[#4361EE]" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide">Meta Wallet Balance</p>
                <p className="text-[20px] font-black" style={{ color: summary.rechargeBalance >= 0 ? "#059669" : "#EF4444" }}>
                  {inr(Math.abs(summary.rechargeBalance))}
                  <span className="text-[12px] font-semibold text-[#9CA3AF] ml-1.5">
                    {summary.rechargeBalance >= 0 ? "remaining" : "overspent"}
                  </span>
                </p>
                <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                  {inr(summary.totalRecharged)} recharged · {inr(summary.totalSpend)} spent
                </p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[#E8EDF6] px-5 py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] flex items-center justify-center flex-shrink-0">
                <MousePointer className="w-5 h-5 text-[#059669]" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide">Total Clicks</p>
                <p className="text-[20px] font-black text-[#059669]">{num(summary.totalClicks)}</p>
                <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                  {summary.overallCpc !== null ? `${inr(summary.overallCpc)} avg CPC` : "CPC data unavailable"}
                </p>
              </div>
            </div>
          </div>

          {/* ── Daily spend chart ── */}
          {spendChart.length > 0 && (
            <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F3F4F6]">
                <h2 className="text-[15px] font-bold text-[#0C1220]">Daily Ad Spend</h2>
                <p className="text-[12px] text-[#9CA3AF] mt-0.5">Last {days} days</p>
              </div>
              <div className="p-5">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={spendChart} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false}
                      tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [inr(Number(v)), "Spend"]} />
                    <Bar dataKey="Spend" fill="#4361EE" radius={[3,3,0,0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Campaign spend vs revenue chart ── */}
          {campaignChart.length > 0 && campaignChart.some(c => c.Revenue > 0) && (
            <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F3F4F6]">
                <h2 className="text-[15px] font-bold text-[#0C1220]">Spend vs Attributed Revenue by Campaign</h2>
                <p className="text-[12px] text-[#9CA3AF] mt-0.5">Top {campaignChart.length} campaigns</p>
              </div>
              <div className="p-5">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={campaignChart} barGap={3} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false}
                      tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [inr(Number(v))]} />
                    <Bar dataKey="Spend"   fill="#EF4444" radius={[3,3,0,0]} maxBarSize={22} />
                    <Bar dataKey="Revenue" fill="#059669" radius={[3,3,0,0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-2">
                  {[["#EF4444","Spend"],["#059669","Revenue"]].map(([c,l]) => (
                    <span key={l} className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />{l}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Campaign performance table ── */}
          {campaigns.length > 0 && (
            <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F3F4F6]">
                <h2 className="text-[15px] font-bold text-[#0C1220]">Campaign Performance</h2>
                <p className="text-[12px] text-[#9CA3AF] mt-0.5">
                  {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} · {hasAttribution ? "click to see product breakdown" : "attribution via UTM tags"}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#F3F4F6]" style={{ background: "#FAFBFF" }}>
                      {["CAMPAIGN","SPEND","ORDERS","DELIVERED","REVENUE","ROAS","CPR","ROI",""].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c, i) => {
                      const isOpen   = expanded === (c.campaignId ?? c.campaignName);
                      const hasOrds  = c.orderCount > 0;
                      // treat roas=0 as no attribution
                      const roasGood = c.roas !== null && c.roas > 0 && c.roas >= 2;
                      const roiGood  = c.roi !== null && c.roi >= 0 && hasOrds;
                      return (
                        <>
                          <tr
                            key={c.campaignId ?? c.campaignName}
                            className="hover:bg-[#FAFBFF] cursor-pointer transition-colors"
                            style={{
                              borderBottom: isOpen ? "none" : "1px solid #F9FAFB",
                              background: isOpen ? "rgba(67,97,238,0.02)" : undefined,
                            }}
                            onClick={() => setExpanded(prev =>
                              prev === (c.campaignId ?? c.campaignName) ? null : (c.campaignId ?? c.campaignName)
                            )}
                          >
                            <td className="px-4 py-3.5 max-w-[200px]">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                                  style={{ background: ["#4361EE","#7C3AED","#059669","#D97706","#EF4444","#0369A1"][i % 6] }}>
                                  {i + 1}
                                </div>
                                <p className="text-[13px] font-semibold text-[#0C1220] truncate">{c.campaignName}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="text-[13px] font-bold text-[#EF4444]">{inr(c.totalSpend)}</p>
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="text-[13px] font-semibold text-[#374151]">{c.orderCount > 0 ? c.orderCount : "—"}</p>
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="text-[13px] font-semibold text-[#059669]">{c.deliveredCount > 0 ? c.deliveredCount : "—"}</p>
                              {c.rtoCount > 0 && <p className="text-[11px] text-[#EF4444]">{c.rtoCount} RTO</p>}
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="text-[13px] font-bold" style={{ color: c.allRevenue > 0 ? "#059669" : "#9CA3AF" }}>
                                {c.allRevenue > 0 ? inr(c.allRevenue) : "—"}
                              </p>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="text-[13px] font-bold" style={{ color: roasGood ? "#059669" : "#9CA3AF" }}>
                                {showRoas(hasOrds && c.roas !== null ? c.roas : null)}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="text-[13px] font-medium text-[#374151]">
                                {c.cpr !== null && c.orderCount > 0 ? inr(c.cpr) : "—"}
                              </p>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="text-[13px] font-bold" style={{ color: roiGood ? "#059669" : "#9CA3AF" }}>
                                {hasOrds && c.roi !== null ? showPct(c.roi) : "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              {isOpen
                                ? <ChevronUp className="w-4 h-4 text-[#9CA3AF]" />
                                : <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />}
                            </td>
                          </tr>

                          {isOpen && (
                            <tr key={`${c.campaignId}-exp`} style={{ borderBottom: "1px solid #F3F4F6", background: "rgba(67,97,238,0.015)" }}>
                              <td colSpan={9} className="px-5 pb-5 pt-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                  <div className="space-y-3">
                                    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide">Campaign Metrics</p>
                                    <div className="grid grid-cols-2 gap-3">
                                      {[
                                        { label: "Total Clicks",  value: num(c.totalClicks), color: "#4361EE" },
                                        { label: "CPC",           value: c.cpc !== null && c.totalClicks > 0 ? inr(c.cpc) : "—", color: "#6B7280" },
                                        { label: "ROAS",          value: showRoas(hasOrds ? c.roas : null), color: roasGood ? "#059669" : "#9CA3AF" },
                                        { label: "ROI",           value: hasOrds && c.roi !== null ? showPct(c.roi) : "—", color: roiGood ? "#059669" : "#9CA3AF" },
                                        { label: "Delivered",     value: c.deliveredCount > 0 ? `${c.deliveredCount} orders` : "—", color: "#059669" },
                                        { label: "RTO",           value: c.rtoCount > 0 ? `${c.rtoCount} orders` : "—", color: "#EF4444" },
                                      ].map(m => (
                                        <div key={m.label} className="bg-[#FAFBFF] rounded-lg border border-[#E8EDF6] px-3 py-2.5">
                                          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide">{m.label}</p>
                                          <p className="text-[15px] font-black mt-0.5" style={{ color: m.color }}>{m.value}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  {c.products.length > 0 && (
                                    <div className="space-y-3">
                                      <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide">Products Sold via This Campaign</p>
                                      <div className="space-y-2">
                                        {c.products.slice(0, 6).map(p => {
                                          const share = c.revenue > 0 ? Math.round((p.revenue / c.revenue) * 100) : 0;
                                          return (
                                            <div key={p.name}>
                                              <div className="flex items-center justify-between mb-1">
                                                <p className="text-[12px] font-medium text-[#374151] truncate max-w-[200px]">{p.name}</p>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                  <span className="text-[11px] text-[#9CA3AF]">{p.quantity} units</span>
                                                  <span className="text-[12px] font-bold text-[#059669]">{inr(p.revenue)}</span>
                                                </div>
                                              </div>
                                              <div className="h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                                                <div className="h-full rounded-full bg-[#4361EE]" style={{ width: `${share}%` }} />
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary totals row */}
              <div className="border-t border-[#F3F4F6] bg-[#FAFBFF] px-4 py-3 flex flex-wrap items-center gap-4">
                <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide">Totals</span>
                <span className="text-[13px] font-bold text-[#EF4444]">Spend: {inr(summary.totalSpend)}</span>
                <span className="text-[13px] font-bold text-[#059669]">Store Revenue: {inr(storeRevenue)}</span>
                {hasAttribution && <span className="text-[13px] font-bold text-[#374151]">Attr. Orders: {summary.totalOrders}</span>}
                <span className="text-[13px] font-bold" style={{ color: blendedRoas && blendedRoas >= 2 ? "#059669" : "#D97706" }}>
                  ROAS: {blendedRoas !== null ? `${blendedRoas}x` : "—"}
                </span>
                <span className="text-[13px] font-bold" style={{ color: blendedRoi && blendedRoi >= 0 ? "#059669" : "#EF4444" }}>
                  ROI: {blendedRoi !== null ? showPct(blendedRoi) : "—"}
                </span>
              </div>
            </div>
          )}

          {campaigns.length === 0 && (
            <div className="bg-white rounded-xl border border-[#E8EDF6] p-8 flex flex-col items-center gap-3">
              <AlertCircle className="w-8 h-8 text-[#E8EDF6]" />
              <p className="text-[13px] font-semibold text-[#9CA3AF]">No campaign data for this period</p>
            </div>
          )}

          {/* ── Recharge history ── */}
          {recharges.length > 0 && (
            <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
              <button
                onClick={() => setShowRecharge(p => !p)}
                className="w-full flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6] hover:bg-[#FAFBFF] transition-colors"
              >
                <div className="text-left">
                  <h2 className="text-[15px] font-bold text-[#0C1220]">Wallet Recharges</h2>
                  <p className="text-[12px] text-[#9CA3AF] mt-0.5">
                    {recharges.length} recharge{recharges.length !== 1 ? "s" : ""} · {inr(summary.totalRecharged)} total
                  </p>
                </div>
                {showRecharge
                  ? <ChevronUp className="w-4 h-4 text-[#9CA3AF]" />
                  : <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />}
              </button>
              {showRecharge && (
                <div className="divide-y divide-[#F9FAFB]">
                  {[...recharges]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((r, i) => (
                      <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-[#FAFBFF]">
                        <div>
                          <p className="text-[13px] font-semibold text-[#0C1220]">{inr(r.amount)}</p>
                          {r.note && <p className="text-[11px] text-[#9CA3AF]">{r.note}</p>}
                        </div>
                        <p className="text-[12px] text-[#9CA3AF]">
                          {new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
