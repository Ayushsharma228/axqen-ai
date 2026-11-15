"use client";
import { useState } from "react";
import { C } from "./constants";
import { useInView } from "./useInView";

const FAQS = [
  {
    q: "What is AXQEN AI?",
    a: "AXQEN AI is an AI Commerce Operating System. It brings store setup, products and suppliers, order processing, shipping, NDR and RTO handling, wallet and analytics into one platform, so you can launch, manage, automate and scale an e-commerce business from a single dashboard.",
  },
  {
    q: "How does onboarding work?",
    a: "Sign up, complete your profile verification, and our team walks you through connecting your store. Most sellers are fully set up within 24–48 hours. You get a dedicated onboarding session and access to the full platform immediately.",
  },
  {
    q: "Which platforms are supported?",
    a: "AXQEN AI connects with Shopify, Amazon, Flipkart, Meesho, Shiprocket, and Easebuzz. We continuously add new platform integrations. If you need a specific integration, contact our team.",
  },
  {
    q: "Do I need technical knowledge?",
    a: "No. AXQEN AI is designed to be used by anyone running an e-commerce business — from first-time sellers to multi-channel operators. The platform handles the technical complexity; you focus on your business.",
  },
  {
    q: "How does order processing work?",
    a: "Orders from all your connected channels flow into a single queue in AXQEN. The platform automatically routes them to the right supplier, tracks fulfilment, and updates status in real time — no manual steps required.",
  },
  {
    q: "How does pricing work?",
    a: "AXQEN AI uses one-time pricing — pay once and use the platform. There are no monthly subscription fees on the base plans. A small platform fee applies per fulfilled order. All prices exclude GST.",
  },
  {
    q: "Can I upgrade my plan?",
    a: "Yes. You can upgrade from Starter to Growth or Scale at any time. Contact our support team and they will process the upgrade and unlock the additional features immediately.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const { ref, inView } = useInView();

  return (
    <section
      id="faqs"
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
          <div className="lg:w-72 flex-shrink-0">
            <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: C.indigo }}>
              FAQ
            </p>
            <h2
              className="text-3xl md:text-4xl font-black mb-4 leading-tight"
              style={{ color: C.heading, letterSpacing: "-0.025em" }}
            >
              Questions, answered.
            </h2>
            <p className="text-sm mb-6" style={{ color: C.body }}>
              Still unsure?{" "}
              <a href="#plans" style={{ color: C.indigo, fontWeight: 600 }}>
                Book a demo
              </a>{" "}
              and we will walk you through it.
            </p>
          </div>

          {/* Right accordion */}
          <div className="flex-1 space-y-2">
            {FAQS.map((f, i) => (
              <div
                key={f.q}
                className="rounded-xl overflow-hidden transition-all duration-200"
                style={{
                  background: open === i ? C.navy : C.navy,
                  border: `1px solid ${open === i ? C.indigoBorder : C.border}`,
                }}
              >
                <button
                  className="w-full flex items-center justify-between px-6 py-4 text-left"
                  onClick={() => setOpen(open === i ? null : i)}
                >
                  <span
                    className="text-sm font-semibold pr-4"
                    style={{ color: open === i ? C.indigo : C.heading }}
                  >
                    {f.q}
                  </span>
                  <span
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-lg font-light transition-transform duration-300"
                    style={{
                      color: C.indigo,
                      background: C.indigoDim,
                      transform: open === i ? "rotate(45deg)" : "none",
                    }}
                  >
                    +
                  </span>
                </button>

                {open === i && (
                  <div
                    className="px-6 pb-5 text-sm leading-relaxed"
                    style={{ color: C.body, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}
                  >
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
