"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { C } from "./constants";
import { NAV as NAV_LINKS } from "./content";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen]         = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <nav
      className="transition-all duration-300"
      style={{
        background:    scrolled ? "rgba(255,255,255,0.96)" : "#fff",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom:  `1px solid ${C.border}`,
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white"
            style={{ background: C.indigo }}
          >
            A
          </div>
          <span className="font-black text-sm tracking-tight" style={{ color: C.heading }}>
            AXQEN <span style={{ color: C.indigo }}>AI</span>
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-sm font-medium transition-colors"
              style={{ color: C.body }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.indigo)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.body)}
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            style={{ color: C.body }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.heading)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.body)}
          >
            Login
          </Link>
          <a
            href="/signup"
            className="text-sm font-bold px-5 py-2.5 rounded-lg transition-all hover:opacity-90 active:scale-95 text-white"
            style={{ background: C.indigo, borderRadius: 8 }}
          >
            Get Started
          </a>
        </div>

        {/* Hamburger */}
        <button
          className="md:hidden p-2"
          onClick={() => setOpen((p) => !p)}
          aria-label="Toggle menu"
        >
          <div className="flex flex-col gap-1.5">
            <span className="block w-5 h-0.5 transition-all" style={{ background: C.heading, transform: open ? "rotate(45deg) translate(4px,4px)" : "none" }} />
            <span className="block w-5 h-0.5 transition-all" style={{ background: C.heading, opacity: open ? 0 : 1 }} />
            <span className="block h-0.5 transition-all" style={{ background: C.heading, transform: open ? "rotate(-45deg) translate(3px,-3px)" : "none", width: open ? 20 : 14 }} />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="md:hidden px-6 pb-6 pt-2 space-y-2"
          style={{ background: "#fff", borderTop: `1px solid ${C.border}` }}
        >
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block text-sm font-semibold py-2.5"
              style={{ color: C.body }}
            >
              {l.label}
            </a>
          ))}
          <div className="pt-3 flex flex-col gap-2">
            <Link href="/login" onClick={() => setOpen(false)}
              className="block text-center text-sm font-semibold py-3 rounded-lg border"
              style={{ borderColor: C.borderStrong, color: C.heading }}>
              Login
            </Link>
            <a href="/signup" onClick={() => setOpen(false)}
              className="block text-center text-sm font-bold py-3 rounded-lg text-white"
              style={{ background: C.indigo, borderRadius: 8 }}>
              Get Started
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
