"use client";
import { C } from "./constants";
import { useInView } from "./useInView";

const STEPS = [
  {
    n: "01",
    title: "Onboard",
    desc: "Register and complete verification.",
    icon: "👤",
  },
  {
    n: "02",
    title: "Build",
    desc: "Set up your store and products.",
    icon: "🏗️",
  },
  {
    n: "03",
    title: "Launch",
    desc: "Start selling with integrated operations.",
    icon: "🚀",
  },
  {
    n: "04",
    title: "Grow",
    desc: "Track, optimize and scale your business.",
    icon: "📈",
  },
];

export function HowItWorks() {
  const { ref, inView } = useInView();

  return (
    <section
      id="how-it-works"
      className="py-24 px-6"
      style={{ background: C.card }}
      ref={ref}
    >
      <div
        className="max-w-[1200px] mx-auto transition-all duration-700"
        style={{ opacity: inView ? 1 : 0, transform: inView ? "none" : "translateY(24px)" }}
      >
        <div className="text-center mb-16">
          <p
            className="text-xs font-bold tracking-widest uppercase mb-4"
            style={{ color: C.indigo }}
          >
            How AXQEN Works
          </p>
          <h2
            className="text-3xl md:text-4xl font-black mb-4"
            style={{ color: C.heading, letterSpacing: "-0.025em" }}
          >
            From sign-up to scale in four steps.
          </h2>
        </div>

        <div className="relative">
          {/* Connector line on desktop */}
          <div
            className="hidden md:block absolute top-10 left-[12.5%] right-[12.5%] border-t-2 border-dashed pointer-events-none"
            style={{ borderColor: C.indigoBorder }}
          />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex flex-col items-center md:items-start text-center md:text-left">
                {/* Icon circle */}
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl mb-5 relative z-10"
                  style={{
                    background: C.indigo,
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {s.icon}
                </div>
                <p
                  className="text-xs font-bold mb-1"
                  style={{ color: C.indigo }}
                >
                  Step {s.n}
                </p>
                <h3
                  className="font-black text-xl mb-2"
                  style={{ color: C.heading }}
                >
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: C.body }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
