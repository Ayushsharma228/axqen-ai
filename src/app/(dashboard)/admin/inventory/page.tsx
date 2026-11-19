"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, Package, Check, ChevronDown } from "lucide-react";

interface Variant { id: string; productId: string; name: string; sku: string | null; stock: number }
interface Row {
  id: string; name: string; sku: string | null; images: string[]; category: string | null; stock: number; updatedAt: string;
  orders30: number; perDay: number; daysLeft: number | null; variants: Variant[];
}
type View = "all" | "out" | "low" | "soon";
const LOW = 10, SOON_DAYS = 7;

export default function AdminInventoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("all");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<{ id: string; text: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/inventory/products").then(r => r.json()).then(d => setRows(d.rows ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const kind = (r: Row): View => (r.stock <= 0 ? "out" : r.daysLeft != null && r.daysLeft < SOON_DAYS ? "soon" : r.stock < LOW ? "low" : "all");
  const counts = useMemo(() => ({
    all: rows.length, out: rows.filter(r => r.stock <= 0).length,
    soon: rows.filter(r => r.stock > 0 && r.daysLeft != null && r.daysLeft < SOON_DAYS).length,
    low: rows.filter(r => r.stock > 0 && r.stock < LOW).length,
  }), [rows]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows
      .filter(r => view === "all" || (view === "out" ? r.stock <= 0 : view === "low" ? r.stock > 0 && r.stock < LOW : r.stock > 0 && r.daysLeft != null && r.daysLeft < SOON_DAYS))
      .filter(r => !s || [r.name, r.sku, r.category].some(v => v?.toLowerCase().includes(s)))
      .sort((a, b) => (view === "soon" ? (a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9) : view === "all" ? b.orders30 - a.orders30 : a.stock - b.stock));
  }, [rows, view, q]);

  async function save(key: string, body: { productId?: string; variantId?: string }, value: string, current: number) {
    const n = Number(value);
    if (value === "" || n === current) { setDraft(d => { const x = { ...d }; delete x[key]; return x; }); return; }
    setSaving(key); setErr(null);
    const res = await fetch("/api/admin/inventory/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, stock: n }) });
    const d = await res.json().catch(() => ({}));
    setSaving(null);
    if (!res.ok) { setErr({ id: key, text: d.error ?? "Couldn't save" }); return; }
    setRows(rs => rs.map(r => body.productId === r.id ? { ...r, stock: n, daysLeft: r.perDay > 0 ? Math.floor(n / r.perDay) : null }
      : { ...r, variants: r.variants.map(v => (v.id === body.variantId ? { ...v, stock: n } : v)) }));
    setDraft(x => { const y = { ...x }; delete y[key]; return y; });
    setSaved(key); setTimeout(() => setSaved(s => (s === key ? null : s)), 1500);
  }

  const stockInput = (key: string, current: number, body: { productId?: string; variantId?: string }) => (
    <div className="inline-flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
      <input id={`stock-${key}`} aria-label="Stock" inputMode="numeric" value={draft[key] ?? String(current)}
        onChange={e => setDraft(d => ({ ...d, [key]: e.target.value.replace(/\D/g, "") }))}
        onBlur={e => save(key, body, e.target.value, current)} onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className={`w-[84px] px-2 py-1.5 text-[13px] text-right tabular-nums rounded-lg border outline-none focus:border-[#4361EE] ${current <= 0 ? "border-[#FECACA] text-[#B91C1C] font-semibold" : current < LOW ? "border-[#FDE68A] text-[#B45309] font-semibold" : "border-[#E8EDF6] text-[#0C1220]"}`} />
      <span className="w-4">{saving === key ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9CA3AF]" /> : saved === key ? <Check className="w-3.5 h-3.5 text-[#059669]" /> : null}</span>
    </div>
  );

  const tiles: { key: View; label: string; value: number; tone: string; hint: string }[] = [
    { key: "all", label: "Live products", value: counts.all, tone: "#0C1220", hint: "Sorted by orders in the last 30 days" },
    { key: "out", label: "Out of stock", value: counts.out, tone: counts.out ? "#B91C1C" : "#0C1220", hint: "Sellers can't sell these" },
    { key: "soon", label: `Runs out within ${SOON_DAYS} days`, value: counts.soon, tone: counts.soon ? "#B45309" : "#0C1220", hint: "At the last 30 days' order pace" },
    { key: "low", label: `Under ${LOW} in stock`, value: counts.low, tone: counts.low ? "#B45309" : "#0C1220", hint: "" },
  ];

  return (
    <div className="px-4 py-5 md:p-8 space-y-5" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div>
        <h1 className="text-[22px] font-black text-[#0C1220]">Inventory</h1>
        <p className="text-[12.5px] text-[#6B7280] mt-1">Stock of every live product, the same number sellers see in the catalogue. Edit a number and press Enter to save.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map(t => (
          <button key={t.key} onClick={() => setView(t.key)} className={`text-left bg-white rounded-xl border p-4 transition-colors ${view === t.key ? "border-[#4361EE] ring-2 ring-[#E8EDFF]" : "border-[#E8EDF6] hover:border-[#C7D2FE]"}`}>
            <p className="text-[11.5px] font-semibold text-[#6B7280]">{t.label}</p>
            <p className="text-[26px] font-black leading-tight tabular-nums mt-1" style={{ color: t.tone }}>{t.value}</p>
            {t.hint && <p className="text-[11px] text-[#9CA3AF] mt-0.5">{t.hint}</p>}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-[#FAFBFF] border-b border-[#F3F4F6]">
          <div className="relative flex-1 min-w-[200px] md:max-w-[300px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
            <input id="inv-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Name, SKU or category" className="pl-8 pr-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] w-full" />
          </div>
          <span className="text-[12px] text-[#9CA3AF] ml-auto">{list.length} products</span>
        </div>
        {loading ? (
          <div className="py-20 flex items-center justify-center gap-2 text-[13px] text-[#9CA3AF]"><Loader2 className="w-4 h-4 animate-spin" /> Loading stock…</div>
        ) : list.length === 0 ? (
          <p className="py-20 text-center text-[13px] text-[#9CA3AF]">{view === "out" ? "Nothing is out of stock." : "No products here."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-[12.5px]">
              <thead>
                <tr className="bg-[#FAFBFF] text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                  <th className="px-4 py-2.5">Product</th><th className="px-3 py-2.5">Category</th>
                  <th className="px-3 py-2.5 text-right">Orders 30d</th><th className="px-3 py-2.5 text-right">Per day</th>
                  <th className="px-3 py-2.5 text-right">Days left</th><th className="px-3 py-2.5 text-right">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {list.map(r => {
                  const k = kind(r);
                  return (
                    <Fragment key={r.id}>
                      <tr className={r.variants.length ? "cursor-pointer hover:bg-[#FAFBFF]" : ""} onClick={() => r.variants.length && setOpen(o => (o === r.id ? null : r.id))}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-lg bg-[#F3F4F6] overflow-hidden flex-shrink-0">
                              {r.images?.[0] ? <img src={r.images[0]} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 m-2.5 text-[#D1D5DB]" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-[#0C1220] truncate max-w-[300px]" title={r.name}>{r.name}</p>
                              <p className="text-[11px] text-[#9CA3AF]">
                                <span className="font-mono">{r.sku ?? "—"}</span>
                                {r.variants.length > 0 && <span className="ml-1.5 text-[#4361EE] font-semibold inline-flex items-center gap-0.5">· {r.variants.length} variants <ChevronDown className={`w-3 h-3 transition-transform ${open === r.id ? "rotate-180" : ""}`} /></span>}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[#6B7280]">{r.category ?? "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[#0C1220] font-semibold">{r.orders30}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[#6B7280]">{r.perDay || "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: k === "out" ? "#B91C1C" : k === "soon" ? "#B45309" : "#374151" }}>
                          {r.stock <= 0 ? "Out" : r.daysLeft != null ? `${r.daysLeft}d` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {stockInput(r.id, r.stock, { productId: r.id })}
                          {err?.id === r.id && <p className="text-[10.5px] text-[#DC2626]">{err.text}</p>}
                        </td>
                      </tr>
                      {open === r.id && r.variants.map(v => (
                        <tr key={v.id} className="bg-[#F9FAFF]">
                          <td className="pl-16 pr-3 py-2 text-[#374151]" colSpan={5}>{v.name} <span className="text-[11px] font-mono text-[#9CA3AF] ml-1">{v.sku ?? ""}</span></td>
                          <td className="px-3 py-2 text-right">
                            {stockInput(v.id, v.stock, { variantId: v.id })}
                            {err?.id === v.id && <p className="text-[10.5px] text-[#DC2626]">{err.text}</p>}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
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
