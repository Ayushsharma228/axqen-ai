"use client";
import { useState } from "react";
import { C, WA_LINK } from "./constants";
import { useInView } from "./useInView";
import { FAQS } from "./content";

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const { ref, inView } = useInView();

  return (
    <section id="faqs" className="py-24 px-6" style={{ background: C.card }} ref={ref}>
      <div
        className="max-w-[1200px] mx-auto transition-all duration-700"
        style={{ opacity: inView ? 1 : 0.001, transform: inView ? "none" : "translateY(24px)" }}
      >
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-20 items-start">
          <div className="lg:w-72 flex-shrink-0">
            <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: C.indigo }}>FAQ</p>
            <h2 className="text-3xl md:text-4xl font-black mb-4 leading-tight" style={{ color: C.heading, letterSpacing: "-0.025em" }}>
              Questions, answered.
            </h2>
            <p className="text-sm" style={{ color: C.body }}>
              Still unsure?{" "}
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer" style={{ color: C.indigo, fontWeight: 600 }}>
                Book a demo
              </a>{" "}
              and we will walk you through it.
            </p>
          </div>

          <div className="flex-1 w-full space-y-2">
            {FAQS.map((f, i) => {
              const isOpen = open === i;
              return (
                <div
                  key={f.q}
                  className="rounded-xl overflow-hidden"
                  style={{ background: C.navy, border: `1px solid ${isOpen ? C.indigoBorder : C.border}` }}
                >
                  <button
                    id={`faq-${i}`}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between px-6 py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
                    onClick={() => setOpen(isOpen ? null : i)}
                  >
                    <span className="text-sm font-semibold pr-4" style={{ color: isOpen ? C.deep : C.heading }}>{f.q}</span>
                    <span
                      aria-hidden
                      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-lg font-light transition-transform duration-300"
                      style={{ color: C.indigo, background: C.indigoDim, transform: isOpen ? "rotate(45deg)" : "none" }}
                    >
                      +
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 pt-1 text-sm leading-relaxed" style={{ color: C.body }}>
                      {f.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
