"use client";
import { C } from "./constants";
import { useInView } from "./useInView";

const PLANS = [
  {
    id: "starter",
    name: "STARTER",
    price: "₹9,999",
    billing: "one-time",
    popular: false,
    features: [
      "Store Setup & Management",
      "Up to 100 Products",
      "Order Processing",
      "Shipping Integration",
      "Basic Analytics",
      "Email Support",
    ],
    cta: "Get Starter",
    href: "/signup?plan=starter",
  },
  {
    id: "growth",
    name: "GROWTH",
    price: "₹19,999",
    billing: "one-time",
    popular: true,
    features: [
      "Everything in Starter",
      "Unlimited Products",
      "Supplier Management",
      "NDR & RTO Management",
      "Profit & Analytics",
      "Priority Support",
    ],
    cta: "Get Growth",
    href: "/signup?plan=growth",
  },
  {
    id: "scale",
    name: "SCALE",
    price: "₹39,999",
    billing: "one-time",
    popular: false,
    features: [
      "Everything in Growth",
      "Multi-Channel Management",
      "AI-Powered Insights",
      "Dedicated Account Manager",
      "Custom Integrations",
      "24/7 Priority Support",
    ],
    cta: "Get Scale",
    href: "/signup?plan=scale",
  },
];

const TABLE_FEATURES = [
  "Store Setup & Management",
  "Product & Supplier Management",
  "Order Processing",
  "Shipping & NDR Management",
  "RTO Management",
  "Profit & Analytics",
];

const TABLE_DATA: Record<string, Record<string, string | boolean>> = {
  "Store Setup & Management":    { starter: true,  growth: true,  scale: true },
  "Product & Supplier Management": { starter: "Up to 100", growth: true, scale: true },
  "Order Processing":            { starter: true,  growth: true,  scale: true },
  "Shipping & NDR Management":   { starter: false, growth: true,  scale: true },
  "RTO Management":              { starter: false, growth: true,  scale: true },
  "Profit & Analytics":          { starter: "Basic", growth: "Full", scale: "Advanced" },
};

function Cell({ val }: { val: string | boolean }) {
  if (val === false) return <span style={{ color: "#D1D5DB", fontSize: 16 }}>—</span>;
  if (val === true)  return <span style={{ color: C.indigo, fontSize: 16, fontWeight: 700 }}>✓</span>;
  return <span style={{ fontSize: 12, fontWeight: 600, color: C.indigo }}>{val as string}</span>;
}

export function Plans() {
  const { ref, inView } = useInView();

  return (
    <section
      id="plans"
      className="py-24 px-6"
      style={{ background: C.navy }}
      ref={ref}
    >
      <div
        className="max-w-[1200px] mx-auto transition-all duration-700"
        style={{ opacity: inView ? 1 : 0, transform: inView ? "none" : "translateY(24px)" }}
      >
        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: C.indigo }}>
            Pricing
          </p>
          <h2
            className="text-3xl md:text-4xl font-black mb-4"
            style={{ color: C.heading, letterSpacing: "-0.025em" }}
          >
            One-time pricing. Pick your starting point.
          </h2>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className="rounded-2xl p-7 flex flex-col relative transition-all duration-300 hover:translate-y-[-3px]"
              style={{
                background:  plan.popular ? C.indigo : C.card,
                border:      plan.popular ? "none" : `1px solid ${C.border}`,
                boxShadow:   plan.popular ? "0 8px 40px rgba(0,72,223,0.25)" : "none",
              }}
            >
              {plan.popular && (
                <div
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-black whitespace-nowrap"
                  style={{ background: "#fff", color: C.indigo }}
                >
                  ★ Most Popular
                </div>
              )}

              <p
                className="text-xs font-black tracking-widest uppercase mb-4"
                style={{ color: plan.popular ? "rgba(255,255,255,0.75)" : C.body }}
              >
                {plan.name}
              </p>

              <div className="flex items-baseline gap-2 mb-5">
                <span
                  className="text-4xl font-black"
                  style={{ color: plan.popular ? "#fff" : C.heading, letterSpacing: "-0.03em" }}
                >
                  {plan.price}
                </span>
                <span className="text-sm" style={{ color: plan.popular ? "rgba(255,255,255,0.6)" : C.muted }}>
                  {plan.billing}
                </span>
              </div>

              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm"
                    style={{ color: plan.popular ? "rgba(255,255,255,0.9)" : C.heading }}>
                    <span style={{ color: plan.popular ? "rgba(255,255,255,0.7)" : C.indigo, flexShrink: 0, marginTop: 1 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={plan.href}
                className="block text-center py-3 rounded-lg text-sm font-bold transition-all hover:opacity-90 active:scale-95"
                style={
                  plan.popular
                    ? { background: "#fff", color: C.indigo }
                    : { background: "transparent", border: `1px solid ${C.borderStrong}`, color: C.heading }
                }
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: `1px solid ${C.border}` }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ background: C.card, borderBottom: `1px solid ${C.border}` }}>
                <th className="text-left px-6 py-4 text-xs font-black uppercase tracking-widest" style={{ color: C.muted, width: "40%" }}>
                  Compare Plans
                </th>
                {PLANS.map((p) => (
                  <th key={p.id} className="text-center px-4 py-4 text-xs font-black uppercase tracking-widest"
                    style={{ color: p.popular ? C.indigo : C.muted }}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TABLE_FEATURES.map((feat, i) => (
                <tr
                  key={feat}
                  style={{
                    background: i % 2 === 0 ? C.navy : C.card,
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <td className="px-6 py-3.5 text-sm" style={{ color: C.heading }}>{feat}</td>
                  {PLANS.map((p) => (
                    <td key={p.id} className="text-center px-4 py-3.5">
                      <Cell val={TABLE_DATA[feat]?.[p.id] ?? false} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-center text-xs mt-8" style={{ color: C.muted }}>
          All prices exclude GST · No monthly charges · Platform fee per fulfilled order applies
        </p>
      </div>
    </section>
  );
}
