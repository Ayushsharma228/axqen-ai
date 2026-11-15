"use client";
import { useState } from "react";
import { C } from "./constants";
import { useInView } from "./useInView";
import { FEATURES } from "./content";

const DEMO_ORDERS = [
  { id: "#AX-10482", channel: "Shopify", items: 2, status: "Processing", color: C.indigo },
  { id: "#AX-10481", channel: "Amazon",  items: 1, status: "Shipped",    color: "#1D9E75" },
  { id: "#AX-10480", channel: "Shopify", items: 3, status: "Delivered",  color: "#475467" },
  { id: "#AX-10479", channel: "Shopify", items: 1, status: "NDR raised", color: "#B54708" },
];

function OrdersPreview() {
  return (
    <div className="rounded-xl p-4 mt-6" style={{ background: C.navy, border: `1px solid ${C.border}` }}>
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm font-bold" style={{ color: C.heading }}>All orders</span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#FEF0C7", color: "#93370D" }}>
          Demo data
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[{ label: "New today", val: "48" }, { label: "To process", val: "17" }, { label: "In transit", val: "176" }].map((s) => (
          <div key={s.label} className="rounded-lg p-3" style={{ background: C.card }}>
            <div className="text-[11px]" style={{ color: C.muted }}>{s.label}</div>
            <div className="text-xl font-black" style={{ color: C.heading, fontVariantNumeric: "tabular-nums" }}>{s.val}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-col">
        {DEMO_ORDERS.map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-xs" style={{ borderTop: `1px solid ${C.border}` }}>
            <span className="font-bold" style={{ color: C.heading, fontVariantNumeric: "tabular-nums" }}>{o.id}</span>
            <span className="hidden sm:inline" style={{ color: C.muted }}>{o.channel} · {o.items} item{o.items > 1 ? "s" : ""}</span>
            <span className="font-semibold px-2 py-0.5 rounded-full" style={{ color: o.color, background: `${o.color}14` }}>{o.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductCatalogue() {
  const [active, setActive] = useState(0);
  const { ref, inView } = useInView();
  const current = FEATURES[active];

  return (
    <section id="platform-features" className="py-24 px-6" style={{ background: C.navy }} ref={ref}>
      <div
        className="max-w-[1200px] mx-auto transition-all duration-700"
        style={{ opacity: inView ? 1 : 0.001, transform: inView ? "none" : "translateY(24px)" }}
      >
        <div className="mb-12">
          <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: C.indigo }}>
            Platform features
          </p>
          <h2 className="text-3xl md:text-4xl font-black" style={{ color: C.heading, letterSpacing: "-0.025em", textWrap: "balance" }}>
            Every part of the order journey, in one place.
          </h2>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-72 flex-shrink-0 flex lg:flex-col gap-1 overflow-x-auto pb-1" role="tablist">
            {FEATURES.map((f, i) => (
              <button
                key={f.id}
                id={`feature-tab-${f.id}`}
                role="tab"
                aria-selected={active === i}
                onClick={() => setActive(i)}
                className="px-4 py-3 rounded-lg text-left text-sm whitespace-nowrap lg:whitespace-normal transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  background: active === i ? C.indigoDim : "transparent",
                  border: `1px solid ${active === i ? C.indigoBorder : "transparent"}`,
                  color: active === i ? C.deep : C.body,
                  fontWeight: active === i ? 600 : 500,
                }}
              >
                {f.title}
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-0 rounded-2xl p-6 md:p-8" role="tabpanel" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <h3 className="text-xl md:text-2xl font-black mb-3" style={{ color: C.heading, letterSpacing: "-0.02em" }}>
              {current.title}
            </h3>
            <p className="text-base leading-relaxed max-w-xl" style={{ color: C.body }}>{current.desc}</p>
            {current.id === "orders" && <OrdersPreview />}
          </div>
        </div>
      </div>
    </section>
  );
}
