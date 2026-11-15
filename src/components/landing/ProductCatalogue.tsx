"use client";
import { useEffect, useRef, useState } from "react";
import { C } from "./constants";
import { FEATURES, INTEGRATIONS } from "./content";

const SUCCESS = "success";
const pill = (color: string) =>
  color === SUCCESS ? { color: C.limeInk, background: "rgba(207,227,255,0.6)" } : { color, background: `${color}14` };

function DemoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4 md:p-5 mt-6" style={{ background: C.navy, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm font-bold" style={{ color: C.heading }}>{title}</span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: C.paleLilac, color: C.deep }}>
          Demo data
        </span>
      </div>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-xs" style={{ borderTop: `1px solid ${C.border}` }}>
      {children}
    </div>
  );
}

function Stat({ label, val, color }: { label: string; val: string; color?: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: C.card }}>
      <div className="text-[11px]" style={{ color: C.muted }}>{label}</div>
      <div className="text-lg font-bold" style={{ color: color ?? C.heading, fontVariantNumeric: "tabular-nums" }}>{val}</div>
    </div>
  );
}

const PREVIEWS: Record<string, () => React.ReactNode> = {
  orders: () => (
    <DemoCard title="All orders">
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Stat label="New today" val="48" /><Stat label="To process" val="17" /><Stat label="In transit" val="176" />
      </div>
      {[
        { id: "#AX-10482", ch: "Shopify · 2 items", s: "Processing", c: C.indigo },
        { id: "#AX-10481", ch: "Amazon · 1 item",   s: "Shipped",    c: SUCCESS },
        { id: "#AX-10480", ch: "Shopify · 3 items", s: "Delivered",  c: SUCCESS },
        { id: "#AX-10479", ch: "Shopify · 1 item",  s: "NDR raised", c: C.amber },
      ].map((o) => (
        <Row key={o.id}>
          <span className="font-bold" style={{ color: C.heading }}>{o.id}</span>
          <span className="hidden sm:inline" style={{ color: C.muted }}>{o.ch}</span>
          <span className="font-semibold px-2 py-0.5 rounded-full" style={pill(o.c)}>{o.s}</span>
        </Row>
      ))}
    </DemoCard>
  ),
  channels: () => (
    <DemoCard title="Sales channels">
      {INTEGRATIONS.filter((i) => i.name !== "Easebuzz").map((i) => (
        <Row key={i.name}>
          <span className="flex items-center gap-2.5 font-semibold" style={{ color: C.heading }}>
            <img src={i.logo} alt="" width={20} height={20} className="w-5 h-5 object-contain rounded" />
            {i.name}
          </span>
          {i.status === "live"
            ? <span className="font-semibold px-2 py-0.5 rounded-full" style={pill(SUCCESS)}>Connected</span>
            : <span className="font-semibold px-2 py-0.5 rounded-full" style={pill(C.body)}>Coming soon</span>}
        </Row>
      ))}
    </DemoCard>
  ),
  products: () => (
    <DemoCard title="Catalogue">
      {[
        { n: "Steel water bottle 1L", sup: "Supplier A", cost: "₹212", stock: "In stock", c: SUCCESS },
        { n: "Cotton bedsheet set",   sup: "Supplier B", cost: "₹489", stock: "Low stock", c: C.amber },
        { n: "LED desk lamp",         sup: "Supplier A", cost: "₹356", stock: "In stock", c: SUCCESS },
      ].map((p) => (
        <Row key={p.n}>
          <span className="font-semibold" style={{ color: C.heading }}>{p.n}</span>
          <span className="hidden sm:inline" style={{ color: C.muted }}>{p.sup} · {p.cost}</span>
          <span className="font-semibold px-2 py-0.5 rounded-full" style={pill(p.c)}>{p.stock}</span>
        </Row>
      ))}
    </DemoCard>
  ),
  shipping: () => (
    <DemoCard title="#AX-10481 · Tracking">
      <ol className="flex flex-col gap-3">
        {["Order confirmed", "Packed", "Shipped", "In transit", "Out for delivery"].map((s, i) => {
          const done = i <= 3;
          return (
            <li key={s} className="flex items-center gap-3 text-xs">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: done ? C.indigo : C.border }} />
              <span style={{ color: done ? C.heading : C.muted, fontWeight: i === 3 ? 700 : 500 }}>{s}</span>
              {i === 3 && <span className="ml-auto font-semibold px-2 py-0.5 rounded-full" style={pill(C.indigo)}>Current</span>}
            </li>
          );
        })}
      </ol>
    </DemoCard>
  ),
  ndr: () => (
    <DemoCard title="Delivery exceptions">
      {[
        { id: "#AX-10479", r: "Customer unavailable", a: "Re-attempt", c: C.indigo },
        { id: "#AX-10466", r: "Address incomplete",   a: "Follow up",  c: C.amber },
        { id: "#AX-10451", r: "Refused at door",      a: "RTO",        c: C.red },
      ].map((n) => (
        <Row key={n.id}>
          <span className="font-bold" style={{ color: C.heading }}>{n.id}</span>
          <span className="hidden sm:inline" style={{ color: C.muted }}>{n.r}</span>
          <span className="font-semibold px-2 py-0.5 rounded-full" style={pill(n.c)}>{n.a}</span>
        </Row>
      ))}
    </DemoCard>
  ),
  wallet: () => (
    <DemoCard title="Wallet">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Earned" val="₹48,620" color={C.limeInk} />
        <Stat label="RTO deductions" val="−₹3,140" color={C.red} />
        <Stat label="Settled to bank" val="₹38,900" color={C.indigo} />
        <Stat label="Wallet balance" val="₹6,580" />
      </div>
    </DemoCard>
  ),
  analytics: () => (
    <DemoCard title="Last 14 days">
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Stat label="Orders" val="612" /><Stat label="Delivered" val="78%" /><Stat label="RTO" val="8%" />
      </div>
      <div className="flex items-end gap-1.5 h-20">
        {[38, 52, 45, 66, 58, 74, 49, 63, 82, 70, 79, 64, 90, 76].map((h, i) => (
          <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: i === 12 ? C.indigo : "#C7DAFF" }} />
        ))}
      </div>
    </DemoCard>
  ),
};

export function ProductCatalogue() {
  const [active, setActive] = useState(0);
  const panels = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    panels.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const jumpTo = (i: number) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panels.current[i]?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  };

  return (
    <section id="platform-features" className="py-20 md:py-28 px-5 md:px-6" style={{ background: C.navy }}>
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-12 md:mb-14">
          <p className="axq-eyebrow mb-4">Platform features</p>
          <h2 className="text-3xl md:text-[44px] leading-tight max-w-2xl" style={{ color: C.heading, textWrap: "balance" }}>
            Every part of the order journey, in one place.
          </h2>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Fixed while the right column scrolls past */}
          <nav className="hidden lg:block lg:w-72 flex-shrink-0" aria-label="Platform features">
            <div className="sticky top-28 flex flex-col gap-1 p-2 rounded-2xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              {FEATURES.map((f, i) => (
                <button
                  key={f.id}
                  id={`feature-nav-${f.id}`}
                  onClick={() => jumpTo(i)}
                  aria-current={active === i ? "true" : undefined}
                  className="relative flex items-center gap-3 px-4 min-h-[46px] rounded-xl text-left text-[15px] transition-colors"
                  style={{
                    background: active === i ? C.action : "transparent",
                    color: active === i ? "#fff" : C.body,
                    fontWeight: active === i ? 600 : 500,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors" style={{ background: active === i ? C.lime : C.borderStrong }} />
                  {f.title}
                </button>
              ))}
            </div>
          </nav>

          <div className="flex-1 min-w-0 flex flex-col gap-6">
            {FEATURES.map((f, i) => (
              <div
                key={f.id}
                id={`feature-${f.id}`}
                data-index={i}
                ref={(el) => { panels.current[i] = el; }}
                className="rounded-2xl p-6 md:p-8 scroll-mt-28 transition-[border-color,box-shadow] duration-300"
                style={{
                  background: C.card,
                  border: `1px solid ${active === i ? C.lilac : C.border}`,
                  boxShadow: active === i ? C.shadowLift : "none",
                }}
              >
                <h3 className="text-xl md:text-2xl mb-3" style={{ color: C.heading, letterSpacing: "-0.02em" }}>
                  {f.title}
                </h3>
                <p className="text-base leading-relaxed max-w-xl" style={{ color: C.body }}>{f.desc}</p>
                {PREVIEWS[f.id]?.()}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
