import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Razorpay from "razorpay";
import { CheckCircle2, Check, ChevronRight } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { planAmountPaise, TEST_TIER } from "@/lib/plan-pricing";
import { PRICING, MARKETPLACE_PLAN, CONTACT } from "@/components/landing/content";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = {
  title: "Welcome & Plan Confirmation",
  robots: { index: false, follow: false },
};

const BLUE = "#155EEF";
const INK = "#0B1220";
const MUTED = "#55607A";
const LINE = "#E1E9F7";

// Mirrors what /onboarding actually collects.
const REQUIREMENTS = [
  { title: "Address details", desc: "Full address, city, state and pincode.", required: true },
  { title: "Phone number", desc: "For order and support updates.", required: false },
  { title: "Business name and GSTIN", desc: "Used on invoices. You can sell as an individual and add these later.", required: false },
  { title: "Aadhaar number", desc: "12-digit Aadhaar for identity verification.", required: true },
  { title: "Aadhaar document", desc: "Photo or scan of the front side (JPG, PNG or PDF, max 5 MB).", required: false },
  { title: "AXQEN Seller Agreement", desc: "Read and accept the agreement to activate your account.", required: true },
];

function inr(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default async function WelcomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, phone: true, plan: true, planTier: true, paymentReference: true, paymentConfirmed: true },
  });
  if (!user) redirect("/login");
  if (!user.paymentConfirmed) redirect("/onboarding");

  const isMarketplace = user.plan === "MARKETPLACE";
  const tierId = (user.planTier ?? "STARTER").toLowerCase();
  const dsPlan = PRICING.plans.find((p) => p.id === tierId) ?? PRICING.plans[0];
  const isTest = tierId === TEST_TIER.toLowerCase();
  const planName = isTest ? "Test plan (internal)" : isMarketplace ? MARKETPLACE_PLAN.name : `${dsPlan.name} plan`;
  const serviceName = isMarketplace ? "Marketplace" : "Dropshipping";
  const billing = isMarketplace ? "3-month plan" : "One-time setup fee";
  const lead = isTest ? "For testing the live payment flow only." : isMarketplace ? MARKETPLACE_PLAN.lead : dsPlan.lead;
  const features = isTest ? ["Full signup, payment and onboarding flow"] : isMarketplace ? MARKETPLACE_PLAN.features : dsPlan.features;

  // Show what Razorpay actually captured; fall back to the plan price if the lookup fails.
  let amount = planAmountPaise(user.plan, user.planTier);
  let paidAt = new Date();
  let method: string | null = null;
  if (user.paymentReference && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    try {
      const rzp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
      const p = await rzp.payments.fetch(user.paymentReference);
      if (Number(p.amount) > 0) amount = Number(p.amount);
      if (p.created_at) paidAt = new Date(Number(p.created_at) * 1000);
      if (p.method) method = String(p.method).toUpperCase();
    } catch (err) {
      console.error("[welcome] Razorpay payment fetch failed:", err);
    }
  }

  const dateText = paidAt.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
  const firstName = (user.name ?? "").split(" ")[0] || "there";

  return (
    <div className="min-h-screen px-4 py-10 md:py-14 print:p-0 print:bg-white" style={{ background: "#F5F8FF" }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8 print:mb-6">
          <a href="/" className="inline-flex items-center gap-2.5">
            <img src="/axqen-icon.png" alt="" width={32} height={32} className="w-8 h-8 rounded-lg" />
            <span className="font-bold text-lg" style={{ color: INK }}>AXQEN <span style={{ color: BLUE }}>AI</span></span>
          </a>
          <span className="hidden print:inline text-xs" style={{ color: MUTED }}>{CONTACT.email} · {CONTACT.phone}</span>
        </div>

        <div className="rounded-3xl p-7 md:p-9 mb-6 text-white print:hidden" style={{ background: "linear-gradient(135deg, #2A73FF 0%, #155EEF 45%, #0B2A80 100%)" }}>
          <CheckCircle2 className="w-10 h-10 mb-4" style={{ color: "#CFE3FF" }} />
          <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ letterSpacing: "-0.02em" }}>Welcome to AXQEN, {firstName}.</h1>
          <p className="text-base" style={{ color: "rgba(255,255,255,0.88)" }}>
            Your payment is confirmed and your {planName} is active. Here is your receipt and what happens next.
          </p>
        </div>

        <section className="rounded-2xl bg-white p-6 md:p-8 mb-6 print:border-0 print:p-0" style={{ border: `1px solid ${LINE}` }}>
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold" style={{ color: INK }}>Welcome & Plan Confirmation</h2>
              <p className="text-sm mt-1" style={{ color: MUTED }}>Payment receipt</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: "#EAF2FF", color: "#0B3DCE" }}>
              <Check className="w-3.5 h-3.5" strokeWidth={3} /> Paid
            </span>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 pb-6 mb-6" style={{ borderBottom: `1px solid ${LINE}` }}>
            {[
              ["Billed to", user.name ?? "—"],
              ["Email", user.email ?? "—"],
              ["Payment ID", user.paymentReference ?? "—"],
              ["Date", dateText],
              ...(method ? [["Payment method", method]] : []),
              ["Service", serviceName],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs" style={{ color: MUTED }}>{k}</dt>
                <dd className="text-sm font-semibold break-all" style={{ color: INK }}>{v}</dd>
              </div>
            ))}
          </dl>

          <div className="flex items-center justify-between gap-4 pb-6 mb-6" style={{ borderBottom: `1px solid ${LINE}` }}>
            <div>
              <p className="text-base font-bold" style={{ color: INK }}>{planName}</p>
              <p className="text-sm" style={{ color: MUTED }}>{serviceName} · {billing}</p>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: MUTED }}>Amount paid</p>
              <p className="text-2xl font-bold" style={{ color: INK, fontVariantNumeric: "tabular-nums" }}>{inr(amount)}</p>
            </div>
          </div>

          <h3 className="text-sm font-bold mb-1" style={{ color: INK }}>Services included</h3>
          {lead && <p className="text-sm mb-3" style={{ color: MUTED }}>{lead}</p>}
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mb-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm" style={{ color: INK }}>
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: BLUE }} strokeWidth={3} />
                {f}
              </li>
            ))}
          </ul>

          <p className="text-xs mt-6" style={{ color: MUTED }}>
            This is a payment confirmation, not a tax invoice. Your GST invoice is issued separately.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-6 md:p-8 mb-8 print:border-0 print:p-0 print:mt-6" style={{ border: `1px solid ${LINE}` }}>
          <h2 className="text-lg font-bold mb-1" style={{ color: INK }}>Onboarding requirements</h2>
          <p className="text-sm mb-5" style={{ color: MUTED }}>Keep these ready. Onboarding takes about 5 minutes.</p>
          <ol className="flex flex-col gap-3">
            {REQUIREMENTS.map((r, i) => (
              <li key={r.title} className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "#EAF2FF", color: "#0B3DCE" }}>
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: INK }}>
                    {r.title}{" "}
                    <span className="text-xs font-medium" style={{ color: r.required ? "#0B3DCE" : MUTED }}>{r.required ? "Required" : "Optional"}</span>
                  </p>
                  <p className="text-sm" style={{ color: MUTED }}>{r.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 print:hidden">
          <PrintButton />
          <a
            href="/onboarding"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: BLUE }}
          >
            Continue to onboarding <ChevronRight className="w-4 h-4" />
          </a>
        </div>

        <p className="text-center text-xs mt-8" style={{ color: MUTED }}>
          Questions? {CONTACT.email} · {CONTACT.phone}
        </p>
      </div>
    </div>
  );
}
