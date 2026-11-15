import type { Metadata } from "next";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { C } from "@/components/landing/constants";
import { SOCIALS } from "@/components/landing/content";

export const metadata: Metadata = {
  title: "Blog",
  description: "Guides and updates on running e-commerce operations with AXQEN AI.",
  alternates: { canonical: "https://www.axqen.app/blog" },
};

export default function BlogPage() {
  return (
    <div style={{ background: C.navy, minHeight: "100vh" }}>
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50 }}>
        <Navbar />
      </header>
      <main className="pt-36 pb-28 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: C.indigo }}>Blog</p>
          <h1 className="text-4xl md:text-5xl font-black mb-5" style={{ color: C.heading, letterSpacing: "-0.03em" }}>
            Articles are on the way.
          </h1>
          <p className="text-base mb-10" style={{ color: C.body }}>
            We&apos;re writing guides on store setup, order operations, NDR and RTO handling, and reading your profit
            numbers. Follow AXQEN AI to see them first.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {SOCIALS.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                style={{ background: C.indigoDim, color: C.deep, border: `1px solid ${C.indigoBorder}` }}
              >
                {s.name}
              </a>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
