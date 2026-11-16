"use client";

import { useState, Suspense } from "react";
import { signIn, signOut } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ArrowLeft, Store, Package, ChevronRight, UserCheck } from "lucide-react";

type Zone = "seller" | "supplier" | "sales" | null;

function LoginContent() {
  const searchParams = useSearchParams();
  const defaultZone = searchParams.get("zone") as Zone;

  const [zone, setZone] = useState<Zone>(defaultZone);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", { email: identifier, password, redirect: false });
    if (result?.error) {
      setError("Invalid username/email or password");
      setLoading(false);
      return;
    }
    const res = await fetch("/api/auth/session");
    const session = await res.json();
    const role = session?.user?.role;

    if (zone === "seller" && role !== "SELLER") {
      await signOut({ redirect: false });
      setError("These credentials don't belong to a Seller account.");
      setLoading(false);
      return;
    }
    if (zone === "supplier" && role !== "SUPPLIER") {
      await signOut({ redirect: false });
      setError("These credentials don't belong to a Supplier account.");
      setLoading(false);
      return;
    }
    if (zone === "sales" && role !== "SALES") {
      await signOut({ redirect: false });
      setError("These credentials don't belong to a Sales team account.");
      setLoading(false);
      return;
    }

    if (role === "ADMIN") window.location.href = "/admin";
    else if (role === "SUPPLIER") window.location.href = "/supplier";
    else if (role === "SALES") window.location.href = "/sales";
    else if (role === "SELLER") {
      window.location.href = session?.user?.plan ? "/seller" : "/onboarding";
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── LEFT PANEL ─────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-12 overflow-hidden"
        style={{ background: "linear-gradient(145deg, #0c1530 0%, #111d45 55%, #1a2a6e 100%)" }}>

        {/* Decorative glowing orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, #4361EE, transparent 70%)" }} />
          <div className="absolute bottom-[-60px] right-[-60px] w-[350px] h-[350px] rounded-full opacity-15"
            style={{ background: "radial-gradient(circle, #7C3AED, transparent 70%)" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-8"
            style={{ background: "radial-gradient(circle, #4361EE, transparent 70%)" }} />
        </div>

        {/* Abstract orb visual — CSS only */}
        <div className="absolute right-[-40px] top-1/2 -translate-y-1/2 w-[340px] h-[340px] pointer-events-none">
          <div className="w-full h-full rounded-full opacity-30"
            style={{ background: "radial-gradient(circle at 40% 40%, #4361EE 0%, #1a2a6e 50%, transparent 70%)", filter: "blur(2px)" }} />
          <div className="absolute inset-8 rounded-full opacity-40"
            style={{ background: "radial-gradient(circle at 60% 35%, #6080ff 0%, #1a2060 60%, transparent 80%)" }} />
          <div className="absolute inset-16 rounded-full opacity-50"
            style={{ background: "radial-gradient(circle at 50% 50%, #4361EE 0%, #2030a0 70%)" }} />
        </div>

        {/* Logo */}
        <a href="/" aria-label="AXQEN home" className="relative flex items-center gap-3 self-start transition-opacity hover:opacity-80">
          <img src="/axqen-icon.png" alt="" className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
          <span className="text-white font-semibold text-lg">AXQEN</span>
        </a>

        {/* Main copy */}
        <div className="relative space-y-6 max-w-sm">
          <h1 className="text-4xl font-bold text-white leading-tight"
            style={{ fontFamily: "var(--font-playfair), serif" }}>
            Start managing your commerce with{" "}
            <em className="not-italic" style={{ fontStyle: "italic", color: "#4361EE" }}>clarity</em>
            {" "}and{" "}
            <em style={{ fontStyle: "italic", color: "#4361EE" }}>control.</em>
          </h1>
          <p className="text-xs font-light leading-relaxed tracking-widest uppercase"
            style={{ color: "rgba(255,255,255,0.4)" }}>
            Built for growth, precision, and real-time insight.{" "}
            From product sourcing to order fulfilment — all in one place.
          </p>

          {/* Feature list */}
          <ul className="space-y-3">
            {[
              "Push products directly to Shopify",
              "Real-time order & delivery tracking",
              "Automated remittance & wallet",
            ].map((f) => (
              <li key={f} className="flex items-center gap-3 text-xs font-light tracking-widest uppercase"
                style={{ color: "rgba(255,255,255,0.55)" }}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(0,198,122,0.2)", border: "1px solid rgba(0,198,122,0.4)" }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#4361EE" }} />
                </div>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom credit */}
        <p className="relative text-xs font-light" style={{ color: "rgba(255,255,255,0.25)" }}>
          © 2025 AXQEN. All rights reserved.
        </p>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 bg-white">
        <div className="w-full max-w-[400px]">

          {zone === null && (
            <>
              {/* Zone selection */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-1" style={{ color: "var(--text-900)" }}>Welcome back</h2>
                <p className="text-sm" style={{ color: "var(--text-400)" }}>Choose your portal to continue</p>
              </div>

              <div className="space-y-3">
                {/* Seller */}
                <button onClick={() => setZone("seller")}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all hover:shadow-md group"
                  style={{ border: "1.5px solid var(--border)", background: "white" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#3B82F6"; e.currentTarget.style.background = "#F8FAFF"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "white"; }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "#EFF6FF" }}>
                    <Store className="w-5 h-5" style={{ color: "#3B82F6" }} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm" style={{ color: "var(--text-900)" }}>Seller Portal</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-400)" }}>Manage your store, orders & deliveries</p>
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-400)" }} />
                </button>

                {/* Sales Team */}
                <button onClick={() => setZone("sales")}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all hover:shadow-md"
                  style={{ border: "1.5px solid var(--border)", background: "white" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#7C3AED"; e.currentTarget.style.background = "#F5F3FF"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "white"; }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "#F5F3FF" }}>
                    <UserCheck className="w-5 h-5" style={{ color: "#7C3AED" }} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm" style={{ color: "var(--text-900)" }}>Sales Team</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-400)" }}>CRM, leads & target tracking</p>
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-400)" }} />
                </button>

                {/* Supplier */}
                <button onClick={() => setZone("supplier")}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all hover:shadow-md"
                  style={{ border: "1.5px solid var(--border)", background: "white" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--green-500)"; e.currentTarget.style.background = "#EEF1FF"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "white"; }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "#EEF1FF" }}>
                    <Package className="w-5 h-5" style={{ color: "var(--green-500)" }} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm" style={{ color: "var(--text-900)" }}>Supplier Portal</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-400)" }}>Submit products & track approvals</p>
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-400)" }} />
                </button>
              </div>

              <div className="mt-8 space-y-3">
                {/* Sign up CTA */}
                <div className="rounded-2xl p-4 flex items-center justify-between"
                  style={{ background: "#EEF1FF", border: "1px solid #C7D2FE" }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "#1e3a8a" }}>New seller?</p>
                    <p className="text-xs" style={{ color: "#93C5FD" }}>Create your account in 2 minutes</p>
                  </div>
                  <Link href="/signup"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90"
                    style={{ background: "var(--green-500)" }}>
                    Sign Up <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <p className="text-center text-xs" style={{ color: "var(--text-400)" }}>
                  Admin?{" "}
                  <Link href="/admin/login" className="font-semibold hover:underline" style={{ color: "var(--green-500)" }}>
                    Admin Login →
                  </Link>
                </p>
              </div>
            </>
          )}

          {zone !== null && (
            <>
              {/* Back button */}
              <button onClick={() => { setZone(null); setError(""); setIdentifier(""); setPassword(""); }}
                className="flex items-center gap-1.5 text-sm mb-7 hover:opacity-70 transition-opacity"
                style={{ color: "var(--text-400)" }}>
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              {/* Header */}
              <div className="mb-7">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-3"
                  style={{
                    background: zone === "seller" ? "#EFF6FF" : zone === "sales" ? "#F5F3FF" : "#EEF1FF",
                    color: zone === "seller" ? "#3B82F6" : zone === "sales" ? "#7C3AED" : "var(--green-500)",
                  }}>
                  {zone === "seller" ? <Store className="w-3 h-3" /> : zone === "sales" ? <UserCheck className="w-3 h-3" /> : <Package className="w-3 h-3" />}
                  {zone === "seller" ? "Seller Portal" : zone === "sales" ? "Sales Team" : "Supplier Portal"}
                </div>
                <h2 className="text-2xl font-bold" style={{ color: "var(--text-900)" }}>Sign in to your account</h2>
                <p className="text-sm mt-1" style={{ color: "var(--text-400)" }}>Enter your credentials to continue</p>
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl text-sm mb-5"
                  style={{ background: "#FEF2F2", color: "#EF4444", border: "1px solid #FEE2E2" }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-600)" }}>
                    Email address
                  </label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 text-sm rounded-xl outline-none transition-all"
                    style={{ border: "1.5px solid var(--border)", color: "var(--text-900)", background: "#FAFAFA" }}
                    onFocus={(e) => { e.currentTarget.style.border = `1.5px solid ${zone === "seller" ? "#3B82F6" : "var(--green-500)"}`; e.currentTarget.style.background = "white"; }}
                    onBlur={(e) => { e.currentTarget.style.border = "1.5px solid var(--border)"; e.currentTarget.style.background = "#FAFAFA"; }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-600)" }}>
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full px-4 py-3 pr-11 text-sm rounded-xl outline-none transition-all"
                      style={{ border: "1.5px solid var(--border)", color: "var(--text-900)", background: "#FAFAFA" }}
                      onFocus={(e) => { e.currentTarget.style.border = `1.5px solid ${zone === "seller" ? "#3B82F6" : "var(--green-500)"}`; e.currentTarget.style.background = "white"; }}
                      onBlur={(e) => { e.currentTarget.style.border = "1.5px solid var(--border)"; e.currentTarget.style.background = "#FAFAFA"; }}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: "var(--text-400)" }}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 mt-1"
                  style={{ background: zone === "seller" ? "#3B82F6" : "var(--green-500)" }}
                >
                  {loading ? "Signing in..." : "Sign in"}
                </button>
              </form>

              <div className="mt-6 space-y-2 text-center">
                {zone === "seller" && (
                  <p className="text-xs" style={{ color: "var(--text-400)" }}>
                    New seller?{" "}
                    <Link href="/signup" className="font-semibold hover:underline" style={{ color: "var(--green-500)" }}>
                      Create an account →
                    </Link>
                  </p>
                )}
                <p className="text-xs" style={{ color: "var(--text-400)" }}>
                  {zone === "seller" ? "Are you a supplier? " : "Are you a seller? "}
                  <button
                    onClick={() => { setZone(zone === "seller" ? "supplier" : "seller"); setError(""); }}
                    className="font-semibold hover:underline"
                    style={{ color: zone === "seller" ? "var(--green-500)" : "#3B82F6" }}>
                    {zone === "seller" ? "Supplier login →" : "Seller login →"}
                  </button>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <LoginContent />
    </Suspense>
  );
}
