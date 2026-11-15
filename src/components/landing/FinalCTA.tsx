import { C, WA_LINK } from "./constants";
import { FINAL_CTA } from "./content";

export function FinalCTA() {
  return (
    <section className="py-20 px-6" style={{ background: C.navy }}>
      <div
        className="max-w-[1200px] mx-auto rounded-3xl px-6 md:px-10 py-16 text-center relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${C.indigo} 0%, ${C.deep} 100%)` }}
      >
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.06)" }} />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.06)" }} />

        <div className="relative max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black mb-4 text-white leading-tight" style={{ letterSpacing: "-0.025em", textWrap: "balance" }}>
            {FINAL_CTA.heading}
          </h2>
          <p className="text-base mb-10" style={{ color: "rgba(255,255,255,0.85)" }}>{FINAL_CTA.sub}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/signup"
              className="w-full sm:w-auto px-8 py-3.5 rounded-lg text-sm font-bold transition-all hover:opacity-90 active:scale-95"
              style={{ background: "#fff", color: C.deep }}
            >
              {FINAL_CTA.primary} →
            </a>
            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-3.5 rounded-lg text-sm font-semibold text-white transition-all hover:bg-white/10"
              style={{ border: "1px solid rgba(255,255,255,0.45)" }}
            >
              {FINAL_CTA.secondary}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
