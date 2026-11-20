"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Building2, ShieldCheck, CheckCircle2, ChevronRight, ChevronLeft,
  Loader2, Check, ArrowRight, Sparkles,
  Package, Zap, ShoppingCart, BarChart3, Wallet, Store,
  MapPin, Briefcase,
} from "lucide-react";

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: "welcome",      label: "Welcome",      icon: Sparkles    },
  { id: "personal",     label: "Personal Info", icon: MapPin      },
  { id: "business",     label: "Business",      icon: Briefcase   },
  { id: "verification", label: "Verification",  icon: ShieldCheck },
];

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan",
  "Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman & Nicobar Islands","Chandigarh","Dadra & Nagar Haveli","Daman & Diu",
  "Delhi","Jammu & Kashmir","Ladakh","Lakshadweep","Puducherry",
];

// ─── Shared field components ──────────────────────────────────────────────────

function Field({ label, hint, optional, children }: { label: string; hint?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>
        {label}{optional && <span className="ml-1 font-normal" style={{ color: "#9CA3AF" }}>(optional)</span>}
      </label>
      {children}
      {hint && <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>{hint}</p>}
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 text-sm rounded-xl outline-none border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all";
const inputStyle = { background: "#fff", borderColor: "#e5e7eb", color: "#0A0E1A" };

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [step,   setStep]   = useState(0);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const [done,   setDone]   = useState(false);

  // User data
  const [sellerName, setSellerName] = useState("");
  const [plan,       setPlan]       = useState("");
  const [planTier,   setPlanTier]   = useState("");
  const [paid,       setPaid]       = useState(false);

  // Step 1 – Personal Info
  const [personal, setPersonal] = useState({ address: "", city: "", state: "", pincode: "", phone: "" });

  // Step 2 – Business Details
  const [business, setBusiness] = useState({ brandName: "", businessName: "", gstNumber: "" });

  // Step 3 – Verification
  const [agreed,          setAgreed]         = useState(false);
  const [aadhaarNumber,   setAadhaarNumber]  = useState("");


  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login?zone=seller");
  }, [status, router]);

  useEffect(() => {
    fetch("/api/seller/onboarding")
      .then((r) => r.json())
      .then((d) => {
        setSellerName(d.name ?? "");
        setPlan(d.plan ?? "");
        setPlanTier(d.planTier ?? "");
        setPaid(Boolean(d.paymentConfirmed));
        if (d.businessAddress) setPersonal((p) => ({ ...p, address: d.businessAddress }));
        if (d.city)            setPersonal((p) => ({ ...p, city: d.city }));
        if (d.state)           setPersonal((p) => ({ ...p, state: d.state }));
        if (d.pincode)         setPersonal((p) => ({ ...p, pincode: d.pincode }));
        if (d.phone)           setPersonal((p) => ({ ...p, phone: d.phone }));
        if (d.brandName)       setBusiness((b) => ({ ...b, brandName: d.brandName }));
        if (d.businessName)    setBusiness((b) => ({ ...b, businessName: d.businessName }));
        if (d.gstNumber)       setBusiness((b) => ({ ...b, gstNumber: d.gstNumber }));
        if (d.aadhaarNumber)   setAadhaarNumber(d.aadhaarNumber);
        if (d.agreementAccepted) setAgreed(true);

        // Resume to furthest incomplete step
        if (d.onboardingDone) { setDone(true); return; }
        if (d.agreementAccepted && d.aadhaarNumber) setStep(3); // past business → verification done? edge case, show it again
        else if (d.businessName || d.brandName)     setStep(3); // past business → verification
        else if (d.city || d.businessAddress)       setStep(2); // past personal → business
        else if (!d.name)                           setStep(0); // new
        else                                        setStep(1); // past welcome → personal
      })
      .catch(() => {});
  }, []);

  const save = useCallback(async (data: Record<string, unknown>, stepName: string): Promise<boolean> => {
    setSaving(true); setError("");
    const r = await fetch("/api/seller/onboarding", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ step: stepName, ...data }),
    });
    const json = await r.json();
    if (!r.ok) { setError(json.error ?? "Failed to save. Please try again."); setSaving(false); return false; }
    setSaving(false);
    return true;
  }, []);


  async function handleNext() {
    setError("");
    if (step === 0) {
      setStep(1);
    } else if (step === 1) {
      const ok = await save({ ...personal }, "personal");
      if (ok) setStep(2);
    } else if (step === 2) {
      const ok = await save({ ...business }, "business");
      if (ok) setStep(3);
    } else if (step === 3) {
      if (!agreed) { setError("Please accept the agreement to continue."); return; }
      if (!aadhaarNumber) { setError("Aadhaar number is required."); return; }
      const ok = await save({ aadhaarNumber }, "verification");
      if (ok) {
        await fetch("/api/seller/onboarding", {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ step: "complete" }),
        }).catch(() => {});
        fetch("/api/payments/invoice", { method: "POST" }).catch(() => {});
        setDone(true);
      }
    }
  }

  const firstName = (session?.user?.name ?? sellerName ?? "there").split(" ")[0];

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8f9fa" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#0048DF" }} />
      </div>
    );
  }

  // ── Done / quick-start screen ──────────────────────────────────────────────
  if (done) {
    const quickStart = [
      { step: "01", title: "Browse Products",  desc: "Discover winning products and add them to your import list.", icon: Package,      href: "/seller/products" },
      { step: "02", title: "Connect Shopify",  desc: "Go to Manage Stores → Add your Shopify credentials.",         icon: Store,        href: "/seller/stores" },
      { step: "03", title: "Push to Store",    desc: "Click \"Push to Store\" on any product — it goes live instantly.", icon: Zap,         href: "/seller/products" },
      { step: "04", title: "Manage Orders",    desc: "Track orders, handle NDR, and monitor fulfilment.",            icon: ShoppingCart, href: "/seller/orders" },
      { step: "05", title: "View Analytics",   desc: "Monitor your sales, conversion, and revenue trends.",          icon: BarChart3,    href: "/seller" },
      { step: "06", title: "Get Paid",         desc: "View your earnings and request settlements from Finance.",      icon: Wallet,       href: "/seller/finance" },
    ];

    return (
      <div className="min-h-screen px-4 py-12 flex flex-col items-center" style={{ background: "#f8f9fa" }}>
        <div className="w-full max-w-2xl">
          {/* Success badge */}
          <div className="flex flex-col items-center text-center mb-10">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ background: "rgba(0,72,223,0.1)" }}>
              <CheckCircle2 className="w-8 h-8" style={{ color: "#0048DF" }} />
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: "#0A0E1A" }}>
              You&apos;re all set, {firstName}! 🚀
            </h1>
            <p className="text-sm" style={{ color: "#6B7280" }}>
              Here&apos;s your quick-start guide to the platform
            </p>
          </div>

          {/* Quick-start grid */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            {quickStart.map((item) => {
              const Icon = item.icon;
              return (
                <a key={item.step} href={item.href}
                  className="rounded-2xl p-5 flex items-start gap-4 transition-all hover:shadow-md group"
                  style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(0,72,223,0.08)" }}>
                    <Icon className="w-5 h-5" style={{ color: "#0048DF" }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold mb-0.5 uppercase tracking-wider" style={{ color: "#0048DF" }}>Step {item.step}</p>
                    <p className="text-sm font-semibold mb-1" style={{ color: "#0A0E1A" }}>{item.title}</p>
                    <p className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>{item.desc}</p>
                  </div>
                </a>
              );
            })}
          </div>

          <button onClick={async () => { await update({ onboardingDone: true }); router.push("/seller"); }}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white"
            style={{ background: "#0048DF" }}>
            Go to Dashboard <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-center text-xs mt-4" style={{ color: "#9CA3AF" }}>
            Questions? <a href="mailto:connect@vrinandyaventures.in" className="underline" style={{ color: "#0048DF" }}>connect@vrinandyaventures.in</a>
          </p>
        </div>
      </div>
    );
  }

  // ── Main onboarding UI ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: "#f8f9fa" }}>

      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-7">
        <img src="/axqen-icon.png" alt="AXQEN" className="w-9 h-9 rounded-xl object-cover" />
        <div>
          <p className="font-bold text-sm leading-tight" style={{ color: "#0A0E1A" }}>AXQEN</p>
          <p className="text-xs" style={{ color: "#9CA3AF" }}>Seller Onboarding</p>
        </div>
      </div>

      {/* Step progress */}
      <div className="w-full max-w-xl mb-6">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const isDone   = i < step;
            const isActive = i === step;
            const Icon     = s.icon;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                    style={{
                      background: isDone ? "#0048DF" : isActive ? "#0048DF" : "#e9ecef",
                      border:     isDone || isActive ? "none" : "1.5px solid #d1d5db",
                    }}>
                    {isDone
                      ? <Check className="w-4 h-4 text-white" />
                      : <Icon className="w-4 h-4" style={{ color: isActive ? "white" : "#9CA3AF" }} />
                    }
                  </div>
                  <span className="text-[10px] font-semibold hidden sm:block"
                    style={{ color: isActive || isDone ? "#0048DF" : "#9CA3AF" }}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 h-0.5 mx-2 mb-4 rounded-full transition-all"
                    style={{ background: i < step ? "#0048DF" : "#e9ecef" }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-xl rounded-2xl bg-white p-8"
        style={{ border: "1px solid #e5e7eb", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>

        {/* Step header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(0,72,223,0.08)" }}>
            {(() => { const Icon = STEPS[step].icon; return <Icon className="w-5 h-5" style={{ color: "#0048DF" }} />; })()}
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: "#0A0E1A" }}>{STEPS[step].label}</h2>
            <p className="text-xs" style={{ color: "#9CA3AF" }}>Step {step + 1} of {STEPS.length}</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 px-4 py-3 rounded-xl text-sm"
            style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>
            {error}
          </div>
        )}

        {/* ── Step 0: Welcome ────────────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-xl font-bold mb-1" style={{ color: "#0A0E1A" }}>
                Welcome to AXQEN{sellerName ? `, ${sellerName.split(" ")[0]}` : ""}! 🎉
              </h3>
              <p className="text-sm" style={{ color: "#6B7280" }}>
                You&apos;re just a few steps away from launching your {plan === "MARKETPLACE" ? "Amazon store" : "dropshipping business"}.
              </p>
            </div>
            {paid && planTier && (
              <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3" style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.25)" }}>
                <div className="flex items-center gap-2.5 text-sm" style={{ color: "#14532D" }}>
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#16A34A" }} />
                  <span>
                    Payment confirmed ·{" "}
                    <strong>{plan === "MARKETPLACE" ? "Amazon Management" : `${planTier.charAt(0)}${planTier.slice(1).toLowerCase()} plan`}</strong>
                  </span>
                </div>
                <a href="/welcome" className="text-xs font-semibold underline underline-offset-2 flex-shrink-0" style={{ color: "#0048DF" }}>View receipt</a>
              </div>
            )}
            <div className="rounded-xl p-5 space-y-3" style={{ background: "#f8f9fa", border: "1px solid #e5e7eb" }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#0048DF" }}>What you&apos;ll set up today</p>
              {[
                "Your personal & business details",
                "Identity verification (Aadhaar)",
                "AXQEN Seller Agreement",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-sm" style={{ color: "#374151" }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(0,72,223,0.1)" }}>
                    <Check className="w-3 h-3" style={{ color: "#0048DF" }} />
                  </div>
                  {item}
                </div>
              ))}
            </div>
            <div className="rounded-xl p-4 flex gap-3" style={{ background: "rgba(0,72,223,0.05)", border: "1px solid rgba(0,72,223,0.15)" }}>
              <Building2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#0048DF" }} />
              <p className="text-xs" style={{ color: "#4B5563" }}>
                Your account is already created. Complete the steps below to activate your seller dashboard and start adding products.
              </p>
            </div>
          </div>
        )}

        {/* ── Step 1: Personal Info ──────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "#6B7280" }}>Tell us where you&apos;re based so we can optimise delivery estimates.</p>
            <Field label="Full Address">
              <input value={personal.address} onChange={(e) => setPersonal((p) => ({ ...p, address: e.target.value }))}
                placeholder="Flat/House no., Street, Area" className={inputCls} style={inputStyle} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="City">
                <input value={personal.city} onChange={(e) => setPersonal((p) => ({ ...p, city: e.target.value }))}
                  placeholder="Mumbai" className={inputCls} style={inputStyle} />
              </Field>
              <Field label="Pincode">
                <input value={personal.pincode} onChange={(e) => setPersonal((p) => ({ ...p, pincode: e.target.value }))}
                  placeholder="400001" className={inputCls} style={inputStyle} />
              </Field>
            </div>
            <Field label="State">
              <select value={personal.state} onChange={(e) => setPersonal((p) => ({ ...p, state: e.target.value }))}
                className={inputCls} style={inputStyle}>
                <option value="">Select State</option>
                {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Phone Number" optional>
              <input value={personal.phone} onChange={(e) => setPersonal((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+91 98765 43210" type="tel" className={inputCls} style={inputStyle} />
            </Field>
          </div>
        )}

        {/* ── Step 2: Business Details ───────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "#6B7280" }}>
              <span style={{ color: "#0048DF", fontWeight: 600 }}>Optional</span> — helps with invoicing and GST compliance.
            </p>
            <Field label="Business / Brand Name" optional>
              <input value={business.brandName} onChange={(e) => setBusiness((b) => ({ ...b, brandName: e.target.value }))}
                placeholder="e.g. TrendZone Retail" className={inputCls} style={inputStyle} />
              <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>This will appear on invoices and customer communications</p>
            </Field>
            <Field label="GST Number" optional hint="15-digit GSTIN">
              <input value={business.gstNumber} onChange={(e) => setBusiness((b) => ({ ...b, gstNumber: e.target.value.toUpperCase() }))}
                placeholder="22AAAAA0000A1Z5" className={inputCls} style={inputStyle} />
            </Field>
            <div className="rounded-xl p-4" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
              <p className="text-xs font-semibold mb-1" style={{ color: "#92400E" }}>No business entity? No problem!</p>
              <p className="text-xs" style={{ color: "#92400E" }}>
                You can sell as an individual. Business details are optional and can be added later from your profile settings.
              </p>
            </div>
          </div>
        )}

        {/* ── Step 3: Verification ──────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5">
            {/* Agreement */}
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(0,72,223,0.2)" }}>
              <div className="flex items-center gap-2 px-4 py-3" style={{ background: "rgba(0,72,223,0.07)", borderBottom: "1px solid rgba(0,72,223,0.15)" }}>
                <ShieldCheck className="w-4 h-4 flex-shrink-0" style={{ color: "#0048DF" }} />
                <p className="text-xs font-bold" style={{ color: "#0A0E1A" }}>AXQEN Seller Agreement</p>
              </div>
              <div className="overflow-y-auto p-4 text-xs leading-relaxed space-y-3" style={{ maxHeight: "220px", color: "#374151", background: "#fff" }}>
                <p><strong>1. Introduction</strong><br />
                This Seller Agreement ("Agreement") is entered into between AXQEN ("Company", "we", "us") and you ("Seller"). By ticking the checkbox below, you agree to be bound by these terms in full.</p>

                <p><strong>2. Platform Usage</strong><br />
                The Company provides a dropshipping and marketplace management platform ("Platform"). The Seller is granted a non-exclusive, non-transferable licence to use the Platform solely for managing their ecommerce operations. The Seller shall not reverse-engineer, resell, or sublicense the Platform.</p>

                <p><strong>3. Seller Obligations</strong><br />
                The Seller agrees to: (a) provide accurate business and identity information; (b) maintain sufficient inventory or supplier coordination; (c) respond to customer queries and NDR (Non-Delivery Reports) within 48 hours; (d) comply with all applicable Indian laws including the Consumer Protection Act, 2019 and IT Act, 2000.</p>

                <p><strong>4. Supplier & Product Policy</strong><br />
                Products listed on the Platform are sourced from verified suppliers. The Company does not guarantee availability or pricing of products. Sellers must not list counterfeit, prohibited, or unlicensed goods. The Company reserves the right to remove any listing without notice.</p>

                <p><strong>5. Order Fulfilment & Shipping</strong><br />
                The Company facilitates fulfilment through its logistics partners. AWB (Airway Bills) are generated automatically on order confirmation. Estimated delivery timelines are indicative. The Company is not liable for delays caused by courier partners, natural calamities, or government restrictions.</p>

                <p><strong>6. RTO (Return to Origin) Policy</strong><br />
                In the event of an RTO, the Seller bears the reverse shipping cost as per the rate card shared at onboarding. Repeated high RTO rates (above 30%) may result in account suspension. The Company will deduct applicable RTO charges from the Seller's settlement amount.</p>

                <p><strong>7. Payments & Payouts</strong><br />
                Payouts are processed on a 7–14 day settlement cycle after successful delivery confirmation. The Company deducts platform fees, shipping charges, and any applicable penalties before releasing the payout. TDS (Tax Deducted at Source) will be deducted as per Indian Income Tax rules.</p>

                <p><strong>8. GST & Invoicing</strong><br />
                The Seller is solely responsible for their own GST compliance. The Company will issue GST-compliant invoices for platform fees. Sellers with GSTIN must provide accurate details for ITC claims.</p>

                <p><strong>9. Confidentiality</strong><br />
                The Seller agrees to keep all supplier pricing, platform pricing, and business data confidential. Sharing proprietary information with third parties without written consent constitutes a material breach of this Agreement.</p>

                <p><strong>10. Termination</strong><br />
                Either party may terminate this Agreement with 30 days' written notice. The Company may terminate immediately in cases of fraud, repeated policy violations, or non-payment. On termination, all pending settlements will be processed within 30 days subject to deductions.</p>

                <p><strong>11. Limitation of Liability</strong><br />
                The Company's aggregate liability under this Agreement shall not exceed the total platform fees paid by the Seller in the preceding 3 months. The Company is not liable for indirect, incidental, or consequential losses.</p>

                <p><strong>12. Governing Law & Dispute Resolution</strong><br />
                This Agreement shall be governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in Agra, Uttar Pradesh. The parties agree to attempt mediation before initiating legal proceedings.</p>

                <p><strong>13. Amendments</strong><br />
                AXQEN reserves the right to amend these terms at any time. Sellers will be notified via email at least 7 days before material changes take effect. Continued use of the Platform constitutes acceptance of the revised terms.</p>

                <p style={{ color: "#9CA3AF" }}>Last updated: January 2025 · AXQEN, Agra, Uttar Pradesh, India</p>
              </div>
              <div className="px-4 py-3" style={{ background: "rgba(0,72,223,0.03)", borderTop: "1px solid rgba(0,72,223,0.1)" }}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 flex-shrink-0 rounded accent-[#0048DF]" />
                  <span className="text-xs" style={{ color: "#374151" }}>
                    I have read and agree to the <strong>AXQEN Seller Agreement</strong> and Terms of Service.
                  </span>
                </label>
              </div>
            </div>

            {/* Aadhaar */}
            <Field label="Aadhaar Number" hint="Used to verify your identity. We keep only the last 4 digits, never the full number.">
              <input value={aadhaarNumber} onChange={(e) => setAadhaarNumber(e.target.value)}
                placeholder="XXXX XXXX XXXX" className={inputCls} style={inputStyle} />
            </Field>

          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-5" style={{ borderTop: "1px solid #f3f4f6" }}>
          <button
            onClick={() => { setError(""); setStep((s) => s - 1); }}
            disabled={step === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-30"
            style={{ color: "#6B7280", border: "1px solid #e5e7eb" }}>
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <button onClick={handleNext} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "#0048DF" }}>
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              : <>{step === 3 ? "Submit & Finish" : "Next"} <ChevronRight className="w-4 h-4" /></>
            }
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-6 text-xs" style={{ color: "#9CA3AF" }}>
        <span>Need help? <a href="mailto:connect@vrinandyaventures.in" className="underline" style={{ color: "#0048DF" }}>connect@vrinandyaventures.in</a></span>
        <span>·</span>
        <Link href="/login?zone=seller" className="underline" style={{ color: "#0048DF" }}>Sign in to a different account</Link>
      </div>
    </div>
  );
}
