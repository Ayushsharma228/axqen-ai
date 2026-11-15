import { C } from "./constants";
import { INTEGRATIONS, INTEGRATIONS_HEADING } from "./content";

export function StatsBar() {
  return (
    <section
      id="integrations"
      style={{ background: C.card, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}
    >
      <div className="max-w-[1200px] mx-auto px-6 py-12">
        <h2 className="text-center text-lg md:text-xl font-bold mb-8" style={{ color: C.heading }}>
          {INTEGRATIONS_HEADING}
        </h2>
        <div className="flex flex-wrap justify-center gap-3">
          {INTEGRATIONS.map((p) => {
            const planned = p.status === "planned";
            return (
              <div
                key={p.name}
                className="flex items-center gap-3 px-5 py-3 rounded-xl w-[calc(50%-6px)] sm:w-[200px]"
                style={{ background: C.navy, border: `1px solid ${C.border}` }}
              >
                <img
                  src={p.logo}
                  alt=""
                  width={28}
                  height={28}
                  className="w-7 h-7 object-contain flex-shrink-0 rounded-md"
                  style={{ opacity: planned ? 0.7 : 1 }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight" style={{ color: planned ? C.body : C.heading }}>{p.name}</p>
                  {planned && (
                    <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>Coming soon</p>
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
