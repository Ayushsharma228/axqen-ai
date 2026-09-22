import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — AXQEN",
  description: "Vrinandya Ventures — the team behind AXQEN. Built in Agra, scaling across India.",
};

const C = {
  blue:     "#0048DF",
  navy:     "#0A0E1A",
  body:     "#4B5563",
  muted:    "rgba(75,85,99,0.5)",
  amber:    "#EF9F27",
  green:    "#1D9E75",
  ground:   "#F7F9FF",
  card:     "#FFFFFF",
  border:   "rgba(0,0,0,0.07)",
};

const PILLARS = [
  {
    n: "01",
    head: "Ship without stress.",
    body: "Logistics, tracking, returns, NDRs — we absorb the chaos so you can focus on selling. Every order, handled.",
  },
  {
    n: "02",
    head: "Sell without guesswork.",
    body: "Real-time dashboards, attribution data, RTO forecasts. Every decision your business makes gets sharper with AXQEN.",
  },
  {
    n: "03",
    head: "Scale without limits.",
    body: "From your first 10 orders to your ten-thousandth — same platform, same team, relentlessly in your corner.",
  },
];

export default function AboutPage() {
  return (
    <div style={{ background: C.ground, minHeight: "100vh", fontFamily: "var(--font-inter), Inter, system-ui, sans-serif" }}>

      {/* ── Navbar ── */}
      <nav style={{ background: "#fff", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 50 }}>
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/axqen-icon.png" alt="AXQEN" className="w-7 h-7 rounded-lg object-cover" />
            <span className="font-semibold text-base tracking-tight" style={{ color: C.navy, fontFamily: "var(--font-space)" }}>AXQEN</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/about" className="text-sm font-medium hidden sm:block"
              style={{ color: C.blue, borderBottom: `1.5px solid ${C.blue}`, paddingBottom: 1 }}>
              About
            </Link>
            <Link href="/company" className="text-sm hidden sm:block" style={{ color: C.body }}>Company</Link>
            <Link href="/#apply"
              className="text-sm font-semibold px-4 py-2 rounded-lg"
              style={{ background: C.blue, color: "#fff", fontFamily: "var(--font-space)" }}>
              Apply Now
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ background: C.navy, borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
        <div className="max-w-5xl mx-auto px-6 py-20 flex flex-col md:flex-row items-center gap-14 md:gap-20">

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] mb-6 font-medium"
              style={{ color: C.blue, fontFamily: "var(--font-space)" }}>
              About Us
            </p>
            <h1 style={{
              fontSize: "clamp(2rem, 5vw, 3.5rem)",
              fontFamily: "var(--font-playfair)",
              fontStyle: "italic",
              fontWeight: 400,
              color: "#ffffff",
              lineHeight: 1.15,
              marginBottom: "1.25rem",
              textWrap: "balance",
            }}>
              Making Indian sellers unstoppable.
            </h1>
            {/* The Taj Mahal line */}
            <p style={{
              fontSize: "1rem",
              lineHeight: 1.7,
              color: "rgba(255,255,255,0.55)",
              maxWidth: "36rem",
              borderLeft: `2px solid ${C.amber}`,
              paddingLeft: "1rem",
              marginBottom: "2rem",
              fontStyle: "normal",
            }}>
              We are from Agra — where the Taj Mahal was built by people who never needed a Gurugram office to prove their worth.
            </p>
            <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.42)", lineHeight: 1.65, maxWidth: "32rem" }}>
              We built AXQEN because sellers deserve a real partner, not another dashboard that leaves you alone with the hard parts.
            </p>
            <div className="flex flex-wrap gap-2.5 mt-8">
              {[
                { label: "Founded 2025",     color: C.blue    },
                { label: "Agra, India",      color: C.amber   },
                { label: "DPIIT Recognised", color: "#7C6FF0" },
                { label: "MSME Registered",  color: C.green   },
              ].map((b) => (
                <span key={b.label}
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 500,
                    padding: "0.3rem 0.75rem",
                    borderRadius: 999,
                    background: `${b.color}18`,
                    color: b.color,
                    border: `1px solid ${b.color}28`,
                    fontFamily: "var(--font-space)",
                    letterSpacing: "0.03em",
                  }}>
                  {b.label}
                </span>
              ))}
            </div>
          </div>

          {/* Founder card */}
          <div className="flex-shrink-0 flex flex-col items-center gap-3">
            {/* Photo frame — swap the initials div with <img src="/Founder.jpeg" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> */}
            <div style={{
              width: 188, height: 228,
              borderRadius: "18px 18px 18px 4px",
              background: "linear-gradient(160deg, rgba(239,159,39,0.12), rgba(239,159,39,0.22))",
              border: `1.5px solid rgba(239,159,39,0.3)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              position: "relative",
              overflow: "hidden",
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/Founder.jpeg"
                alt="Aayush Sharma — Founder & Director"
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
              />
            </div>
            <div className="text-center">
              <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff", fontFamily: "var(--font-space)" }}>
                Aayush Sharma
              </p>
              <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                Founder & Director, Vrinandya Ventures
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 py-14 space-y-16">

        {/* ── Story ── */}
        <section>
          <div className="flex flex-col md:flex-row gap-10 items-start">
            <div className="md:w-40 flex-shrink-0 pt-1">
              <p style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em", color: C.muted, fontFamily: "var(--font-space)" }}>
                Our Story
              </p>
            </div>
            <div className="flex-1 space-y-4">
              <p style={{
                fontSize: "clamp(1.2rem, 2.5vw, 1.6rem)",
                fontFamily: "var(--font-playfair)",
                fontStyle: "italic",
                fontWeight: 400,
                color: C.navy,
                lineHeight: 1.45,
                textWrap: "balance",
              }}>
                "Every seller we work with gets the same attention I'd give my own business."
              </p>
              <p className="text-sm leading-relaxed" style={{ color: C.body }}>
                Vrinandya Ventures was incorporated in Agra in December 2025, born out of a single frustration: dropshippers in India were choosing between affordable tools that did nothing, and expensive agencies that over-promised and under-delivered.
              </p>
              <p className="text-sm leading-relaxed" style={{ color: C.body }}>
                AXQEN is our answer — an end-to-end operating system for COD dropshipping in India. Suppliers. Fulfilment. Analytics. Marketing. Under one roof, with a team that actually picks up the phone.
              </p>
            </div>
          </div>
        </section>

        <div style={{ height: 1, background: C.border }} />

        {/* ── Pillars ── */}
        <section>
          <p style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em", color: C.muted, fontFamily: "var(--font-space)", marginBottom: "2.5rem" }}>
            What drives us
          </p>
          <div className="grid sm:grid-cols-3 gap-5">
            {PILLARS.map((p) => (
              <div key={p.n} className="rounded-2xl p-6 flex flex-col gap-3"
                style={{ background: C.card, border: `1px solid ${C.border}` }}>
                <span style={{
                  fontSize: 36, fontWeight: 700, lineHeight: 1,
                  color: "rgba(0,72,223,0.12)",
                  fontFamily: "var(--font-space)",
                }}>
                  {p.n}
                </span>
                <p style={{
                  fontSize: "0.9rem", fontWeight: 500, lineHeight: 1.45,
                  color: C.navy, fontFamily: "var(--font-playfair)", fontStyle: "italic",
                }}>
                  {p.head}
                </p>
                <p style={{ fontSize: "0.82rem", lineHeight: 1.65, color: C.body }}>{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        <div style={{ height: 1, background: C.border }} />

        {/* ── Quick facts ── */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { v: "Dec 2025", l: "Incorporated" },
            { v: "Agra, UP", l: "Headquartered" },
            { v: "DIPP239200", l: "DPIIT Recognition" },
            { v: "Pvt. Ltd.", l: "Company type" },
          ].map((s) => (
            <div key={s.l} className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <p style={{ fontSize: "0.85rem", fontWeight: 600, color: C.blue, fontFamily: "var(--font-space)", fontVariantNumeric: "tabular-nums", marginBottom: 2 }}>
                {s.v}
              </p>
              <p style={{ fontSize: "0.72rem", color: C.muted }}>{s.l}</p>
            </div>
          ))}
        </section>

        {/* ── Address ── */}
        <section>
          <div className="rounded-2xl p-7 flex flex-col sm:flex-row gap-8 sm:gap-14"
            style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="flex-1">
              <p style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em", color: C.muted, fontFamily: "var(--font-space)", marginBottom: "1rem" }}>
                Find us in Agra. Reach us everywhere.
              </p>
              <p style={{ fontSize: "0.9rem", fontWeight: 600, color: C.navy, fontFamily: "var(--font-space)", marginBottom: "0.4rem" }}>
                Vrinandya Ventures Pvt. Ltd.
              </p>
              <p style={{ fontSize: "0.85rem", color: C.body, lineHeight: 1.7 }}>
                4/210 Unt Gali, Kacheri Ghat<br />
                Agra, Uttar Pradesh — 282004<br />
                India
              </p>
            </div>
            <div className="flex-shrink-0">
              <p style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em", color: C.muted, fontFamily: "var(--font-space)", marginBottom: "1rem" }}>
                Get in touch
              </p>
              <div className="space-y-3">
                <a href="mailto:connect@vrinandyaventures.in"
                  className="flex items-center gap-2"
                  style={{ fontSize: "0.85rem", color: C.blue, fontFamily: "var(--font-space)", fontWeight: 500 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                  connect@vrinandyaventures.in
                </a>
                <a href="https://axqen.app"
                  className="flex items-center gap-2"
                  style={{ fontSize: "0.85rem", color: C.blue, fontFamily: "var(--font-space)", fontWeight: 500 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
                  </svg>
                  axqen.app
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="text-center py-4">
          <p style={{
            fontSize: "clamp(1.3rem, 3vw, 2rem)",
            fontFamily: "var(--font-playfair)",
            fontStyle: "italic",
            fontWeight: 400,
            color: C.navy,
            marginBottom: "0.75rem",
            textWrap: "balance",
          }}>
            Ready to run a better business?
          </p>
          <p style={{ fontSize: "0.85rem", color: C.body, marginBottom: "2rem" }}>
            Join sellers already scaling with AXQEN's done-for-you platform.
          </p>
          <Link href="/#apply"
            className="inline-block transition-opacity hover:opacity-90"
            style={{
              fontSize: "0.85rem",
              fontWeight: 600,
              padding: "0.75rem 2rem",
              borderRadius: 10,
              background: C.blue,
              color: "#fff",
              fontFamily: "var(--font-space)",
              letterSpacing: "0.02em",
            }}>
            Apply Now — It&apos;s Free to Start
          </Link>
        </section>
      </div>

      {/* ── Footer ── */}
      <div className="py-8 px-6 text-center mt-4" style={{ background: "#fff", borderTop: `1px solid ${C.border}` }}>
        <p style={{ fontSize: "0.75rem", color: C.muted, marginBottom: "0.25rem" }}>
          © {new Date().getFullYear()} Vrinandya Ventures Private Limited. All rights reserved.
        </p>
        <Link href="/" style={{ fontSize: "0.75rem", fontWeight: 500, color: C.blue, fontFamily: "var(--font-space)" }}>
          ← Back to AXQEN
        </Link>
      </div>
    </div>
  );
}
