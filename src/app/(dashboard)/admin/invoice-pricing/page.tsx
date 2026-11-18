"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Search, Check, AlertTriangle, Package } from "lucide-react";

interface P {
  id: string; name: string; sku: string | null; images: string[]; price: number; costPrice: number | null;
  hsn: string | null; gstRate: number | null; invoicePrice: number | null; invoiceShipping: number | null; invoicePacking: number | null;
}
type Draft = { invoicePrice: string; invoiceShipping: string; invoicePacking: string; hsn: string; gstRate: string };

const toDraft = (p: P): Draft => ({
  invoicePrice: p.invoicePrice?.toString() ?? "", invoiceShipping: p.invoiceShipping?.toString() ?? "",
  invoicePacking: p.invoicePacking?.toString() ?? "", hsn: p.hsn ?? "", gstRate: p.gstRate?.toString() ?? "",
});
const RATES = ["0", "5", "12", "18", "28"];

export default function InvoicePricingPage() {
  const [rows, setRows] = useState<P[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [missing, setMissing] = useState(0);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; text: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ ...(search ? { search } : {}), ...(onlyMissing ? { missing: "1" } : {}) });
    fetch(`/api/admin/invoice-pricing?${p}`).then(r => r.json()).then(d => {
      setRows(d.products ?? []);
      setMissing(d.missingCount ?? 0);
      setDrafts(Object.fromEntries((d.products ?? []).map((x: P) => [x.id, toDraft(x)])));
    }).finally(() => setLoading(false));
  }, [search, onlyMissing]);
  useEffect(() => { load(); }, [load]);

  async function save(p: P) {
    const d = drafts[p.id];
    setSaving(p.id); setError(null);
    const res = await fetch("/api/admin/invoice-pricing", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: p.id, ...d }) });
    const out = await res.json().catch(() => ({}));
    setSaving(null);
    if (!res.ok) { setError({ id: p.id, text: out.error ?? "Couldn't save" }); return; }
    setRows(rs => rs.map(r => (r.id === p.id ? { ...r, ...out.product } : r)));
    setSaved(p.id); setTimeout(() => setSaved(s => (s === p.id ? null : s)), 1800);
  }

  const changed = (p: P) => JSON.stringify(drafts[p.id]) !== JSON.stringify(toDraft(p));
  const input = "w-full px-2 py-1.5 text-[12.5px] rounded-md border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] tabular-nums";

  return (
    <div className="px-4 py-5 md:p-8 space-y-5" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <Link href="/admin/invoices" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#4361EE]"><ArrowLeft className="w-3.5 h-3.5" /> Invoices</Link>
      <div>
        <h1 className="text-[22px] font-black text-[#0C1220]">Product invoice pricing</h1>
        <p className="text-[12.5px] text-[#6B7280] mt-1 max-w-[80ch]">
          What Vrinandya charges the seller per unit, <b>GST included</b>. Set once, change only when a price changes. Every AXP invoice and the payout deduction for delivered orders use these amounts; invoices already issued keep their old amounts.
        </p>
      </div>

      {missing > 0 && (
        <button onClick={() => setOnlyMissing(true)} className="w-full text-left flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E]">
          <AlertTriangle className="w-4 h-4 text-[#D97706]" /> <b>{missing}</b> product{missing > 1 ? "s" : ""} still need a price, HSN or GST rate. Orders with them can&apos;t be invoiced.
        </button>
      )}

      <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
        <div className="flex items-center gap-2 flex-wrap px-4 py-3 bg-[#FAFBFF] border-b border-[#F3F4F6]">
          <form className="relative flex-1 min-w-[200px] md:max-w-[280px]" onSubmit={e => { e.preventDefault(); setSearch(searchInput.trim()); }}>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
            <input id="price-search" value={searchInput} onChange={e => { setSearchInput(e.target.value); if (!e.target.value) setSearch(""); }} placeholder="Product name or SKU"
              className="pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] w-full" />
          </form>
          <label className="flex items-center gap-1.5 text-[12.5px] text-[#374151]">
            <input id="only-missing" type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} className="accent-[#4361EE]" /> Only missing
          </label>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[#9CA3AF]"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-[13px] text-[#9CA3AF]">No products.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-[12.5px]">
              <thead>
                <tr className="bg-[#FAFBFF] text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                  <th className="px-4 py-2.5">Product</th>
                  <th className="px-2 py-2.5 w-[110px]">Price to seller ₹</th>
                  <th className="px-2 py-2.5 w-[100px]">Shipping ₹</th>
                  <th className="px-2 py-2.5 w-[100px]">Packing ₹</th>
                  <th className="px-2 py-2.5 w-[110px]">HSN</th>
                  <th className="px-2 py-2.5 w-[80px]">GST %</th>
                  <th className="px-2 py-2.5 w-[120px] text-right">Taxable / GST</th>
                  <th className="px-3 py-2.5 w-[90px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {rows.map(p => {
                  const d = drafts[p.id] ?? toDraft(p);
                  const price = Number(d.invoicePrice), rate = Number(d.gstRate);
                  const taxable = d.invoicePrice && d.gstRate !== "" ? price / (1 + rate / 100) : null;
                  const incomplete = !d.invoicePrice || d.gstRate === "" || !d.hsn;
                  const upd = (k: keyof Draft, v: string) => setDrafts(x => ({ ...x, [p.id]: { ...d, [k]: v } }));
                  return (
                    <tr key={p.id} className="align-middle">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-md bg-[#F3F4F6] overflow-hidden flex-shrink-0">
                            {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 m-2.5 text-[#D1D5DB]" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[#0C1220] truncate max-w-[260px]" title={p.name}>{p.name}</p>
                            <p className="text-[11px] text-[#9CA3AF]">{p.sku ?? "—"}{p.costPrice != null ? ` · supplier cost ₹${p.costPrice}` : ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2"><input id={`pp-${p.id}`} aria-label="Price to seller" inputMode="decimal" className={input} value={d.invoicePrice} onChange={e => upd("invoicePrice", e.target.value)} /></td>
                      <td className="px-2 py-2"><input id={`ps-${p.id}`} aria-label="Shipping" inputMode="decimal" className={input} value={d.invoiceShipping} onChange={e => upd("invoiceShipping", e.target.value)} /></td>
                      <td className="px-2 py-2"><input id={`pk-${p.id}`} aria-label="Packing" inputMode="decimal" className={input} value={d.invoicePacking} onChange={e => upd("invoicePacking", e.target.value)} /></td>
                      <td className="px-2 py-2"><input id={`ph-${p.id}`} aria-label="HSN" inputMode="numeric" maxLength={8} className={`${input} font-mono`} value={d.hsn} onChange={e => upd("hsn", e.target.value.replace(/\D/g, ""))} /></td>
                      <td className="px-2 py-2">
                        <select id={`pg-${p.id}`} aria-label="GST rate" className={input} value={d.gstRate} onChange={e => upd("gstRate", e.target.value)}>
                          <option value="">—</option>
                          {RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2 text-right text-[11.5px] text-[#6B7280] tabular-nums">
                        {taxable != null ? <>₹{taxable.toFixed(2)}<br />+ ₹{(price - taxable).toFixed(2)}</> : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {saved === p.id ? (
                          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#047857]"><Check className="w-3.5 h-3.5" /> Saved</span>
                        ) : (
                          <button onClick={() => save(p)} disabled={!changed(p) || saving === p.id}
                            className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-white bg-[#4361EE] disabled:opacity-40">
                            {saving === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
                          </button>
                        )}
                        {incomplete && !changed(p) && <p className="text-[10.5px] text-[#B45309] mt-0.5">Incomplete</p>}
                        {error?.id === p.id && <p className="text-[10.5px] text-[#DC2626] mt-0.5 max-w-[160px] ml-auto">{error.text}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
