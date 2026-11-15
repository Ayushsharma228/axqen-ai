import type { Metadata } from "next";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Plans } from "@/components/landing/Plans";
import { C, WA_LINK } from "@/components/landing/constants";
import { DROPSHIPPING as D, PRICING } from "@/components/landing/content";

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

const eyebrow = "text-xs font-bold tracking-widest uppercase mb-4";
const h2 = "text-3xl md:text-4xl font-black mb-4";

export default function DropshippingPage() {
  return (
    <div style={{ background: C.navy, minHeight: "100vh" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50 }}>
        <Navbar />
      </header>

      <main>
        {/* Hero */}
        <section className="pt-32 pb-20 px-6" style={{ background: `linear-gradient(180deg, ${C.indigoDim} 0%, ${C.navy} 100%)` }}>
          <div className="max-w-3xl mx-auto text-center">
            <p className={eyebrow} style={{ color: C.indigo }}>{D.eyebrow}</p>
            <h1 className="text-4xl sm:text-5xl md:text-[56px] font-black mb-6" style={{ color: C.heading, letterSpacing: "-0.03em", lineHeight: 1.08, textWrap: "balance" }}>
              {D.h1}
            </h1>
            <p className="text-base md:text-lg mb-10" style={{ color: C.body, lineHeight: 1.7 }}>{D.sub}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a href="/signup" className="w-full sm:w-auto px-7 py-3.5 text-sm font-bold rounded-lg text-white transition-opacity hover:opacity-90" style={{ background: C.indigo }}>
                Get Started →
              </a>
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto px-7 py-3.5 text-sm font-semibold rounded-lg border" style={{ borderColor: C.borderStrong, color: C.heading, background: C.navy }}>
                Book a Demo
              </a>
            </div>
          </div>
        </section>

        {/* What we handle */}
        <section className="py-20 px-6">
          <div className="max-w-[1200px] mx-auto">
            <p className={eyebrow} style={{ color: C.indigo }}>What AXQEN handles</p>
            <h2 className={`${h2} max-w-2xl`} style={{ color: C.heading, letterSpacing: "-0.025em", textWrap: "balance" }}>
              The operations behind your dropshipping store, in one platform.
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px rounded-2xl overflow-hidden mt-10" style={{ background: C.border, border: `1px solid ${C.border}` }}>
              {D.whatWeHandle.map((w) => (
                <div key={w.title} className="p-7" style={{ background: C.navy }}>
                  <span className="block w-2 h-2 rounded-sm mb-5" style={{ background: C.indigo }} />
                  <h3 className="font-bold text-base mb-2" style={{ color: C.heading }}>{w.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: C.body }}>{w.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="py-20 px-6" style={{ background: C.card }}>
          <div className="max-w-[1200px] mx-auto">
            <p className={eyebrow} style={{ color: C.indigo }}>How it works</p>
            <h2 className={h2} style={{ color: C.heading, letterSpacing: "-0.025em" }}>Start dropshipping in four steps.</h2>
            <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mt-10">
              {D.steps.map((s) => (
                <li key={s.n}>
                  <span className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black text-white mb-5" style={{ background: C.indigo }}>{s.n}</span>
                  <h3 className="font-black text-lg mb-2" style={{ color: C.heading }}>{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: C.body }}>{s.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <Plans />

        {/* FAQ */}
        <section className="py-20 px-6" style={{ background: C.card }}>
          <div className="max-w-3xl mx-auto">
            <p className={eyebrow} style={{ color: C.indigo }}>FAQ</p>
            <h2 className={`${h2} mb-8`} style={{ color: C.heading, letterSpacing: "-0.025em" }}>Dropshipping with AXQEN, answered.</h2>
            <div className="space-y-2">
              {D.faqs.map((f, i) => (
                <details key={f.q} className="group rounded-xl" open={i === 0} style={{ background: C.navy, border: `1px solid ${C.border}` }}>
                  <summary className="flex items-center justify-between gap-4 px-6 py-4 cursor-pointer list-none text-sm font-semibold" style={{ color: C.heading }}>
                    {f.q}
                    <span aria-hidden className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-transform group-open:rotate-45" style={{ color: C.indigo, background: C.indigoDim }}>+</span>
                  </summary>
                  <p className="px-6 pb-5 text-sm leading-relaxed" style={{ color: C.body }}>{f.a}</p>
                </details>
              ))}
            </div>
            <p className="text-sm mt-8" style={{ color: C.body }}>
              Want the full platform view? See <a href="/" className="font-semibold" style={{ color: C.indigo }}>AXQEN AI, the AI Commerce Operating System</a>.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
