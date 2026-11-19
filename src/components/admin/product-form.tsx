"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Loader2, ImagePlus, Trash2 } from "lucide-react";

export interface EditableProduct {
  id: string; name: string; sku: string | null; images: string[]; category: string | null; description: string | null;
  price: number; costPrice: number | null; suggestedPrice: number | null; invoicePrice: number | null; invoiceShipping: number | null; invoicePacking: number | null;
  hsn: string | null; gstRate: number | null; stock: number; weight: number | null; length: number | null; width: number | null; height: number | null; moq: number | null;
}

type Fields = Record<"name" | "sku" | "category" | "description" | "price" | "costPrice" | "suggestedPrice" | "invoicePrice" | "invoiceShipping" | "invoicePacking" | "hsn" | "gstRate" | "stock" | "weight" | "length" | "width" | "height" | "moq", string>;
const s = (v: number | string | null | undefined) => (v == null ? "" : String(v));
const toFields = (p?: EditableProduct): Fields => ({
  name: s(p?.name), sku: s(p?.sku), category: s(p?.category), description: s(p?.description),
  price: s(p?.price), costPrice: s(p?.costPrice), suggestedPrice: s(p?.suggestedPrice),
  invoicePrice: s(p?.invoicePrice), invoiceShipping: s(p?.invoiceShipping), invoicePacking: s(p?.invoicePacking),
  hsn: s(p?.hsn), gstRate: s(p?.gstRate), stock: s(p?.stock ?? 0), weight: s(p?.weight), length: s(p?.length), width: s(p?.width), height: s(p?.height), moq: s(p?.moq),
});
const RATES = ["0", "5", "12", "18", "28"];

/** Add (no product) or edit (product given) a catalogue product. */
export function ProductForm({ product, onClose, onSaved }: { product?: EditableProduct; onClose: () => void; onSaved: (id?: string) => void }) {
  const editing = !!product;
  const [f, setF] = useState<Fields>(toFields(product));
  const [keep, setKeep] = useState<string[]>(product?.images ?? []);
  const [files, setFiles] = useState<File[]>([]);
  const [owners, setOwners] = useState<{ id: string; name: string | null; email: string; products: number }[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (editing) return;
    fetch("/api/admin/products/manage").then(r => r.json()).then(d => { setOwners(d.suppliers ?? []); setOwnerId(d.houseSupplierId ?? ""); }).catch(() => {});
  }, [editing]);

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF(x => ({ ...x, [k]: e.target.value }));
  const previews = useMemo(() => files.map(file => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach(p => URL.revokeObjectURL(p.url)), [previews]);

  const inv = Number(f.invoicePrice), rate = Number(f.gstRate), cost = Number(f.costPrice);
  const taxable = f.invoicePrice && f.gstRate !== "" ? inv / (1 + rate / 100) : null;
  const margin = f.invoicePrice && f.costPrice ? inv - (taxable != null ? inv - taxable : 0) - cost : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr("");
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => fd.append(k, v));
    files.forEach(file => fd.append("images", file));
    if (editing) { fd.append("id", product!.id); fd.append("keepImages", JSON.stringify(keep)); }
    else fd.append("ownerId", ownerId);
    const res = await fetch("/api/admin/products/manage", { method: editing ? "PATCH" : "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setErr(d.error ?? "Couldn't save"); return; }
    onSaved(d.id);
  }

  const input = "w-full px-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE]";
  const label = "block text-[11.5px] font-semibold text-[#374151] mb-1";
  const section = "bg-white rounded-xl border border-[#E8EDF6] p-4 space-y-3";

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex justify-end" onClick={onClose}>
      <form onSubmit={save} onClick={e => e.stopPropagation()} className="w-full max-w-2xl bg-[#F7F8FC] h-full flex flex-col">
        <div className="bg-white border-b border-[#E8EDF6] px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[16px] font-bold text-[#0C1220]">{editing ? "Edit product" : "Add product"}</p>
            <p className="text-[12px] text-[#9CA3AF]">{editing ? "Changes show to sellers straight away. Invoices already issued keep their old amounts." : "Added products are approved and show in the seller catalogue straight away."}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-[#F3F4F6]"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {err && <p className="text-[12.5px] text-[#B91C1C] bg-[#FEF2F2] rounded-lg px-3 py-2">{err}</p>}

          <section className={section}>
            <p className="text-[13px] font-bold text-[#0C1220]">Product</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><label htmlFor="pf-name" className={label}>Name *</label><input id="pf-name" required className={input} value={f.name} onChange={set("name")} /></div>
              <div><label htmlFor="pf-sku" className={label}>SKU * (10 characters)</label><input id="pf-sku" required maxLength={10} className={`${input} font-mono uppercase`} value={f.sku} onChange={set("sku")} /></div>
              <div><label htmlFor="pf-cat" className={label}>Category</label><input id="pf-cat" className={input} value={f.category} onChange={set("category")} /></div>
              <div className="sm:col-span-2"><label htmlFor="pf-desc" className={label}>Description</label><textarea id="pf-desc" rows={3} className={`${input} resize-y`} value={f.description} onChange={set("description")} /></div>
              {!editing && (
                <div className="sm:col-span-2">
                  <label htmlFor="pf-owner" className={label}>Belongs to account *</label>
                  <select id="pf-owner" required className={input} value={ownerId} onChange={e => setOwnerId(e.target.value)}>
                    <option value="">Pick your team&apos;s supplier account</option>
                    {owners.map(o => <option key={o.id} value={o.id}>{o.name || o.email} · {o.products} products</option>)}
                  </select>
                  <p className="text-[11px] text-[#9CA3AF] mt-1">Remembered for next time.</p>
                </div>
              )}
            </div>
          </section>

          <section className={section}>
            <p className="text-[13px] font-bold text-[#0C1220]">Images</p>
            <div className="flex flex-wrap gap-2">
              {keep.map(u => (
                <div key={u} className="relative w-20 h-20 rounded-lg overflow-hidden border border-[#E8EDF6] bg-[#F9FAFB]">
                  <img src={u} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setKeep(k => k.filter(x => x !== u))} aria-label="Remove image" className="absolute top-1 right-1 p-1 rounded bg-white/90 text-[#B91C1C]"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
              {previews.map(p => (
                <div key={p.url} className="relative w-20 h-20 rounded-lg overflow-hidden border border-[#C7D2FE]">
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setFiles(fs => fs.filter(x => x !== p.file))} aria-label="Remove image" className="absolute top-1 right-1 p-1 rounded bg-white/90 text-[#B91C1C]"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
              <label htmlFor="pf-images" className="w-20 h-20 rounded-lg border-2 border-dashed border-[#D9E0F2] flex flex-col items-center justify-center text-[#6B7280] cursor-pointer hover:border-[#4361EE] hover:text-[#4361EE] text-[10.5px] font-semibold gap-1">
                <ImagePlus className="w-4 h-4" /> Add
              </label>
              <input id="pf-images" type="file" accept="image/*" multiple className="hidden" onChange={e => { setFiles(fs => [...fs, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} />
            </div>
          </section>

          <section className={section}>
            <p className="text-[13px] font-bold text-[#0C1220]">Pricing</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div><label htmlFor="pf-cost" className={label}>Supplier cost ₹</label><input id="pf-cost" inputMode="decimal" className={input} value={f.costPrice} onChange={set("costPrice")} /></div>
              <div><label htmlFor="pf-price" className={label}>Catalogue price ₹ *</label><input id="pf-price" required inputMode="decimal" className={input} value={f.price} onChange={set("price")} /></div>
              <div><label htmlFor="pf-mrp" className={label}>Suggested selling price ₹</label><input id="pf-mrp" inputMode="decimal" className={input} value={f.suggestedPrice} onChange={set("suggestedPrice")} /></div>
              <div><label htmlFor="pf-inv" className={label}>Invoice price ₹ (GST incl.)</label><input id="pf-inv" inputMode="decimal" className={input} value={f.invoicePrice} onChange={set("invoicePrice")} /></div>
              <div><label htmlFor="pf-ship" className={label}>Invoice shipping ₹</label><input id="pf-ship" inputMode="decimal" className={input} value={f.invoiceShipping} onChange={set("invoiceShipping")} /></div>
              <div><label htmlFor="pf-pack" className={label}>Packing override ₹</label><input id="pf-pack" inputMode="decimal" placeholder="Default" className={input} value={f.invoicePacking} onChange={set("invoicePacking")} /></div>
              <div><label htmlFor="pf-hsn" className={label}>HSN</label><input id="pf-hsn" inputMode="numeric" maxLength={8} className={`${input} font-mono`} value={f.hsn} onChange={e => setF(x => ({ ...x, hsn: e.target.value.replace(/\D/g, "") }))} /></div>
              <div><label htmlFor="pf-gst" className={label}>GST %</label>
                <select id="pf-gst" className={input} value={f.gstRate} onChange={set("gstRate")}><option value="">—</option>{RATES.map(r => <option key={r} value={r}>{r}%</option>)}</select>
              </div>
            </div>
            <p className="text-[11.5px] text-[#6B7280]">
              Catalogue price is what sellers see. Invoice price is what AXP invoices and payout deductions use.
              {taxable != null && <> Taxable <b>₹{taxable.toFixed(2)}</b> + GST <b>₹{(inv - taxable).toFixed(2)}</b>.</>}
              {margin != null && <> Margin over cost <b className={margin < 0 ? "text-[#B91C1C]" : "text-[#047857]"}>₹{margin.toFixed(2)}</b>.</>}
            </p>
          </section>

          <section className={section}>
            <p className="text-[13px] font-bold text-[#0C1220]">Stock and package</p>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <div className="col-span-1 sm:col-span-2"><label htmlFor="pf-stock" className={label}>Stock</label><input id="pf-stock" inputMode="numeric" className={input} value={f.stock} onChange={set("stock")} /></div>
              <div className="col-span-1"><label htmlFor="pf-moq" className={label}>MOQ</label><input id="pf-moq" inputMode="numeric" className={input} value={f.moq} onChange={set("moq")} /></div>
              <div className="col-span-1"><label htmlFor="pf-w" className={label}>Weight kg</label><input id="pf-w" inputMode="decimal" className={input} value={f.weight} onChange={set("weight")} /></div>
              <div className="col-span-2 grid grid-cols-3 gap-1.5">
                <div><label htmlFor="pf-l" className={label}>L cm</label><input id="pf-l" inputMode="decimal" className={input} value={f.length} onChange={set("length")} /></div>
                <div><label htmlFor="pf-b" className={label}>B cm</label><input id="pf-b" inputMode="decimal" className={input} value={f.width} onChange={set("width")} /></div>
                <div><label htmlFor="pf-h" className={label}>H cm</label><input id="pf-h" inputMode="decimal" className={input} value={f.height} onChange={set("height")} /></div>
              </div>
            </div>
          </section>
        </div>

        <div className="bg-white border-t border-[#E8EDF6] px-5 py-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] font-medium text-[#374151] border border-[#E8EDF6] hover:bg-[#F9FAFB]">Cancel</button>
          <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold text-white bg-[#4361EE] disabled:opacity-60">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {editing ? "Save changes" : "Add product"}
          </button>
        </div>
      </form>
    </div>
  );
}
