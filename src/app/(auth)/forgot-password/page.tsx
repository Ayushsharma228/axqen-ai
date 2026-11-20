"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, MailCheck } from "lucide-react";

const BLUE = "#1D5CFF";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(d.error ?? "Something went wrong. Try again."); return; }
    setSent(true);
  }

  return (
    <div className="app-ui min-h-screen flex items-center justify-center p-4" style={{ background: "#E9EDF5" }}>
      <div className="w-full max-w-[440px] bg-white rounded-[24px] shadow-[0_30px_80px_rgba(15,22,35,0.12)] p-8 sm:p-10">
        <a href="/" aria-label="AXQEN home" className="flex items-center gap-2.5">
          <img src="/axqen-icon.png" alt="" className="w-8 h-8 rounded-lg object-cover" />
          <span className="text-[17px] font-bold text-[#0C1220]">AXQEN</span>
        </a>

        {sent ? (
          <div className="mt-8 text-center">
            <span className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "#E6EEFF", color: BLUE }}><MailCheck className="w-7 h-7" /></span>
            <h1 className="text-[26px] font-bold text-[#0C1220] mt-4">Check your email</h1>
            <p className="text-[14px] text-[#6B7280] mt-2 leading-relaxed">If <b className="text-[#0C1220]">{email.trim()}</b> has an AXQEN account, we&apos;ve sent a link to set a new password. It works for 60 minutes.</p>
            <p className="text-[12.5px] text-[#9CA3AF] mt-4">Nothing in a few minutes? Check spam, or <button onClick={() => setSent(false)} className="font-semibold" style={{ color: BLUE }}>try again</button>.</p>
            <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-semibold" style={{ color: BLUE }}><ArrowLeft className="w-4 h-4" /> Back to log in</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8">
            <h1 className="text-[28px] font-bold text-[#0C1220] leading-tight">Forgot your password?</h1>
            <p className="text-[14px] text-[#6B7280] mt-2">Enter the email you log in with and we&apos;ll send you a link to set a new one.</p>
            {err && <div role="alert" className="mt-5 px-4 py-3 rounded-xl text-[13px] bg-[#FEF2F2] text-[#B91C1C] border border-[#FEE2E2]">{err}</div>}
            <label htmlFor="fp-email" className="block text-[12.5px] font-semibold text-[#374151] mt-6 mb-1.5">Email</label>
            <input id="fp-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@yourstore.com"
              className="w-full h-12 px-4 text-[14px] rounded-xl border border-[#E2E7F0] outline-none focus:border-[#1D5CFF] focus:ring-4 focus:ring-[#1D5CFF]/10" />
            <button type="submit" disabled={busy} className="mt-5 w-full h-12 rounded-xl text-[14px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: BLUE }}>
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : "Send reset link"}
            </button>
            <Link href="/login" className="mt-5 flex items-center justify-center gap-1.5 text-[13.5px] font-semibold" style={{ color: BLUE }}><ArrowLeft className="w-4 h-4" /> Back to log in</Link>
          </form>
        )}
      </div>
    </div>
  );
}
