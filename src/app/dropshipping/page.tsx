import type { Metadata } from "next";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Plans } from "@/components/landing/Plans";
import { Results } from "@/components/landing/Results";
import { C, WA_LINK } from "@/components/landing/constants";
import { DROPSHIPPING as D, PRICING } from "@/components/landing/content";
import { AXQ_ROOT } from "@/components/landing/theme";
import { Store, Boxes, ClipboardList, Truck, RotateCcw, Wallet, Plus, type LucideIcon } from "lucide-react";

// Icons follow DROPSHIPPING.whatWeHandle order.
const HANDLE_ICONS: LucideIcon[] = [Store, Boxes, ClipboardList, Truck, RotateCcw, Wallet];

const URL = "https://www.axqen.app/dropshipping";

export const metadata: Metadata = {
  title: D.seo.title,
  description: D.seo.description,
  keywords: D.seo.keywords,
  alternates: { canonical: URL },
  openGraph: { title: D.seo.title, description: D.seo.description, url: URL, siteName: "AXQEN AI", locale: "en_IN", type: "website" },
  twitter: { card: "summary_large_image", title: D.seo.title, description: D.seo.description },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      name: "Dropshipping provider in India",
      serviceType: "Dropshipping store setup and order operations",
      provider: { "@id": "https://axqen.app/#organization" },
      areaServed: "IN",
      url: URL,
      offers: PRICING.plans.map((p) => ({
        "@type": "Offer",
        name: `${p.name} plan`,
        price: p.price.replace(/[^\d]/g, ""),
        priceCurrency: "INR",
      })),
    },
    {
      "@type": "FAQPage",
      mainEntity: D.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://www.axqen.app/" },
        { "@type": "ListItem", position: 2, name: "Dropshipping provider", item: URL },
      ],
    },
  ],
};

export default function DropshippingPage() {
  return (
    <div className={AXQ_ROOT} style={{ minHeight: "100vh" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50 }}>
        <Navbar />
      </header>

      <main>
        <section className="axq-hero relative overflow-hidden pt-36 md:pt-44 pb-20 md:pb-28 px-5 md:px-6">
          <div className="relative max-w-3xl mx-auto text-center">
            <span
              className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full mb-8 uppercase"
              style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", letterSpacing: "0.14em" }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.lime }} />
              {D.eyebrow}
            </span>
            <h1 className="text-white mb-6" style={{ fontSize: "clamp(2.25rem, 1.2rem + 4vw, 4rem)", lineHeight: 1.05, textWrap: "balance" }}>
              {D.h1}
            </h1>
            <p className="text-base md:text-lg mb-10" style={{ color: "rgba(255,255,255,0.88)", lineHeight: 1.7 }}>{D.sub}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a href="/signup" className="axq-btn axq-btn-lime w-full sm:w-auto !min-h-[52px] !px-8">Get Started →</a>
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="axq-btn axq-btn-pill w-full sm:w-auto !min-h-[52px] !px-8">Book a Demo</a>
            </div>
          </div>
        </section>

        <section className="py-20 md:py-28 px-5 md:px-6">
          <div className="max-w-[1200px] mx-auto">
            <p className="axq-eyebrow mb-4">What AXQEN handles</p>
            <h2 className="text-3xl md:text-[44px] leading-tight max-w-2xl" style={{ color: C.heading, textWrap: "balance" }}>
              The operations behind your dropshipping store, in one platform.
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mt-10">
              {D.whatWeHandle.map((w, i) => {
                const Icon = HANDLE_ICONS[i] ?? Store;
                return (
                  <div key={w.title} className="axq-card axq-card-hover p-7">
                    <span className="w-11 h-11 rounded-xl flex items-center justify-center mb-6" style={{ background: C.paleLilac }}>
                      <Icon size={22} color={C.action} aria-hidden />
                    </span>
                    <h3 className="text-lg mb-2" style={{ color: C.heading, letterSpacing: "-0.02em" }}>{w.title}</h3>
                    <p className="text-[15px] leading-relaxed" style={{ color: C.body }}>{w.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-20 md:py-28 px-5 md:px-6" style={{ background: C.card }}>
          <div className="max-w-[1200px] mx-auto">
            <p className="axq-eyebrow mb-4">How it works</p>
            <h2 className="text-3xl md:text-[44px] leading-tight" style={{ color: C.heading }}>Start dropshipping in four steps.</h2>
            <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-10">
              {D.steps.map((s, i) => {
                const last = i === D.steps.length - 1;
                return (
                  <li key={s.n} className="axq-card axq-card-hover p-7">
                    <span
                      className="axq-display w-12 h-12 rounded-full flex items-center justify-center text-base mb-6"
                      style={{ background: last ? C.lime : C.action, color: last ? C.deep : "#fff", boxShadow: `0 0 0 6px ${last ? "rgba(207,227,255,0.35)" : C.paleLilac}` }}
                    >
                      {s.n}
                    </span>
                    <h3 className="text-xl mb-2" style={{ color: C.heading }}>{s.title}</h3>
                    <p className="text-[15px] leading-relaxed" style={{ color: C.body }}>{s.desc}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
        <Results />
        <Plans />

        {/* FAQ */}
        <section className="py-20 md:py-28 px-5 md:px-6" style={{ background: C.navy }}>
          <div className="max-w-3xl mx-auto">
            <p className="axq-eyebrow mb-4">FAQ</p>
            <h2 className="text-3xl md:text-[44px] leading-tight mb-10" style={{ color: C.heading }}>Dropshipping with AXQEN, answered.</h2>
            <div className="flex flex-col gap-3">
              {D.faqs.map((f, i) => (
                <details key={f.q} className="group axq-card open:!border-[#9EC2FF]" open={i === 0}>
                  <summary className="flex items-center justify-between gap-4 px-6 min-h-[64px] py-4 cursor-pointer list-none text-base font-semibold group-open:text-[#155EEF]" style={{ color: C.heading }}>
                    {f.q}
                    <span aria-hidden className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-open:rotate-45" style={{ background: C.paleLilac }}>
                      <Plus size={16} strokeWidth={2.5} color={C.action} />
                    </span>
                  </summary>
                  <p className="px-6 pb-6 text-[15px] leading-relaxed" style={{ color: C.body }}>{f.a}</p>
                </details>
              ))}
            </div>
            <p className="text-base mt-10" style={{ color: C.body }}>
              Want the full platform view? See <a href="/" className="font-semibold underline underline-offset-4" style={{ color: C.action }}>AXQEN AI, the AI Commerce Operating System</a>.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
