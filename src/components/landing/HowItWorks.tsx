"use client";
import { C } from "./constants";
import { useInView } from "./useInView";
import { STEPS } from "./content";

export function HowItWorks() {
  const { ref, inView } = useInView();

  return (
    <section id="how-it-works" className="py-24 px-6" style={{ background: C.card }} ref={ref}>
      <div
        className="max-w-[1200px] mx-auto transition-all duration-700"
        style={{ opacity: inView ? 1 : 0.001, transform: inView ? "none" : "translateY(24px)" }}
      >
        <div className="mb-14">
          <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: C.indigo }}>
            How AXQEN works
          </p>
          <h2 className="text-3xl md:text-4xl font-black" style={{ color: C.heading, letterSpacing: "-0.025em" }}>
            From sign-up to scale in four steps.
          </h2>
        </div>

        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {STEPS.map((s, i) => (
            <li key={s.n} className="relative">
              <div className="flex items-center gap-3 mb-5">
                <span
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                  style={{ background: C.indigo, fontVariantNumeric: "tabular-nums" }}
                >
                  {s.n}
                </span>
                {i < STEPS.length - 1 && (
                  <span className="hidden lg:block flex-1 border-t-2 border-dashed" style={{ borderColor: C.indigoBorder }} />
                )}
              </div>
              <h3 className="font-black text-lg mb-2" style={{ color: C.heading }}>{s.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: C.body }}>{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
