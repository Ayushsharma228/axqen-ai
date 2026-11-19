"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Loader2, ShieldCheck, ListChecks, PhoneCall, Truck, AlertTriangle, RotateCcw, FileWarning, CreditCard, LifeBuoy, BadgeIndianRupee, ChevronRight, Package, CheckCircle2 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { PincodeRtoCard } from "@/components/dashboard/pincode-rto-card";

interface Data {
  needs: { kyc: number; listings: number; calling: number; toShip: number; ndr: number; rtoOverdue: number; invoicesHeld: number; planOverdue: number; supportNeedsReply: number; scheduledPayouts: { count: number; amount: number } };
  key: { days: number; orders: number; delivered: number; rto: number; deliveredPct: number | null; rtoPct: number | null; gmv: number; earned: number; activeSellers: number };
  trend: { day: string; delivered: number; rto: number; orders: number }[];
  sellers: { id: string; name: string; orders: number; delivered: number; rto: number; deliveredPct: number | null; rtoPct: number | null; flags: string[]; lastOrder: string | null }[];
  products: { id: string; name: string; image: string | null; orders: number; delivered: number; rto: number; deliveredPct: number | null; rtoPct: number | null; deliveredValue: number }[];
  money: { toPay: number; awaiting: number; scheduled: number; toCollect: number; earnedThisMonth: number };
}

const RANGES = [{ label: "Today", days: 1 }, { label: "7 days", days: 7 }, { label: "30 days", days: 30 }];
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const pctColor = (p: number | null, bad = false) => (p == null ? "#9CA3AF" : bad ? (p >= 30 ? "#B91C1C" : p >= 20 ? "#B45309" : "#047857") : p >= 80 ? "#047857" : p >= 65 ? "#B45309" : "#B91C1C");
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

function Section({ title, sub, right, children }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-end justify-between gap-3 mb-3">
        <div><h2 className="text-[15px] font-bold text-[#0C1220]">{title}</h2>{sub && <p className="text-[12px] text-[#9CA3AF] mt-0.5">{sub}</p>}</div>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function AdminDashboard() {
  const { data: session } = useSession();
  const [days, setDays] = useState(1);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/dashboard?days=${days}`).then(r => r.json())
      .then(d => { if (d.needs) { setData(d); setError(false); } else setError(true); })
      .catch(() => setError(true)).finally(() => setLoading(false));
  }, [days]);

  const n = data?.needs;
  const tiles = n ? [
    { label: "KYC to review", value: n.kyc, href: "/admin/kyc", icon: ShieldCheck },
    { label: "Listing requests", value: n.listings, href: "/admin/listings", icon: ListChecks },
    { label: "COD orders being called", value: n.calling, href: "/admin/order-confirmation", icon: PhoneCall },
    { label: "Confirmed, not shipped", value: n.toShip, href: "/admin/delivery", icon: Truck },
    { label: "NDR, no action yet", value: n.ndr, href: "/admin/ndr", icon: AlertTriangle },
    { label: "RTO not received 15d+", value: n.rtoOverdue, href: "/admin/rto", icon: RotateCcw },
    { label: "Payouts to mark paid", value: n.scheduledPayouts.count, sub: n.scheduledPayouts.count ? inr(n.scheduledPayouts.amount) : undefined, href: "/admin/remittance", icon: BadgeIndianRupee },
    { label: "Invoices on hold", value: n.invoicesHeld, href: "/admin/invoices", icon: FileWarning },
    { label: "Sellers with plan overdue", value: n.planOverdue, href: "/admin/plan-billing", icon: CreditCard },
    { label: "Tickets waiting on you", value: n.supportNeedsReply, href: "/admin/support", icon: LifeBuoy },
  ] : [];
  const waiting = tiles.filter(t => t.value > 0);
  const k = data?.key;
  const name = session?.user?.name?.split(" ")[0] ?? "";

  return (
    <div className="px-4 py-5 md:p-8 space-y-7" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div>
        <p className="text-[12.5px] font-semibold text-[#9CA3AF]">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="text-[24px] font-black text-[#0C1220]">{greeting()}{name ? `, ${name}` : ""}</h1>
      </div>

      {error ? <p className="py-24 text-center text-[13px] text-[#B91C1C]">Couldn&apos;t load the dashboard. Refresh to try again.</p>
        : !data ? <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-[#9CA3AF]"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
        : (
        <>
          <Section title="Needs your attention" sub={waiting.length ? `${waiting.length} things waiting on the team` : undefined}>
            {waiting.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#E8EDF6] p-6 flex items-center gap-3 text-[13px] text-[#047857]"><CheckCircle2 className="w-5 h-5" /> Nothing waiting. Every queue is clear.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {waiting.map(t => {
                  const Icon = t.icon;
                  return (
                    <Link key={t.label} href={t.href} className="group bg-white rounded-xl border border-[#E8EDF6] p-4 hover:border-[#C7D2FE] transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="w-8 h-8 rounded-lg bg-[#FEF3C7] text-[#B45309] flex items-center justify-center"><Icon className="w-4 h-4" /></span>
                        <ChevronRight className="w-4 h-4 text-[#C4C9D4] group-hover:text-[#4361EE]" />
                      </div>
                      <p className="text-[26px] font-black leading-none tabular-nums text-[#0C1220]">{t.value}</p>
                      <p className="text-[12px] font-medium text-[#6B7280] mt-1.5">{t.label}</p>
                      {t.sub && <p className="text-[11px] text-[#9CA3AF]">{t.sub}</p>}
                    </Link>
                  );
                })}
              </div>
            )}
          </Section>

          <Section title="Key numbers" right={
            <div className="flex items-center gap-1 bg-white rounded-lg border border-[#E8EDF6] p-1">
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9CA3AF] mx-1" />}
              {RANGES.map(r => <button key={r.days} onClick={() => setDays(r.days)} className={`px-2.5 py-1 rounded-lg text-[12px] font-semibold ${days === r.days ? "bg-[#E8EDFF] text-[#4361EE]" : "text-[#6B7280] hover:bg-[#F3F6FF]"}`}>{r.label}</button>)}
            </div>}>
            {k && (
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                {[
                  { l: "Orders", v: k.orders.toLocaleString("en-IN"), c: "#0C1220", s: "By order date" },
                  { l: "Delivered %", v: k.deliveredPct != null ? `${k.deliveredPct}%` : "—", c: pctColor(k.deliveredPct), s: `${k.delivered} delivered` },
                  { l: "RTO %", v: k.rtoPct != null ? `${k.rtoPct}%` : "—", c: pctColor(k.rtoPct, true), s: `${k.rto} returned` },
                  { l: "Delivered GMV", v: inr(k.gmv), c: "#0C1220", s: "Delivered order value" },
                  { l: "AXQEN earned", v: inr(k.earned), c: "#047857", s: "Commission + packing" },
                  { l: "Active sellers", v: String(k.activeSellers), c: "#0C1220", s: "With orders in range" },
                ].map(x => (
                  <div key={x.l} className="bg-white rounded-xl border border-[#E8EDF6] p-4">
                    <p className="text-[11.5px] font-semibold text-[#6B7280]">{x.l}</p>
                    <p className="text-[22px] font-black leading-tight tabular-nums mt-1" style={{ color: x.c }}>{x.v}</p>
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5">{x.s}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Orders trend" sub="Last 30 days, all sellers · delivered vs RTO by order date">
            <div className="bg-white rounded-xl border border-[#E8EDF6] p-5">
              {data.trend.some(t => t.orders) ? (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={data.trend.map(t => ({ ...t, label: new Date(t.day + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) }))} barCategoryGap="22%">
                    <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E8EDF6", fontSize: 12 }} />
                    <Bar dataKey="delivered" name="Delivered" stackId="s" fill="#059669" maxBarSize={14} />
                    <Bar dataKey="rto" name="RTO" stackId="s" fill="#EF4444" radius={[3, 3, 0, 0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="py-10 text-center text-[13px] text-[#9CA3AF]">No orders in the last 30 days.</p>}
            </div>
          </Section>

          <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-5">
            <Section title="Seller health" sub="Last 30 days · problems first" right={<Link href="/admin/sellers" className="text-[12.5px] font-semibold text-[#4361EE]">All sellers</Link>}>
              <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
                {data.sellers.length === 0 ? <p className="py-10 text-center text-[13px] text-[#9CA3AF]">No seller orders in the last 30 days.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-[12.5px]">
                      <thead><tr className="bg-[#FAFBFF] text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                        <th className="px-4 py-2.5">Seller</th><th className="px-3 py-2.5 text-right">Orders</th><th className="px-3 py-2.5 text-right">Delivered</th><th className="px-3 py-2.5 text-right">RTO</th><th className="px-3 py-2.5">Last order</th>
                      </tr></thead>
                      <tbody className="divide-y divide-[#F3F4F6]">
                        {data.sellers.map(s => (
                          <tr key={s.id} className="hover:bg-[#FAFBFF]">
                            <td className="px-4 py-2.5">
                              <Link href={`/admin/sellers/${s.id}`} className="font-semibold text-[#0C1220] hover:text-[#4361EE]">{s.name}</Link>
                              {s.flags.map(f => <span key={f} className="ml-1.5 text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-[#FEE2E2] text-[#B91C1C]">{f}</span>)}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{s.orders}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: pctColor(s.deliveredPct) }}>{s.deliveredPct != null ? `${s.deliveredPct}%` : "—"}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: pctColor(s.rtoPct, true) }}>{s.rtoPct != null ? `${s.rtoPct}%` : "—"}</td>
                            <td className="px-3 py-2.5 text-[#6B7280] whitespace-nowrap">{s.lastOrder ? new Date(s.lastOrder).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Section>

            <Section title="Top products" sub="Last 30 days, by orders" right={<Link href="/admin/products" className="text-[12.5px] font-semibold text-[#4361EE]">All products</Link>}>
              <div className="bg-white rounded-xl border border-[#E8EDF6] divide-y divide-[#F3F4F6]">
                {data.products.length === 0 ? <p className="py-10 text-center text-[13px] text-[#9CA3AF]">No product orders matched yet.</p> : data.products.map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-10 h-10 rounded-lg bg-[#F3F4F6] overflow-hidden flex-shrink-0">{p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 m-3 text-[#D1D5DB]" />}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#0C1220] truncate">{p.name}</p>
                      <p className="text-[11.5px] text-[#9CA3AF]">{p.orders} orders · {inr(p.deliveredValue)} delivered</p>
                    </div>
                    <div className="text-right text-[12px] tabular-nums">
                      <p style={{ color: pctColor(p.deliveredPct) }} className="font-semibold">{p.deliveredPct != null ? `${p.deliveredPct}%` : "—"} <span className="text-[#9CA3AF] font-normal">del.</span></p>
                      <p style={{ color: pctColor(p.rtoPct, true) }} className="font-semibold">{p.rtoPct != null ? `${p.rtoPct}%` : "—"} <span className="text-[#9CA3AF] font-normal">RTO</span></p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          <PincodeRtoCard endpoint="/api/admin/pincode-rto" allSellers />

          <Section title="Money">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link href="/admin/remittance" className="group bg-white rounded-xl border border-[#E8EDF6] p-5 hover:border-[#C7D2FE]">
                <p className="text-[12px] font-semibold text-[#6B7280] uppercase tracking-wide flex items-center justify-between">To pay sellers <ChevronRight className="w-4 h-4 text-[#C4C9D4] group-hover:text-[#4361EE]" /></p>
                <p className="text-[26px] font-black tabular-nums text-[#0C1220] mt-2">{inr(data.money.toPay)}</p>
                <p className="text-[12px] text-[#9CA3AF] mt-1">{inr(data.money.scheduled)} scheduled · {inr(data.money.awaiting)} delivered, not remitted yet</p>
              </Link>
              <Link href="/admin/plan-billing" className="group bg-white rounded-xl border border-[#E8EDF6] p-5 hover:border-[#C7D2FE]">
                <p className="text-[12px] font-semibold text-[#6B7280] uppercase tracking-wide flex items-center justify-between">To collect from sellers <ChevronRight className="w-4 h-4 text-[#C4C9D4] group-hover:text-[#4361EE]" /></p>
                <p className="text-[26px] font-black tabular-nums mt-2" style={{ color: data.money.toCollect ? "#B91C1C" : "#0C1220" }}>{inr(data.money.toCollect)}</p>
                <p className="text-[12px] text-[#9CA3AF] mt-1">Plan dues pending, with GST</p>
              </Link>
              <Link href="/admin/analytics" className="group bg-white rounded-xl border border-[#E8EDF6] p-5 hover:border-[#C7D2FE]">
                <p className="text-[12px] font-semibold text-[#6B7280] uppercase tracking-wide flex items-center justify-between">Earned this month <ChevronRight className="w-4 h-4 text-[#C4C9D4] group-hover:text-[#4361EE]" /></p>
                <p className="text-[26px] font-black tabular-nums text-[#047857] mt-2">{inr(data.money.earnedThisMonth)}</p>
                <p className="text-[12px] text-[#9CA3AF] mt-1">Commission, packing and plan payments</p>
              </Link>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
