"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye, EyeOff, Check, ChevronRight, Store, Package,
  Zap, TrendingUp, Crown, Mail, Loader2, RefreshCw, CreditCard,
} from "lucide-react";

declare global {
  interface Window {
    Razorpay: new (opts: Record<string, unknown>) => { open(): void };
  }
}

const BLUE   = "#0048DF";
const BLUEDIM = "rgba(0,72,223,0.08)";
const BLUEBORDER = "rgba(0,72,223,0.25)";

const PLANS = {
  DROPSHIPPING: [
    {
      tier: "STARTER", label: "Starter", price: 10000,
      features: ["Premium Shopify Store", "1-Year Domain", "Payment Gateway Setup", "Product Import (Up to 100)", "Winning Product Research", "Basic Training", "30 Days Support"],
      icon: Zap,
    },
    {
      tier: "GROWTH", label: "Growth", price: 25000, popular: true,
      features: ["AI Dashboard", "Meta Pixel Setup", "Premium Theme", "Product Optimization", "Supplier Management", "NDR Management", "Free Shipping Setup", "Priority Support"],
      icon: TrendingUp,
    },
    {
      tier: "SCALE", label: "Scale", price: 50000,
      features: ["Dedicated Account Manager", "Unlimited Product Import", "AI Commerce Dashboard", "Priority Operations", "Advanced Analytics", "Custom Branding", "Faster Turnaround"],
      icon: Crown,
    },
  ],
  MARKETPLACE: [
    {
      tier: "STARTER", label: "Starter", price: 5000,
      features: ["Amazon Management", "Flipkart Management", "Meesho Management", "Product Listing (Up to 100)", "Inventory Updates", "Order Monitoring", "Basic Reports"],
      icon: Zap,
    },
    {
      tier: "GROWTH", label: "Growth", price: 10000, popular: true,
      features: ["Catalog Optimization", "SEO Listings", "A+ Content Guidance", "Return Management", "NDR Management", "Priority Support", "Weekly Reports"],
      icon: TrendingUp,
    },
    {
      tier: "SCALE", label: "Scale", price: 20000,
      features: ["Dedicated Account Manager", "Unlimited Listings", "Brand Registry Support", "Performance Dashboard", "Competitor Analysis", "Buy Box Monitoring"],
      icon: Crown,
    },
  ],
};


const STEPS = ["Account", "Verify Email", "Service", "Plan", "Payment"];

const inputCls = "w-full px-4 py-2.5 rounded-xl text-sm outline-none border focus:ring-2 focus:border-blue-500 transition-all";
const inputStyle = { background: "#fff", borderColor: "#e5e7eb", color: "#0A0E1A" };

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
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

  const [service,    setService]    = useState<"DROPSHIPPING" | "MARKETPLACE" | "">("");
  const [planTier,   setPlanTier]   = useState("");
  const [rzpLoading, setRzpLoading] = useState(false);

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
    setStep(1); setLoading(false);
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
    const res = await fetch("/api/auth/otp/verify-email", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ otp: otpInput.trim() }),
    });
    const d = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) { setError(d.error ?? "Verification failed."); setOtpLoading(false); return; }
    setStep(2); setOtpLoading(false);
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

  async function handleService() {
    if (!service) return;
    setError(""); setLoading(true);
    const ok = await saveStep({ step: "service", service });
    if (ok) { setStep(3); setLoading(false); }
  }

  async function handlePlan() {
    if (!planTier) return;
    setError(""); setLoading(true);
    const ok = await saveStep({ step: "plan", planTier });
    if (ok) { setStep(4); setLoading(false); }
  }

  async function handleRazorpay() {
    setError(""); setRzpLoading(true);
    if (!window.Razorpay) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://checkout.razorpay.com/v1/checkout.js";
        s.onload  = () => resolve();
        s.onerror = () => reject(new Error("Failed to load payment gateway"));
        document.body.appendChild(s);
      });
    }
    const res  = await fetch("/api/payments/create-order", { method: "POST" });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Could not create order"); setRzpLoading(false); return; }

    const rzp = new window.Razorpay({
      key:         data.key,
      amount:      data.amount,
      currency:    data.currency,
      order_id:    data.orderId,
      name:        "AXQEN",
      description: `${data.tierLabel} Plan Setup Fee`,
      image:       "/favicon.ico",
      prefill:     { name: data.name, email: data.email, contact: data.phone },
      theme:       { color: BLUE },
      handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        const verify = await fetch("/api/payments/verify", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_order_id:   response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature:  response.razorpay_signature,
          }),
        });
        if (verify.ok) {
          router.push("/onboarding");
        } else {
          const d = await verify.json().catch(() => ({})) as { error?: string };
          setError(d.error ?? "Payment verification failed. Contact support.");
          setRzpLoading(false);
        }
      },
      modal: { ondismiss: () => setRzpLoading(false) },
    });
    rzp.open();
  }

  const selectedPlan = service ? PLANS[service].find((p) => p.tier === planTier) : null;
  const planAmount   = selectedPlan?.price ?? 0;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "#f8f9fa" }}>

      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-6">
          <a href="/" aria-label="AXQEN home" className="inline-flex items-center gap-2 mb-2 transition-opacity hover:opacity-80">
            <img src="/axqen-icon.png" alt="" className="w-8 h-8 rounded-lg object-cover" />
            <span className="font-black text-lg" style={{ color: "#0A0E1A" }}>AXQEN</span>
          </a>
          <p className="text-sm" style={{ color: "#6B7280" }}>Create your seller account</p>
        </div>

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

          {/* ── Step 0: Account ── */}
          {step === 0 && (
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <h2 className="text-xl font-bold mb-1" style={{ color: "#0A0E1A" }}>Create your account</h2>
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

          {step > 0 && (
            <p className="text-center text-xs mt-5 pt-5" style={{ color: "#9CA3AF", borderTop: "1px solid #F3F4F6" }}>
              Already have an account?{" "}
              <Link href="/login" style={{ color: BLUE }} className="font-semibold hover:opacity-80">Sign in</Link>
            </p>
          )}

          {/* ── Step 1: Verify Email ── */}
          {step === 1 && (
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

          {/* ── Step 2: Service ── */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold mb-1" style={{ color: "#0A0E1A" }}>Choose your service</h2>
              <p className="text-sm mb-6" style={{ color: "#6B7280" }}>Select how you want to sell your products</p>

              <div className="space-y-4 mb-6">
                {[
                  {
                    value: "DROPSHIPPING" as const,
                    label: "Dropshipping",
                    desc: "Push products to your Shopify store. We handle fulfilment end-to-end.",
                    icon: Package,
                    features: ["Shopify integration", "Auto order sync", "AWB generation & tracking"],
                  },
                  {
                    value: "MARKETPLACE" as const,
                    label: "Marketplace",
                    desc: "List on Amazon, Flipkart, Meesho and more — our team manages listings.",
                    icon: Store,
                    features: ["Multi-platform listings", "Admin-managed listings", "Order sync from all platforms"],
                  },
                ].map((opt) => {
                  const Icon   = opt.icon;
                  const active = service === opt.value;
                  return (
                    <button key={opt.value} onClick={() => setService(opt.value)}
                      className="w-full p-5 rounded-xl text-left transition-all"
                      style={{
                        border:     `2px solid ${active ? BLUE : "#e5e7eb"}`,
                        background: active ? BLUEDIM : "#fafafa",
                      }}>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: active ? BLUEDIM : "#f3f4f6" }}>
                          <Icon className="w-5 h-5" style={{ color: active ? BLUE : "#9CA3AF" }} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold" style={{ color: "#0A0E1A" }}>{opt.label}</h3>
                            {active && <Check className="w-4 h-4" style={{ color: BLUE }} />}
                          </div>
                          <p className="text-sm mt-0.5 mb-2" style={{ color: "#6B7280" }}>{opt.desc}</p>
                          <div className="flex flex-wrap gap-2">
                            {opt.features.map((f) => (
                              <span key={f} className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background: "#f3f4f6", color: "#6B7280" }}>{f}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button onClick={handleService} disabled={!service || loading}
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 text-white"
                style={{ background: BLUE }}>
                {loading ? "Saving..." : <><span>Continue</span><ChevronRight className="w-4 h-4" /></>}
              </button>
            </div>
          )}

          {/* ── Step 3: Plan ── */}
          {step === 3 && service && (
            <div>
              <h2 className="text-xl font-bold mb-1" style={{ color: "#0A0E1A" }}>Select your plan</h2>
              <p className="text-sm mb-6" style={{ color: "#6B7280" }}>
                Choose a {service === "DROPSHIPPING" ? "Dropshipping" : "Marketplace"} plan
              </p>

              <div className="space-y-3 mb-6">
                {PLANS[service].map((plan) => {
                  const Icon   = plan.icon;
                  const active = planTier === plan.tier;
                  return (
                    <button key={plan.tier} onClick={() => setPlanTier(plan.tier)}
                      className="w-full p-4 rounded-xl text-left transition-all relative overflow-hidden"
                      style={{
                        border:     `2px solid ${active ? BLUE : "#e5e7eb"}`,
                        background: active ? BLUEDIM : "#fafafa",
                      }}>
                      {"popular" in plan && plan.popular && (
                        <span className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full font-semibold text-white"
                          style={{ background: BLUE }}>Popular</span>
                      )}
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ background: active ? BLUE : "#f3f4f6" }}>
                          <Icon className="w-4 h-4" style={{ color: active ? "white" : "#9CA3AF" }} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: "#0A0E1A" }}>{plan.label}</p>
                          <p className="font-bold" style={{ color: BLUE }}>
                            ₹{plan.price.toLocaleString("en-IN")}
                            <span className="text-xs font-normal ml-1" style={{ color: "#9CA3AF" }}>one-time</span>
                          </p>
                        </div>
                        {active && <Check className="w-4 h-4 ml-auto flex-shrink-0" style={{ color: BLUE }} />}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {plan.features.map((f) => (
                          <span key={f} className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: "#f3f4f6", color: "#6B7280" }}>{f}</span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>

              <button onClick={handlePlan} disabled={!planTier || loading}
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 text-white"
                style={{ background: BLUE }}>
                {loading ? "Saving..." : <><span>Continue</span><ChevronRight className="w-4 h-4" /></>}
              </button>
            </div>
          )}

          {/* ── Step 4: Payment ── */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold mb-1" style={{ color: "#0A0E1A" }}>Complete payment</h2>
              <p className="text-sm" style={{ color: "#6B7280" }}>
                Pay securely via Razorpay — UPI, cards, net banking all accepted.
              </p>

              <div className="rounded-xl p-5 text-center" style={{ background: BLUEDIM, border: `1px solid ${BLUEBORDER}` }}>
                <p className="text-xs font-medium mb-1" style={{ color: "#6B7280" }}>Amount to pay</p>
                <p className="text-4xl font-black mb-1" style={{ color: "#0A0E1A" }}>
                  ₹{planAmount.toLocaleString("en-IN")}
                </p>
                <p className="text-sm font-semibold" style={{ color: BLUE }}>
                  {selectedPlan?.label} Plan · {service === "MARKETPLACE" ? "Marketplace" : "Dropshipping"}
                </p>
                <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>One-time · + 18% GST</p>
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                {["UPI", "Credit Card", "Debit Card", "Net Banking", "Wallets"].map((m) => (
                  <span key={m} className="text-xs px-3 py-1 rounded-full"
                    style={{ background: "#f3f4f6", color: "#6B7280" }}>{m}</span>
                ))}
              </div>

              <button onClick={handleRazorpay} disabled={rzpLoading}
                className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 text-white transition-all hover:opacity-90"
                style={{ background: BLUE }}>
                {rzpLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Opening payment…</>
                  : <><CreditCard className="w-4 h-4" /> Pay ₹{planAmount.toLocaleString("en-IN")} Securely</>
                }
              </button>

              <p className="text-center text-xs" style={{ color: "#9CA3AF" }}>
                Secured by Razorpay · 256-bit SSL encryption
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
