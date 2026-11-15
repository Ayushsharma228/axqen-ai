import { C } from "./constants";

export function FinalCTA() {
  return (
    <section
      className="py-24 px-6 relative overflow-hidden"
      style={{ background: C.navy }}
    >
      <div
        className="max-w-[1200px] mx-auto rounded-3xl px-10 py-16 text-center relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${C.indigo} 0%, #1e3a8a 100%)`,
        }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.05)" }} />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.05)" }} />

        <div className="relative">
          <h2
            className="text-3xl md:text-4xl font-black mb-4 text-white leading-tight"
            style={{ letterSpacing: "-0.025em" }}
          >
            Your Commerce Business Deserves<br className="hidden md:block" />
            a Better Operating System.
          </h2>
          <p className="text-base mb-10 text-white/80">
            Build smarter. Operate faster. Scale with AXQEN AI.
          </p>
          <a
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95"
            style={{ background: "#fff", color: C.indigo }}
          >
            Get Started Today →
          </a>
        </div>
      </div>
    </section>
  );
}
