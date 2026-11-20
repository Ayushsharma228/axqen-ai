"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { PLAN_PRICES_INR } from "@/lib/plan-pricing";

/**
 * Approve KYC. For a seller who isn't active yet, the same click activates the account,
 * starts plan billing today and records the signup payment collected offline.
 */
export function KycApprovePanel({ seller, onDone }: {
  seller: { id: string; name: string | null; email: string; plan: string | null; planTier: string | null; accountStatus: string };
  onDone: (text: string, ok: boolean) => void;
}) {
  const needsActivation = seller.accountStatus !== "ACTIVE";
  const base = seller.plan ? (PLAN_PRICES_INR as Record<string, Record<string, number>>)[seller.plan]?.[(seller.planTier ?? "STARTER").toUpperCase()] ?? PLAN_PRICES_INR[seller.plan as "DROPSHIPPING" | "MARKETPLACE"]?.STARTER : null;
  const withGst = base != null ? Math.round(base * 1.18 * 100) / 100 : null;

  const [activate, setActivate] = useState(needsActivation);
  const [received, setReceived] = useState(true);
  const [amount, setAmount] = useState(withGst != null ? String(withGst) : "");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState("UPI");
  const [tx, setTx] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function approve() {
    setBusy(true); setErr("");
    const body: Record<string, unknown> = { action: "APPROVED" };
    if (activate) {
      body.activate = true;
      if (received) body.payment = { amount, paidAt, mode, transactionId: tx };
    }
    const res = await fetch(`/api/admin/kyc/${seller.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(d.error ?? "Couldn't approve"); return; }
    const who = seller.name ?? seller.email;
    const parts = ["KYC approved"];
    if (d.activated) parts.push("account activated");
    if (d.billingStarted) parts.push("plan billing started today");
    if (d.paymentRecorded) parts.push(`₹${Number(amount).toLocaleString("en-IN")} payment recorded`);
    onDone(`${who}: ${parts.join(", ")}. The seller has been notified.${d.warning ? ` Note: ${d.warning}` : ""}`, !d.warning);
  }

  const input = "w-full px-2.5 py-2 text-[12.5px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#1D5CFF]";
  const planLabel = !seller.plan ? "No plan chosen" : seller.plan === "MARKETPLACE" ? "Marketplace" : `Dropshipping ${(seller.planTier ?? "Starter").charAt(0)}${(seller.planTier ?? "starter").slice(1).toLowerCase()}`;

  return (
    <div className="rounded-xl border border-[#D3DEF7] bg-[#F7F9FF] p-4 space-y-3">
      {needsActivation ? (
        <>
          <label className="flex items-start gap-2 cursor-pointer">
            <input id={`act-${seller.id}`} type="checkbox" checked={activate} onChange={e => setActivate(e.target.checked)} className="mt-0.5 accent-[#1D5CFF]" />
            <span>
              <span className="block text-[13px] font-semibold text-[#0C1220]">Also activate the account</span>
              <span className="block text-[11.5px] text-[#6B7280]">Opens their dashboard and starts {planLabel} billing from today.</span>
            </span>
          </label>
          {activate && (
            <div className="pl-6 space-y-2.5">
              <label className="flex items-center gap-2 text-[12.5px] text-[#374151] cursor-pointer">
                <input id={`rcv-${seller.id}`} type="checkbox" checked={received} onChange={e => setReceived(e.target.checked)} className="accent-[#1D5CFF]" />
                Signup payment received {withGst != null && <span className="text-[#9CA3AF]">(plan ₹{base?.toLocaleString("en-IN")} + 18% GST)</span>}
              </label>
              {received ? (
                <div className="grid grid-cols-2 gap-2">
                  <div><label htmlFor={`amt-${seller.id}`} className="block text-[11px] font-semibold text-[#374151] mb-0.5">Amount ₹</label><input id={`amt-${seller.id}`} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} className={input} /></div>
                  <div><label htmlFor={`dt-${seller.id}`} className="block text-[11px] font-semibold text-[#374151] mb-0.5">Received on</label><input id={`dt-${seller.id}`} type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} className={input} /></div>
                  <div><label htmlFor={`md-${seller.id}`} className="block text-[11px] font-semibold text-[#374151] mb-0.5">Mode</label>
                    <select id={`md-${seller.id}`} value={mode} onChange={e => setMode(e.target.value)} className={input}>{["UPI", "BANK", "CASH", "CHEQUE", "OTHER"].map(m => <option key={m} value={m}>{m === "BANK" ? "Bank transfer" : m.charAt(0) + m.slice(1).toLowerCase()}</option>)}</select>
                  </div>
                  <div><label htmlFor={`tx-${seller.id}`} className="block text-[11px] font-semibold text-[#374151] mb-0.5">Transaction ID / UTR{mode === "CASH" ? " (optional)" : ""}</label><input id={`tx-${seller.id}`} value={tx} onChange={e => setTx(e.target.value)} className={`${input} font-mono`} /></div>
                </div>
              ) : <p className="text-[11.5px] text-[#B45309]">The plan amount stays pending in Plan Billing until you record it there.</p>}
            </div>
          )}
        </>
      ) : <p className="text-[12px] text-[#6B7280]">This account is already active. Approving only marks the KYC as verified.</p>}
      {err && <p className="text-[12px] text-[#B91C1C]">{err}</p>}
      <button onClick={approve} disabled={busy} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-bold text-white bg-[#059669] disabled:opacity-60">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
        {activate && needsActivation ? (received ? "Approve, activate and record payment" : "Approve and activate") : "Approve KYC"}
      </button>
    </div>
  );
}
