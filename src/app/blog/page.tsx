import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { C } from "@/components/landing/constants";
import { SOCIALS } from "@/components/landing/content";
import { AXQ_ROOT } from "@/components/landing/theme";
import { POSTS, formatDate } from "./posts";

export const metadata: Metadata = {
  title: "Blog",
  description: "Guides on starting and running an e-commerce business in India: dropshipping, COD, RTO, suppliers and profit.",
  alternates: { canonical: "https://www.axqen.app/blog" },
};

export default function BlogPage() {
  const posts = [...POSTS].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className={AXQ_ROOT} style={{ minHeight: "100vh" }}>
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50 }}>
        <Navbar />
      </header>
      <main>
        <section className="axq-hero pt-36 md:pt-44 pb-16 md:pb-20 px-5 md:px-6">
          <div className="max-w-[1100px] mx-auto">
            <p className="axq-eyebrow mb-5" style={{ color: C.lime }}>Blog</p>
            <h1 className="text-white mb-5 max-w-2xl" style={{ fontSize: "clamp(2.25rem, 1.4rem + 3.5vw, 3.75rem)", lineHeight: 1.05 }}>
              Guides for running e-commerce in India.
            </h1>
            <p className="text-base md:text-lg max-w-2xl" style={{ color: "rgba(255,255,255,0.88)" }}>
              Practical, numbers-first articles on dropshipping, COD, RTO, suppliers and profit.
            </p>
          </div>
        </section>

        <section className="px-5 md:px-6 py-16 md:py-20" style={{ background: C.card }}>
          <div className="max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            {posts.map((p) => (
              <a key={p.slug} href={`/blog/${p.slug}`} className="axq-card axq-card-hover group flex flex-col overflow-hidden">
                <img src={`/blog/${p.slug}/opengraph-image`} alt={p.imageAlt} width={1200} height={630} loading="lazy" className="w-full aspect-[1200/630] object-cover" />
                <div className="p-6 md:p-7 flex flex-col flex-1">
                  <p className="text-sm mb-3" style={{ color: C.body }}>
                    <time dateTime={p.date}>{formatDate(p.date)}</time> · {p.readingMinutes} min read
                  </p>
                  <h2 className="text-xl md:text-2xl leading-tight mb-3" style={{ color: C.heading }}>{p.title}</h2>
                  <p className="text-[15px] leading-relaxed mb-5 flex-1" style={{ color: C.body }}>{p.excerpt}</p>
                  <span className="inline-flex items-center gap-1.5 text-[15px] font-semibold" style={{ color: C.action }}>
                    Read article <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" aria-hidden />
                  </span>
                </div>
              </a>
            ))}
          </div>

          <div className="max-w-[1100px] mx-auto mt-14 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-base" style={{ color: C.body }}>New guides every week. Follow AXQEN AI to see them first.</p>
            <div className="flex flex-wrap gap-2">
              {SOCIALS.map((s) => (
                <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer" className="axq-btn axq-btn-lilac !min-h-[44px] !px-5 text-sm">
                  {s.name}
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
