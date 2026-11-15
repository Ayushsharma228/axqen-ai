import { C, WA_LINK } from "./constants";
import { FINAL_CTA } from "./content";

export function FinalCTA() {
  return (
    <section className="axq-hero relative overflow-hidden px-5 md:px-6 py-20 md:py-28 text-center">
      <div aria-hidden className="absolute -top-24 left-1/2 -translate-x-1/2 w-[640px] h-[320px] rounded-full pointer-events-none" style={{ background: "rgba(158,194,255,0.35)", filter: "blur(80px)" }} />
      <div className="relative max-w-3xl mx-auto">
        <h2 className="text-white mb-5" style={{ fontSize: "clamp(2rem, 1.2rem + 3vw, 3.5rem)", lineHeight: 1.06, textWrap: "balance" }}>
          {FINAL_CTA.heading}
        </h2>
        <p className="text-base md:text-lg mb-10 max-w-2xl mx-auto" style={{ color: C.paleLilac }}>{FINAL_CTA.sub}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href="/signup" className="axq-btn axq-btn-lime w-full sm:w-auto !min-h-[52px] !px-8">
            {FINAL_CTA.primary} →
          </a>
          <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="axq-btn axq-btn-pill w-full sm:w-auto !min-h-[52px] !px-8">
            {FINAL_CTA.secondary}
          </a>
        </div>
      </div>
    </section>
  );
}
