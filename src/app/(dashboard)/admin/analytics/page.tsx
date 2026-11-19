"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, ChevronUp, ChevronDown, ArrowUpDown } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

interface View {
  orders: number; delivered: number; rto: number; cancelled: number; moving: number; cod: number; gmv: number;
  deliveredPct: number | null; rtoPct: number | null; commission: number; packing: number; packingMissing: number;
}
interface Data {
  feePerDelivered: number;
  totals: View & { plans: number; paidOut: number; activeSellers: number };
  byMonth: (View & { month: string; plans: number; paidOut: number })[];
  bySeller: (View & { id: string; name: string })[];
}
type SortKey = "name" | "orders" | "gmv" | "deliveredPct" | "rtoPct" | "earned";

const RANGES: { label: string; days: number | null }[] = [{ label: "7 days", days: 7 }, { label: "30 days", days: 30 }, { label: "90 days", days: 90 }, { label: "All time", days: null }];
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const short = (n: number) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `₹${(n / 1e3).toFixed(0)}k` : `₹${n}`);
const pctColor = (p: number | null, bad = false) => (p == null ? "#9CA3AF" : bad ? (p >= 30 ? "#B91C1C" : p >= 20 ? "#B45309" : "#047857") : p >= 80 ? "#047857" : p >= 65 ? "#B45309" : "#B91C1C");
const monthLabel = (m: string) => new Date(m + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

export default function PlatformAnalyticsPage() {
  const [days, setDays] = useState<number | null>(30);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "gmv", dir: -1 });

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/analytics/platform${days ? `?days=${days}` : ""}`).then(r => r.json())
      .then(d => { if (d.totals) { setData(d); setError(false); } else setError(true); })
      .catch(() => setError(true)).finally(() => setLoading(false));
  }, [days]);

  const sellers = useMemo(() => {
    if (!data) return [];
    const val = (r: Data["bySeller"][number]): number | string => sort.key === "name" ? r.name.toLowerCase() : sort.key === "earned" ? r.commission + r.packing : r[sort.key] ?? -1;
    return [...data.bySeller].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [data, sort]);

  const th = (label: string, k: SortKey, right = true) => (
    <th className={`px-3 py-2.5 whitespace-nowrap ${right ? "text-right" : ""}`}>
      <button onClick={() => setSort(s => (s.key === k ? { key: k, dir: s.dir === 1 ? -1 : 1 } : { key: k, dir: k === "name" ? 1 : -1 }))} className={`inline-flex items-center gap-1 hover:text-[#4361EE] ${sort.key === k ? "text-[#4361EE]" : ""}`}>
        {label}{sort.key === k ? (sort.dir === 1 ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
      </button>
    </th>
  );
  const chip = (on: boolean) => `px-2.5 py-1 rounded-lg text-[12px] font-semibold ${on ? "bg-[#E8EDFF] text-[#4361EE]" : "text-[#6B7280] hover:bg-[#F3F6FF]"}`;
  const t = data?.totals;
  const earned = t ? t.commission + t.packing + t.plans : 0;

  return (
    <div className="px-4 py-5 md:p-8 space-y-5" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-black text-[#0C1220]">Platform Analytics</h1>
          <p className="text-[12.5px] text-[#6B7280] mt-1">Orders, delivery and what AXQEN earned, worked out from live orders, payouts and plan payments.</p>
        </div>
        <div className="flex items-center gap-1 bg-white rounded-lg border border-[#E8EDF6] p-1">
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9CA3AF] mx-1" />}
          {RANGES.map(r => <button key={r.label} onClick={() => setDays(r.days)} className={chip(days === r.days)}>{r.label}</button>)}
        </div>
      </div>

      {error ? <p className="py-24 text-center text-[13px] text-[#B91C1C]">Couldn&apos;t load analytics. Refresh to try again.</p>
        : !data || !t ? <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-[#9CA3AF]"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
        : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { l: "Orders", v: t.orders.toLocaleString("en-IN"), s: `${t.activeSellers} sellers · ${t.moving} moving · ${t.cancelled} cancelled`, c: "#0C1220" },
              { l: "Delivered GMV", v: inr(t.gmv), s: `${t.delivered.toLocaleString("en-IN")} delivered orders`, c: "#0C1220" },
              { l: "Delivered %", v: t.deliveredPct != null ? `${t.deliveredPct}%` : "—", s: "Of completed orders", c: pctColor(t.deliveredPct) },
              { l: "RTO %", v: t.rtoPct != null ? `${t.rtoPct}%` : "—", s: `${t.rto.toLocaleString("en-IN")} returned`, c: pctColor(t.rtoPct, true) },
            ].map(x => (
              <div key={x.l} className="bg-white rounded-xl border border-[#E8EDF6] p-4">
                <p className="text-[11.5px] font-semibold text-[#6B7280]">{x.l}</p>
                <p className="text-[24px] font-black leading-tight tabular-nums mt-1" style={{ color: x.c }}>{x.v}</p>
                <p className="text-[11px] text-[#9CA3AF] mt-0.5">{x.s}</p>
              </div>
            ))}
          </div>

          <section className="bg-white rounded-xl border border-[#E8EDF6] p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
              <div>
                <h2 className="text-[15px] font-bold text-[#0C1220]">What AXQEN earned</h2>
                <p className="text-[12px] text-[#9CA3AF] mt-0.5">Commission and packing on delivered orders, plus plan payments received in this period.</p>
              </div>
              <p className="text-[26px] font-black tabular-nums text-[#047857]">{inr(earned)}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {[
                { l: `Commission (₹${data.feePerDelivered} × delivered)`, v: t.commission, s: "Invoiced to sellers at month end" },
                { l: "Packing on invoices", v: t.packing, s: t.packingMissing ? `${t.packingMissing} delivered orders have no packing yet` : "From AXP invoices" },
                { l: "Plan payments received", v: t.plans, s: "Incl. GST, as recorded in Plan Billing" },
                { l: "Paid to sellers", v: t.paidOut, s: "Remittances marked paid, after RTO deductions" },
              ].map(x => (
                <div key={x.l} className="bg-[#FAFBFF] rounded-lg border border-[#EEF1F8] p-3">
                  <p className="text-[11.5px] text-[#6B7280]">{x.l}</p>
                  <p className="text-[18px] font-black tabular-nums text-[#0C1220]">{inr(x.v)}</p>
                  <p className="text-[11px] text-[#9CA3AF] mt-0.5">{x.s}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-[#E8EDF6] p-5">
            <h2 className="text-[15px] font-bold text-[#0C1220]">By month</h2>
            <p className="text-[12px] text-[#9CA3AF] mt-0.5 mb-4">Delivered vs RTO orders by order month{days ? " within the selected period" : ", last 12 months"}.</p>
            {data.byMonth.length ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.byMonth.map(m => ({ ...m, label: monthLabel(m.month) }))} barCategoryGap="28%">
                    <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} width={36} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E8EDF6", fontSize: 12 }} />
                    <Bar dataKey="delivered" name="Delivered" stackId="a" fill="#059669" maxBarSize={30} />
                    <Bar dataKey="rto" name="RTO" stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="overflow-x-auto mt-4">
                  <table className="w-full min-w-[760px] text-[12.5px]">
                    <thead><tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF] border-b border-[#F3F4F6]">
                      <th className="py-2 pr-3">Month</th><th className="py-2 pr-3 text-right">Orders</th><th className="py-2 pr-3 text-right">Delivered</th><th className="py-2 pr-3 text-right">RTO</th>
                      <th className="py-2 pr-3 text-right">GMV</th><th className="py-2 pr-3 text-right">Commission + packing</th><th className="py-2 pr-3 text-right">Plans</th><th className="py-2 text-right">Paid to sellers</th>
                    </tr></thead>
                    <tbody className="divide-y divide-[#F3F4F6]">
                      {[...data.byMonth].reverse().map(m => (
                        <tr key={m.month}>
                          <td className="py-2 pr-3 font-medium text-[#0C1220]">{monthLabel(m.month)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{m.orders}</td>
                          <td className="py-2 pr-3 text-right tabular-nums" style={{ color: pctColor(m.deliveredPct) }}>{m.delivered}{m.deliveredPct != null && <span className="text-[11px] text-[#9CA3AF]"> · {m.deliveredPct}%</span>}</td>
                          <td className="py-2 pr-3 text-right tabular-nums" style={{ color: pctColor(m.rtoPct, true) }}>{m.rto}{m.rtoPct != null && <span className="text-[11px] text-[#9CA3AF]"> · {m.rtoPct}%</span>}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{short(m.gmv)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-[#047857]">{inr(m.commission + m.packing)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{m.plans ? inr(m.plans) : "—"}</td>
                          <td className="py-2 text-right tabular-nums">{m.paidOut ? inr(m.paidOut) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : <p className="py-10 text-center text-[13px] text-[#9CA3AF]">No orders in this period.</p>}
          </section>

          <section className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-[15px] font-bold text-[#0C1220]">By seller</h2>
              <p className="text-[12px] text-[#9CA3AF] mt-0.5">Click a seller for their full page.</p>
            </div>
            {sellers.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-[12.5px]">
                  <thead><tr className="bg-[#FAFBFF] text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                    {th("Seller", "name", false)}{th("Orders", "orders")}{th("GMV", "gmv")}{th("Delivered", "deliveredPct")}{th("RTO", "rtoPct")}{th("AXQEN earned", "earned")}
                  </tr></thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {sellers.map(r => (
                      <tr key={r.id} className="hover:bg-[#FAFBFF]">
                        <td className="px-3 py-2.5"><Link href={`/admin/sellers/${r.id}`} className="font-semibold text-[#0C1220] hover:text-[#4361EE]">{r.name}</Link></td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.orders}{r.moving > 0 && <span className="block text-[10.5px] text-[#9CA3AF]">{r.moving} moving</span>}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{inr(r.gmv)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: pctColor(r.deliveredPct) }}>{r.deliveredPct != null ? `${r.deliveredPct}%` : "—"}<span className="block text-[10.5px] font-normal text-[#9CA3AF]">{r.delivered}</span></td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: pctColor(r.rtoPct, true) }}>{r.rtoPct != null ? `${r.rtoPct}%` : "—"}<span className="block text-[10.5px] font-normal text-[#9CA3AF]">{r.rto}</span></td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[#047857] font-semibold">{inr(r.commission + r.packing)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="py-10 text-center text-[13px] text-[#9CA3AF]">No orders in this period.</p>}
          </section>
        </>
      )}
    </div>
  );
}
