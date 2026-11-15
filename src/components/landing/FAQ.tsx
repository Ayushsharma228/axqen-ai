"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { C, WA_LINK } from "./constants";
import { FAQS } from "./content";

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faqs" className="py-20 md:py-28 px-5 md:px-6" style={{ background: C.navy }}>
      <div className="max-w-[1200px] mx-auto">
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-20 items-start">
          <div className="lg:w-80 flex-shrink-0 lg:sticky lg:top-28">
            <p className="axq-eyebrow mb-4">FAQ</p>
            <h2 className="text-3xl md:text-[44px] mb-5 leading-tight" style={{ color: C.heading }}>
              Questions, answered.
            </h2>
            <p className="text-base" style={{ color: C.body }}>
              Still unsure?{" "}
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 decoration-2" style={{ color: C.action, fontWeight: 600, textDecorationColor: C.lilac }}>
                Book a demo
              </a>{" "}
              and we will walk you through it.
            </p>
          </div>

          <div className="flex-1 w-full flex flex-col gap-3">
            {FAQS.map((f, i) => {
              const isOpen = open === i;
              return (
                <div
                  key={f.q}
                  className="rounded-2xl transition-[border-color,box-shadow] duration-300"
                  style={{
                    background: "#fff",
                    border: `1px solid ${isOpen ? C.lilac : C.border}`,
                    boxShadow: isOpen ? C.shadowLift : C.shadow,
                  }}
                >
                  <button
                    id={`faq-${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${i}`}
                    className="w-full flex items-center justify-between gap-4 px-6 min-h-[64px] py-4 text-left"
                    onClick={() => setOpen(isOpen ? null : i)}
                  >
                    <span className="text-base font-semibold" style={{ color: isOpen ? C.action : C.heading }}>{f.q}</span>
                    <span
                      aria-hidden
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-[transform,background-color] duration-300"
                      style={{ background: isOpen ? C.action : C.paleLilac, transform: isOpen ? "rotate(45deg)" : "none" }}
                    >
                      <Plus size={16} strokeWidth={2.5} color={isOpen ? "#fff" : C.action} />
                    </span>
                  </button>
                  <div id={`faq-panel-${i}`} role="region" aria-labelledby={`faq-${i}`} className="axq-acc" data-open={isOpen} inert={!isOpen}>
                    <div>
                      <p className="px-6 pb-6 text-[15px] leading-relaxed" style={{ color: C.body }}>{f.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
