"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Search, Plus, Package, ChevronUp, ChevronDown, ArrowUpDown, X, Pencil, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { ProductForm, type EditableProduct } from "@/components/admin/product-form";

interface Stats { orders: number; units: number; delivered: number; rto: number; moving: number; cancelled: number; deliveredValue: number; deliveredPct: number | null; rtoPct: number | null; orderingSellers: number }
interface Product extends EditableProduct {
  status: "APPROVED" | "PENDING" | "REJECTED"; adminNote: string | null; createdAt: string;
  supplier: { id: string; name: string | null; email: string }; listedSellers: number; stats: Stats;
}
interface Summary { total: number; approved: number; pending: number; missingPricing: number; outOfStock: number }
interface Detail {
  product: Product; variants: { id: string; name: string; sku: string | null; price: number; stock: number }[]; stats: Stats;
  bySeller: (Stats & { seller: string })[]; byState: (Stats & { state: string })[]; listings: { status: string; platform: string; seller: string }[];
}
type View = "approved" | "pending" | "missingPricing" | "outOfStock" | "all";
type SortKey = "name" | "invoicePrice" | "margin" | "orders" | "deliveredPct" | "rtoPct" | "deliveredValue" | "listedSellers" | "stock";

const RANGES: { label: string; days: number | null }[] = [{ label: "30 days", days: 30 }, { label: "90 days", days: 90 }, { label: "All time", days: null }];
const inr = (n: number | null | undefined, dp = 0) => (n == null ? "—" : `₹${n.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`);
const marginOf = (p: Product) => {
  if (p.invoicePrice == null || p.costPrice == null) return null;
  const taxable = p.gstRate != null ? p.invoicePrice / (1 + p.gstRate / 100) : p.invoicePrice;
  return Math.round((taxable - p.costPrice) * 100) / 100;
};
const pctColor = (p: number | null, bad = false) => (p == null ? "#9CA3AF" : bad ? (p >= 30 ? "#B91C1C" : p >= 20 ? "#B45309" : "#047857") : p >= 80 ? "#047857" : p >= 65 ? "#B45309" : "#B91C1C");
const STATUS = { APPROVED: ["Live", "#DCFCE7", "#047857"], PENDING: ["Pending approval", "#FEF3C7", "#B45309"], REJECTED: ["Rejected", "#FEE2E2", "#B91C1C"] } as const;

export default function AdminProductsPage() {
  const [rows, setRows] = useState<Product[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<number | null>(90);
  const [view, setView] = useState<View>("approved");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "orders", dir: -1 });
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<{ product?: EditableProduct } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/products/board${days ? `?days=${days}` : ""}`).then(r => r.json())
      .then(d => { if (d.products) { setRows(d.products); setSummary(d.summary); } }).finally(() => setLoading(false));
  }, [days]);
  useEffect(() => { load(); }, [load]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out = rows.filter(p =>
      (view === "all" || (view === "approved" ? p.status === "APPROVED" : view === "pending" ? p.status === "PENDING"
        : view === "missingPricing" ? p.status === "APPROVED" && (p.invoicePrice == null || !p.hsn || p.gstRate == null)
        : p.status === "APPROVED" && p.stock <= 0)) &&
      (!s || [p.name, p.sku, p.category].some(v => v?.toLowerCase().includes(s))));
    const val = (p: Product): number | string => {
      switch (sort.key) {
        case "name": return p.name.toLowerCase();
        case "invoicePrice": return p.invoicePrice ?? -1;
        case "margin": return marginOf(p) ?? -1e9;
        case "listedSellers": return p.listedSellers;
        case "stock": return p.stock;
        default: return p.stats[sort.key] ?? -1;
      }
    };
    return [...out].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [rows, view, q, sort]);

  const th = (label: string, k?: SortKey, right = false) => (
    <th key={label} className={`px-3 py-2.5 whitespace-nowrap ${right ? "text-right" : ""}`}>
      {k ? (
        <button onClick={() => setSort(s => (s.key === k ? { key: k, dir: s.dir === 1 ? -1 : 1 } : { key: k, dir: k === "name" ? 1 : -1 }))}
          className={`inline-flex items-center gap-1 hover:text-[#4361EE] ${sort.key === k ? "text-[#4361EE]" : ""}`}>
          {label}{sort.key === k ? (sort.dir === 1 ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
        </button>
      ) : label}
    </th>
  );
  const tiles: { key: View; label: string; value: number; tone: string }[] = summary ? [
    { key: "approved", label: "Live products", value: summary.approved, tone: "#0C1220" },
    { key: "pending", label: "Pending approval", value: summary.pending, tone: summary.pending ? "#B45309" : "#0C1220" },
    { key: "missingPricing", label: "Missing invoice pricing", value: summary.missingPricing, tone: summary.missingPricing ? "#B91C1C" : "#0C1220" },
    { key: "outOfStock", label: "Out of stock", value: summary.outOfStock, tone: summary.outOfStock ? "#B91C1C" : "#0C1220" },
    { key: "all", label: "All products", value: summary.total, tone: "#0C1220" },
  ] : [];
  const chip = (on: boolean) => `px-2.5 py-1 rounded-lg text-[12px] font-semibold ${on ? "bg-[#E8EDFF] text-[#4361EE]" : "text-[#6B7280] hover:bg-[#F3F6FF]"}`;

  return (
    <div className="px-4 py-5 md:p-8 space-y-5" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-black text-[#0C1220]">Products</h1>
          <p className="text-[12.5px] text-[#6B7280] mt-1">The catalogue with pricing and how each product performs: orders, delivered %, RTO % and who&apos;s selling it.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white rounded-lg border border-[#E8EDF6] p-1">
            {RANGES.map(r => <button key={r.label} onClick={() => setDays(r.days)} className={chip(days === r.days)}>{r.label}</button>)}
          </div>
          <button onClick={() => setForm({})} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold text-white bg-[#4361EE]"><Plus className="w-3.5 h-3.5" /> Add product</button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {tiles.map(t => (
            <button key={t.key} onClick={() => setView(t.key)} className={`text-left bg-white rounded-xl border p-4 transition-colors ${view === t.key ? "border-[#4361EE] ring-2 ring-[#E8EDFF]" : "border-[#E8EDF6] hover:border-[#C7D2FE]"}`}>
              <p className="text-[11.5px] font-semibold text-[#6B7280]">{t.label}</p>
              <p className="text-[26px] font-black leading-tight tabular-nums mt-1" style={{ color: t.tone }}>{t.value}</p>
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
        <div className="flex items-center gap-2 flex-wrap px-4 py-3 bg-[#FAFBFF] border-b border-[#F3F4F6]">
          <div className="relative flex-1 min-w-[200px] md:max-w-[300px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
            <input id="prod-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Name, SKU or category" className="pl-8 pr-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] w-full" />
          </div>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-[#9CA3AF]" />}
          <span className="text-[12px] text-[#9CA3AF] ml-auto">{list.length} products · orders matched by SKU</span>
        </div>
        {!summary && loading ? (
          <div className="py-20 flex items-center justify-center gap-2 text-[13px] text-[#9CA3AF]"><Loader2 className="w-4 h-4 animate-spin" /> Loading products…</div>
        ) : list.length === 0 ? (
          <p className="py-20 text-center text-[13px] text-[#9CA3AF]">No products here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-[12.5px]">
              <thead>
                <tr className="bg-[#FAFBFF] text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                  {th("Product", "name")}{th("Cost", undefined, true)}{th("Invoice price", "invoicePrice", true)}{th("Margin", "margin", true)}{th("GST")}
                  {th("Orders", "orders", true)}{th("Delivered", "deliveredPct", true)}{th("RTO", "rtoPct", true)}{th("Delivered value", "deliveredValue", true)}
                  {th("Listed by", "listedSellers", true)}{th("Stock", "stock", true)}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {list.map(p => {
                  const m = marginOf(p), st = STATUS[p.status];
                  return (
                    <tr key={p.id} onClick={() => setOpenId(p.id)} className="cursor-pointer hover:bg-[#FAFBFF]">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-lg bg-[#F3F4F6] overflow-hidden flex-shrink-0">
                            {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 m-3 text-[#D1D5DB]" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[#0C1220] truncate max-w-[260px]" title={p.name}>{p.name}</p>
                            <p className="text-[11px] text-[#9CA3AF]"><span className="font-mono">{p.sku ?? "—"}</span>{p.status !== "APPROVED" && <span className="ml-1.5 font-bold" style={{ color: st[2] }}>· {st[0]}</span>}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#6B7280]">{inr(p.costPrice)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#0C1220]">{p.invoicePrice != null ? inr(p.invoicePrice) : <span className="text-[#B91C1C] text-[11.5px] font-semibold">Not set</span>}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: m == null ? "#9CA3AF" : m < 0 ? "#B91C1C" : "#047857" }}>{m == null ? "—" : inr(m)}</td>
                      <td className="px-3 py-2.5 text-[#6B7280] whitespace-nowrap">{p.gstRate != null ? `${p.gstRate}%` : <span className="text-[#B91C1C]">—</span>}{p.hsn && <span className="block text-[10.5px] font-mono text-[#9CA3AF]">{p.hsn}</span>}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[#0C1220]">{p.stats.orders}{p.stats.moving > 0 && <span className="block text-[10.5px] font-normal text-[#9CA3AF]">{p.stats.moving} moving</span>}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums"><span className="font-semibold" style={{ color: pctColor(p.stats.deliveredPct) }}>{p.stats.deliveredPct != null ? `${p.stats.deliveredPct}%` : "—"}</span><span className="block text-[10.5px] text-[#9CA3AF]">{p.stats.delivered}</span></td>
                      <td className="px-3 py-2.5 text-right tabular-nums"><span className="font-semibold" style={{ color: pctColor(p.stats.rtoPct, true) }}>{p.stats.rtoPct != null ? `${p.stats.rtoPct}%` : "—"}</span><span className="block text-[10.5px] text-[#9CA3AF]">{p.stats.rto}</span></td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{p.stats.deliveredValue ? inr(p.stats.deliveredValue) : "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#374151]">{p.listedSellers}{p.stats.orderingSellers > 0 && <span className="block text-[10.5px] text-[#9CA3AF]">{p.stats.orderingSellers} with orders</span>}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: p.stock <= 0 ? "#B91C1C" : p.stock < 10 ? "#B45309" : "#374151" }}>{p.stock}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openId && <ProductDrawer id={openId} days={days} onClose={() => setOpenId(null)} onEdit={p => setForm({ product: p })} onChanged={load} />}
      {form && <ProductForm product={form.product} onClose={() => setForm(null)} onSaved={id => { setForm(null); load(); if (id) setOpenId(id); }} />}
    </div>
  );
}

function ProductDrawer({ id, days, onClose, onEdit, onChanged }: { id: string; days: number | null; onClose: () => void; onEdit: (p: Product) => void; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    fetch(`/api/admin/products/board?id=${id}${days ? `&days=${days}` : ""}`).then(r => r.json()).then(x => (x.product ? setD(x) : setErr(x.error ?? "Couldn't load")));
  }, [id, days]);
  useEffect(() => { load(); }, [load]);

  async function decide(status: "APPROVED" | "REJECTED") {
    setBusy(true); setErr("");
    const res = await fetch("/api/admin/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: id, status, adminNote: note }) });
    setBusy(false);
    if (!res.ok) { const x = await res.json().catch(() => ({})); setErr(x.error ?? "Couldn't save"); return; }
    load(); onChanged();
  }

  const p = d?.product, s = d?.stats;
  const table = (rows: (Stats & { label: string })[], head: string) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-[12.5px]">
        <thead><tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF] border-b border-[#F3F4F6]">
          <th className="py-2 pr-3">{head}</th><th className="py-2 pr-3 text-right">Orders</th><th className="py-2 pr-3 text-right">Delivered</th><th className="py-2 pr-3 text-right">RTO</th><th className="py-2 text-right">Value</th>
        </tr></thead>
        <tbody className="divide-y divide-[#F3F4F6]">
          {rows.map(r => (
            <tr key={r.label}>
              <td className="py-2 pr-3 text-[#0C1220] truncate max-w-[180px]">{r.label}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{r.orders}</td>
              <td className="py-2 pr-3 text-right tabular-nums" style={{ color: pctColor(r.deliveredPct) }}>{r.deliveredPct != null ? `${r.deliveredPct}%` : "—"}</td>
              <td className="py-2 pr-3 text-right tabular-nums" style={{ color: pctColor(r.rtoPct, true) }}>{r.rtoPct != null ? `${r.rtoPct}%` : "—"}</td>
              <td className="py-2 text-right tabular-nums">{r.deliveredValue ? inr(r.deliveredValue) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onClick={onClose}>
      <aside className="w-full max-w-2xl bg-[#F7F8FC] h-full overflow-y-auto" onClick={e => e.stopPropagation()} aria-label="Product details">
        <div className="sticky top-0 bg-white border-b border-[#E8EDF6] px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div className="min-w-0">
            <p className="text-[16px] font-bold text-[#0C1220] truncate">{p?.name ?? "Product"}</p>
            {p && <p className="text-[12px] text-[#9CA3AF]"><span className="font-mono">{p.sku}</span> · {p.category ?? "No category"} · by {p.supplier.name || p.supplier.email}</p>}
          </div>
          <div className="flex items-center gap-2">
            {p && <button onClick={() => onEdit(p)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold border border-[#E8EDF6] text-[#374151] hover:border-[#C7D2FE]"><Pencil className="w-3.5 h-3.5" /> Edit</button>}
            <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-[#F3F4F6]"><X className="w-4 h-4" /></button>
          </div>
        </div>
        {err && <p className="m-5 text-[12.5px] text-[#B91C1C] bg-[#FEF2F2] rounded-lg px-3 py-2">{err}</p>}
        {!d || !p || !s ? <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#4361EE]" /></div> : (
          <div className="p-5 space-y-4">
            {p.status !== "APPROVED" && (
              <section className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-4 space-y-2">
                <p className="text-[13px] font-bold text-[#92400E] flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> {p.status === "PENDING" ? "Waiting for approval" : "Rejected"}{p.adminNote ? `: ${p.adminNote}` : ""}</p>
                <div className="flex gap-2 flex-wrap">
                  <input id="pd-note" value={note} onChange={e => setNote(e.target.value)} placeholder="Note to the supplier (optional)" className="flex-1 min-w-[180px] px-3 py-2 text-[12.5px] rounded-lg border border-[#FDE68A] bg-white outline-none" />
                  <button onClick={() => decide("APPROVED")} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold text-white bg-[#059669] disabled:opacity-50"><CheckCircle2 className="w-3.5 h-3.5" /> Approve</button>
                  {p.status === "PENDING" && <button onClick={() => decide("REJECTED")} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold bg-[#FEE2E2] text-[#B91C1C] disabled:opacity-50"><XCircle className="w-3.5 h-3.5" /> Reject</button>}
                </div>
              </section>
            )}

            {p.images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">{p.images.map(u => <img key={u} src={u} alt="" className="w-24 h-24 rounded-lg object-cover border border-[#E8EDF6] flex-shrink-0" />)}</div>
            )}

            <section className="bg-white rounded-xl border border-[#E8EDF6] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF] mb-2">Pricing</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12.5px]">
                {[["Supplier cost", inr(p.costPrice)], ["Catalogue price", inr(p.price)], ["Invoice price (GST incl.)", inr(p.invoicePrice)], ["Margin over cost", inr(marginOf(p), 2)],
                  ["Suggested selling", inr(p.suggestedPrice)], ["Invoice shipping", inr(p.invoiceShipping)], ["HSN · GST", `${p.hsn ?? "—"} · ${p.gstRate != null ? `${p.gstRate}%` : "—"}`], ["Stock", String(p.stock)]].map(([l, v]) => (
                  <div key={l}><p className="text-[11px] text-[#9CA3AF]">{l}</p><p className="font-semibold text-[#0C1220] tabular-nums">{v}</p></div>
                ))}
              </div>
              <Link href="/admin/invoice-pricing" className="inline-block mt-3 text-[12px] font-semibold text-[#4361EE]">Invoice pricing for all products</Link>
            </section>

            <section className="bg-white rounded-xl border border-[#E8EDF6] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF] mb-3">Performance {days ? `· last ${days} days` : "· all time"}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[["Orders", String(s.orders), "#0C1220"], ["Delivered", s.deliveredPct != null ? `${s.deliveredPct}%` : "—", pctColor(s.deliveredPct)], ["RTO", s.rtoPct != null ? `${s.rtoPct}%` : "—", pctColor(s.rtoPct, true)], ["Delivered value", inr(s.deliveredValue), "#0C1220"]].map(([l, v, c]) => (
                  <div key={l} className="bg-[#FAFBFF] rounded-lg border border-[#EEF1F8] p-3">
                    <p className="text-[11px] text-[#6B7280]">{l}</p><p className="text-[18px] font-black tabular-nums" style={{ color: c }}>{v}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11.5px] text-[#9CA3AF] mt-2">{s.delivered} delivered · {s.rto} RTO · {s.moving} moving · {s.cancelled} cancelled · {s.units} units delivered</p>
            </section>

            <section className="bg-white rounded-xl border border-[#E8EDF6] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF] mb-2">By seller</p>
              {d.bySeller.length ? table(d.bySeller.map(r => ({ ...r, label: r.seller })), "Seller") : <p className="text-[12.5px] text-[#9CA3AF]">No orders for this product yet.</p>}
              {d.listings.length > 0 && (
                <p className="text-[11.5px] text-[#6B7280] mt-3">Listing requests: {d.listings.map(l => `${l.seller} (${l.platform.toLowerCase()}, ${l.status.toLowerCase().replace("_", " ")})`).join(", ")}</p>
              )}
            </section>

            {d.byState.length > 0 && (
              <section className="bg-white rounded-xl border border-[#E8EDF6] p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF] mb-2">By state</p>
                {table(d.byState.map(r => ({ ...r, label: r.state })), "State")}
              </section>
            )}

            {d.variants.length > 0 && (
              <section className="bg-white rounded-xl border border-[#E8EDF6] p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF] mb-2">Variants</p>
                <div className="divide-y divide-[#F3F4F6] text-[12.5px]">
                  {d.variants.map(v => <div key={v.id} className="flex gap-3 py-2"><span className="flex-1 text-[#0C1220]">{v.name}</span><span className="font-mono text-[#9CA3AF]">{v.sku ?? "—"}</span><span className="tabular-nums w-[80px] text-right">{inr(v.price)}</span><span className="tabular-nums w-[60px] text-right">{v.stock}</span></div>)}
                </div>
              </section>
            )}

            {p.description && (
              <section className="bg-white rounded-xl border border-[#E8EDF6] p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF] mb-2">Description</p>
                <p className="text-[12.5px] text-[#374151] whitespace-pre-line">{p.description}</p>
              </section>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
