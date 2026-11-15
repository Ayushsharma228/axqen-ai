import type { Metadata } from "next";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { C } from "@/components/landing/constants";
import { SOCIALS } from "@/components/landing/content";
import { AXQ_ROOT } from "@/components/landing/theme";

export const metadata: Metadata = {
  title: "Blog",
  description: "Guides and updates on running e-commerce operations with AXQEN AI.",
  alternates: { canonical: "https://www.axqen.app/blog" },
};

export default function BlogPage() {
  return (
    <div className={AXQ_ROOT} style={{ minHeight: "100vh" }}>
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50 }}>
        <Navbar />
      </header>
      <main className="axq-hero pt-40 pb-32 px-5 md:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <p className="axq-eyebrow mb-5" style={{ color: C.lime }}>Blog</p>
          <h1 className="text-white mb-6" style={{ fontSize: "clamp(2.25rem, 1.4rem + 3.5vw, 3.75rem)", lineHeight: 1.05 }}>
            Articles are on the way.
          </h1>
          <p className="text-base md:text-lg mb-10" style={{ color: "rgba(255,255,255,0.88)" }}>
            We&apos;re writing guides on store setup, order operations, NDR and RTO handling, and reading your profit
            numbers. Follow AXQEN AI to see them first.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {SOCIALS.map((s) => (
              <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer" className="axq-btn axq-btn-pill">
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
