"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";

/** Create a seller account by hand (same as the old Team page did). The seller then logs in and completes onboarding. */
export function AddSellerModal({ onClose, onAdded }: { onClose: () => void; onAdded: (id: string, email: string) => void }) {
  const [f, setF] = useState({ name: "", email: "", password: "", plan: "DROPSHIPPING" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (f.password.length < 8 || !/\d/.test(f.password)) { setErr("Password should be 8+ characters with a number"); return; }
    setSaving(true); setErr("");
    const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, email: f.email.trim().toLowerCase(), role: "SELLER" }) });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setErr(d.error ?? "Couldn't create the account"); return; }
    onAdded(d.user?.id ?? "", f.email);
  }

  const input = "w-full px-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] outline-none focus:border-[#4361EE]";
  const label = "block text-[11.5px] font-semibold text-[#374151] mb-1";
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={save} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-5 py-4 border-b border-[#F3F4F6] flex items-center justify-between">
          <div>
            <p className="text-[15px] font-bold text-[#0C1220]">Add seller</p>
            <p className="text-[12px] text-[#9CA3AF]">They log in with this email and password and finish onboarding themselves.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg hover:bg-[#F3F4F6]"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          {err && <p className="text-[12.5px] text-[#B91C1C] bg-[#FEF2F2] rounded-lg px-3 py-2">{err}</p>}
          <div><label htmlFor="as-name" className={label}>Name</label><input id="as-name" required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={input} /></div>
          <div><label htmlFor="as-email" className={label}>Email</label><input id="as-email" type="email" required value={f.email} onChange={e => setF({ ...f, email: e.target.value })} className={input} /></div>
          <div><label htmlFor="as-pw" className={label}>Temporary password</label><input id="as-pw" type="text" autoComplete="new-password" required value={f.password} onChange={e => setF({ ...f, password: e.target.value })} className={`${input} font-mono`} /></div>
          <div><label htmlFor="as-plan" className={label}>Plan</label>
            <select id="as-plan" value={f.plan} onChange={e => setF({ ...f, plan: e.target.value })} className={input}><option value="DROPSHIPPING">Dropshipping</option><option value="MARKETPLACE">Marketplace</option></select>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-[#F3F4F6] flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] text-[#374151] border border-[#E8EDF6]">Cancel</button>
          <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold text-white bg-[#4361EE] disabled:opacity-60">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Create seller</button>
        </div>
      </form>
    </div>
  );
}
