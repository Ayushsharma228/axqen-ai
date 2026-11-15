"use client";
import Link from "next/link";
import { C } from "./constants";

function DashboardMockup() {
  const NAV_ITEMS = ["Dashboard", "Orders", "Products", "Suppliers", "Shipping", "NDR", "RTO", "Wallet", "Analytics"];
  const STATS = [
    { label: "Total Orders",     val: "1,284",    sub: "All channels" },
    { label: "Delivered Orders", val: "1,012",    sub: "78.8% of total" },
    { label: "RTO Orders",       val: "96",       sub: "7.5% of total" },
    { label: "Net Profit",       val: "₹2,18,400", sub: "After shipping & RTO" },
  ];
  const BARS = [30, 45, 40, 65, 55, 78, 50, 62, 88, 72, 82, 68, 92, 78];
  const CHANNELS = [
    { name: "Shopify",  val: 590, pct: 100, color: C.indigo },
    { name: "Amazon",   val: 308, pct: 52,  color: "#1D9E75" },
    { name: "Flipkart", val: 231, pct: 39,  color: "#7C3AED" },
    { name: "Meesho",   val: 155, pct: 26,  color: "#F59E0B" },
  ];

  return (
    <div
      className="rounded-2xl overflow-hidden select-none"
      style={{
        border: `1px solid ${C.border}`,
        boxShadow: "0 24px 64px rgba(0,0,0,0.10)",
        display: "flex",
        height: 380,
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: 190,
          background: "linear-gradient(180deg, #1a3480 0%, #1e40af 100%)",
          padding: "16px 0",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div style={{ padding: "0 14px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 5, background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: "white" }}>A</div>
          <span style={{ color: "white", fontSize: 12, fontWeight: 900 }}>AXQEN</span>
        </div>
        {NAV_ITEMS.map((item, i) => (
          <div
            key={item}
            style={{
              padding: "7px 14px",
              fontSize: 11.5,
              color: i === 0 ? "white" : "rgba(255,255,255,0.6)",
              fontWeight: i === 0 ? 700 : 400,
              background: i === 0 ? "rgba(255,255,255,0.14)" : "transparent",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div style={{ width: 13, height: 13, borderRadius: 3, background: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
            {item}
          </div>
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, background: "#fff", padding: "16px 18px", overflow: "hidden", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Business Overview</span>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ fontSize: 10, background: "#EFF6FF", color: C.indigo, padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>Demo data</span>
            <span style={{ fontSize: 10, color: "#6B7280", background: "#F3F4F6", padding: "3px 10px", borderRadius: 20 }}>Last 30 days</span>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {STATS.map((s) => (
            <div key={s.label} style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 9, padding: "10px 12px" }}>
              <div style={{ fontSize: 9, color: "#9CA3AF", marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#111827", letterSpacing: "-0.03em" }}>{s.val}</div>
              <div style={{ fontSize: 9, color: "#9CA3AF", marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, flex: 1, minHeight: 0 }}>
          {/* Bar chart */}
          <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 9, padding: "10px 12px", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#374151", marginBottom: 2 }}>Sales Performance</div>
            <div style={{ fontSize: 9, color: "#9CA3AF", marginBottom: 8 }}>Daily sales, ₹</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2.5, flex: 1, minHeight: 0 }}>
              {BARS.map((h, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${h}%`,
                    background: i === BARS.length - 2 ? C.indigo : "#BFDBFE",
                    borderRadius: "2px 2px 0 0",
                    minWidth: 3,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Channel breakdown */}
          <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 9, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Channel-wise Orders</div>
            {CHANNELS.map((ch) => (
              <div key={ch.name} style={{ marginBottom: 7 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "#374151", marginBottom: 3 }}>
                  <span>{ch.name}</span>
                  <span style={{ fontWeight: 700 }}>{ch.val}</span>
                </div>
                <div style={{ height: 4, background: "#E5E7EB", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${ch.pct}%`, background: ch.color, borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section
      className="relative pt-28 pb-16 px-6 overflow-hidden"
      style={{ background: "#fff" }}
    >
      {/* Subtle radial glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 0%, rgba(0,72,223,0.06) 0%, transparent 70%)` }}
      />

      <div className="relative max-w-[1200px] mx-auto">
        <div className="text-center mb-12">
          {/* Badge */}
          <span
            className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-full mb-7 tracking-widest uppercase"
            style={{
              background: C.indigoDim,
              color: C.indigo,
              border: `1px solid ${C.indigoBorder}`,
              letterSpacing: "0.08em",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.indigo, display: "inline-block" }} />
            AI Commerce Operating System
          </span>

          {/* H1 */}
          <h1
            className="text-5xl md:text-[62px] font-black leading-tight mb-6 max-w-3xl mx-auto"
            style={{
              color: C.heading,
              letterSpacing: "-0.03em",
              lineHeight: 1.08,
            }}
          >
            Run, Automate &amp; Grow<br className="hidden md:block" />
            Your E-commerce<br className="hidden md:block" />
            Business with{" "}
            <span style={{ color: C.indigo }}>AXQEN AI.</span>
          </h1>

          {/* Sub */}
          <p
            className="text-base md:text-lg leading-relaxed mb-10 max-w-2xl mx-auto"
            style={{ color: C.body, lineHeight: 1.75 }}
          >
            One intelligent commerce platform to launch stores, manage products,
            automate operations, connect suppliers and track business performance.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-7">
            <a
              href="/signup"
              className="w-full sm:w-auto px-7 py-3.5 text-sm font-bold rounded-lg transition-all hover:opacity-90 active:scale-95 text-white"
              style={{ background: C.indigo, borderRadius: 8 }}
            >
              Start Your Business →
            </a>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto px-7 py-3.5 text-sm font-semibold rounded-lg border transition-all hover:border-opacity-80"
              style={{ borderColor: C.borderStrong, color: C.heading, borderRadius: 8 }}
            >
              Book a Demo
            </a>
          </div>

          {/* Trust checks */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm" style={{ color: C.body }}>
            {["Launch Your Store", "End-to-End Operations", "AI-Powered Growth"].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <span style={{ color: C.indigo, fontSize: 15 }}>✓</span>
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="max-w-[860px] mx-auto">
          <div
            className="rounded-2xl overflow-hidden p-3"
            style={{
              background: "linear-gradient(135deg, rgba(0,72,223,0.08) 0%, rgba(0,72,223,0.03) 100%)",
              border: `1px solid ${C.indigoBorder}`,
            }}
          >
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
