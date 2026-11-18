"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine,
} from "recharts";
import { RefreshCw, AlertTriangle, Loader2, ArrowUpDown, Info } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface Summary {
  orders: number; delivered: number; rto: number; cancelled: number; inTransit: number; inTransitValue: number;
  revenue: number; productCost: number; shipping: number; packing: number; platformFee: number; rtoLoss: number; adSpend: number;
  costsMissing: number; platformFeePerOrder: number;
  netProfit: number; margin: number | null; profitPerDelivered: number | null; rtoPct: number | null;
}
interface MonthRow { month: string; delivered: number; rto: number; revenue: number; costs: number; rtoLoss: number; ads: number; net: number; costsMissing: number }
interface Row { label: string; delivered: number; rto: number; units: number; revenue: number; costs: number; rtoLoss: number; profit: number; margin: number | null; rtoPct: number | null; costsMissing: number }
interface ProfitData { summary: Summary; byMonth: MonthRow[]; byProduct: Row[]; byState: Row[] }

const RANGES = [{ k: "30", l: "30 days" }, { k: "90", l: "90 days" }, { k: "180", l: "6 months" }, { k: "365", l: "12 months" }, { k: "all", l: "All time" }];
const GOOD = "#047857", BAD = "#DC2626";

const inr = (n: number) => (n < 0 ? "−₹" : "₹") + Math.abs(Math.round(n)).toLocaleString("en-IN");
const num = (n: number) => Math.round(n).toLocaleString("en-IN");
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
const axisInr = (v: number) => {
  const a = Math.abs(v), sign = v < 0 ? "−" : "";
  if (a >= 100000) return `${sign}₹${(a / 100000).toFixed(a % 100000 === 0 ? 0 : 1)}L`;
  if (a >= 1000) return `${sign}₹${(a / 1000).toFixed(a % 1000 === 0 ? 0 : 1)}k`;
  return `${sign}₹${a}`;
};

export default function ProfitAnalyticsPage() {
  const [range, setRange] = useState("90");
  const [data, setData] = useState<ProfitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/seller/profit${range === "all" ? "" : `?days=${range}`}`)
      .then(r => r.json()).then(d => setData(d.summary ? d : null)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [range, key]);

  const s = data?.summary;

  return (
    <div className="px-3 py-4 md:p-8 space-y-5" style={{ background: "#F7F8FC", minHeight: "100vh" }}>
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Insights</p>
          <h1 className="text-[22px] font-black text-[#0C1220] mt-0.5">Profit &amp; Analytics</h1>
          <p className="text-[12.5px] text-[#6B7280] mt-1 max-w-[70ch]">What you actually earned: delivered orders only, with returns counted as a loss and ads and fees deducted.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white border border-[#E8EDF6] rounded-lg p-0.5">
            {RANGES.map(r => (
              <button key={r.k} onClick={() => setRange(r.k)} className="px-2.5 py-1.5 text-[12px] font-semibold rounded-md"
                style={{ background: range === r.k ? "#4361EE" : "transparent", color: range === r.k ? "white" : "#6B7280" }}>{r.l}</button>
            ))}
          </div>
          <button onClick={() => setKey(k => k + 1)} aria-label="Refresh" className="p-2 rounded-lg bg-white border border-[#E8EDF6] text-[#6B7280] hover:text-[#0C1220]">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-[#9CA3AF]"><Loader2 className="w-5 h-5 animate-spin text-[#4361EE]" /> Working out your profit…</div>
      ) : !s ? (
        <p className="py-24 text-center text-[13px] text-[#9CA3AF]">Couldn&apos;t load profit data. Try Refresh.</p>
      ) : (
        <>
          {/* Missing-cost warning */}
          {s.costsMissing > 0 && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-[12.5px] bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E]">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#D97706]" />
              <span>
                <b>{num(s.costsMissing)} completed order{s.costsMissing === 1 ? "" : "s"} have no product cost yet</b>, so profit below is higher than it really is. Costs are filled in when the AXQEN team reconciles those orders; rows marked <b>≈</b> are affected.
              </span>
            </div>
          )}

          {/* Headline tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: "Net profit", value: `${s.costsMissing ? "≈ " : ""}${inr(s.netProfit)}`, color: s.costsMissing ? "#B45309" : s.netProfit >= 0 ? GOOD : BAD, sub: s.margin != null ? `${s.margin}% of delivered revenue` : "No delivered orders yet" },
              { label: "Delivered revenue", value: inr(s.revenue), color: "#0C1220", sub: `${num(s.delivered)} delivered orders` },
              { label: "Profit per delivered order", value: s.profitPerDelivered != null ? inr(s.profitPerDelivered) : "—", color: (s.profitPerDelivered ?? 0) >= 0 ? "#0C1220" : BAD, sub: "After ads, fees and returns" },
              { label: "RTO loss", value: inr(-s.rtoLoss), color: s.rtoLoss > 0 ? BAD : "#9CA3AF", sub: s.rtoPct != null ? `${num(s.rto)} returns · ${s.rtoPct}% of completed` : "No returns" },
              { label: "Not delivered yet", value: inr(s.inTransitValue), color: "#6B7280", sub: `${num(s.inTransit)} orders, counted once delivered` },
            ].map(t => (
              <div key={t.label} className="bg-white rounded-xl border border-[#E8EDF6] px-4 py-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF] mb-1.5">{t.label}</p>
                <p className="text-[22px] font-black leading-none tabular-nums" style={{ color: t.color }}>{t.value}</p>
                <p className="text-[11px] text-[#9CA3AF] mt-1.5">{t.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-4">
            <Bridge s={s} />
            <MonthlyChart rows={data!.byMonth} />
          </div>

          <ProfitTable title="Profit by product" sub="Profit before ads. Order money is split across items by their price share." rows={data!.byProduct} kind="product" />
          <ProfitTable title="Profit by state" sub="States with at least 2 completed orders. Profit before ads." rows={data!.byState} kind="state" />

          <p className="text-[11.5px] text-[#9CA3AF] flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            Profit = delivered revenue − product cost − shipping − packing − AXQEN fee (₹{s.platformFeePerOrder} per delivered order) − RTO loss (product, return shipping and packing) − ad spend.
            Cancelled orders ({num(s.cancelled)}) and orders not delivered yet are left out. Ad spend is shown for the whole store, not per product. See <Link href="/seller/meta-ads" className="text-[#4361EE] font-semibold">Ad Spend</Link> for campaigns.
          </p>
        </>
      )}
    </div>
  );
}

// ── Revenue → net profit bridge ────────────────────────────────────────────
function Bridge({ s }: { s: Summary }) {
  const steps = [
    { label: "Delivered revenue", value: s.revenue, kind: "total" as const, to: "" },
    { label: "Product cost", value: -s.productCost, kind: "step" as const, to: "Supplier" },
    { label: "Shipping", value: -s.shipping, kind: "step" as const, to: "Courier" },
    { label: "Packing", value: -s.packing, kind: "step" as const, to: "Fulfilment" },
    { label: "AXQEN fee", value: -s.platformFee, kind: "step" as const, to: "AXQEN" },
    { label: "RTO loss", value: -s.rtoLoss, kind: "step" as const, to: "Returns" },
    { label: "Ad spend", value: -s.adSpend, kind: "step" as const, to: "Meta" },
    { label: "Net profit", value: s.netProfit, kind: "total" as const, to: "You" },
  ];
  const max = Math.max(s.revenue, Math.abs(s.netProfit), 1);
  let running = 0;
  return (
    <div className="bg-white rounded-xl border border-[#E8EDF6] p-5">
      <h2 className="text-[15px] font-bold text-[#0C1220]">Where your revenue went</h2>
      <p className="text-[12px] text-[#9CA3AF] mt-0.5 mb-4">From delivered revenue down to what you keep</p>
      <div className="space-y-2">
        {steps.map(st => {
          let left: number, width: number;
          if (st.kind === "total") {
            left = st.value >= 0 ? 0 : (st.value / max) * 100;
            width = (Math.abs(st.value) / max) * 100;
            running = st.value;
          } else {
            const from = running, to = running + st.value;
            left = (Math.min(from, to) / max) * 100;
            width = (Math.abs(st.value) / max) * 100;
            running = to;
          }
          const color = st.kind === "total" ? (st.value >= 0 ? (st.label === "Net profit" ? GOOD : "#4361EE") : BAD) : "#F87171";
          return (
            <div key={st.label} className="grid grid-cols-[118px_minmax(0,1fr)_88px] items-center gap-3">
              <span className={`text-[12px] ${st.kind === "total" ? "font-bold text-[#0C1220]" : "text-[#374151]"}`}>{st.label}</span>
              <div className="relative h-5 rounded bg-[#F7F8FC]" title={st.to ? `Goes to: ${st.to}` : undefined}>
                <div className="absolute top-0 bottom-0 rounded" style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(width, st.value ? 0.6 : 0)}%`, background: color, opacity: st.kind === "total" ? 1 : 0.85 }} />
              </div>
              <span className={`text-[12px] text-right tabular-nums ${st.kind === "total" ? "font-black" : "font-semibold"}`} style={{ color: st.value < 0 ? BAD : "#0C1220" }}>{inr(st.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Net profit by month (signed bars about zero) ───────────────────────────
function MonthlyChart({ rows }: { rows: MonthRow[] }) {
  const chart = rows.map(r => ({ ...r, label: monthLabel(r.month) }));
  return (
    <div className="bg-white rounded-xl border border-[#E8EDF6] p-5">
      <h2 className="text-[15px] font-bold text-[#0C1220]">Net profit by month</h2>
      <p className="text-[12px] text-[#9CA3AF] mt-0.5 mb-3">After product, shipping, packing, fee, returns and ads · by order month</p>
      {chart.length === 0 ? (
        <p className="text-[13px] text-[#9CA3AF] py-16 text-center">No completed orders in this period yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chart} barCategoryGap="28%" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={axisInr} width={56} />
            <ReferenceLine y={0} stroke="#C4C9D4" />
            <Tooltip
              cursor={{ fill: "rgba(67,97,238,0.05)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as MonthRow & { label: string };
                return (
                  <div className="bg-white border border-[#E8EDF6] rounded-lg px-3 py-2 text-[12px] shadow-sm">
                    <p className="font-bold text-[#0C1220] mb-1">{r.label}</p>
                    <p className="text-[#6B7280]">Delivered revenue <b className="text-[#0C1220]">{inr(r.revenue)}</b></p>
                    <p className="text-[#6B7280]">Costs and fee <b className="text-[#0C1220]">{inr(-r.costs)}</b></p>
                    <p className="text-[#6B7280]">RTO loss <b className="text-[#0C1220]">{inr(-r.rtoLoss)}</b></p>
                    <p className="text-[#6B7280]">Ads <b className="text-[#0C1220]">{inr(-r.ads)}</b></p>
                    <p className="mt-1 pt-1 border-t border-[#F3F4F6] font-bold" style={{ color: r.net >= 0 ? GOOD : BAD }}>Net {inr(r.net)}{r.costsMissing ? " (≈ costs missing)" : ""}</p>
                    <p className="text-[#9CA3AF]">{r.delivered} delivered · {r.rto} RTO</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="net" radius={[4, 4, 4, 4]} maxBarSize={36}>
              {chart.map(r => <Cell key={r.month} fill={r.net >= 0 ? GOOD : BAD} fillOpacity={r.costsMissing ? 0.55 : 1} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Product / state table ──────────────────────────────────────────────────
function ProfitTable({ title, sub, rows, kind }: { title: string; sub: string; rows: Row[]; kind: "product" | "state" }) {
  const [sort, setSort] = useState<"revenue" | "profit" | "margin" | "rtoPct">("revenue");
  const [showAll, setShowAll] = useState(false);
  const sorted = [...rows].sort((a, b) => {
    if (sort === "profit") return a.profit - b.profit;          // biggest losses first
    if (sort === "margin") return (a.margin ?? 999) - (b.margin ?? 999);
    if (sort === "rtoPct") return (b.rtoPct ?? -1) - (a.rtoPct ?? -1);
    return b.revenue - a.revenue;
  });
  const shown = showAll ? sorted : sorted.slice(0, 10);

  return (
    <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F3F4F6] flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[15px] font-bold text-[#0C1220]">{title}</h2>
          <p className="text-[12px] text-[#9CA3AF] mt-0.5">{sub}</p>
        </div>
        <label className="flex items-center gap-1.5 text-[12px] text-[#6B7280]">
          <ArrowUpDown className="w-3.5 h-3.5" />
          <select id={`sort-${kind}`} value={sort} onChange={e => setSort(e.target.value as typeof sort)}
            className="bg-white border border-[#E8EDF6] rounded-lg px-2 py-1.5 text-[12px] font-semibold text-[#374151] focus:outline-none focus:border-[#4361EE]">
            <option value="revenue">Most revenue</option>
            <option value="profit">Biggest losses first</option>
            <option value="margin">Lowest margin</option>
            <option value="rtoPct">Highest RTO %</option>
          </select>
        </label>
      </div>
      {rows.length === 0 ? (
        <p className="py-12 text-center text-[13px] text-[#9CA3AF]">No completed orders in this period yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[12.5px]">
            <thead>
              <tr className="bg-[#FAFBFF] text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                <th className="px-4 py-2.5">{kind === "product" ? "Product" : "State"}</th>
                <th className="px-3 py-2.5 text-right">Delivered</th>
                <th className="px-3 py-2.5 text-right">RTO</th>
                <th className="px-3 py-2.5 text-right">Revenue</th>
                <th className="px-3 py-2.5 text-right">Costs &amp; fee</th>
                <th className="px-3 py-2.5 text-right">RTO loss</th>
                <th className="px-3 py-2.5 text-right">Profit</th>
                <th className="px-3 py-2.5 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {shown.map(r => {
                const approx = r.costsMissing > 0;
                return (
                  <tr key={r.label} className="hover:bg-[#FAFBFF]">
                    <td className="px-4 py-2.5 max-w-[280px]">
                      <p className="font-semibold text-[#0C1220] truncate" title={r.label}>{r.label}</p>
                      {approx && <p className="text-[10.5px] text-[#B45309]">costs missing on {r.costsMissing}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{num(r.delivered)}{kind === "product" && r.units > r.delivered ? <span className="text-[#9CA3AF]"> · {num(r.units)} units</span> : null}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {num(r.rto)}{r.rtoPct != null && <span className="ml-1 font-semibold" style={{ color: r.rtoPct >= 30 ? BAD : r.rtoPct >= 15 ? "#B45309" : "#6B7280" }}>{r.rtoPct}%</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{inr(r.revenue)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#6B7280]">{inr(-r.costs)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: r.rtoLoss > 0 ? BAD : "#9CA3AF" }}>{inr(-r.rtoLoss)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold" style={{ color: approx ? "#B45309" : r.profit >= 0 ? GOOD : BAD }}>{approx ? "≈ " : ""}{inr(r.profit)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#6B7280]">{r.margin != null ? `${r.margin}%` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 10 && (
        <button onClick={() => setShowAll(v => !v)} className="w-full py-2.5 text-[12.5px] font-semibold text-[#4361EE] border-t border-[#F3F4F6] hover:bg-[#FAFBFF]">
          {showAll ? "Show top 10" : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}
