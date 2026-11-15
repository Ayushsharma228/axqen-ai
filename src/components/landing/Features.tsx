"use client";
import { C } from "./constants";
import { useInView } from "./useInView";
import { CAPABILITIES, CAPABILITIES_HEADING } from "./content";

export function Features() {
  const { ref, inView } = useInView();

  return (
    <section id="features" className="py-24 px-6" style={{ background: C.navy }} ref={ref}>
      <div
        className="max-w-[1200px] mx-auto transition-all duration-700"
        style={{ opacity: inView ? 1 : 0.001, transform: inView ? "none" : "translateY(24px)" }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px rounded-2xl overflow-hidden"
          style={{ background: C.border, border: `1px solid ${C.border}` }}>
          {/* Heading occupies the first cell so 7 capabilities fill an even grid */}
          <div className="p-7 flex flex-col justify-end" style={{ background: C.indigoDim }}>
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: C.indigo }}>
              Platform capabilities
            </p>
            <h2 className="text-2xl font-black leading-tight" style={{ color: C.heading, letterSpacing: "-0.02em", textWrap: "balance" }}>
              {CAPABILITIES_HEADING}
            </h2>
          </div>
          {CAPABILITIES.map((f) => (
            <div key={f.title} className="p-7" style={{ background: C.navy }}>
              <span className="block w-2 h-2 rounded-sm mb-5" style={{ background: C.indigo }} />
              <h3 className="font-bold text-base mb-2 leading-snug" style={{ color: C.heading }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: C.body }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
