"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, Eye, EyeOff, CheckCircle2, AlertTriangle } from "lucide-react";

const BLUE = "#1D5CFF";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"checking" | "valid" | "invalid" | "done">("checking");
  const [email, setEmail] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`).then(r => r.json())
      .then(d => { setEmail(d.email ?? null); setState(d.valid ? "valid" : "invalid"); }).catch(() => setState("invalid"));
  }, [token]);

  const strong = pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!strong) { setErr("Use at least 8 characters with letters and a number"); return; }
    if (pw !== pw2) { setErr("The two passwords don't match"); return; }
    setBusy(true); setErr("");
    const res = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: pw }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(d.error ?? "Couldn't change the password"); if (res.status === 400 && /expired|used/i.test(d.error ?? "")) setState("invalid"); return; }
    setState("done");
  }

  const input = "w-full h-12 pl-4 pr-12 text-[14px] rounded-xl border border-[#E2E7F0] outline-none focus:border-[#1D5CFF] focus:ring-4 focus:ring-[#1D5CFF]/10";

  if (state === "checking") return <div className="mt-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" style={{ color: BLUE }} /></div>;
  if (state === "invalid") return (
    <div className="mt-8 text-center">
      <span className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center bg-[#FEF3C7] text-[#B45309]"><AlertTriangle className="w-7 h-7" /></span>
      <h1 className="text-[26px] font-bold text-[#0C1220] mt-4">This link has expired</h1>
      <p className="text-[14px] text-[#6B7280] mt-2">Reset links work once and for 60 minutes. Ask for a new one.</p>
      <Link href="/forgot-password" className="mt-6 inline-flex items-center justify-center w-full h-12 rounded-xl text-[14px] font-bold text-white" style={{ background: BLUE }}>Send a new link</Link>
    </div>
  );
  if (state === "done") return (
    <div className="mt-8 text-center">
      <span className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center bg-[#DCFCE7] text-[#047857]"><CheckCircle2 className="w-7 h-7" /></span>
      <h1 className="text-[26px] font-bold text-[#0C1220] mt-4">Password changed</h1>
      <p className="text-[14px] text-[#6B7280] mt-2">Log in with your new password.</p>
      <Link href="/login" className="mt-6 inline-flex items-center justify-center w-full h-12 rounded-xl text-[14px] font-bold text-white" style={{ background: BLUE }}>Log in</Link>
    </div>
  );
  return (
    <form onSubmit={submit} className="mt-8">
      <h1 className="text-[28px] font-bold text-[#0C1220] leading-tight">Set a new password</h1>
      <p className="text-[14px] text-[#6B7280] mt-2">{email ? <>For <b className="text-[#0C1220]">{email}</b>. </> : null}Use at least 8 characters with letters and a number.</p>
      {err && <div role="alert" className="mt-5 px-4 py-3 rounded-xl text-[13px] bg-[#FEF2F2] text-[#B91C1C] border border-[#FEE2E2]">{err}</div>}
      <label htmlFor="rp-new" className="block text-[12.5px] font-semibold text-[#374151] mt-6 mb-1.5">New password</label>
      <div className="relative">
        <input id="rp-new" type={show ? "text" : "password"} autoComplete="new-password" required value={pw} onChange={e => setPw(e.target.value)} className={input} />
        <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#1D5CFF]">{show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
      </div>
      <p className={`text-[12px] mt-1.5 ${pw ? (strong ? "text-[#047857]" : "text-[#B45309]") : "text-[#9CA3AF]"}`}>{pw ? (strong ? "Strong enough" : "Needs 8+ characters, letters and a number") : " "}</p>
      <label htmlFor="rp-confirm" className="block text-[12.5px] font-semibold text-[#374151] mt-3 mb-1.5">Type it again</label>
      <input id="rp-confirm" type={show ? "text" : "password"} autoComplete="new-password" required value={pw2} onChange={e => setPw2(e.target.value)} className={input} />
      <button type="submit" disabled={busy} className="mt-6 w-full h-12 rounded-xl text-[14px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: BLUE }}>
        {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Save new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="app-ui min-h-screen flex items-center justify-center p-4" style={{ background: "#E9EDF5" }}>
      <div className="w-full max-w-[440px] bg-white rounded-[24px] shadow-[0_30px_80px_rgba(15,22,35,0.12)] p-8 sm:p-10">
        <a href="/" aria-label="AXQEN home" className="flex items-center gap-2.5">
          <img src="/axqen-icon.png" alt="" className="w-8 h-8 rounded-lg object-cover" />
          <span className="text-[17px] font-bold text-[#0C1220]">AXQEN</span>
        </a>
        <Suspense fallback={<div className="mt-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" style={{ color: BLUE }} /></div>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
