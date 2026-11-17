"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye, EyeOff, Check, ChevronRight, ChevronLeft, Store, Sprout, ShoppingBag, Package, ArrowRight,
  Zap, TrendingUp, Crown, Mail, Loader2, RefreshCw,
} from "lucide-react";
import { PLAN_PRICES_INR, TEST_TIER, TEST_PRICE_INR, TEST_PLAN_ENABLED, type Service, type Tier } from "@/lib/plan-pricing";
import { PRICING, MARKETPLACE_PLAN } from "@/components/landing/content";

const BLUE   = "#0048DF";
const BLUEDIM = "rgba(0,72,223,0.08)";
const BLUEBORDER = "rgba(0,72,223,0.25)";

type PlanCard = { tier: Tier | typeof TEST_TIER; label: string; price: number; billing: string; lead?: string | null; features: string[]; popular?: boolean; icon: typeof Zap };

const TIER_ICON: Record<Tier, typeof Zap> = { STARTER: Zap, GROWTH: TrendingUp, SCALE: Crown };

// Dropshipping plans mirror the website pricing section; prices come from the shared price list.
const PLANS: Record<Service, PlanCard[]> = {
  DROPSHIPPING: PRICING.plans.map((p) => {
    const tier = p.id.toUpperCase() as Tier;
    return { tier, label: p.name, price: PLAN_PRICES_INR.DROPSHIPPING[tier], billing: "one-time", lead: p.lead, features: p.features, popular: p.popular, icon: TIER_ICON[tier] };
  }),
  MARKETPLACE: [
    {
      tier: "STARTER", label: MARKETPLACE_PLAN.name, price: PLAN_PRICES_INR.MARKETPLACE.STARTER, billing: MARKETPLACE_PLAN.billing,
      lead: MARKETPLACE_PLAN.lead,
      features: MARKETPLACE_PLAN.features,
      icon: Store,
    },
  ],
};

// TEMPORARY: internal ₹1 plan, only listed on /signup?plan=test; the server allows it for the test inbox only.
const TEST_PLAN: PlanCard = {
  tier: TEST_TIER, label: "Test plan (internal)", price: TEST_PRICE_INR, billing: "one-time",
  lead: "For testing the live payment flow only.", features: ["Full signup, payment and onboarding flow"], icon: Zap,
};

const STEPS = ["Plan", "Account", "Verify Email", "Done"];

// Screen 1: what brings the seller here. Each answer picks the service and a recommended plan.
type GoalId = "NEW_BUSINESS" | "SHOPIFY_STORE" | "AMAZON" | "BRAND";
const GOALS: { id: GoalId; title: string; desc: string; icon: typeof Zap; service: Service; tier: Tier }[] = [
  { id: "NEW_BUSINESS",  title: "Starting a new business", desc: "I don't have an online store yet",                    icon: Sprout,      service: "DROPSHIPPING", tier: "STARTER" },
  { id: "SHOPIFY_STORE", title: "I have a Shopify store",  desc: "I want to run orders, shipping and profit better",   icon: ShoppingBag, service: "DROPSHIPPING", tier: "GROWTH" },
  { id: "AMAZON",        title: "I sell on Amazon",         desc: "I want my Amazon account managed",                   icon: Package,     service: "MARKETPLACE",  tier: "STARTER" },
  { id: "BRAND",         title: "Growing a brand",          desc: "I'm scaling and want more support",                  icon: TrendingUp,  service: "DROPSHIPPING", tier: "SCALE" },
];

const inputCls = "w-full px-4 py-2.5 rounded-xl text-sm outline-none border focus:ring-2 focus:border-blue-500 transition-all";
const inputStyle = { background: "#fff", borderColor: "#e5e7eb", color: "#0A0E1A" };

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={
                  done   ? { background: BLUE,            color: "white" } :
                  active ? { background: BLUE,            color: "white" } :
                           { background: "#e9ecef",       color: "#9ca3af" }
                }
              >
                {done ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className="text-xs mt-1 font-medium"
                style={{ color: active || done ? BLUE : "#9ca3af" }}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="w-12 h-0.5 mb-4 mx-1"
                style={{ background: i < current ? BLUE : "#e9ecef" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep]       = useState(0);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [username, setUsername]   = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPw, setShowPw]       = useState(false);

  // Email OTP (step 1)
  const [otpInput,    setOtpInput]    = useState("");
  const [otpLoading,  setOtpLoading]  = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [emailVerified, setEmailVerified] = useState(false);

  const [service,    setService]    = useState<Service>("DROPSHIPPING");
  const [planTier,   setPlanTier]   = useState<PlanCard["tier"] | "">("");
  const [testMode,   setTestMode]   = useState(false);
  const [goal,       setGoal]       = useState<GoalId | null>(null);
  const [showGoal,   setShowGoal]   = useState(true);

  // Preselect the plan picked on the website pricing section (/signup?plan=growth) and skip the goal question.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("plan")?.toUpperCase();
    if (p === "STARTER" || p === "GROWTH" || p === "SCALE") { setPlanTier(p); setShowGoal(false); }
    if (TEST_PLAN_ENABLED && p === TEST_TIER) { setTestMode(true); setPlanTier(TEST_TIER); setShowGoal(false); }
  }, []);

  function chooseGoal(g: (typeof GOALS)[number]) {
    setGoal(g.id);
    setService(g.service);
    setPlanTier(g.tier);
    setShowGoal(false);
    setStep(0);
  }

  // Recommendation from the goal screen; only applies while the seller stays on the service that goal points to.
  const goalDef = GOALS.find((g) => g.id === goal);
  const recommendedTier = goalDef && goalDef.service === service ? goalDef.tier : null;
  const recommendedPlan = recommendedTier ? PLANS[service].find((p) => p.tier === recommendedTier) ?? null : null;

  const visiblePlans = (s: Service) => (s === "DROPSHIPPING" && testMode ? [...PLANS[s], TEST_PLAN] : PLANS[s]);

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, username, password, confirmPassword: confirm }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setLoading(false); return; }
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) { setError("Account created but sign-in failed. Please log in."); setLoading(false); return; }
    // Send email OTP and move to verification step
    await fetch("/api/auth/otp/send-email", { method: "POST" }).catch(() => {});
    startResendTimer();
    setStep(2); setLoading(false);
  }

  function startResendTimer() {
    setResendTimer(60);
    const id = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) { clearInterval(id); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  async function handleResendOtp() {
    setError("");
    const res = await fetch("/api/auth/otp/send-email", { method: "POST" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { error?: string };
      setError(d.error ?? "Failed to resend OTP.");
    } else {
      startResendTimer();
    }
  }

  async function handleVerifyEmail() {
    if (otpInput.trim().length !== 6) { setError("Enter the 6-digit code."); return; }
    setError(""); setOtpLoading(true);
    if (!emailVerified) {
      const res = await fetch("/api/auth/otp/verify-email", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ otp: otpInput.trim() }),
      });
      const d = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setError(d.error ?? "Verification failed."); setOtpLoading(false); return; }
      setEmailVerified(true);
    }
    // The plan was chosen before the account existed; save it now that there is a session.
    const saved = (await saveStep({ step: "service", service })) && (await saveStep({ step: "plan", planTier }));
    setOtpLoading(false);
    if (saved) setStep(3);
  }

  async function saveStep(payload: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await fetch("/api/onboarding/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) { setError("Session expired. Please sign in again."); setLoading(false); return false; }
      if (!res.ok) { const d = await res.json().catch(() => ({ error: "Something went wrong" })); setError(d.error ?? "Something went wrong"); setLoading(false); return false; }
      return true;
    } catch {
      setError("Network error. Please try again."); setLoading(false); return false;
    }
  }

  function handlePlanContinue() {
    if (!planTier) return;
    setError("");
    setStep(1);
  }

  const selectedPlan = visiblePlans(service).find((p) => p.tier === planTier) ?? null;
  const planAmount   = selectedPlan?.price ?? 0;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "#f8f9fa" }}>

      <div className={`w-full ${showGoal ? "max-w-3xl" : step === 0 ? "max-w-5xl" : "max-w-lg"}`}>
        {/* Logo */}
        <div className="text-center mb-6">
          <a href="/" aria-label="AXQEN home" className="inline-flex items-center gap-2 mb-2 transition-opacity hover:opacity-80">
            <img src="/axqen-icon.png" alt="" className="w-8 h-8 rounded-lg object-cover" />
            <span className="font-black text-lg" style={{ color: "#0A0E1A" }}>AXQEN</span>
          </a>
          <p className="text-sm" style={{ color: "#6B7280" }}>Create your seller account</p>
        </div>

        {showGoal ? (
          <div>
            <div className="text-center mb-8">
              <h1 className="text-2xl md:text-3xl font-black mb-2" style={{ color: "#0A0E1A", letterSpacing: "-0.02em" }}>
                Let&apos;s set up AXQEN for you
              </h1>
              <p className="text-sm md:text-base" style={{ color: "#6B7280" }}>
                Pick what fits you best. You can change it later.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {GOALS.map((g) => {
                const Icon = g.icon;
                return (
                  <button
                    key={g.id}
                    onClick={() => chooseGoal(g)}
                    className="group flex items-start gap-4 p-5 md:p-6 rounded-2xl bg-white text-left border-2 border-[#e5e7eb] transition-all duration-200 hover:border-[#0048DF] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-14px_rgba(0,72,223,0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0048DF]"
                  >
                    <span className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors bg-[rgba(0,72,223,0.08)] group-hover:bg-[#0048DF]">
                      <Icon className="w-6 h-6 text-[#0048DF] group-hover:text-white transition-colors" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-base font-bold mb-1" style={{ color: "#0A0E1A" }}>{g.title}</span>
                      <span className="block text-sm leading-snug" style={{ color: "#6B7280" }}>{g.desc}</span>
                    </span>
                    <ArrowRight className="w-5 h-5 mt-1 flex-shrink-0 text-[#d1d5db] transition-all group-hover:text-[#0048DF] group-hover:translate-x-0.5" />
                  </button>
                );
              })}
            </div>

            <p className="text-center text-sm mt-8" style={{ color: "#6B7280" }}>
              Already have an account?{" "}
              <Link href="/login" style={{ color: BLUE }} className="font-semibold hover:opacity-80">Sign in</Link>
            </p>
          </div>
        ) : (
        <>
        <StepBar current={step} />

        {/* Card */}
        <div className="rounded-2xl p-8 bg-white shadow-sm" style={{ border: "1px solid #e5e7eb" }}>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl text-sm font-medium"
              style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}>
              {error}{" "}
              {(error.includes("sign in") || error.includes("Session")) && (
                <Link href="/login" className="underline font-bold">Sign in here →</Link>
              )}
            </div>
          )}

          {/* ── Step 0: Plan ── */}
          {step === 0 && (
            <div>
              {goal && (
                <button type="button" onClick={() => setShowGoal(true)}
                  className="flex items-center gap-1 text-xs font-semibold -mt-2 mb-4 hover:opacity-70" style={{ color: BLUE }}>
                  <ChevronLeft className="w-3.5 h-3.5" /> Change answer
                </button>
              )}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold mb-1" style={{ color: "#0A0E1A" }}>
                    {recommendedPlan ? "Your recommended plan" : "Choose your plan"}
                  </h2>
                  <p className="text-sm" style={{ color: "#6B7280" }}>
                    {recommendedPlan && service !== "MARKETPLACE"
                      ? <>Based on your answer, we suggest <strong style={{ color: "#0A0E1A" }}>{recommendedPlan.label}</strong>. You can pick any plan. </>
                      : null}
                    {service === "MARKETPLACE"
                      ? "Amazon management · 3-month plan · + 18% GST"
                      : "One-time setup fee · + 18% GST · No monthly subscription"}
                  </p>
                </div>
                <div className="inline-flex p-1 rounded-xl self-start" style={{ background: "#f3f4f6" }} role="tablist" aria-label="Service">
                  {(["DROPSHIPPING", "MARKETPLACE"] as const).map((s) => (
                    <button
                      key={s}
                      role="tab"
                      aria-selected={service === s}
                      onClick={() => { setService(s); setPlanTier(PLANS[s].length === 1 ? PLANS[s][0].tier : ""); }}
                      className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                      style={service === s ? { background: "#fff", color: BLUE, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" } : { color: "#6B7280" }}
                    >
                      {s === "DROPSHIPPING" ? "Dropshipping" : "Marketplace"}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`grid gap-4 mb-6 ${PLANS[service].length === 1 ? "grid-cols-1 max-w-xl mx-auto w-full" : "grid-cols-1 md:grid-cols-3"}`}>
                {visiblePlans(service).map((plan) => {
                  const Icon   = plan.icon;
                  const active = planTier === plan.tier;
                  return (
                    <button
                      key={plan.tier}
                      onClick={() => setPlanTier(plan.tier)}
                      aria-pressed={active}
                      className="relative flex flex-col p-5 rounded-2xl text-left transition-all hover:-translate-y-0.5"
                      style={{ border: `2px solid ${active ? BLUE : "#e5e7eb"}`, background: active ? BLUEDIM : "#fff" }}
                    >
                      {plan.tier === recommendedTier ? (
                        <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-semibold text-white" style={{ background: "#16A34A" }}>
                          <Check className="w-3 h-3" strokeWidth={3} /> Recommended for you
                        </span>
                      ) : plan.popular && (
                        <span className="absolute -top-2.5 left-5 text-[11px] px-2.5 py-0.5 rounded-full font-semibold text-white" style={{ background: BLUE }}>
                          Most popular
                        </span>
                      )}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: active ? BLUE : "#f3f4f6" }}>
                            <Icon className="w-4 h-4" style={{ color: active ? "white" : "#6B7280" }} />
                          </div>
                          <p className="font-bold" style={{ color: "#0A0E1A" }}>{plan.label}</p>
                        </div>
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ border: `2px solid ${active ? BLUE : "#d1d5db"}`, background: active ? BLUE : "transparent" }}
                        >
                          {active && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </span>
                      </div>
                      <p className="mb-4">
                        <span className="text-2xl font-black" style={{ color: "#0A0E1A" }}>₹{plan.price.toLocaleString("en-IN")}</span>
                        <span className="text-xs ml-1.5" style={{ color: "#6B7280" }}>{plan.billing} + GST</span>
                      </p>
                      {plan.lead && <p className="text-xs font-semibold mb-2" style={{ color: "#374151" }}>{plan.lead}</p>}
                      <ul className={PLANS[service].length === 1 ? "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5" : "space-y-1.5"}>
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-[13px] leading-snug" style={{ color: "#374151" }}>
                            <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: BLUE }} strokeWidth={3} />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs order-2 sm:order-1" style={{ color: "#6B7280" }}>
                  Already have an account?{" "}
                  <Link href="/login" style={{ color: BLUE }} className="font-semibold hover:opacity-80">Sign in</Link>
                </p>
                <button onClick={handlePlanContinue} disabled={!planTier}
                  className="w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 text-white order-1 sm:order-2"
                  style={{ background: BLUE }}>
                  {selectedPlan ? <>Continue with {selectedPlan.label}<ChevronRight className="w-4 h-4" /></> : "Select a plan to continue"}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 1: Account ── */}
          {step === 1 && (
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <button type="button" onClick={() => setStep(0)}
                className="flex items-center gap-1 text-xs font-semibold -mt-1 mb-2 hover:opacity-70" style={{ color: BLUE }}>
                <ChevronLeft className="w-3.5 h-3.5" /> Change plan
              </button>
              {selectedPlan && (
                <div className="flex items-center justify-between px-4 py-3 rounded-xl text-sm" style={{ background: BLUEDIM, border: `1px solid ${BLUEBORDER}` }}>
                  <span style={{ color: "#374151" }}>
                    <strong style={{ color: "#0A0E1A" }}>{selectedPlan.label}</strong> · {service === "MARKETPLACE" ? "Marketplace" : "Dropshipping"}
                  </span>
                  <span className="font-bold" style={{ color: BLUE }}>₹{selectedPlan.price.toLocaleString("en-IN")}</span>
                </div>
              )}
              <h2 className="text-xl font-bold mb-1 pt-2" style={{ color: "#0A0E1A" }}>Create your account</h2>
              <p className="text-sm mb-5" style={{ color: "#6B7280" }}>Fill in your details to get started</p>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#374151" }}>Full Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required
                  placeholder="Your full name" className={inputCls} style={inputStyle} />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#374151" }}>Email Address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  placeholder="you@example.com" className={inputCls} style={inputStyle} />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#374151" }}>Username</label>
                <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} required
                  placeholder="your_username" className={`${inputCls} font-mono`} style={inputStyle} />
                <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>Lowercase letters, numbers, underscores only</p>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#374151" }}>Password</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required
                    placeholder="Min. 8 characters" className={`${inputCls} pr-10`} style={inputStyle} />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }}>
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#374151" }}>Confirm Password</label>
                <input type={showPw ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} required
                  placeholder="Re-enter password" className={inputCls} style={inputStyle} />
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2 text-white"
                style={{ background: BLUE }}>
                {loading ? "Creating account..." : <><span>Create Account</span><ChevronRight className="w-4 h-4" /></>}
              </button>

              <p className="text-center text-xs" style={{ color: "#6B7280" }}>
                Already have an account?{" "}
                <Link href="/login" style={{ color: BLUE }} className="font-semibold hover:opacity-80">Sign in</Link>
              </p>
            </form>
          )}

          {step >= 2 && (
            <p className="text-center text-xs mt-5 pt-5" style={{ color: "#9CA3AF", borderTop: "1px solid #F3F4F6" }}>
              Already have an account?{" "}
              <Link href="/login" style={{ color: BLUE }} className="font-semibold hover:opacity-80">Sign in</Link>
            </p>
          )}

          {/* ── Step 2: Verify Email ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex flex-col items-center text-center gap-3 py-2">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: BLUEDIM }}>
                  <Mail className="w-7 h-7" style={{ color: BLUE }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: "#0A0E1A" }}>Check your email</h2>
                  <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
                    We sent a 6-digit code to <strong style={{ color: "#0A0E1A" }}>{email}</strong>
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#374151" }}>Verification Code</label>
                <input
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full px-4 py-3 rounded-xl text-2xl font-bold text-center tracking-widest outline-none border focus:ring-2 focus:border-blue-500 transition-all"
                  style={{ background: "#fff", borderColor: "#e5e7eb", color: "#0A0E1A", fontFamily: "monospace" }}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyEmail()}
                />
              </div>

              <button onClick={handleVerifyEmail} disabled={otpLoading || otpInput.length !== 6}
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-white"
                style={{ background: BLUE }}>
                {otpLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                  : <><Check className="w-4 h-4" /> Verify Email</>
                }
              </button>

              <div className="text-center">
                {resendTimer > 0 ? (
                  <p className="text-xs" style={{ color: "#9CA3AF" }}>Resend in {resendTimer}s</p>
                ) : (
                  <button onClick={handleResendOtp}
                    className="text-xs flex items-center gap-1 mx-auto hover:opacity-70 transition-opacity"
                    style={{ color: BLUE }}>
                    <RefreshCw className="w-3 h-3" /> Resend code
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Step 3: Done (payment is collected offline during onboarding) ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex flex-col items-center text-center gap-3 py-2">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: BLUEDIM }}>
                  <Check className="w-7 h-7" style={{ color: BLUE }} strokeWidth={3} />
                </div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: "#0A0E1A" }}>Your account is ready</h2>
                  <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
                    Our team will contact you to complete payment and set up your account.
                  </p>
                </div>
              </div>

              <div className="rounded-xl p-5 text-center" style={{ background: BLUEDIM, border: `1px solid ${BLUEBORDER}` }}>
                <p className="text-xs font-medium mb-1" style={{ color: "#6B7280" }}>Selected plan</p>
                <p className="text-lg font-bold" style={{ color: "#0A0E1A" }}>
                  {selectedPlan?.label}{service === "DROPSHIPPING" ? " plan" : ""} · {service === "MARKETPLACE" ? "Marketplace" : "Dropshipping"}
                </p>
                <p className="text-2xl font-black mt-1" style={{ color: BLUE }}>₹{planAmount.toLocaleString("en-IN")}</p>
                <p className="text-xs mt-1" style={{ color: "#6B7280" }}>{service === "MARKETPLACE" ? "3-month plan" : "One-time"} · + 18% GST</p>
              </div>

              <button onClick={() => router.push("/onboarding")}
                className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 text-white transition-all hover:opacity-90"
                style={{ background: BLUE }}>
                Continue to onboarding <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>
        </>
        )}
      </div>
    </div>
  );
}
