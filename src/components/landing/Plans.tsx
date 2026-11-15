import { Check, Receipt, RotateCcw } from "lucide-react";
import { C } from "./constants";
import { PRICING } from "./content";

export function Plans() {
  return (
    <section id="plans" className="py-20 md:py-28 px-5 md:px-6" style={{ background: C.card }}>
      <div className="max-w-[1200px] mx-auto">
        <div className="text-center mb-14">
          <p className="axq-eyebrow mb-4">Pricing</p>
          <h2 className="text-3xl md:text-[44px] leading-tight mb-5" style={{ color: C.heading, textWrap: "balance" }}>
            {PRICING.heading}
          </h2>
          <p className="text-base md:text-lg max-w-2xl mx-auto" style={{ color: C.body }}>{PRICING.sub}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 items-start">
          {PRICING.plans.map((plan) => {
            const hi = plan.popular;
            const ink = hi ? "rgba(255,255,255,0.92)" : C.body;
            return (
              <div
                key={plan.id}
                className={`relative p-7 md:p-8 flex flex-col rounded-2xl ${hi ? "md:-mt-4" : "axq-card axq-card-hover"}`}
                style={hi ? {
                  background: `radial-gradient(90% 60% at 100% 0%, rgba(198,165,255,0.45) 0%, transparent 60%), linear-gradient(160deg, ${C.action} 0%, ${C.deep} 100%)`,
                  boxShadow: "0 30px 60px -24px rgba(83,24,235,0.6)",
                } : undefined}
              >
                {hi && (
                  <span className="absolute -top-3 left-8 px-3 py-1 rounded-full text-[11px] font-bold" style={{ background: C.lime, color: C.deep }}>
                    Most popular
                  </span>
                )}
                <p className="text-xs font-bold tracking-[0.16em] uppercase mb-4" style={{ color: hi ? C.lime : C.action }}>
                  {plan.name}
                </p>
                <div className="flex items-baseline gap-2 flex-wrap mb-1">
                  <span className="axq-display text-[44px] leading-none" style={{ color: hi ? "#fff" : C.heading, fontVariantNumeric: "tabular-nums" }}>
                    {plan.price}
                  </span>
                  <span className="text-[15px]" style={{ color: ink }}>one-time</span>
                </div>
                <p className="text-sm mb-7" style={{ color: ink }}>+ 18% GST</p>

                <a
                  href={`/signup?plan=${plan.id}`}
                  className={`axq-btn w-full mb-7 ${hi ? "axq-btn-lime" : "axq-btn-violet"}`}
                >
                  Get {plan.name}
                </a>

                <div className="pt-6" style={{ borderTop: `1px solid ${hi ? "rgba(255,255,255,0.2)" : C.border}` }}>
                  {plan.lead && (
                    <p className="text-[15px] font-bold mb-4" style={{ color: hi ? "#fff" : C.heading }}>{plan.lead}</p>
                  )}
                  <ul className="flex flex-col gap-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-[15px] leading-snug" style={{ color: hi ? "#fff" : C.heading }}>
                        <span className="w-5 h-5 mt-px rounded-full flex items-center justify-center flex-shrink-0" style={{ background: hi ? C.lime : C.paleLilac }}>
                          <Check size={12} strokeWidth={3} color={hi ? C.deep : C.action} aria-hidden />
                        </span>
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
          <div className="axq-card p-7 md:p-8">
            <h3 className="flex items-center gap-3 text-lg mb-5" style={{ color: C.heading }}>
              <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: C.paleLilac }}>
                <Receipt size={20} color={C.action} aria-hidden />
              </span>
              Common commercial terms
            </h3>
            <ul className="flex flex-col gap-3">
              {PRICING.terms.map((t) => (
                <li key={t} className="flex items-start gap-3 text-[15px]" style={{ color: C.body }}>
                  <span aria-hidden className="w-1.5 h-1.5 rounded-full mt-2.5 flex-shrink-0" style={{ background: C.action }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="axq-card p-7 md:p-8">
            <h3 className="flex items-center gap-3 text-lg mb-5" style={{ color: C.heading }}>
              <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(196,238,135,0.55)" }}>
                <RotateCcw size={20} color={C.limeInk} aria-hidden />
              </span>
              RTO benefits
            </h3>
            <div className="flex flex-col gap-5">
              {PRICING.rtoBenefits.map((b) => (
                <div key={b.plan}>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] mb-1.5" style={{ color: C.action }}>{b.plan}</p>
                  <p className="text-[15px] leading-relaxed" style={{ color: C.body }}>{b.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
