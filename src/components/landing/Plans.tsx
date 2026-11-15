"use client";
import { C } from "./constants";
import { useInView } from "./useInView";
import { PRICING } from "./content";

export function Plans() {
  const { ref, inView } = useInView();

  return (
    <section id="plans" className="py-24 px-6" style={{ background: C.navy }} ref={ref}>
      <div
        className="max-w-[1200px] mx-auto transition-all duration-700"
        style={{ opacity: inView ? 1 : 0.001, transform: inView ? "none" : "translateY(24px)" }}
      >
        <div className="text-center mb-14">
          <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: C.indigo }}>Pricing</p>
          <h2 className="text-3xl md:text-4xl font-black mb-4" style={{ color: C.heading, letterSpacing: "-0.025em", textWrap: "balance" }}>
            {PRICING.heading}
          </h2>
          <p className="text-base max-w-2xl mx-auto" style={{ color: C.body }}>{PRICING.sub}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 items-start">
          {PRICING.plans.map((plan) => {
            const hi = plan.popular;
            return (
              <div
                key={plan.id}
                className="rounded-2xl p-7 flex flex-col relative"
                style={{
                  background: hi ? C.indigo : C.navy,
                  border: hi ? "none" : `1px solid ${C.border}`,
                  boxShadow: hi ? "0 12px 40px rgba(21,94,239,0.28)" : "none",
                }}
              >
                {hi && (
                  <span
                    className="absolute -top-3 left-7 px-3 py-1 rounded-full text-[11px] font-bold"
                    style={{ background: C.deep, color: "#fff" }}
                  >
                    Most popular
                  </span>
                )}
                <p className="text-xs font-black tracking-widest uppercase mb-3" style={{ color: hi ? "rgba(255,255,255,0.8)" : C.body }}>
                  {plan.name}
                </p>
                <div className="flex items-baseline gap-2 flex-wrap mb-1">
                  <span className="text-4xl font-black" style={{ color: hi ? "#fff" : C.heading, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>
                    {plan.price}
                  </span>
                  <span className="text-sm" style={{ color: hi ? "rgba(255,255,255,0.75)" : C.muted }}>one-time</span>
                </div>
                <p className="text-xs mb-6" style={{ color: hi ? "rgba(255,255,255,0.75)" : C.muted }}>+ 18% GST</p>

                <a
                  href={`/signup?plan=${plan.id}`}
                  className="block text-center py-3 rounded-lg text-sm font-bold transition-all hover:opacity-90 active:scale-95 mb-6"
                  style={hi
                    ? { background: "#fff", color: C.deep }
                    : { background: C.indigoDim, color: C.deep, border: `1px solid ${C.indigoBorder}` }}
                >
                  Get {plan.name}
                </a>

                <div style={{ borderTop: `1px solid ${hi ? "rgba(255,255,255,0.2)" : C.border}` }} className="pt-5">
                  {plan.lead && (
                    <p className="text-sm font-bold mb-3" style={{ color: hi ? "#fff" : C.heading }}>{plan.lead}</p>
                  )}
                  <ul className="space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm" style={{ color: hi ? "rgba(255,255,255,0.92)" : C.heading }}>
                        <span aria-hidden style={{ color: hi ? "#fff" : C.indigo, flexShrink: 0 }}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl p-7" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <h3 className="text-base font-black mb-4" style={{ color: C.heading }}>Common commercial terms</h3>
            <ul className="space-y-2.5">
              {PRICING.terms.map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm" style={{ color: C.body }}>
                  <span aria-hidden className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: C.indigo }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl p-7" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <h3 className="text-base font-black mb-4" style={{ color: C.heading }}>RTO benefits</h3>
            <div className="space-y-4">
              {PRICING.rtoBenefits.map((b) => (
                <div key={b.plan}>
                  <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: C.indigo }}>{b.plan}</p>
                  <p className="text-sm leading-relaxed" style={{ color: C.body }}>{b.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
