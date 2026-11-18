"use client";

import { Fragment, useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import {
  RefreshCw, ChevronDown, ChevronUp, Megaphone, AlertCircle, Wallet, MessageCircle,
} from "lucide-react";
import { WA_LINK } from "@/components/landing/constants";

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
  deliveredRoas: number | null;
  rtoPct: number | null;
  costPerDelivered: number | null;
  profitAfterAds: number;
  costsMissing: number;
  verdict: "SCALE" | "WATCH" | "LOSING" | "LEARNING" | null;
}

interface StoreStats {
  orders: number; taggedOrders: number; delivered: number; rto: number; inTransit: number;
  deliveredRevenue: number; deliveredRoas: number | null; costPerDelivered: number | null;
  profitAfterAds: number; costsMissing: number;
}
interface AdWallet { recharged: number; spent: number; balance: number; dailyBurn: number; daysLeft: number | null }

const VERDICT: Record<string, { label: string; bg: string; color: string; hint: string }> = {
  SCALE:    { label: "Scale",        bg: "#ECFDF5", color: "#047857", hint: "Profitable after ads and RTO" },
  WATCH:    { label: "Watch RTO",    bg: "#FFFBEB", color: "#B45309", hint: "Profitable, but 30% or more of orders return" },
  LOSING:   { label: "Losing money", bg: "#FEF2F2", color: "#DC2626", hint: "Spend plus costs exceed delivered revenue" },
  LEARNING: { label: "Too early",    bg: "#F3F4F6", color: "#6B7280", hint: "Fewer than 3 completed orders" },
};

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
const axisInr = (v: number) => v >= 1000 ? `₹${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `₹${Math.round(v)}`;
const money = (n: number) => `${n < 0 ? "−" : ""}${inr(Math.abs(n))}`;
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
  const [store,        setStore]        = useState<StoreStats | null>(null);
  const [adWallet,     setAdWallet]     = useState<AdWallet | null>(null);
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
    setStore(attr.store              ?? null);
    setAdWallet(attr.wallet          ?? null);
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
    Revenue: Math.round(c.revenue),
  }));

  const hasAttribution = (summary?.totalOrders ?? 0) > 0;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="px-3 py-4 md:p-8 space-y-5" style={{ background: "#F7F8FC", minHeight: "100vh" }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[18px] font-black text-[#0C1220]">Meta Ads</h1>
          <p className="text-[12px] text-[#9CA3AF] mt-0.5">Your Meta ads are run by the AXQEN team. See what you spent, what it delivered, and what it earned after returns.</p>
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
              {connected ? "Meta connected" : "Ad account not linked yet"}
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
          {/* ── Summary tiles (COD-true: delivered orders only, RTO costs counted) ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Ad spend", value: inr(summary.totalSpend), color: "#0C1220", sub: `Last ${days} days` },
              {
                label: "Delivered ROAS",
                value: store?.deliveredRoas != null && store.deliveredRoas > 0 ? `${store.deliveredRoas}x` : "—",
                color: store?.deliveredRoas != null && store.deliveredRoas >= 2 ? "#047857" : "#B45309",
                sub: store ? `${inr(store.deliveredRevenue)} delivered ÷ spend` : "",
              },
              {
                label: "Cost per delivered order",
                value: store?.costPerDelivered != null ? inr(store.costPerDelivered) : "—",
                color: "#0C1220",
                sub: store ? `${num(store.delivered)} delivered · ${num(store.rto)} RTO` : "",
              },
              {
                label: "Profit after ads",
                value: store ? (store.costsMissing ? `≈ ${money(store.profitAfterAds)}` : money(store.profitAfterAds)) : "—",
                color: store?.costsMissing ? "#B45309" : store && store.profitAfterAds >= 0 ? "#047857" : "#DC2626",
                sub: store?.costsMissing ? `Incomplete: costs not entered on ${store.costsMissing} orders` : "Delivered − costs − RTO − ads",
              },
              {
                label: "Orders tracked",
                value: store && store.orders > 0 ? `${Math.round((store.taggedOrders / store.orders) * 100)}%` : "—",
                color: store && store.orders > 0 && store.taggedOrders / store.orders >= 0.7 ? "#047857" : "#B45309",
                sub: store ? `${num(store.taggedOrders)} of ${num(store.orders)} have a campaign tag` : "",
              },
              {
                label: "Ad wallet",
                value: adWallet ? (adWallet.recharged === 0 ? "—" : money(adWallet.balance)) : "—",
                color: adWallet && adWallet.recharged === 0 ? "#9CA3AF" : adWallet && adWallet.balance > 0 && (adWallet.daysLeft ?? 99) > 3 ? "#047857" : "#DC2626",
                sub: adWallet
                  ? adWallet.recharged === 0 ? "No recharges recorded yet"
                  : adWallet.balance <= 0 ? "Recharge to keep ads running"
                    : adWallet.daysLeft != null ? `About ${adWallet.daysLeft} day${adWallet.daysLeft === 1 ? "" : "s"} left`
                    : "No spend in the last 7 days"
                  : "",
              },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-xl border border-[#E8EDF6] px-4 py-3.5">
                <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide mb-1">{card.label}</p>
                <p className="text-[20px] font-black leading-none tabular-nums" style={{ color: card.color }}>{card.value}</p>
                <p className="text-[11px] text-[#9CA3AF] mt-1">{card.sub}</p>
              </div>
            ))}
          </div>
          {store && store.inTransit > 0 && (
            <p className="text-[11.5px] text-[#9CA3AF] -mt-2">
              {num(store.inTransit)} orders from this period are not delivered yet, so Delivered ROAS and profit will rise as they arrive. Longer ranges give a truer picture.
            </p>
          )}

          {/* ── UTM attribution notice ── */}
          {!hasAttribution && summary.totalSpend > 0 && (
            <div className="flex items-start gap-3 bg-[#FFFBEB] border border-[#FEF3C7] rounded-xl px-4 py-3.5">
              <AlertCircle className="w-4 h-4 text-[#D97706] flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-[#92400E]">
                <strong>No orders are linked to a campaign yet.</strong> The tiles above compare all delivered orders with total ad spend. To see results per campaign, the ads need campaign tags: in Meta Ads Manager, open each ad and set <b>URL parameters</b> to <code className="bg-[#FEF3C7] px-1 rounded">utm_source=facebook&amp;utm_medium=paid&amp;utm_campaign={"{{campaign.name}}"}</code>. New orders are matched automatically.
              </p>
            </div>
          )}

          {/* ── Ad wallet ── */}
          {adWallet && (
            <div className="bg-white rounded-xl border px-5 py-4 flex items-center gap-4 flex-wrap"
              style={{ borderColor: adWallet.recharged > 0 && (adWallet.balance <= 0 || (adWallet.daysLeft ?? 99) <= 3) ? "#FECACA" : "#E8EDF6" }}>
              <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center flex-shrink-0">
                <Wallet className="w-5 h-5 text-[#4361EE]" />
              </div>
              <div className="flex-1 min-w-[220px]">
                <p className="text-[13px] font-bold text-[#0C1220]">
                  {adWallet.recharged === 0 ? `Ad wallet: ${inr(adWallet.spent)} spent, no recharges recorded yet` : `Ad wallet: ${money(adWallet.balance)} ${adWallet.balance < 0 ? "overspent" : "left"}`}
                </p>
                <p className="text-[12px] text-[#6B7280] mt-0.5">
                  {inr(adWallet.recharged)} recharged · {inr(adWallet.spent)} spent by the AXQEN ads team
                  {adWallet.dailyBurn > 0 && <> · spending about {inr(adWallet.dailyBurn)} a day</>}
                </p>
                {adWallet.recharged === 0 && (
                  <p className="text-[12px] text-[#6B7280] mt-1">Your recharges appear here once the AXQEN team records them.</p>
                )}
                {adWallet.recharged > 0 && (adWallet.balance <= 0 || (adWallet.daysLeft ?? 99) <= 3) && (
                  <p className="text-[12px] font-semibold text-[#DC2626] mt-1">
                    {adWallet.balance <= 0
                      ? "Your ad wallet is empty. Ads may pause until you recharge."
                      : `Only about ${adWallet.daysLeft} day${adWallet.daysLeft === 1 ? "" : "s"} of ads left. Recharge soon to avoid a pause.`}
                  </p>
                )}
              </div>
              <a href={`${WA_LINK}?text=${encodeURIComponent("Hi AXQEN team, I want to recharge my ad wallet.")}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold text-white bg-[#16A34A]">
                <MessageCircle className="w-4 h-4" /> Recharge
              </a>
            </div>
          )}

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
                      tickFormatter={axisInr} />
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
                <h2 className="text-[15px] font-bold text-[#0C1220]">Spend vs Delivered Revenue by Campaign</h2>
                <p className="text-[12px] text-[#9CA3AF] mt-0.5">Top {campaignChart.length} campaigns</p>
              </div>
              <div className="p-5">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={campaignChart} barGap={3} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false}
                      tickFormatter={axisInr} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [inr(Number(v))]} />
                    <Bar dataKey="Spend"   fill="#EF4444" radius={[3,3,0,0]} maxBarSize={22} />
                    <Bar dataKey="Revenue" fill="#059669" radius={[3,3,0,0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-2">
                  {[["#EF4444","Spend"],["#059669","Delivered revenue"]].map(([c,l]) => (
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
                      {["CAMPAIGN","SPEND","ORDERS","DELIVERED","DELIVERED REVENUE","DELIVERED ROAS","COST / DELIVERED","PROFIT AFTER ADS","STATUS",""].map(h => (
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
                        <Fragment key={c.campaignId ?? c.campaignName}>
                          <tr
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
                              {c.rtoCount > 0 && <p className="text-[11px] text-[#EF4444]">{c.rtoCount} RTO{c.rtoPct != null ? ` · ${c.rtoPct}%` : ""}</p>}
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="text-[13px] font-bold" style={{ color: c.revenue > 0 ? "#059669" : "#9CA3AF" }}>
                                {c.revenue > 0 ? inr(c.revenue) : "—"}
                              </p>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="text-[13px] font-bold" style={{ color: c.deliveredRoas != null && c.deliveredRoas >= 2 ? "#059669" : "#9CA3AF" }}>
                                {showRoas(c.deliveredRoas)}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="text-[13px] font-medium text-[#374151]">
                                {c.costPerDelivered != null ? inr(c.costPerDelivered) : "—"}
                              </p>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="text-[13px] font-bold tabular-nums" style={{ color: !hasOrds ? "#9CA3AF" : c.profitAfterAds >= 0 ? "#059669" : "#DC2626" }}>
                                {hasOrds ? money(c.profitAfterAds) : "—"}
                              </span>
                              {c.costsMissing > 0 && <p className="text-[10.5px] text-[#9CA3AF]">costs missing on {c.costsMissing}</p>}
                            </td>
                            <td className="px-4 py-3.5">
                              {c.verdict && (
                                <span title={VERDICT[c.verdict].hint} className="px-2 py-1 rounded-full text-[11px] font-bold whitespace-nowrap"
                                  style={{ background: VERDICT[c.verdict].bg, color: VERDICT[c.verdict].color }}>
                                  {VERDICT[c.verdict].label}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              {isOpen
                                ? <ChevronUp className="w-4 h-4 text-[#9CA3AF]" />
                                : <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />}
                            </td>
                          </tr>

                          {isOpen && (
                            <tr style={{ borderBottom: "1px solid #F3F4F6", background: "rgba(67,97,238,0.015)" }}>
                              <td colSpan={10} className="px-5 pb-5 pt-3">
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
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary totals row */}
              <div className="border-t border-[#F3F4F6] bg-[#FAFBFF] px-4 py-3 flex flex-wrap items-center gap-4">
                <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide">Totals</span>
                <span className="text-[13px] font-bold text-[#EF4444]">Spend: {inr(summary.totalSpend)}</span>
                <span className="text-[13px] font-bold text-[#059669]">Delivered revenue: {inr(store?.deliveredRevenue ?? 0)}</span>
                {hasAttribution && <span className="text-[13px] font-bold text-[#374151]">Attr. Orders: {summary.totalOrders}</span>}
                <span className="text-[13px] font-bold" style={{ color: store?.deliveredRoas && store.deliveredRoas >= 2 ? "#059669" : "#D97706" }}>
                  Delivered ROAS: {store?.deliveredRoas ? `${store.deliveredRoas}x` : "—"}
                </span>
                <span className="text-[13px] font-bold" style={{ color: store && store.profitAfterAds >= 0 ? "#059669" : "#EF4444" }}>
                  Profit after ads: {store ? money(store.profitAfterAds) : "—"}
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
