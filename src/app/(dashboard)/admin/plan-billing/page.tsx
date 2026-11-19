"use client";

import { useState, useEffect, useCallback } from "react";
import { PlanBillingDrawer } from "@/components/billing/plan-billing-drawer";
import { Loader2, Search } from "lucide-react";

interface SellerRow {
  id: string; name: string | null; brandName: string | null; email: string; plan: string; planTier: string | null; accountStatus: string;
  started: boolean; due: number; paid: number; pending: number; overdue: boolean; nextDueDate: string | null;
  held: number; releasable: number; ordersBlocked: boolean;
}
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const fmtD = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const planName = (p: string, t: string | null) => p === "MARKETPLACE" ? "Marketplace" : `Dropshipping${t ? ` ${t.charAt(0)}${t.slice(1).toLowerCase()}` : ""}`;
type Filter = "ALL" | "PENDING" | "OVERDUE" | "RELEASE" | "NOT_STARTED";

export default function PlanBillingPage() {
  const [rows, setRows] = useState<SellerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/plan-billing").then(r => r.json()).then(d => setRows(d.sellers ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const count = (f: Filter) => rows.filter(r => match(r, f)).length;
  const shown = rows.filter(r => match(r, filter)).filter(r => !q.trim() || `${r.brandName} ${r.name} ${r.email}`.toLowerCase().includes(q.trim().toLowerCase()));
  const totalPending = rows.reduce((s, r) => s + r.pending, 0);
  const totalHeld = rows.reduce((s, r) => s + r.held, 0);

  return (
    <div className="px-4 py-5 md:p-8 space-y-5" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div>
        <h1 className="text-[22px] font-black text-[#0C1220]">Plan Billing</h1>
        <p className="text-[12.5px] text-[#6B7280] mt-1 max-w-[80ch]">Plan dues and payments for every seller (invoices are made in Tally). Pending dues are held from Dropshipping payouts; Marketplace orders stop after an unpaid due date.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Pending across sellers", value: inr(totalPending), color: totalPending ? "#DC2626" : "#0C1220" },
          { label: "Overdue sellers", value: String(count("OVERDUE")), color: count("OVERDUE") ? "#DC2626" : "#0C1220" },
          { label: "Held from payouts", value: inr(totalHeld), color: "#0C1220" },
          { label: "Ready to release", value: String(count("RELEASE")), color: count("RELEASE") ? "#047857" : "#0C1220" },
        ].map(t => (
          <div key={t.label} className="bg-white rounded-xl border border-[#E8EDF6] px-4 py-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF] mb-1.5">{t.label}</p>
            <p className="text-[22px] font-black leading-none tabular-nums" style={{ color: t.color }}>{loading ? "…" : t.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
        <div className="flex items-center gap-1 border-b border-[#F3F4F6] px-2 overflow-x-auto">
          {([["PENDING", "Pending"], ["OVERDUE", "Overdue"], ["RELEASE", "Release held money"], ["NOT_STARTED", "Billing not started"], ["ALL", "All"]] as [Filter, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className="px-3 py-3 text-[13px] font-semibold border-b-2 -mb-px whitespace-nowrap"
              style={{ borderColor: filter === k ? "#4361EE" : "transparent", color: filter === k ? "#4361EE" : "#6B7280" }}>
              {l} <span className="ml-1 text-[10.5px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: filter === k ? "#4361EE" : "#F3F4F6", color: filter === k ? "white" : "#9CA3AF" }}>{count(k)}</span>
            </button>
          ))}
        </div>
        <div className="px-4 py-3 bg-[#FAFBFF] border-b border-[#F3F4F6]">
          <div className="relative max-w-[280px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
            <input id="pb-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Seller name or email"
              className="pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] w-full" />
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[#9CA3AF]"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
        ) : shown.length === 0 ? (
          <p className="py-16 text-center text-[13px] text-[#9CA3AF]">No sellers here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-[12.5px]">
              <thead>
                <tr className="bg-[#FAFBFF] text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                  <th className="px-4 py-2.5">Seller</th><th className="px-3 py-2.5">Plan</th>
                  <th className="px-3 py-2.5 text-right">Due</th><th className="px-3 py-2.5 text-right">Paid</th><th className="px-3 py-2.5 text-right">Pending</th>
                  <th className="px-3 py-2.5">Due date</th><th className="px-3 py-2.5 text-right">Held</th><th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {shown.map(r => (
                  <tr key={r.id} className="hover:bg-[#FAFBFF] cursor-pointer" onClick={() => setOpenId(r.id)}>
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-[#0C1220]">{r.brandName || r.name || r.email}</p>
                      <p className="text-[11px] text-[#9CA3AF]">{r.email}</p>
                    </td>
                    <td className="px-3 py-2.5 text-[#374151]">{planName(r.plan, r.planTier)}</td>
                    {r.started ? <>
                      <td className="px-3 py-2.5 text-right tabular-nums">{inr(r.due)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#047857]">{inr(r.paid)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold" style={{ color: r.pending > 0 ? "#DC2626" : "#9CA3AF" }}>{inr(r.pending)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {r.nextDueDate ? <span style={{ color: r.overdue ? "#DC2626" : "#374151", fontWeight: r.overdue ? 700 : 400 }}>{fmtD(r.nextDueDate)}{r.overdue ? " · overdue" : ""}</span> : <span className="text-[#9CA3AF]">{r.pending > 0 ? "Not set" : "—"}</span>}
                        {r.ordersBlocked && <p className="text-[10.5px] font-bold text-[#DC2626]">Orders on hold</p>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.held > 0 ? <span style={{ color: r.releasable ? "#047857" : "#0C1220", fontWeight: 600 }}>{inr(r.held)}{r.releasable ? " · release" : ""}</span> : "—"}</td>
                    </> : (
                      <td colSpan={5} className="px-3 py-2.5 text-[12px] text-[#B45309]">Billing not started</td>
                    )}
                    <td className="px-3 py-2.5 text-right text-[12px] font-semibold text-[#4361EE]">Open</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openId && <PlanBillingDrawer sellerId={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}

function match(r: SellerRow, f: Filter) {
  if (f === "ALL") return true;
  if (f === "NOT_STARTED") return !r.started;
  if (f === "PENDING") return r.started && r.pending > 0;
  if (f === "OVERDUE") return r.overdue;
  return r.releasable > 0;
}
