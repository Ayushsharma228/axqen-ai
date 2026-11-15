"use client";
import { C } from "./constants";
import { useInView } from "./useInView";
import { AUDIENCES } from "./content";

export function Testimonials() {
  const { ref, inView } = useInView();

  return (
    <section id="audience" className="py-24 px-6" style={{ background: C.card }} ref={ref}>
      <div
        className="max-w-[1200px] mx-auto transition-all duration-700"
        style={{ opacity: inView ? 1 : 0.001, transform: inView ? "none" : "translateY(24px)" }}
      >
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-20 items-start">
          <div className="lg:w-80 flex-shrink-0">
            <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: C.indigo }}>
              Who AXQEN is for
            </p>
            <h2 className="text-3xl md:text-4xl font-black mb-4 leading-tight" style={{ color: C.heading, letterSpacing: "-0.025em", textWrap: "balance" }}>
              Built for wherever you are in the journey.
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: C.body }}>
              From your first product to a multi-channel brand, the same operating system grows with you.
            </p>
          </div>

          <ul className="flex-1 w-full rounded-2xl overflow-hidden" style={{ background: C.navy, border: `1px solid ${C.border}` }}>
            {AUDIENCES.map((a, i) => (
              <li
                key={a.title}
                className="flex items-center gap-4 px-6 py-5"
                style={{ borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: C.indigo }} />
                <div className="flex-1">
                  <p className="text-base font-bold" style={{ color: C.heading }}>{a.title}</p>
                  <p className="text-sm mt-0.5" style={{ color: C.body }}>{a.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
