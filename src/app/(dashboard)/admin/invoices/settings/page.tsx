"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Save } from "lucide-react";
import type { InvoiceSettings } from "@/lib/invoice-format";

export default function InvoiceSettingsPage() {
  const [s, setS] = useState<InvoiceSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { fetch("/api/admin/invoices/settings").then(r => r.json()).then(d => setS(d.settings)); }, []);

  async function save() {
    if (!s) return;
    setSaving(true); setMsg(null);
    const res = await fetch("/api/admin/invoices/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: s }) });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    setMsg(res.ok ? { ok: true, text: "Saved. New invoices use these settings; invoices already issued don't change." } : { ok: false, text: d.error ?? "Couldn't save" });
  }

  if (!s) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-[#4361EE]" /></div>;

  const input = "w-full px-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE]";
  const label = "block text-[11.5px] font-semibold text-[#374151] mb-1";
  const set = (fn: (x: InvoiceSettings) => InvoiceSettings) => setS(prev => (prev ? fn(prev) : prev));
  const example = `${s.series}/26-27/${"1".padStart(Number(s.digits) || 5, "0")}`;

  return (
    <div className="px-4 py-5 md:p-8 space-y-5 max-w-3xl" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <Link href="/admin/invoices" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#4361EE]"><ArrowLeft className="w-3.5 h-3.5" /> Invoices</Link>
      <div>
        <h1 className="text-[22px] font-black text-[#0C1220]">Invoice settings</h1>
        <p className="text-[12.5px] text-[#6B7280] mt-1">What prints on every AXP invoice. Changes apply to new invoices only.</p>
      </div>
      {msg && <div className="px-4 py-2.5 rounded-xl text-[13px]" style={{ background: msg.ok ? "#ECFDF5" : "#FEF2F2", color: msg.ok ? "#047857" : "#B91C1C" }}>{msg.text}</div>}

      <section className="bg-white rounded-xl border border-[#E8EDF6] p-5 space-y-3">
        <h2 className="text-[14px] font-bold text-[#0C1220]">Company</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><label htmlFor="c-name" className={label}>Legal name</label><input id="c-name" className={input} value={s.company.name} onChange={e => set(x => ({ ...x, company: { ...x.company, name: e.target.value } }))} /></div>
          <div className="sm:col-span-2"><label htmlFor="c-addr" className={label}>Address (one line per row)</label>
            <textarea id="c-addr" rows={3} className={`${input} resize-none`} value={s.company.addressLines.join("\n")} onChange={e => set(x => ({ ...x, company: { ...x.company, addressLines: e.target.value.split("\n") } }))} /></div>
          <div><label htmlFor="c-gstin" className={label}>GSTIN</label><input id="c-gstin" className={`${input} font-mono`} value={s.company.gstin} onChange={e => set(x => ({ ...x, company: { ...x.company, gstin: e.target.value.toUpperCase() } }))} /></div>
          <div><label htmlFor="c-cin" className={label}>CIN</label><input id="c-cin" className={`${input} font-mono`} value={s.company.cin} onChange={e => set(x => ({ ...x, company: { ...x.company, cin: e.target.value.toUpperCase() } }))} /></div>
          <div><label htmlFor="c-state" className={label}>State</label><input id="c-state" className={input} value={s.company.stateName} onChange={e => set(x => ({ ...x, company: { ...x.company, stateName: e.target.value } }))} /></div>
          <div><label htmlFor="c-code" className={label}>State code</label><input id="c-code" maxLength={2} className={`${input} font-mono`} value={s.company.stateCode} onChange={e => set(x => ({ ...x, company: { ...x.company, stateCode: e.target.value.replace(/\D/g, "") } }))} /></div>
          <div className="sm:col-span-2"><label htmlFor="c-email" className={label}>Email</label><input id="c-email" className={input} value={s.company.email} onChange={e => set(x => ({ ...x, company: { ...x.company, email: e.target.value } }))} /></div>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-[#E8EDF6] p-5 space-y-3">
        <h2 className="text-[14px] font-bold text-[#0C1220]">Numbering</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label htmlFor="n-series" className={label}>Series prefix</label><input id="n-series" maxLength={6} className={`${input} font-mono`} value={s.series} onChange={e => set(x => ({ ...x, series: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") }))} /></div>
          <div><label htmlFor="n-digits" className={label}>Digits</label>
            <select id="n-digits" className={input} value={s.digits} onChange={e => set(x => ({ ...x, digits: Number(e.target.value) }))}>
              {[3, 4, 5, 6].map(d => <option key={d} value={d}>{d}</option>)}
            </select></div>
        </div>
        <p className="text-[12px] text-[#6B7280]">Example: <span className="font-mono font-semibold text-[#0C1220]">{example}</span>. Restarts at 1 every April. Changing the prefix mid-year starts a new series, so tell your CA.</p>
      </section>

      <section className="bg-white rounded-xl border border-[#E8EDF6] p-5 space-y-3">
        <h2 className="text-[14px] font-bold text-[#0C1220]">Shipping and packing lines</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="packing-amount" className={label}>Packing per order ₹ (GST incl.)</label>
            <input id="packing-amount" inputMode="decimal" className={input} value={s.packing.amount ?? 0} onChange={e => set(x => ({ ...x, packing: { ...x.packing, amount: Number(e.target.value) || 0 } }))} />
          </div>
          <p className="col-span-2 text-[12px] text-[#6B7280] self-end pb-2">Added once to every invoice. A product&apos;s own packing amount in Product pricing replaces it for orders containing that product.</p>
        </div>
        {(["shipping", "packing"] as const).map(k => (
          <div key={k} className="grid grid-cols-3 gap-3">
            <div><label htmlFor={`${k}-label`} className={label}>{k === "shipping" ? "Shipping label" : "Packing label"}</label><input id={`${k}-label`} className={input} value={s[k].label} onChange={e => set(x => ({ ...x, [k]: { ...x[k], label: e.target.value } }))} /></div>
            <div><label htmlFor={`${k}-sac`} className={label}>SAC code</label><input id={`${k}-sac`} className={`${input} font-mono`} value={s[k].sac} onChange={e => set(x => ({ ...x, [k]: { ...x[k], sac: e.target.value.replace(/\D/g, "") } }))} /></div>
            <div><label htmlFor={`${k}-rate`} className={label}>GST %</label><input id={`${k}-rate`} inputMode="decimal" className={input} value={s[k].rate} onChange={e => set(x => ({ ...x, [k]: { ...x[k], rate: Number(e.target.value) || 0 } }))} /></div>
          </div>
        ))}
      </section>

      <section className="bg-white rounded-xl border border-[#E8EDF6] p-5 space-y-3">
        <h2 className="text-[14px] font-bold text-[#0C1220]">Bank details and declaration</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([["holder", "Account holder"], ["bankName", "Bank name"], ["account", "Account number"], ["branchIfsc", "Branch & IFSC"], ["swift", "SWIFT (optional)"]] as const).map(([k, l]) => (
            <div key={k}><label htmlFor={`b-${k}`} className={label}>{l}</label><input id={`b-${k}`} className={input} value={s.bank[k]} onChange={e => set(x => ({ ...x, bank: { ...x.bank, [k]: e.target.value } }))} /></div>
          ))}
          <div className="sm:col-span-2"><label htmlFor="decl" className={label}>Declaration</label>
            <textarea id="decl" rows={2} className={`${input} resize-none`} value={s.declaration} onChange={e => set(x => ({ ...x, declaration: e.target.value }))} /></div>
        </div>
      </section>

      <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-bold text-white bg-[#4361EE] disabled:opacity-60">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save settings
      </button>
    </div>
  );
}
