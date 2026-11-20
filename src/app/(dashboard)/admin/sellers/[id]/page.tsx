"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, Phone, Mail, Store, CheckCircle2, XCircle, FileText, ExternalLink, ShieldCheck, ShieldAlert,
  Ban, Play, CalendarDays, MessageCircle, CreditCard, AlertTriangle,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { PincodeRtoCard } from "@/components/dashboard/pincode-rto-card";
import { PlanBillingDrawer } from "@/components/billing/plan-billing-drawer";
import { KycApprovePanel } from "@/components/admin/kyc-approve-panel";

interface Summary {
  seller: {
    id: string; name: string | null; email: string; phone: string | null; username: string | null; brandName: string | null; businessName: string | null;
    businessAddress: string | null; city: string | null; state: string | null; pincode: string | null; gstNumber: string | null;
    plan: string | null; planTier: string | null; accountStatus: "ACTIVE" | "PENDING" | "SUSPENDED"; kycStatus: string;
    aadhaarNumber: string | null; aadhaarDocUrl: string | null; onboardingDone: boolean; agreementAccepted: boolean; agreementAcceptedAt: string | null;
    paymentReference: string | null; paymentConfirmed: boolean; dataStartDate: string | null;
    bankName: string | null; bankHolder: string | null; bankAccount: string | null; bankIfsc: string | null; createdAt: string;
    shopifyStore: { storeName: string; storeUrl: string; createdAt: string } | null;
  };
  profit: {
    summary: Record<string, number | null>;
    byMonth: { month: string; delivered: number; rto: number; revenue: number; net: number }[];
    byProduct: { label: string; delivered: number; rto: number; revenue: number; profit: number; rtoPct: number | null }[];
  };
  billing: { periods: unknown[]; totals: { due: number; paid: number; pending: number }; overdue: boolean; nextDueDate: string | null; ordersBlocked: boolean; holds: { held: number } };
  payouts: {
    pipeline: {
      awaiting: { count: number; amount: number }; rtoPending: { count: number; amount: number };
      scheduled: { count: number; amount: number; nextDate: string | null }; paid: { count: number; amount: number; lastDate: string | null }; onHold: { amount: number };
    };
    recent: { id: string; status: string; date: string; orders: number; net: number; held: number; bankRef: string | null }[];
    since: string | null;
  };
  recentOrders: { id: string; externalOrderId: string; status: string; totalAmount: number; createdAt: string; source: string; courier: string | null; awbNumber: string | null; paymentMode: string; customerName: string | null }[];
  activation: Record<string, unknown> | null;
  invoices: Record<string, number>;
}

const TABS = ["Overview", "Profile & KYC", "Orders", "Money", "Plan", "Account"] as const;
type Tab = (typeof TABS)[number];
const RANGES: { label: string; days: number | null }[] = [{ label: "30 days", days: 30 }, { label: "90 days", days: 90 }, { label: "All time", days: null }];

const inr = (n: number | null | undefined) => (n == null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`);
const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const planName = (p: string | null, t: string | null) => (!p ? "No plan" : p === "MARKETPLACE" ? "Marketplace" : `Dropshipping${t ? ` · ${t[0]}${t.slice(1).toLowerCase()}` : ""}`);
const STATUS = { ACTIVE: ["Active", "#DCFCE7", "#047857"], PENDING: ["Pending", "#FEF3C7", "#B45309"], SUSPENDED: ["Suspended", "#FEE2E2", "#B91C1C"] } as const;
const ORDER_TONE: Record<string, string> = { DELIVERED: "#047857", RTO: "#B91C1C", CANCELLED: "#9CA3AF", NEW: "#B45309", PROCESSING: "#4361EE", SHIPPED: "#4361EE", IN_TRANSIT: "#4361EE" };

function Card({ title, right, children }: { title?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-[#E8EDF6] p-5">
      {(title || right) && <div className="flex items-center justify-between gap-3 mb-4">{title && <h2 className="text-[15px] font-bold text-[#0C1220]">{title}</h2>}{right}</div>}
      {children}
    </section>
  );
}
function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{label}</p>
      <p className={`text-[13px] text-[#0C1220] mt-0.5 break-words ${mono ? "font-mono" : ""}`}>{value || <span className="text-[#C4C9D4]">—</span>}</p>
    </div>
  );
}
function Stat({ label, value, sub, tone = "#0C1220" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="bg-[#FAFBFF] rounded-xl border border-[#EEF1F8] p-4">
      <p className="text-[11.5px] font-semibold text-[#6B7280]">{label}</p>
      <p className="text-[22px] font-black leading-tight tabular-nums mt-1" style={{ color: tone }}>{value}</p>
      {sub && <p className="text-[11px] text-[#9CA3AF] mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminSellerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<Tab>("Overview");
  const [days, setDays] = useState<number | null>(90);
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [planOpen, setPlanOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [startInput, setStartInput] = useState("");
  const [rejectNote, setRejectNote] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/sellers/${id}/summary${days ? `?days=${days}` : ""}`).then(r => r.json())
      .then(d => { if (d.seller) { setData(d); setStartInput(d.seller.dataStartDate ? d.seller.dataStartDate.slice(0, 10) : ""); setError(""); } else setError(d.error ?? "Couldn't load this seller"); })
      .catch(() => setError("Couldn't load this seller")).finally(() => setLoading(false));
  }, [id, days]);
  useEffect(() => { load(); }, [load]);

  async function call(key: string, url: string, method: string, body: unknown, ok: string) {
    setBusy(key); setMsg(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    setMsg(res.ok ? { ok: true, text: ok } : { ok: false, text: d.error ?? "Something went wrong" });
    if (res.ok) load();
  }

  if (!data) {
    return (
      <div className="px-4 py-5 md:p-8" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
        <Link href="/admin/sellers" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#4361EE]"><ArrowLeft className="w-3.5 h-3.5" /> Sellers</Link>
        {loading ? <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-[#4361EE]" /></div>
          : <p className="py-24 text-center text-[13px] text-[#B91C1C]">{error}</p>}
      </div>
    );
  }

  const s = data.seller, p = data.profit.summary, pipe = data.payouts.pipeline;
  const st = STATUS[s.accountStatus];
  const phone = s.phone?.replace(/\D/g, "").slice(-10);
  const act = data.activation as Record<string, boolean | string | null> | null;
  const steps: [string, boolean][] = act ? [
    ["Account", true], ["Agreement", !!act.agreementSigned], ["Business details", !!act.businessFilled], ["Bank", !!act.bankFilled],
    ["KYC approved", !!act.kycApproved], ["Shopify", !!act.shopifyConnected], ["Listing requested", !!act.listingRequested],
    ["First listing live", !!act.firstListingLive], ["First order", !!act.firstOrderReceived], ["First delivery", !!act.firstOrderDelivered],
  ] : [];
  const chip = (on: boolean) => `px-2.5 py-1 rounded-lg text-[12px] font-semibold transition-colors ${on ? "bg-[#E8EDFF] text-[#4361EE]" : "text-[#6B7280] hover:bg-[#F3F6FF]"}`;
  const btn = "flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold disabled:opacity-50";

  return (
    <div className="px-4 py-5 md:p-8 space-y-5" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <Link href="/admin/sellers" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#4361EE]"><ArrowLeft className="w-3.5 h-3.5" /> Sellers</Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-[#E8EDF6] p-5 flex flex-col md:flex-row md:items-center gap-4">
        <span className="w-14 h-14 rounded-full flex items-center justify-center text-white text-[20px] font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg,#4361EE,#7B8CFF)" }}>
          {(s.name ?? s.email)[0]?.toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[20px] font-black text-[#0C1220] truncate">{s.name ?? s.email}</h1>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold" style={{ background: st[1], color: st[2] }}>{st[0]}</span>
            {data.billing.overdue && <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#FEE2E2] text-[#B91C1C]">Plan overdue</span>}
          </div>
          <p className="text-[12.5px] text-[#6B7280] mt-0.5">{[s.brandName || s.businessName, planName(s.plan, s.planTier), `joined ${fmt(s.createdAt)}`].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {phone && <a href={`tel:${phone}`} className={`${btn} border border-[#E8EDF6] text-[#374151] hover:border-[#C7D2FE]`}><Phone className="w-3.5 h-3.5" /> Call</a>}
          {phone && <a href={`https://wa.me/91${phone}`} target="_blank" rel="noreferrer" className={`${btn} border border-[#E8EDF6] text-[#374151] hover:border-[#C7D2FE]`}><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</a>}
          <a href={`mailto:${s.email}`} className={`${btn} border border-[#E8EDF6] text-[#374151] hover:border-[#C7D2FE]`}><Mail className="w-3.5 h-3.5" /> Email</a>
        </div>
      </div>

      {msg && <div className="px-4 py-2.5 rounded-xl text-[13px]" style={{ background: msg.ok ? "#ECFDF5" : "#FEF2F2", color: msg.ok ? "#047857" : "#B91C1C" }}>{msg.text}</div>}

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto bg-white rounded-xl border border-[#E8EDF6] p-1.5">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3.5 py-2 rounded-lg text-[13px] font-semibold whitespace-nowrap ${tab === t ? "bg-[#E8EDFF] text-[#4361EE]" : "text-[#6B7280] hover:bg-[#F3F6FF]"}`}>{t}</button>
        ))}
      </div>

      {tab === "Overview" && (
        <>
          <Card title="Key numbers" right={
            <div className="flex items-center gap-1">
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9CA3AF] mr-1" />}
              {RANGES.map(r => <button key={r.label} onClick={() => setDays(r.days)} className={chip(days === r.days)}>{r.label}</button>)}
            </div>}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="Orders" value={String(p.orders ?? 0)} sub={`${p.inTransit ?? 0} in transit · ${p.cancelled ?? 0} cancelled`} />
              <Stat label="Delivered" value={String(p.delivered ?? 0)} tone="#047857" sub={p.rtoPct != null ? `${100 - (p.rtoPct ?? 0)}% of completed` : undefined} />
              <Stat label="RTO" value={String(p.rto ?? 0)} tone={(p.rtoPct ?? 0) >= 30 ? "#B91C1C" : "#0C1220"} sub={p.rtoPct != null ? `${p.rtoPct}% RTO rate` : undefined} />
              <Stat label="Seller's net profit" value={inr(p.netProfit)} tone={(p.netProfit ?? 0) < 0 ? "#B91C1C" : "#047857"} sub={`Revenue ${inr(p.revenue)} · ads ${inr(p.adSpend)}`} />
            </div>
            {(p.costsMissing ?? 0) > 0 && <p className="text-[11.5px] text-[#B45309] mt-3">{p.costsMissing} completed orders have no product cost, so profit is shown higher than it really is.</p>}
          </Card>

          <Card title="Delivered vs RTO by month">
            {data.profit.byMonth.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.profit.byMonth.map(m => ({ ...m, label: new Date(m.month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }) }))} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E8EDF6", fontSize: 12 }} />
                  <Bar dataKey="delivered" name="Delivered" stackId="a" fill="#059669" maxBarSize={28} />
                  <Bar dataKey="rto" name="RTO" stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="py-10 text-center text-[13px] text-[#9CA3AF]">No orders in this period.</p>}
          </Card>

          <Card title="Top products">
            {data.profit.byProduct.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-[12.5px]">
                  <thead><tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF] border-b border-[#F3F4F6]">
                    <th className="py-2 pr-3">Product</th><th className="py-2 pr-3 text-right">Delivered</th><th className="py-2 pr-3 text-right">RTO</th><th className="py-2 pr-3 text-right">RTO %</th><th className="py-2 text-right">Revenue</th>
                  </tr></thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {data.profit.byProduct.map(r => (
                      <tr key={r.label}>
                        <td className="py-2.5 pr-3 text-[#0C1220] font-medium truncate max-w-[280px]">{r.label}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-[#047857]">{r.delivered}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-[#DC2626]">{r.rto}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{r.rtoPct != null ? `${r.rtoPct}%` : "—"}</td>
                        <td className="py-2.5 text-right tabular-nums">{inr(r.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="py-8 text-center text-[13px] text-[#9CA3AF]">No delivered or returned orders yet.</p>}
          </Card>

          <PincodeRtoCard endpoint={`/api/admin/sellers/${id}/pincode-rto`} />
        </>
      )}

      {tab === "Profile & KYC" && (
        <>
          <Card title="Business">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Name" value={s.name} />
              <Field label="Brand" value={s.brandName} />
              <Field label="Business name" value={s.businessName} />
              <Field label="Phone" value={s.phone} />
              <Field label="Email" value={s.email} />
              <Field label="Username" value={s.username} />
              <Field label="GSTIN" value={s.gstNumber} mono />
              <Field label="Address" value={[s.businessAddress, s.city, s.state, s.pincode].filter(Boolean).join(", ")} />
              <Field label="Shopify store" value={s.shopifyStore ? <a href={s.shopifyStore.storeUrl.startsWith("http") ? s.shopifyStore.storeUrl : `https://${s.shopifyStore.storeUrl}`} target="_blank" rel="noreferrer" className="text-[#4361EE] inline-flex items-center gap-1">{s.shopifyStore.storeName} <ExternalLink className="w-3 h-3" /></a> : null} />
            </div>
          </Card>

          <Card title="KYC" right={
            <span className="text-[12px] font-bold px-2 py-0.5 rounded-md" style={s.kycStatus === "APPROVED" ? { background: "#DCFCE7", color: "#047857" } : s.kycStatus === "SUBMITTED" ? { background: "#FEF3C7", color: "#B45309" } : s.kycStatus === "REJECTED" ? { background: "#FEE2E2", color: "#B91C1C" } : { background: "#F3F4F6", color: "#6B7280" }}>
              {s.kycStatus === "SUBMITTED" ? "Waiting for review" : s.kycStatus === "NOT_SUBMITTED" ? "Not submitted" : s.kycStatus[0] + s.kycStatus.slice(1).toLowerCase()}
            </span>}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Aadhaar" value={s.aadhaarNumber} mono />
              <Field label="Aadhaar document" value={s.aadhaarDocUrl ? <a href={s.aadhaarDocUrl} target="_blank" rel="noreferrer" className="text-[#4361EE] inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Open document</a> : null} />
              <Field label="Agreement" value={s.agreementAccepted ? `Accepted ${fmt(s.agreementAcceptedAt)}` : "Not accepted"} />
            </div>
            {(s.kycStatus === "SUBMITTED" || s.kycStatus === "REJECTED") && (
              <div className="mt-4 pt-4 border-t border-[#F3F4F6] space-y-2">
                <KycApprovePanel seller={{ id: s.id, name: s.name, email: s.email, plan: s.plan, planTier: s.planTier, accountStatus: s.accountStatus }} onDone={(text, ok) => { setMsg({ ok, text }); load(); }} />
                {s.kycStatus === "SUBMITTED" && <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <input id="kyc-reason" value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="Reason for rejecting (sent to the seller)"
                    className="flex-1 px-3 py-2 text-[12.5px] rounded-lg border border-[#E8EDF6] outline-none focus:border-[#4361EE]" />
                  <button onClick={() => call("kyc-no", `/api/admin/kyc/${id}`, "PATCH", { action: "REJECTED", adminNote: rejectNote.trim() || undefined }, "KYC rejected. The seller has been emailed the reason.")} disabled={!!busy || !rejectNote.trim()}
                    className={`${btn} bg-[#FEE2E2] text-[#B91C1C]`}>{busy === "kyc-no" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />} Reject</button>
                </div>}
              </div>
            )}
          </Card>

          <Card title="Bank account">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Field label="Account holder" value={s.bankHolder} />
              <Field label="Bank" value={s.bankName} />
              <Field label="Account" value={s.bankAccount} mono />
              <Field label="IFSC" value={s.bankIfsc} mono />
            </div>
          </Card>
        </>
      )}

      {tab === "Orders" && (
        <Card title="Recent orders" right={<Link href={`/admin/orders?seller=${id}`} className="text-[12.5px] font-semibold text-[#4361EE] inline-flex items-center gap-1">All orders of this seller <ExternalLink className="w-3 h-3" /></Link>}>
          {data.recentOrders.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[12.5px]">
                <thead><tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF] border-b border-[#F3F4F6]">
                  <th className="py-2 pr-3">Order</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Customer</th><th className="py-2 pr-3">Payment</th><th className="py-2 pr-3">Courier / AWB</th><th className="py-2 pr-3">Status</th><th className="py-2 text-right">Amount</th>
                </tr></thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {data.recentOrders.map(o => (
                    <tr key={o.id}>
                      <td className="py-2.5 pr-3 font-mono text-[#0C1220]">{o.externalOrderId}</td>
                      <td className="py-2.5 pr-3 text-[#6B7280] whitespace-nowrap">{fmt(o.createdAt)}</td>
                      <td className="py-2.5 pr-3 text-[#374151] truncate max-w-[160px]">{o.customerName ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-[#374151]">{o.paymentMode === "UNKNOWN" ? "—" : o.paymentMode}</td>
                      <td className="py-2.5 pr-3 text-[#6B7280] truncate max-w-[180px]">{[o.courier?.replace("Shipdaak · ", ""), o.awbNumber].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="py-2.5 pr-3 text-[11.5px] font-bold" style={{ color: ORDER_TONE[o.status] ?? "#374151" }}>{o.status.replace("_", " ")}</td>
                      <td className="py-2.5 text-right tabular-nums">{inr(o.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="py-10 text-center text-[13px] text-[#9CA3AF]">No orders yet.</p>}
        </Card>
      )}

      {tab === "Money" && (
        <>
          <Card title="Payouts" right={data.payouts.since ? <span className="text-[11.5px] text-[#9CA3AF]">Counting from {fmt(data.payouts.since)}</span> : undefined}>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Stat label="Delivered, not remitted" value={inr(pipe.awaiting.amount)} sub={`${pipe.awaiting.count} orders`} />
              <Stat label="RTO to deduct" value={inr(pipe.rtoPending.amount)} tone={pipe.rtoPending.amount ? "#B91C1C" : "#0C1220"} sub={`${pipe.rtoPending.count} orders`} />
              <Stat label="Scheduled" value={inr(pipe.scheduled.amount)} tone="#4361EE" sub={pipe.scheduled.nextDate ? `Next ${fmt(pipe.scheduled.nextDate)}` : "Nothing scheduled"} />
              <Stat label="Paid to bank" value={inr(pipe.paid.amount)} tone="#047857" sub={pipe.paid.lastDate ? `Last ${fmt(pipe.paid.lastDate)}` : undefined} />
              <Stat label="On hold (plan due)" value={inr(pipe.onHold.amount)} tone={pipe.onHold.amount ? "#B45309" : "#0C1220"} />
            </div>
          </Card>
          <Card title="Recent payouts" right={<Link href="/admin/remittance" className="text-[12.5px] font-semibold text-[#4361EE] inline-flex items-center gap-1">Seller Remittance <ExternalLink className="w-3 h-3" /></Link>}>
            {data.payouts.recent.length ? (
              <div className="divide-y divide-[#F3F4F6]">
                {data.payouts.recent.map(r => (
                  <div key={r.id} className="flex items-center gap-3 py-2.5 text-[12.5px]">
                    <span className="w-[110px] text-[#6B7280]">{fmt(r.date)}</span>
                    <span className="flex-1 text-[#374151]">{r.orders} orders{r.bankRef ? ` · ref ${r.bankRef}` : ""}{r.held ? ` · ${inr(r.held)} held` : ""}</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={r.status === "PAID" ? { background: "#DCFCE7", color: "#047857" } : { background: "#E8EDFF", color: "#4361EE" }}>{r.status === "PAID" ? "Paid" : "Scheduled"}</span>
                    <span className="w-[100px] text-right font-semibold tabular-nums">{inr(r.net)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="py-8 text-center text-[13px] text-[#9CA3AF]">No payouts yet.</p>}
          </Card>
          <Card title="Invoices" right={<Link href="/admin/invoices" className="text-[12.5px] font-semibold text-[#4361EE] inline-flex items-center gap-1">All invoices <ExternalLink className="w-3 h-3" /></Link>}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Issued" value={String(data.invoices.ISSUED ?? 0)} />
              <Stat label="Held" value={String(data.invoices.HELD ?? 0)} tone={data.invoices.HELD ? "#B91C1C" : "#0C1220"} sub={data.invoices.HELD ? "Missing price, HSN or KYC" : undefined} />
              <Stat label="Cancelled" value={String(data.invoices.CANCELLED ?? 0)} />
              <Stat label="Before invoicing began" value={String(data.invoices.EXEMPT ?? 0)} />
            </div>
          </Card>
        </>
      )}

      {tab === "Plan" && (
        <Card title={planName(s.plan, s.planTier)} right={
          <button onClick={() => setPlanOpen(true)} className={`${btn} bg-[#4361EE] text-white`}><CreditCard className="w-3.5 h-3.5" /> Manage plan & payments</button>}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Billed" value={inr(data.billing.totals.due)} />
            <Stat label="Paid" value={inr(data.billing.totals.paid)} tone="#047857" />
            <Stat label="Pending" value={inr(data.billing.totals.pending)} tone={data.billing.totals.pending ? "#B91C1C" : "#0C1220"} />
            <Stat label="Next due" value={data.billing.nextDueDate ? fmt(data.billing.nextDueDate) : "—"} tone={data.billing.overdue ? "#B91C1C" : "#0C1220"} sub={data.billing.overdue ? "Overdue" : undefined} />
          </div>
          {data.billing.periods.length === 0 && <p className="text-[12.5px] text-[#6B7280] mt-3">Billing hasn&apos;t started for this seller. Open &quot;Manage plan & payments&quot; to start it or change the plan.</p>}
          {data.billing.ordersBlocked && <p className="mt-3 flex items-center gap-2 text-[12.5px] font-semibold text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2"><AlertTriangle className="w-4 h-4" /> Orders are on hold until the overdue plan payment is recorded.</p>}
        </Card>
      )}

      {tab === "Account" && (
        <>
          <Card title="Account status">
            <p className="text-[12.5px] text-[#6B7280] mb-3">
              {s.accountStatus === "ACTIVE" ? "This seller is active." : s.accountStatus === "PENDING" ? "This seller signed up and is waiting to be activated." : "This seller is suspended and can't use AXQEN."}
              {s.paymentReference ? ` Signup payment ref: ${s.paymentReference}${s.paymentConfirmed ? " (verified)" : ""}.` : ""}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {s.accountStatus !== "ACTIVE" && (
                <button onClick={() => call("activate", "/api/admin/sellers", "POST", { sellerId: id, action: "activate" }, "Seller activated.")} disabled={!!busy} className={`${btn} bg-[#059669] text-white`}>
                  {busy === "activate" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Activate
                </button>
              )}
              {s.accountStatus === "ACTIVE" && (
                <button onClick={() => { if (confirm("Suspend this seller? They won't be able to use AXQEN until reactivated.")) call("suspend", "/api/admin/sellers", "POST", { sellerId: id, action: "suspend" }, "Seller suspended."); }} disabled={!!busy} className={`${btn} bg-[#FEE2E2] text-[#B91C1C]`}>
                  {busy === "suspend" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />} Suspend
                </button>
              )}
              {s.accountStatus === "PENDING" && (
                <button onClick={() => { if (confirm("Reject this signup? The account will be suspended and the payment marked unverified.")) call("reject", "/api/admin/sellers", "POST", { sellerId: id, action: "reject" }, "Signup rejected."); }} disabled={!!busy} className={`${btn} border border-[#FECACA] text-[#B91C1C]`}>
                  {busy === "reject" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />} Reject signup
                </button>
              )}
            </div>
          </Card>

          <Card title="Data start date">
            <p className="text-[12.5px] text-[#6B7280] mb-3">Orders before this date are left out of this seller&apos;s dashboard, wallet and analytics. Leave empty to count everything.</p>
            <div className="flex items-center gap-2 flex-wrap">
              <input id="data-start" type="date" value={startInput} onChange={e => setStartInput(e.target.value)} className="px-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] outline-none focus:border-[#4361EE]" />
              <button onClick={() => call("start", "/api/admin/sellers", "PATCH", { sellerId: id, dataStartDate: startInput || null }, startInput ? "Data start date saved." : "Data start date cleared.")} disabled={!!busy}
                className={`${btn} bg-[#4361EE] text-white`}>{busy === "start" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarDays className="w-3.5 h-3.5" />} Save</button>
              {s.dataStartDate && <span className="text-[12px] text-[#6B7280]">Currently {fmt(s.dataStartDate)}</span>}
            </div>
          </Card>

          {steps.length > 0 && (
            <Card title="Activation checklist" right={<Link href="/admin/activation" className="text-[12.5px] font-semibold text-[#4361EE]">Seller Activation</Link>}>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {steps.map(([label, done]) => (
                  <div key={label} className="flex items-center gap-1.5 text-[12.5px]" style={{ color: done ? "#047857" : "#9CA3AF" }}>
                    {done ? <CheckCircle2 className="w-4 h-4" /> : <span className="w-4 h-4 rounded-full border-2 border-[#D1D5DB]" />} {label}
                  </div>
                ))}
              </div>
            </Card>
          )}
          <p className="text-[11.5px] text-[#9CA3AF] flex items-center gap-1.5"><Store className="w-3.5 h-3.5" /> Seller ID <span className="font-mono">{s.id}</span></p>
        </>
      )}

      {planOpen && <PlanBillingDrawer sellerId={id} onClose={() => setPlanOpen(false)} onChanged={load} />}
    </div>
  );
}
