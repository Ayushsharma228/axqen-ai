import { C } from "./constants";
import { RESULTS } from "./content";

type Store = (typeof RESULTS.stores)[number];

const GROUPS: { platform: Store["platform"]; label: string; logo: string; cols: string; aspect: string }[] = [
  { platform: "Shopify", label: "Shopify stores", logo: "/integrations/shopify.svg", cols: "md:grid-cols-3", aspect: "aspect-[16/10]" },
  { platform: "Amazon",  label: "Amazon sellers", logo: "/integrations/amazon.svg",  cols: "md:grid-cols-2", aspect: "aspect-[2.4/1]" },
];

function Card({ s, aspect }: { s: Store; aspect: string }) {
  return (
    <figure className="rounded-2xl overflow-hidden flex flex-col" style={{ background: "#1D2939", border: "1px solid rgba(255,255,255,0.1)" }}>
      <a href={s.image} target="_blank" rel="noopener noreferrer" className={`block ${aspect} overflow-hidden bg-white`} aria-label={`Open ${s.name} ${s.platform} dashboard screenshot`}>
        <img
          src={s.image}
          alt={`${s.name} ${s.platform} seller dashboard`}
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
  );
}

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

        <div className="flex flex-col gap-12">
          {GROUPS.map((g) => {
            const stores = RESULTS.stores.filter((s) => s.platform === g.platform);
            if (!stores.length) return null;
            return (
              <div key={g.platform}>
                <h3 className="flex items-center gap-2.5 text-sm font-bold uppercase tracking-widest mb-5" style={{ color: "rgba(255,255,255,0.8)" }}>
                  <span className="w-7 h-7 rounded-md bg-white flex items-center justify-center">
                    <img src={g.logo} alt="" width={16} height={16} className="w-4 h-4" />
                  </span>
                  {g.label}
                </h3>
                <div className={`grid grid-cols-1 ${g.cols} gap-6`}>
                  {stores.map((s) => <Card key={s.name} s={s} aspect={g.aspect} />)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-10">
          <p className="text-xs max-w-2xl" style={{ color: "rgba(255,255,255,0.5)" }}>{RESULTS.disclaimer}</p>
          <a href="/case-studies" className="text-sm font-semibold flex-shrink-0" style={{ color: "#84ADFF" }}>
            Read the case studies →
          </a>
        </div>
      </div>
    </section>
  );
}
