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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {INTEGRATIONS.map((p) => {
            const planned = p.status === "planned";
            return (
              <div
                key={p.name}
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
                style={{ background: C.navy, border: `1px solid ${C.border}`, opacity: planned ? 0.75 : 1 }}
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center text-white font-black flex-shrink-0"
                  style={{ background: planned ? C.muted : p.color, fontSize: 10 }}
                >
                  {p.short}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight" style={{ color: C.heading }}>{p.name}</p>
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
