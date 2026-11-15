import { C } from "./constants";
import { STEPS } from "./content";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 md:py-28 px-5 md:px-6" style={{ background: C.card }}>
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-14 text-center">
          <p className="axq-eyebrow mb-4">How AXQEN works</p>
          <h2 className="text-3xl md:text-[44px] leading-tight" style={{ color: C.heading }}>
            From sign-up to scale in four steps.
          </h2>
        </div>

        <ol className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Connector across the step numbers on desktop */}
          <span
            aria-hidden
            className="hidden lg:block absolute top-[51px] left-[10%] right-[10%] h-[2px]"
            style={{ background: `linear-gradient(90deg, ${C.lilac}, ${C.action}, ${C.lilac})` }}
          />
          {STEPS.map((s, i) => {
            const last = i === STEPS.length - 1;
            return (
              <li key={s.n} className="axq-card axq-card-hover relative p-7 text-center lg:text-left">
                <span
                  className="axq-display relative z-10 w-12 h-12 rounded-full flex items-center justify-center text-base mb-6 mx-auto lg:mx-0"
                  style={{
                    background: last ? C.lime : C.action,
                    color: last ? C.deep : "#fff",
                    boxShadow: `0 0 0 6px ${last ? "rgba(207,227,255,0.35)" : C.paleLilac}`,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {s.n}
                </span>
                <h3 className="text-xl mb-2" style={{ color: C.heading }}>{s.title}</h3>
                <p className="text-[15px] leading-relaxed" style={{ color: C.body }}>{s.desc}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
