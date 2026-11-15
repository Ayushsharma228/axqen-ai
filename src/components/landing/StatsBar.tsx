import { C } from "./constants";
import { INTEGRATIONS, INTEGRATIONS_HEADING } from "./content";

export function StatsBar() {
  return (
    <section id="integrations" className="px-5 md:px-6 py-14 md:py-16" style={{ background: C.card, borderBottom: `1px solid ${C.border}` }}>
      <div className="max-w-[1200px] mx-auto">
        <h2 className="text-center text-xl md:text-2xl mb-9" style={{ color: C.heading }}>
          {INTEGRATIONS_HEADING}
        </h2>
        <div className="flex flex-wrap justify-center gap-3 md:gap-4">
          {INTEGRATIONS.map((p) => {
            const planned = p.status === "planned";
            return (
              <div key={p.name} className="axq-card axq-card-hover flex items-center gap-3 px-5 py-3.5 w-[calc(50%-6px)] sm:w-[210px] !rounded-2xl">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  <img src={p.logo} alt="" width={24} height={24} className="w-6 h-6 object-contain rounded" style={{ opacity: planned ? 0.75 : 1 }} />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold leading-tight" style={{ color: C.heading }}>{p.name}</p>
                  {planned ? (
                    <p className="text-[11px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: C.body }}>Coming soon</p>
                  ) : (
                    <span className="sr-only">Available</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
