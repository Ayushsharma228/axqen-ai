"use client";
import { C } from "./constants";
import { useInView } from "./useInView";

const AUDIENCES = [
  {
    icon: "🌱",
    title: "Beginners Starting E-commerce",
    desc: "Go from idea to first order with a guided setup.",
  },
  {
    icon: "🏪",
    title: "Shopify Store Owners",
    desc: "Run the operations behind your storefront in one place.",
  },
  {
    icon: "📦",
    title: "Amazon Sellers",
    desc: "Bring marketplace orders into the same workflow as everything else.",
  },
  {
    icon: "🌐",
    title: "Multi-Channel Sellers",
    desc: "One dashboard for every channel, order and shipment.",
  },
  {
    icon: "📈",
    title: "Growing D2C Brands",
    desc: "Scale volume without scaling operational chaos.",
  },
];

export function Testimonials() {
  const { ref, inView } = useInView();

  return (
    <section
      id="audience"
      className="py-24 px-6"
      style={{ background: C.card }}
      ref={ref}
    >
      <div
        className="max-w-[1200px] mx-auto transition-all duration-700"
        style={{ opacity: inView ? 1 : 0, transform: inView ? "none" : "translateY(24px)" }}
      >
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 items-start">
          {/* Left heading */}
          <div className="lg:w-64 flex-shrink-0">
            <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: C.indigo }}>
              Who is AXQEN for?
            </p>
            <h2
              className="text-3xl md:text-4xl font-black mb-4 leading-tight"
              style={{ color: C.heading, letterSpacing: "-0.025em" }}
            >
              Built for wherever you are in the journey.
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: C.body }}>
              From your first product to a multichannel brand, the same operating system grows with you.
            </p>
          </div>

          {/* Right audience list */}
          <div className="flex-1 flex flex-col gap-3">
            {AUDIENCES.map((a) => (
              <div
                key={a.title}
                className="flex items-center gap-4 px-5 py-4 rounded-xl transition-all hover:translate-x-1"
                style={{
                  background: C.navy,
                  border: `1px solid ${C.border}`,
                }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: C.indigoDim, border: `1px solid ${C.indigoBorder}` }}
                >
                  {a.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold" style={{ color: C.heading }}>{a.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: C.body }}>{a.desc}</p>
                </div>
                <span style={{ color: C.indigo, fontSize: 18, flexShrink: 0 }}>→</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
