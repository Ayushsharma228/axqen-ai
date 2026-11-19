"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Search, Store, ArrowUpDown, ChevronUp, ChevronDown, CheckCircle2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { AddSellerModal } from "@/components/admin/add-seller-modal";

interface Row {
  id: string; name: string | null; email: string; phone: string | null; brand: string | null;
  status: "ACTIVE" | "PENDING" | "SUSPENDED"; plan: string | null; tier: string | null; kyc: string;
  shopify: boolean; joined: string; orders30: number; delivered30: number; rto30: number;
  deliveredPct: number | null; rtoPct: number | null; unpaidCount: number; unpaidAmount: number;
  planState: "NOT_STARTED" | "PAID" | "DUE" | "OVERDUE"; planPending: number; lastOrder: string | null;
}
interface Summary { total: number; active: number; pending: number; suspended: number; planOverdue: number }

type SortKey = "name" | "orders30" | "deliveredPct" | "rtoPct" | "unpaidAmount" | "planPending" | "lastOrder" | "joined";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "—");
const daysAgo = (s: string | null) => (s ? Math.floor((Date.now() - new Date(s).getTime()) / 86400000) : null);

const STATUS: Record<Row["status"], { label: string; bg: string; fg: string }> = {
  ACTIVE: { label: "Active", bg: "#DCFCE7", fg: "#047857" },
  PENDING: { label: "Pending", bg: "#FEF3C7", fg: "#B45309" },
  SUSPENDED: { label: "Suspended", bg: "#FEE2E2", fg: "#B91C1C" },
};
const KYC: Record<string, { label: string; fg: string }> = {
  APPROVED: { label: "Approved", fg: "#047857" }, SUBMITTED: { label: "To review", fg: "#B45309" },
  REJECTED: { label: "Rejected", fg: "#B91C1C" }, NOT_SUBMITTED: { label: "Not submitted", fg: "#9CA3AF" },
};
const PLAN_STATE: Record<Row["planState"], { label: string; bg: string; fg: string }> = {
  PAID: { label: "Paid", bg: "#DCFCE7", fg: "#047857" },
  DUE: { label: "Due", bg: "#E8EDFF", fg: "#4361EE" },
  OVERDUE: { label: "Overdue", bg: "#FEE2E2", fg: "#B91C1C" },
  NOT_STARTED: { label: "Not started", bg: "#F3F4F6", fg: "#6B7280" },
};
const planName = (p: string | null, t: string | null) =>
  !p ? "—" : p === "MARKETPLACE" ? "Marketplace" : `Dropshipping${t ? ` · ${t[0]}${t.slice(1).toLowerCase()}` : ""}`;

export default function AdminSellersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [kyc, setKyc] = useState("");
  const [planState, setPlanState] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "joined", dir: -1 });
  const [adding, setAdding] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/admin/sellers/overview").then(r => r.json())
      .then(d => { if (d.sellers) { setRows(d.sellers); setSummary(d.summary); } else setError(true); })
      .catch(() => setError(true)).finally(() => setLoading(false));
  }, []);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out = rows.filter(r =>
      (!s || [r.name, r.email, r.phone, r.brand].some(v => v?.toLowerCase().includes(s))) &&
      (!status || r.status === status) && (!plan || r.plan === plan) && (!kyc || r.kyc === kyc) && (!planState || r.planState === planState));
    const val = (r: Row): number | string => {
      switch (sort.key) {
        case "name": return (r.name ?? r.email).toLowerCase();
        case "lastOrder": return r.lastOrder ?? "";
        case "joined": return r.joined;
        default: return r[sort.key] ?? -1;
      }
    };
    return [...out].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [rows, q, status, plan, kyc, planState, sort]);

  const setSortKey = (key: SortKey) => setSort(s => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "name" ? 1 : -1 }));
  const th = (children: React.ReactNode, k?: SortKey, right?: boolean) => (
    <th key={String(children)} className={`px-3 py-2.5 whitespace-nowrap ${right ? "text-right" : ""}`}>
      {k ? (
        <button onClick={() => setSortKey(k)} className={`inline-flex items-center gap-1 hover:text-[#4361EE] ${sort.key === k ? "text-[#4361EE]" : ""}`}>
          {children}
          {sort.key === k ? (sort.dir === 1 ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
        </button>
      ) : children}
    </th>
  );

  const tiles: { label: string; value: number; tone: string; onClick: () => void; active: boolean }[] = summary ? [
    { label: "All sellers", value: summary.total, tone: "#0C1220", onClick: () => { setStatus(""); setPlanState(""); }, active: !status && !planState },
    { label: "Active", value: summary.active, tone: "#047857", onClick: () => { setStatus("ACTIVE"); setPlanState(""); }, active: status === "ACTIVE" },
    { label: "Waiting activation", value: summary.pending, tone: "#B45309", onClick: () => { setStatus("PENDING"); setPlanState(""); }, active: status === "PENDING" },
    { label: "Suspended", value: summary.suspended, tone: "#B91C1C", onClick: () => { setStatus("SUSPENDED"); setPlanState(""); }, active: status === "SUSPENDED" },
    { label: "Plan overdue", value: summary.planOverdue, tone: "#B91C1C", onClick: () => { setStatus(""); setPlanState("OVERDUE"); }, active: planState === "OVERDUE" },
  ] : [];
  const select = "px-2.5 py-1.5 text-[12.5px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] text-[#374151]";

  return (
    <div className="px-4 py-5 md:p-8 space-y-5" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-black text-[#0C1220]">Sellers</h1>
          <p className="text-[12.5px] text-[#6B7280] mt-1">Every seller with their last 30 days of orders, unpaid delivered value and plan status. Open a seller for the full picture.</p>
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold text-white bg-[#4361EE]"><Plus className="w-3.5 h-3.5" /> Add seller</button>
      </div>
      {adding && <AddSellerModal onClose={() => setAdding(false)} onAdded={id => { setAdding(false); if (id) router.push(`/admin/sellers/${id}`); }} />}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-[#9CA3AF]"><Loader2 className="w-5 h-5 animate-spin" /> Loading sellers…</div>
      ) : error ? (
        <p className="py-24 text-center text-[13px] text-[#B91C1C]">Couldn&apos;t load sellers. Refresh to try again.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {tiles.map(t => (
              <button key={t.label} onClick={t.onClick}
                className={`text-left bg-white rounded-xl border p-4 transition-colors ${t.active ? "border-[#4361EE] ring-2 ring-[#E8EDFF]" : "border-[#E8EDF6] hover:border-[#C7D2FE]"}`}>
                <p className="text-[11.5px] font-semibold text-[#6B7280]">{t.label}</p>
                <p className="text-[26px] font-black leading-tight tabular-nums mt-1" style={{ color: t.tone }}>{t.value}</p>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
            <div className="flex items-center gap-2 flex-wrap px-4 py-3 bg-[#FAFBFF] border-b border-[#F3F4F6]">
              <div className="relative flex-1 min-w-[200px] md:max-w-[300px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
                <input id="seller-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Name, brand, email or phone"
                  className="pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] w-full" />
              </div>
              <select id="f-status" aria-label="Status" className={select} value={status} onChange={e => setStatus(e.target.value)}>
                <option value="">All statuses</option><option value="ACTIVE">Active</option><option value="PENDING">Pending</option><option value="SUSPENDED">Suspended</option>
              </select>
              <select id="f-plan" aria-label="Plan" className={select} value={plan} onChange={e => setPlan(e.target.value)}>
                <option value="">All plans</option><option value="DROPSHIPPING">Dropshipping</option><option value="MARKETPLACE">Marketplace</option>
              </select>
              <select id="f-kyc" aria-label="KYC" className={select} value={kyc} onChange={e => setKyc(e.target.value)}>
                <option value="">All KYC</option><option value="SUBMITTED">To review</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="NOT_SUBMITTED">Not submitted</option>
              </select>
              <select id="f-planstate" aria-label="Plan payment" className={select} value={planState} onChange={e => setPlanState(e.target.value)}>
                <option value="">All plan payments</option><option value="OVERDUE">Overdue</option><option value="DUE">Due</option><option value="PAID">Paid</option><option value="NOT_STARTED">Not started</option>
              </select>
              <span className="text-[12px] text-[#9CA3AF] ml-auto">{list.length} of {rows.length}</span>
            </div>

            {list.length === 0 ? (
              <p className="py-16 text-center text-[13px] text-[#9CA3AF]">No sellers match these filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] text-[12.5px]">
                  <thead>
                    <tr className="bg-[#FAFBFF] text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                      {th("Seller", "name")}
                      {th("Plan")}
                      {th("Status")}
                      {th("KYC")}
                      {th("Shopify")}
                      {th("Orders 30d", "orders30", true)}
                      {th("Delivered", "deliveredPct", true)}
                      {th("RTO", "rtoPct", true)}
                      {th("Unpaid delivered", "unpaidAmount", true)}
                      {th("Plan payment", "planPending")}
                      {th("Last order", "lastOrder")}
                      {th("Joined", "joined")}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {list.map(r => {
                      const s = STATUS[r.status], k = KYC[r.kyc] ?? KYC.NOT_SUBMITTED, p = PLAN_STATE[r.planState];
                      const idle = daysAgo(r.lastOrder);
                      return (
                        <tr key={r.id} className="hover:bg-[#FAFBFF]">
                          <td className="px-3 py-2.5">
                            <Link href={`/admin/sellers/${r.id}`} className="flex items-center gap-2.5 group">
                              <span className="w-8 h-8 rounded-full bg-[#E8EDFF] text-[#4361EE] text-[12px] font-bold flex items-center justify-center flex-shrink-0">
                                {(r.name ?? r.email)[0]?.toUpperCase()}
                              </span>
                              <span className="min-w-0">
                                <span className="block font-semibold text-[#0C1220] group-hover:text-[#4361EE] truncate max-w-[200px]">{r.name ?? r.email}</span>
                                <span className="block text-[11px] text-[#9CA3AF] truncate max-w-[200px]">{[r.brand, r.phone].filter(Boolean).join(" · ") || r.email}</span>
                              </span>
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-[#374151] whitespace-nowrap">{planName(r.plan, r.tier)}</td>
                          <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded-md text-[11px] font-bold" style={{ background: s.bg, color: s.fg }}>{s.label}</span></td>
                          <td className="px-3 py-2.5 text-[12px] font-semibold whitespace-nowrap" style={{ color: k.fg }}>{k.label}</td>
                          <td className="px-3 py-2.5">{r.shopify ? <CheckCircle2 className="w-4 h-4 text-[#059669]" aria-label="Connected" /> : <span className="text-[#C4C9D4]">—</span>}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-[#0C1220] font-semibold">{r.orders30}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-[#047857]">{r.deliveredPct != null ? `${r.deliveredPct}%` : "—"}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {r.rtoPct != null ? <span className="font-semibold" style={{ color: r.rtoPct >= 50 ? "#B91C1C" : r.rtoPct >= 30 ? "#B45309" : "#374151" }}>{r.rtoPct}%</span> : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-[#374151]">
                            {r.unpaidCount ? <>{inr(r.unpaidAmount)}<span className="block text-[10.5px] text-[#9CA3AF]">{r.unpaidCount} orders</span></> : "—"}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold" style={{ background: p.bg, color: p.fg }}>{p.label}</span>
                            {r.planPending > 0 && <span className="ml-1.5 text-[11.5px] text-[#6B7280] tabular-nums">{inr(r.planPending)}</span>}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="text-[#374151]">{date(r.lastOrder)}</span>
                            {idle != null && idle >= 7 && <span className="block text-[10.5px] text-[#B45309]">{idle} days ago</span>}
                          </td>
                          <td className="px-3 py-2.5 text-[#6B7280] whitespace-nowrap">{date(r.joined)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p className="text-[11px] text-[#9CA3AF] flex items-center gap-1.5"><Store className="w-3.5 h-3.5" /> Delivered and RTO % use the last 30 days of orders. Unpaid delivered = delivered orders not yet remitted, after product, shipping and packing.</p>
        </>
      )}
    </div>
  );
}
