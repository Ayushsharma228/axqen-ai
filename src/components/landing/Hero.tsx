import { Check } from "lucide-react";
import { C, WA_LINK } from "./constants";
import { HERO } from "./content";

function DashboardMockup() {
  const NAV_ITEMS = ["Dashboard", "Orders", "Products", "Suppliers", "Shipping", "NDR", "RTO", "Wallet", "Analytics"];
  const STATS = [
    { label: "Total Orders",     val: "1,284",     sub: "All channels" },
    { label: "Delivered Orders", val: "1,012",     sub: "78.8% of total", good: true },
    { label: "RTO Orders",       val: "96",        sub: "7.5% of total" },
    { label: "Net Profit",       val: "₹2,18,400", sub: "After shipping & RTO", good: true },
  ];
  const BARS = [30, 45, 40, 65, 55, 78, 50, 62, 88, 72, 82, 68, 92, 78];
  const CHANNELS = [
    { name: "Shopify",       val: 742, pct: 100, color: C.action },
    { name: "Amazon",        val: 386, pct: 52,  color: C.lilac },
    { name: "Manual orders", val: 156, pct: 21,  color: "#9BCB55" },
  ];

  return (
    <div
      className="rounded-2xl overflow-hidden select-none"
      style={{ display: "flex", height: 380, background: "#fff", boxShadow: "0 40px 90px -30px rgba(20,7,47,0.75), 0 0 0 1px rgba(255,255,255,0.4)" }}
    >
      <div style={{ width: 190, background: `linear-gradient(180deg, ${C.deep} 0%, #3B1A8C 100%)`, padding: "16px 0", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "0 14px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <img src="/axqen-icon.png" alt="" width={22} height={22} style={{ width: 22, height: 22, borderRadius: 5, boxShadow: "0 0 0 1px rgba(255,255,255,0.35)" }} />
          <span style={{ color: "white", fontSize: 12, fontWeight: 800 }}>AXQEN</span>
        </div>
        {NAV_ITEMS.map((item, i) => (
          <div
            key={item}
            style={{
              padding: "7px 14px", margin: "0 8px", borderRadius: 7, fontSize: 11.5,
              color: i === 0 ? C.deep : "rgba(255,255,255,0.7)", fontWeight: i === 0 ? 700 : 500,
              background: i === 0 ? C.lime : "transparent", display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <div style={{ width: 12, height: 12, borderRadius: 3, background: i === 0 ? "rgba(39,15,96,0.3)" : "rgba(255,255,255,0.25)", flexShrink: 0 }} />
            {item}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, background: "#fff", padding: "16px 18px", overflow: "hidden", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.heading }}>Business Overview</span>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ fontSize: 10, background: C.paleLilac, color: C.deep, padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>Demo data</span>
            <span style={{ fontSize: 10, color: C.body, background: C.card, border: `1px solid ${C.border}`, padding: "3px 10px", borderRadius: 20 }}>Last 30 days</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {STATS.map((s) => (
            <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 9, color: C.body, marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.heading, letterSpacing: "-0.03em" }}>{s.val}</div>
              <div style={{ fontSize: 9, marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4, color: s.good ? C.limeInk : C.body }}>
                {s.good && <span style={{ width: 6, height: 6, borderRadius: 9, background: "#9BCB55" }} />}
                {s.sub}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, flex: 1, minHeight: 0 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.heading, marginBottom: 2 }}>Sales Performance</div>
            <div style={{ fontSize: 9, color: C.body, marginBottom: 8 }}>Daily sales, ₹</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2.5, flex: 1, minHeight: 0 }}>
              {BARS.map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h}%`, background: i === BARS.length - 2 ? C.action : "#D9C8FF", borderRadius: "3px 3px 0 0", minWidth: 3 }} />
              ))}
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.heading, marginBottom: 10 }}>Channel-wise Orders</div>
            {CHANNELS.map((ch) => (
              <div key={ch.name} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: C.heading, marginBottom: 3 }}>
                  <span>{ch.name}</span>
                  <span style={{ fontWeight: 700 }}>{ch.val}</span>
                </div>
                <div style={{ height: 5, background: C.paleLilac, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${ch.pct}%`, background: ch.color, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Real seller dashboard screenshots already published on the site, used as atmospheric thumbnails.
const THUMBS = [
  { src: "/hero/thumb-zolf.jpg",           w: 260, top: "14%", left: "-3%",  o: 0.5,  r: "-6deg", d: "19s", x: "14px",  y: "-20px", hide: "" },
  { src: "/hero/thumb-meta-hyperloop.jpg", w: 210, top: "52%", left: "2%",   o: 0.38, r: "4deg",  d: "23s", x: "-10px", y: "16px",  hide: "max-lg:hidden" },
  { src: "/hero/thumb-sutvakka.jpg",       w: 280, top: "10%", left: "77%",  o: 0.5,  r: "5deg",  d: "21s", x: "-16px", y: "18px",  hide: "" },
  { src: "/hero/thumb-hyperloop.jpg",      w: 220, top: "48%", left: "82%",  o: 0.4,  r: "-4deg", d: "25s", x: "12px",  y: "-14px", hide: "max-lg:hidden" },
  { src: "/hero/thumb-kgn.jpg",            w: 190, top: "-2%", left: "30%",  o: 0.28, r: "-2deg", d: "27s", x: "18px",  y: "10px",  hide: "max-md:hidden" },
  { src: "/hero/thumb-meta-zolf.jpg",      w: 180, top: "-4%", left: "58%",  o: 0.26, r: "3deg",  d: "29s", x: "-14px", y: "12px",  hide: "max-md:hidden" },
];

export function Hero() {
  const words = HERO.headlineLead.split(" ");
  const brandWords = HERO.headlineBrand.split(" ");

  return (
    <section className="axq-hero relative overflow-hidden pt-32 md:pt-40 pb-16 md:pb-24 px-5 md:px-6">
      <div className="absolute inset-x-0 top-0 h-[640px] pointer-events-none max-w-[1440px] mx-auto">
        {THUMBS.map((t) => (
          <div
            key={t.src}
            aria-hidden
            className={`axq-thumb pointer-events-auto ${t.hide} max-sm:!w-[150px]`}
            style={{
              width: t.w, top: t.top, left: t.left, opacity: t.o,
              ["--r" as string]: t.r, ["--d" as string]: t.d, ["--x" as string]: t.x, ["--y" as string]: t.y,
            }}
          >
            <img src={t.src} alt="" loading="eager" decoding="async" />
          </div>
        ))}
      </div>

      <div className="relative max-w-[1200px] mx-auto">
        <div className="text-center mb-14 md:mb-16 max-w-4xl mx-auto">
          <span
            className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full mb-8 uppercase"
            style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", letterSpacing: "0.14em" }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.lime }} />
            {HERO.eyebrow}
          </span>

          <h1
            className="mb-7 text-white"
            style={{ fontSize: "clamp(2.4rem, 1.2rem + 4.6vw, 4.75rem)", lineHeight: 1.04, letterSpacing: "-0.035em", textWrap: "balance" }}
          >
            {words.map((w, i) => (
              <span key={i} className="axq-word" style={{ animationDelay: `${i * 55}ms` }}>{w}&nbsp;</span>
            ))}
            {brandWords.map((w, i) => (
              <span key={`b${i}`} className="axq-word" style={{ color: C.lime, animationDelay: `${(words.length + i) * 55}ms` }}>
                {w}{i < brandWords.length - 1 ? " " : ""}
              </span>
            ))}
          </h1>

          <p className="mb-10 max-w-2xl mx-auto" style={{ color: "rgba(255,255,255,0.88)", fontSize: "clamp(1rem, 0.9rem + 0.4vw, 1.2rem)", lineHeight: 1.65 }}>
            {HERO.sub}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-9">
            <a href="/signup" className="axq-btn axq-btn-lime w-full sm:w-auto !min-h-[52px] !px-8">
              {HERO.primaryCta} →
            </a>
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="axq-btn axq-btn-pill w-full sm:w-auto !min-h-[52px] !px-8">
              {HERO.secondaryCta}
            </a>
          </div>

          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 text-[15px]" style={{ color: "rgba(255,255,255,0.9)" }}>
            {HERO.points.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: C.lime }}>
                  <Check size={12} strokeWidth={3} color={C.deep} aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="max-w-[900px] mx-auto">
          <div className="rounded-[22px] p-2.5 md:p-3" style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.28)" }}>
            <div className="overflow-x-auto rounded-2xl">
              <div style={{ minWidth: 680 }}>
                <DashboardMockup />
              </div>
            </div>
          </div>
          <p className="text-center text-xs mt-4" style={{ color: "rgba(255,255,255,0.78)" }}>
            Illustrative demo data
          </p>
        </div>
      </div>
    </section>
  );
}
