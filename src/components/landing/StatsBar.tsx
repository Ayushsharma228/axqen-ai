import { C } from "./constants";

const PLATFORMS = [
  { short: "S",  name: "Shopify",    color: "#96BF48" },
  { short: "A",  name: "Amazon",     color: "#FF9900" },
  { short: "F",  name: "Flipkart",   color: "#2874F0" },
  { short: "M",  name: "Meesho",     color: "#FF0059" },
  { short: "SR", name: "Shiprocket", color: "#E84B2C" },
  { short: "E",  name: "Easebuzz",   color: "#1E9BD7" },
];

export function StatsBar() {
  return (
    <section
      id="integrations"
      style={{ background: C.card, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}
    >
      <div className="max-w-[1200px] mx-auto px-6 py-10">
        <p
          className="text-center text-xs font-bold tracking-widest uppercase mb-8"
          style={{ color: C.muted }}
        >
          Connects with the platforms you already sell and ship on
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {PLATFORMS.map((p) => (
            <div
              key={p.name}
              className="flex items-center gap-2.5 px-5 py-3 rounded-xl"
              style={{
                background: C.navy,
                border: `1px solid ${C.border}`,
              }}
            >
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center text-white font-black"
                style={{ background: p.color, fontSize: 9 }}
              >
                {p.short}
              </div>
              <span className="text-sm font-semibold" style={{ color: C.heading }}>
                {p.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
