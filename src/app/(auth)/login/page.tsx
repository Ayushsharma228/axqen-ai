"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, ArrowRight, Wallet, ShoppingBag, MapPin } from "lucide-react";


/** Illustrative preview of the seller dashboard for the brand panel. Not real data. */
function DashboardPreview() {
  const bars = [38, 52, 44, 61, 57, 72, 66, 80, 74, 88, 79, 92];
  return (
    <div className="relative" aria-hidden="true">
      {/* Main window */}
      <div className="rounded-2xl bg-white shadow-[0_24px_60px_rgba(12,18,48,0.35)] p-4 w-[420px] max-w-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#E6EEFF] text-[#1D5CFF] text-[10px] font-bold flex items-center justify-center">R</span>
            <span className="text-[11px] font-semibold text-[#0C1220]">Seller dashboard</span>
          </div>
          <span className="text-[10px] text-[#9CA3AF]">Last 30 days</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[["Orders", "1,284", "#0C1220"], ["Delivered", "82%", "#047857"], ["RTO", "11%", "#B91C1C"]].map(([l, v, c]) => (
            <div key={l} className="rounded-xl bg-[#F6F8FC] px-2.5 py-2">
              <p className="text-[9.5px] text-[#6B7280]">{l}</p>
              <p className="text-[15px] font-bold tabular-nums" style={{ color: c }}>{v}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-[#F6F8FC] px-3 pt-3 pb-2">
          <p className="text-[9.5px] text-[#6B7280] mb-2">Delivered orders per day</p>
          <div className="flex items-end gap-1.5 h-[70px]">
            {bars.map((h, i) => (
              <div key={i} className="flex-1 rounded-t-[3px]" style={{ height: `${h}%`, background: i === bars.length - 1 ? "#1D5CFF" : "#BFD3FF" }} />
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#EEF1F8] px-3 py-2">
          <MapPin className="w-3.5 h-3.5 text-[#B91C1C]" />
          <span className="text-[10.5px] text-[#374151] flex-1">High RTO pincode spotted</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FEE2E2] text-[#B91C1C]">Review</span>
        </div>
      </div>

      {/* Floating cards */}
      <div className="absolute -left-10 -bottom-6 rounded-xl bg-white shadow-[0_12px_32px_rgba(12,18,48,0.28)] px-3 py-2.5 flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-lg bg-[#DCFCE7] text-[#047857] flex items-center justify-center"><Wallet className="w-4 h-4" /></span>
        <div>
          <p className="text-[10.5px] font-semibold text-[#0C1220]">Payout scheduled</p>
          <p className="text-[10px] text-[#6B7280]">Lands in your bank on Friday</p>
        </div>
      </div>
      <div className="absolute -right-6 -top-5 rounded-xl bg-[#FFD84D] shadow-[0_12px_32px_rgba(12,18,48,0.28)] px-3 py-2 flex items-center gap-2">
        <ShoppingBag className="w-3.5 h-3.5 text-[#5B4300]" />
        <p className="text-[10.5px] font-semibold text-[#3D2E00]">New COD order confirmed</p>
      </div>
    </div>
  );
}

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", { email: email.trim(), password, redirect: false });
    if (result?.error) {
      setError(result.error.startsWith("Too many") ? result.error : "That email and password don't match. Check them and try again.");
      setLoading(false);
      return;
    }
    const session = await fetch("/api/auth/session").then(r => r.json()).catch(() => null);
    const role = session?.user?.role;
    // Everyone signs in here; each account type goes to its own panel.
    if (role === "ADMIN") window.location.href = "/admin";
    else if (role === "SUPPLIER") window.location.href = "/supplier";
    else if (role === "SALES") window.location.href = "/sales";
    else window.location.href = session?.user?.plan ? "/seller" : "/onboarding";
  }

  return (
    <div className="app-ui min-h-screen flex items-center justify-center p-0 sm:p-6 lg:p-10" style={{ background: "#E9EDF5" }}>
      <div className="w-full max-w-[1180px] min-h-screen sm:min-h-[680px] bg-white sm:rounded-[28px] shadow-[0_30px_80px_rgba(15,22,35,0.12)] grid lg:grid-cols-[1fr_1.08fr] overflow-hidden">

        {/* ── Form ─────────────────────────────────────────── */}
        <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
          <a href="/" aria-label="AXQEN home" className="flex items-center gap-2.5 self-start">
            <img src="/axqen-icon.png" alt="" className="w-8 h-8 rounded-lg object-cover" />
            <span className="text-[17px] font-bold text-[#0C1220]">AXQEN</span>
          </a>

          <div className="flex-1 flex flex-col justify-center py-10">
            <div className="w-full max-w-[380px] mx-auto">
              <h1 className="text-[34px] font-bold text-[#0C1220] leading-tight text-center">Welcome back</h1>
              <p className="text-[14px] text-[#6B7280] text-center mt-2">Log in to manage your store, orders and payouts.</p>

              {error && <div role="alert" className="mt-6 px-4 py-3 rounded-xl text-[13px] bg-[#FEF2F2] text-[#B91C1C] border border-[#FEE2E2]">{error}</div>}

              <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-[12.5px] font-semibold text-[#374151] mb-1.5">Email</label>
                  <input id="login-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@yourstore.com"
                    className="w-full h-12 px-4 text-[14px] rounded-xl border border-[#E2E7F0] bg-white text-[#0C1220] outline-none transition-colors focus:border-[#1D5CFF] focus:ring-4 focus:ring-[#1D5CFF]/10" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-password" className="block text-[12.5px] font-semibold text-[#374151]">Password</label>
                    <Link href="/forgot-password" className="text-[12.5px] font-semibold text-[#1D5CFF] hover:underline">Forgot password?</Link>
                  </div>
                  <div className="relative">
                    <input id="login-password" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password"
                      className="w-full h-12 pl-4 pr-12 text-[14px] rounded-xl border border-[#E2E7F0] bg-white text-[#0C1220] outline-none transition-colors focus:border-[#1D5CFF] focus:ring-4 focus:ring-[#1D5CFF]/10" />
                    <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#1D5CFF] hover:bg-[#F0F5FF]">
                      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full h-12 rounded-xl text-[14px] font-bold text-white bg-[#1D5CFF] hover:bg-[#1449D9] disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Logging in…</> : "Log in"}
                </button>
              </form>

              <div className="mt-6 rounded-xl bg-[#F6F8FC] px-4 py-3.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-[#0C1220]">New to AXQEN?</p>
                  <p className="text-[12px] text-[#6B7280]">Set up your seller account in a few minutes.</p>
                </div>
                <Link href="/signup" className="flex items-center gap-1 px-3.5 h-9 rounded-lg text-[12.5px] font-bold text-[#1D5CFF] bg-white border border-[#D3DEF7] hover:border-[#1D5CFF] whitespace-nowrap">
                  Create account <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap text-[12px] text-[#9CA3AF]">
            <span>© {new Date().getFullYear()} AXQEN</span>
            <span className="flex items-center gap-4">
              <Link href="/legal/privacy" className="hover:text-[#1D5CFF]">Privacy</Link>
              <Link href="/admin/login" className="hover:text-[#1D5CFF]">AXQEN team login</Link>
            </span>
          </div>
        </div>

        {/* ── Brand panel ──────────────────────────────────── */}
        <div className="hidden lg:block p-3">
          <div className="relative h-full rounded-[22px] overflow-hidden flex flex-col px-12 pt-14 pb-12" style={{ background: "linear-gradient(160deg, #1D5CFF 0%, #1A52F0 55%, #1244D6 100%)" }}>
            <div className="absolute inset-0 pointer-events-none opacity-[0.10]"
              style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
            <div className="absolute -right-24 -bottom-24 w-[420px] h-[420px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.16), transparent 65%)" }} />
            <div className="relative max-w-[440px]">
              <h2 className="text-[34px] font-bold text-white leading-[1.12]">Your store&apos;s orders, payouts and returns, in one place.</h2>
              <p className="text-[14.5px] text-white/75 mt-4 leading-relaxed max-w-[400px]">We call your COD orders, ship them, chase failed deliveries and pay you out every week. You watch it all happen here.</p>
            </div>
            <div className="relative flex-1 flex items-center justify-center mt-12">
              <DashboardPreview />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: "#E9EDF5" }} />}>
      <LoginContent />
    </Suspense>
  );
}
