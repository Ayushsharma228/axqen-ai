import { C } from "./constants";
import { RESULTS } from "./content";

export function Results() {
  return (
    <section id="results" className="py-24 px-6" style={{ background: C.heading }}>
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: "#84ADFF" }}>Seller results</p>
          <h2 className="text-3xl md:text-4xl font-black mb-4 text-white" style={{ letterSpacing: "-0.025em", textWrap: "balance" }}>
            {RESULTS.heading}
          </h2>
          <p className="text-base" style={{ color: "rgba(255,255,255,0.7)" }}>{RESULTS.sub}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {RESULTS.stores.map((s) => (
            <figure key={s.name} className="rounded-2xl overflow-hidden flex flex-col" style={{ background: "#1D2939", border: "1px solid rgba(255,255,255,0.1)" }}>
              <a href={s.image} target="_blank" rel="noopener noreferrer" className="block aspect-[16/10] overflow-hidden bg-white" aria-label={`Open ${s.name} Shopify dashboard screenshot`}>
                <img
                  src={s.image}
                  alt={`${s.name} Shopify admin dashboard`}
                  loading="lazy"
                  className="w-full h-full object-cover object-top transition-transform duration-300 hover:scale-[1.03]"
                />
              </a>
              <figcaption className="p-5 flex flex-col gap-4 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-base font-bold text-white">{s.name}</span>
                  {s.period && <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>{s.period}</span>}
                </div>
                <dl className="grid grid-cols-3 gap-3">
                  {s.stats.map((st) => (
                    <div key={st.label}>
                      <dt className="text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>{st.label}</dt>
                      <dd className="text-lg font-black text-white" style={{ fontVariantNumeric: "tabular-nums" }}>{st.val}</dd>
                    </div>
                  ))}
                </dl>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-8">
          <p className="text-xs max-w-2xl" style={{ color: "rgba(255,255,255,0.5)" }}>{RESULTS.disclaimer}</p>
          <a href="/case-studies" className="text-sm font-semibold flex-shrink-0" style={{ color: "#84ADFF" }}>
            Read the case studies →
          </a>
        </div>
      </div>
    </section>
  );
}
