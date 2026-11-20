"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

type DeletionRequest = { requestedAt: string; ticketNumber: number };

const fmt = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

/** Lets a seller ask for their account to be deleted, or cancel that request. */
export function DeleteAccountPanel({ email }: { email: string }) {
  const [request, setRequest] = useState<DeletionRequest | null | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/seller/account/delete").then(r => r.json()).then(d => setRequest(d.request ?? null)).catch(() => setRequest(null));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await fetch("/api/seller/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, confirm, reason }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(d.error ?? "Couldn't send the request. Try again."); return; }
    setRequest(d.request); setPassword(""); setConfirm("");
  }

  async function cancel() {
    setBusy(true); setErr("");
    const res = await fetch("/api/seller/account/delete", { method: "DELETE" });
    setBusy(false);
    if (!res.ok) { setErr("Couldn't cancel the request. Try again."); return; }
    setRequest(null);
  }

  const input = "w-full px-3 py-2.5 text-[13.5px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#DC2626]";
  const label = "block text-[12px] font-semibold text-[#374151] mb-1.5";

  if (request === undefined) return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#9CA3AF]" /></div>;

  if (request) {
    return (
      <div className="space-y-4">
        <h2 className="text-[16px] font-bold text-[#0C1220]">Delete account</h2>
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-[#FFFBEB] text-[#92400E] text-[13px]">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>You asked to delete your account on {fmt(request.requestedAt)} (ticket #{request.ticketNumber}). Our team will settle any pending payouts and close the account within 7 working days. We&apos;ll email {email} when it&apos;s done.</p>
        </div>
        {err && <p className="text-[12.5px] text-[#B91C1C]">{err}</p>}
        <button onClick={cancel} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-bold border border-[#E8EDF6] text-[#374151] bg-white disabled:opacity-60">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Keep my account
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <h2 className="text-[16px] font-bold text-[#0C1220]">Delete account</h2>
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-[#FEF2F2] text-[#991B1B] text-[13px]">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="space-y-1.5">
          <p className="font-semibold">This closes your AXQEN account for good.</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Your store connections (Shopify, Amazon, Meta) are removed and you can&apos;t log in again.</li>
            <li>Pending payouts are settled to your bank account before the account is closed.</li>
            <li>Orders, invoices and payment records are kept as long as Indian tax law requires. Everything else is deleted.</li>
          </ul>
        </div>
      </div>
      <div>
        <label htmlFor="del-reason" className={label}>Why are you leaving? (optional)</label>
        <textarea id="del-reason" rows={3} value={reason} onChange={e => setReason(e.target.value)} className={input} />
      </div>
      <div>
        <label htmlFor="del-pw" className={label}>Your password</label>
        <input id="del-pw" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className={input} />
      </div>
      <div>
        <label htmlFor="del-confirm" className={label}>Type DELETE to confirm</label>
        <input id="del-confirm" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="off" className={input} />
      </div>
      {err && <p className="text-[12.5px] text-[#B91C1C]">{err}</p>}
      <button type="submit" disabled={busy || !password || confirm.trim().toUpperCase() !== "DELETE"} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-bold text-white bg-[#DC2626] disabled:opacity-50">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} Delete my account
      </button>
    </form>
  );
}
