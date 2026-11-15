import { C } from "./constants";
import { RESULTS } from "./content";

type Store = (typeof RESULTS.stores)[number];

const GROUPS: { platform: Store["platform"]; label: string; logo: string; cols: string; aspect: string }[] = [
  { platform: "Shopify", label: "Shopify stores", logo: "/integrations/shopify.svg", cols: "md:grid-cols-3", aspect: "aspect-[16/10]" },
  { platform: "Amazon",  label: "Amazon sellers", logo: "/integrations/amazon.svg",  cols: "md:grid-cols-2", aspect: "aspect-[2.4/1]" },
];

function Card({ s, aspect }: { s: Store; aspect: string }) {
  return (
    <figure className="rounded-2xl overflow-hidden flex flex-col transition-transform duration-300 hover:-translate-y-1" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(198,165,255,0.25)" }}>
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
          {s.period && <span className="text-xs" style={{ color: "rgba(235,227,254,0.82)" }}>{s.period}</span>}
        </div>
        <dl className="grid grid-cols-3 gap-3">
          {s.stats.map((st) => (
            <div key={st.label}>
              <dt className="text-[11px]" style={{ color: "rgba(235,227,254,0.82)" }}>{st.label}</dt>
              <dd className="axq-display text-lg text-white" style={{ fontVariantNumeric: "tabular-nums" }}>{st.val}</dd>
            </div>
          ))}
        </dl>
      </figcaption>
    </figure>
  );
}

export function Results() {
  return (
    <section id="results" className="py-20 md:py-28 px-5 md:px-6" style={{ background: `radial-gradient(80% 60% at 85% 0%, rgba(119,79,207,0.55) 0%, transparent 60%), radial-gradient(60% 50% at 0% 100%, rgba(83,24,235,0.35) 0%, transparent 60%), ${C.night}` }}>
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-12 max-w-2xl">
          <p className="axq-eyebrow mb-4" style={{ color: C.lime }}>Seller results</p>
          <h2 className="text-3xl md:text-[44px] leading-tight mb-4 text-white" style={{ textWrap: "balance" }}>
            {RESULTS.heading}
          </h2>
          <p className="text-base" style={{ color: C.paleLilac }}>{RESULTS.sub}</p>
        </div>

        <div className="flex flex-col gap-12">
          {GROUPS.map((g) => {
            const stores = RESULTS.stores.filter((s) => s.platform === g.platform);
            if (!stores.length) return null;
            return (
              <div key={g.platform}>
                <h3 className="flex items-center gap-2.5 text-sm font-bold uppercase tracking-widest mb-5" style={{ color: C.paleLilac }}>
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
          <p className="text-xs max-w-2xl" style={{ color: "rgba(235,227,254,0.82)" }}>{RESULTS.disclaimer}</p>
          <a href="/case-studies" className="text-sm font-semibold flex-shrink-0" style={{ color: C.lime }}>
            Read the case studies →
          </a>
        </div>
      </div>
    </section>
  );
}
