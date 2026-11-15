"use client";
import { C } from "./constants";
import { useInView } from "./useInView";

const CAPABILITIES = [
  {
    icon: "🏪",
    title: "Store Setup & Management",
    desc: "Get your store set up and keep it running from the same place you manage everything else.",
  },
  {
    icon: "📦",
    title: "Product & Supplier Management",
    desc: "One catalogue for products and the suppliers who fulfil them, across every channel you sell on.",
  },
  {
    icon: "🛒",
    title: "Order Processing",
    desc: "Every order in a single queue, moving from confirmation to dispatch with fewer manual steps.",
  },
  {
    icon: "🚚",
    title: "Shipping & NDR Management",
    desc: "Ship, track and act on failed deliveries before they turn into returns.",
  },
  {
    icon: "↩️",
    title: "RTO Management",
    desc: "Follow every return to origin and see exactly what it costs your business.",
  },
  {
    icon: "📊",
    title: "Profit & Analytics",
    desc: "Know your real profit after product cost, shipping and RTO, not just your sales.",
  },
];

export function Features() {
  const { ref, inView } = useInView();

  return (
    <section
      id="features"
      className="py-24 px-6"
      style={{ background: C.navy }}
      ref={ref}
    >
      <div
        className="max-w-[1200px] mx-auto transition-all duration-700"
        style={{ opacity: inView ? 1 : 0, transform: inView ? "none" : "translateY(24px)" }}
      >
        <div className="mb-14">
          <p
            className="text-xs font-bold tracking-widest uppercase mb-4"
            style={{ color: C.indigo }}
          >
            Platform Capabilities
          </p>
          <h2
            className="text-3xl md:text-4xl font-black mb-4 max-w-xl"
            style={{ color: C.heading, letterSpacing: "-0.025em" }}
          >
            Not a tool. The operating system behind your commerce business.
          </h2>
          <p className="text-base max-w-lg" style={{ color: C.body }}>
            Store, catalogue, orders, shipping, returns and profit live in one connected system instead of six disconnected tabs.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {CAPABILITIES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl p-7 transition-all duration-300 hover:translate-y-[-2px]"
              style={{
                background: C.navy,
                border: `1px solid ${C.border}`,
              }}
            >
              <div className="text-2xl mb-4">{f.icon}</div>
              <h3
                className="font-bold text-base mb-2.5 leading-snug"
                style={{ color: C.heading }}
              >
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: C.body }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
