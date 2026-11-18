"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FileText, Download, Printer, Search, Loader2, Receipt, Wallet, ExternalLink } from "lucide-react";
import { PlanPaymentsPanel } from "@/components/billing/plan-payments-panel";

interface Row {
  id: string; number: string | null; status: "ISSUED" | "CANCELLED"; issueDate: string | null;
  orderId: string; orderNumber: string | null; customerName: string | null;
  taxableTotal: number; cgst: number; sgst: number; igst: number; total: number;
}
interface Data { invoices: Row[]; totals: { count: number; taxable: number; tax: number; total: number }; months: string[] }

const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const istMonth = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600000).toISOString().slice(0, 7);

export default function DocumentsPage() {
  const [tab, setTab] = useState<"invoices" | "statements" | "plan">("invoices");
  const [month, setMonth] = useState(istMonth());
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ month, ...(search ? { search } : {}) });
    fetch(`/api/seller/invoices?${p}`).then(r => r.json()).then(d => setData(d.invoices ? d : null)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [month, search]);

  const months = [...new Set([istMonth(), ...(data?.months ?? [])])].sort().reverse();

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["Invoice No.", "Date", "Order", "Taxable value", "CGST", "SGST", "IGST", "Total", "Status"],
      ...data.invoices.map(i => [
        i.number ?? "", i.issueDate ? new Date(i.issueDate).toLocaleDateString("en-IN") : "", i.orderNumber ? `#${i.orderNumber}` : "",
        i.taxableTotal.toFixed(2), i.cgst.toFixed(2), i.sgst.toFixed(2), i.igst.toFixed(2), i.total.toFixed(2), i.status === "CANCELLED" ? "Cancelled" : "Issued",
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `axqen-invoices-${month}.csv`;
    a.click();
  }

  return (
    <div className="px-3 py-4 md:p-8 space-y-5" style={{ background: "#F7F8FC", minHeight: "100vh" }}>
      <div>
        <h1 className="text-[22px] font-black text-[#0C1220]">Documents &amp; Invoices</h1>
        <p className="text-[12.5px] text-[#6B7280] mt-1 max-w-[70ch]">Tax invoices from Vrinandya Ventures Pvt. Ltd. for every delivered order, your payout statements, and plan payments.</p>
      </div>

      <div className="flex gap-1 p-1 rounded-xl w-fit bg-[#E8EBFF]">
        {([["invoices", "Tax invoices"], ["statements", "Payout statements"], ["plan", "Plan payments"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="px-4 py-2 rounded-lg text-[13px] font-semibold"
            style={{ background: tab === k ? "white" : "transparent", color: tab === k ? "#4361EE" : "#6B7280", boxShadow: tab === k ? "0 1px 4px rgba(67,97,238,0.15)" : "none" }}>
            {l}
          </button>
        ))}
      </div>

      {tab === "invoices" && (
        <>
          {/* Month summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Invoices", value: loading ? "…" : String(data?.totals.count ?? 0) },
              { label: "Taxable value", value: loading ? "…" : inr(data?.totals.taxable ?? 0) },
              { label: "GST", value: loading ? "…" : inr(data?.totals.tax ?? 0) },
              { label: "Invoice total", value: loading ? "…" : inr(data?.totals.total ?? 0) },
            ].map(t => (
              <div key={t.label} className="bg-white rounded-xl border border-[#E8EDF6] px-4 py-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF] mb-1.5">{t.label}</p>
                <p className="text-[20px] font-black leading-none tabular-nums text-[#0C1220]">{t.value}</p>
                <p className="text-[11px] text-[#9CA3AF] mt-1.5">{monthLabel(month)}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
            <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-b border-[#F3F4F6] bg-[#FAFBFF]">
              <select id="inv-month" aria-label="Month" value={month} onChange={e => setMonth(e.target.value)}
                className="bg-white border border-[#E8EDF6] rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-[#374151] focus:outline-none focus:border-[#4361EE]">
                {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
              <form className="relative flex-1 min-w-[180px] md:max-w-[240px]" onSubmit={e => { e.preventDefault(); setSearch(searchInput.trim()); }}>
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
                <input id="inv-search" value={searchInput} onChange={e => { setSearchInput(e.target.value); if (!e.target.value) setSearch(""); }}
                  placeholder="Invoice number" className="pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] w-full" />
              </form>
              <div className="flex items-center gap-2 md:ml-auto">
                <a href={`/print/invoices?month=${month}`} target="_blank" rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-bold text-white bg-[#4361EE] ${data?.invoices.length ? "" : "pointer-events-none opacity-50"}`}>
                  <Printer className="w-3.5 h-3.5" /> Download month (PDF)
                </a>
                <button onClick={exportCsv} disabled={!data?.invoices.length}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold bg-white border border-[#E8EDF6] text-[#374151] disabled:opacity-50">
                  <Download className="w-3.5 h-3.5" /> CSV for your accountant
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[#9CA3AF]"><Loader2 className="w-5 h-5 animate-spin text-[#4361EE]" /> Loading invoices…</div>
            ) : !data?.invoices.length ? (
              <div className="py-16 text-center px-4">
                <FileText className="w-10 h-10 mx-auto text-[#E8EDF6]" />
                <p className="text-[13px] font-semibold text-[#6B7280] mt-2">No invoices for {monthLabel(month)}</p>
                <p className="text-[12px] text-[#9CA3AF] mt-1">An invoice is created automatically on the day each order is delivered.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-[12.5px]">
                  <thead>
                    <tr className="bg-[#FAFBFF] text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                      <th className="px-4 py-2.5">Invoice</th>
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Order</th>
                      <th className="px-3 py-2.5 text-right">Taxable</th>
                      <th className="px-3 py-2.5 text-right">GST</th>
                      <th className="px-3 py-2.5 text-right">Total</th>
                      <th className="px-3 py-2.5 text-right">Open</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {data.invoices.map(i => (
                      <tr key={i.id} className="hover:bg-[#FAFBFF]">
                        <td className="px-4 py-2.5">
                          <span className="font-mono font-semibold text-[#0C1220]">{i.number}</span>
                          {i.status === "CANCELLED" && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#FEF2F2] text-[#DC2626]">CANCELLED</span>}
                        </td>
                        <td className="px-3 py-2.5 text-[#6B7280] whitespace-nowrap">{i.issueDate ? new Date(i.issueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                        <td className="px-3 py-2.5">
                          {i.orderNumber ? <Link href={`/seller/orders/${i.orderId}`} className="text-[#4361EE] font-semibold hover:underline">#{i.orderNumber}</Link> : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{inr(i.taxableTotal)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[#6B7280]">{inr(i.cgst + i.sgst + i.igst)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#0C1220]">{inr(i.total)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <a href={`/print/invoice/${i.id}`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold bg-[#EEF2FF] text-[#4361EE] hover:bg-[#4361EE] hover:text-white">
                            <Printer className="w-3.5 h-3.5" /> View / PDF
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p className="text-[11.5px] text-[#9CA3AF]">Each invoice lists the product, shipping and packing for one delivered order, with GST worked out from the prices. These are the same amounts deducted in your payouts.</p>
        </>
      )}

      {tab === "statements" && (
        <div className="bg-white rounded-xl border border-[#E8EDF6] p-6 flex items-start gap-4 flex-wrap max-w-2xl">
          <span className="w-11 h-11 rounded-xl bg-[#ECFDF5] flex items-center justify-center"><Wallet className="w-5 h-5 text-[#047857]" /></span>
          <div className="flex-1 min-w-[220px]">
            <p className="text-[15px] font-bold text-[#0C1220]">Payout statements</p>
            <p className="text-[13px] text-[#6B7280] mt-1">Every payout has a statement listing its orders and what was deducted, and for whom. Open one and use Download statement.</p>
          </div>
          <Link href="/seller/wallet" className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-bold text-white bg-[#4361EE]">
            <Receipt className="w-4 h-4" /> Open Wallet &amp; Payouts <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {tab === "plan" && <PlanPaymentsPanel />}
    </div>
  );
}
