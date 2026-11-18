"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Loader2, Play, RefreshCw, Printer, Settings2, Tags, AlertTriangle, XCircle, Search } from "lucide-react";

type Status = "ISSUED" | "HELD" | "CANCELLED";
interface Row {
  id: string; number: string | null; status: Status; heldReason: string | null; cancelReason: string | null;
  issueDate: string | null; updatedAt: string; orderId: string; orderNumber: string | null; sellerId: string; seller: string;
  taxableTotal: number; tax: number; total: number; placeOfSupply: string | null;
}
interface Seller { id: string; name: string | null; brandName: string | null; email: string }

const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const istMonth = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 7);

export default function AdminInvoicesPage() {
  const [status, setStatus] = useState<Status>("ISSUED");
  const [month, setMonth] = useState(istMonth());
  const [sellerId, setSellerId] = useState("");
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ status, ...(status !== "HELD" && month ? { month } : {}), ...(sellerId ? { sellerId } : {}), ...(search ? { search } : {}) });
    fetch(`/api/admin/invoices?${p}`).then(r => r.json()).then(d => { setRows(d.invoices ?? []); setCounts(d.counts ?? {}); }).finally(() => setLoading(false));
  }, [status, month, sellerId, search]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch("/api/admin/sellers").then(r => r.json()).then(d => setSellers(d.sellers ?? [])).catch(() => {}); }, []);

  async function act(body: Record<string, unknown>, key: string) {
    setBusy(key); setFlash(null);
    const res = await fetch("/api/admin/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setFlash({ ok: false, text: d.error ?? "Failed" }); return; }
    if (body.action === "run") setFlash({ ok: true, text: d.baseline ? `Invoicing started. ${d.exempted} orders delivered earlier were marked as before invoicing and won't be invoiced.` : `Checked ${d.checked}: ${d.issued} issued, ${d.held} held.` });
    else if (body.action === "retryAll") setFlash({ ok: true, text: `${d.issued} issued, ${d.held} still held.` });
    else if (body.action === "retry") setFlash({ ok: d.status === "ISSUED", text: d.status === "ISSUED" ? `Issued ${d.number}` : `Still held: ${d.reason}` });
    else setFlash({ ok: true, text: "Invoice cancelled. Its number stays on record." });
    load();
  }

  return (
    <div className="px-4 py-5 md:p-8 space-y-5" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-black text-[#0C1220]">Invoices</h1>
          <p className="text-[12.5px] text-[#6B7280] mt-1 max-w-[75ch]">AXP tax invoices from Vrinandya Ventures to sellers, one per delivered order, created automatically every hour on the delivery date.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/admin/invoice-pricing" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-white border border-[#E8EDF6] text-[#374151]"><Tags className="w-3.5 h-3.5" /> Product pricing</Link>
          <Link href="/admin/invoices/settings" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-white border border-[#E8EDF6] text-[#374151]"><Settings2 className="w-3.5 h-3.5" /> Settings</Link>
          <button onClick={() => act({ action: "run" }, "run")} disabled={busy === "run"} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-bold text-white bg-[#4361EE] disabled:opacity-60">
            {busy === "run" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Run now
          </button>
        </div>
      </div>

      {flash && (
        <div className="px-4 py-2.5 rounded-xl text-[13px]" style={{ background: flash.ok ? "#ECFDF5" : "#FEF2F2", color: flash.ok ? "#047857" : "#B91C1C" }}>{flash.text}</div>
      )}

      {(counts.HELD ?? 0) > 0 && status !== "HELD" && (
        <button onClick={() => setStatus("HELD")} className="w-full text-left flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E]">
          <AlertTriangle className="w-4 h-4 text-[#D97706]" /> <b>{counts.HELD}</b> delivered order{counts.HELD > 1 ? "s are" : " is"} waiting for an invoice: missing KYC address or product pricing. Fix and retry.
        </button>
      )}

      <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
        <div className="flex items-center border-b border-[#F3F4F6] px-2">
          {(["ISSUED", "HELD", "CANCELLED"] as Status[]).map(s => (
            <button key={s} onClick={() => setStatus(s)} className="px-4 py-3 text-[13px] font-semibold border-b-2 -mb-px"
              style={{ borderColor: status === s ? "#4361EE" : "transparent", color: status === s ? "#4361EE" : "#6B7280" }}>
              {s === "ISSUED" ? "Issued" : s === "HELD" ? "Held" : "Cancelled"}
              <span className="ml-1.5 text-[10.5px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: status === s ? "#4361EE" : "#F3F4F6", color: status === s ? "white" : "#9CA3AF" }}>{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap px-4 py-3 bg-[#FAFBFF] border-b border-[#F3F4F6]">
          {status !== "HELD" && (
            <input id="inv-month" type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="bg-white border border-[#E8EDF6] rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-[#374151]" />
          )}
          <select id="inv-seller" aria-label="Seller" value={sellerId} onChange={e => setSellerId(e.target.value)}
            className="bg-white border border-[#E8EDF6] rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-[#374151] max-w-[220px]">
            <option value="">All sellers</option>
            {sellers.map(s => <option key={s.id} value={s.id}>{s.brandName || s.name || s.email}</option>)}
          </select>
          <form className="relative flex-1 min-w-[180px] md:max-w-[240px]" onSubmit={e => { e.preventDefault(); setSearch(searchInput.trim()); }}>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
            <input id="inv-search" value={searchInput} onChange={e => { setSearchInput(e.target.value); if (!e.target.value) setSearch(""); }} placeholder="Invoice number"
              className="pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] w-full" />
          </form>
          {status === "ISSUED" && sellerId && (
            <a href={`/print/invoices?month=${month}&sellerId=${sellerId}`} target="_blank" rel="noopener noreferrer" className="md:ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold bg-white border border-[#E8EDF6] text-[#374151]">
              <Printer className="w-3.5 h-3.5" /> Print seller&apos;s month
            </a>
          )}
          {status === "HELD" && (counts.HELD ?? 0) > 0 && (
            <button onClick={() => act({ action: "retryAll" }, "retryAll")} disabled={busy === "retryAll"} className="md:ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-bold text-white bg-[#D97706] disabled:opacity-60">
              {busy === "retryAll" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Retry all held
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[#9CA3AF]"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-[13px] text-[#9CA3AF]">Nothing here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-[12.5px]">
              <thead>
                <tr className="bg-[#FAFBFF] text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                  <th className="px-4 py-2.5">{status === "HELD" ? "Order" : "Invoice"}</th>
                  <th className="px-3 py-2.5">Seller</th>
                  {status === "HELD" ? <th className="px-3 py-2.5">Why it&apos;s held</th> : <>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Place of supply</th>
                    <th className="px-3 py-2.5 text-right">Taxable</th>
                    <th className="px-3 py-2.5 text-right">GST</th>
                    <th className="px-3 py-2.5 text-right">Total</th>
                  </>}
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {rows.map(r => (
                  <tr key={r.id} className="align-top hover:bg-[#FAFBFF]">
                    <td className="px-4 py-2.5">
                      {status === "HELD" ? <span className="font-semibold">#{r.orderNumber}</span> : <span className="font-mono font-semibold">{r.number}</span>}
                      {status !== "HELD" && r.orderNumber && <p className="text-[11px] text-[#9CA3AF]">Order #{r.orderNumber}</p>}
                      {r.cancelReason && <p className="text-[11px] text-[#DC2626]">{r.cancelReason}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-[#374151]">{r.seller}</td>
                    {status === "HELD" ? (
                      <td className="px-3 py-2.5 text-[12px] text-[#92400E] max-w-[420px]">{r.heldReason}</td>
                    ) : <>
                      <td className="px-3 py-2.5 text-[#6B7280] whitespace-nowrap">{r.issueDate ? new Date(r.issueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                      <td className="px-3 py-2.5 text-[#6B7280]">{r.placeOfSupply}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{inr(r.taxableTotal)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#6B7280]">{inr(r.tax)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold">{inr(r.total)}</td>
                    </>}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {status === "HELD" ? (
                          <button onClick={() => act({ action: "retry", invoiceId: r.id }, r.id)} disabled={busy === r.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold bg-[#FFFBEB] text-[#B45309] disabled:opacity-60">
                            {busy === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Retry
                          </button>
                        ) : (
                          <a href={`/print/invoice/${r.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold bg-[#EEF2FF] text-[#4361EE]">
                            <Printer className="w-3.5 h-3.5" /> View
                          </a>
                        )}
                        {status === "ISSUED" && (
                          <button onClick={() => { const reason = prompt(`Cancel ${r.number}? Its number stays on record and is never reused.\n\nReason:`); if (reason?.trim()) act({ action: "cancel", invoiceId: r.id, reason }, r.id); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold bg-[#FEF2F2] text-[#DC2626]">
                            <XCircle className="w-3.5 h-3.5" /> Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
