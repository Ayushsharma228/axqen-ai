"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { C } from "./constants";
import { NAV as NAV_LINKS } from "./content";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen]         = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const solid = scrolled || open;
  const linkColor = solid ? C.body : "rgba(255,255,255,0.88)";

  return (
    <nav
      className="transition-[background-color,box-shadow,border-color] duration-300"
      style={{
        background: solid ? "rgba(255,255,255,0.94)" : "transparent",
        backdropFilter: solid ? "saturate(1.4) blur(18px)" : "none",
        borderBottom: `1px solid ${solid ? C.border : "transparent"}`,
        boxShadow: solid ? "0 8px 30px -18px rgba(39,15,96,0.35)" : "none",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-5 md:px-6 h-[72px] flex items-center justify-between gap-6">
        <a href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <img
            src="/axqen-icon.png"
            alt=""
            width={34}
            height={34}
            className="w-[34px] h-[34px] rounded-[9px]"
            style={{ boxShadow: solid ? "none" : "0 0 0 1.5px rgba(255,255,255,0.55)" }}
          />
          <span className="axq-display text-[17px] tracking-tight" style={{ color: solid ? C.heading : "#fff" }}>
            AXQEN <span style={{ color: solid ? C.action : C.lime }}>AI</span>
          </span>
        </a>

        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="px-3.5 py-2 rounded-full text-[15px] font-medium transition-colors"
              style={{ color: linkColor }}
              onMouseEnter={(e) => { e.currentTarget.style.color = solid ? C.action : "#fff"; e.currentTarget.style.background = solid ? C.paleLilac : "rgba(255,255,255,0.12)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = linkColor; e.currentTarget.style.background = "transparent"; }}
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2.5">
          <Link href="/login" className={`axq-btn ${solid ? "axq-btn-lilac" : "axq-btn-pill"} !min-h-[42px] !px-5 text-sm`}>
            Login
          </Link>
          <a href="/signup" className="axq-btn axq-btn-lime !min-h-[42px] !px-5 text-sm">
            Get Started
          </a>
        </div>

        <button
          className="md:hidden w-11 h-11 -mr-2 flex items-center justify-center rounded-full"
          onClick={() => setOpen((p) => !p)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          <div className="flex flex-col gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="block h-0.5 transition-all duration-300"
                style={{
                  width: i === 2 && !open ? 14 : 20,
                  background: solid ? C.heading : "#fff",
                  opacity: open && i === 1 ? 0 : 1,
                  transform: open ? (i === 0 ? "rotate(45deg) translate(4px,4px)" : i === 2 ? "rotate(-45deg) translate(5px,-5px)" : "none") : "none",
                }}
              />
            ))}
          </div>
        </button>
      </div>

      {open && (
        <div className="md:hidden px-5 pb-6 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
          <div className="flex flex-col">
            {NAV_LINKS.map((l) => (
              <a key={l.label} href={l.href} onClick={() => setOpen(false)} className="py-3 text-base font-semibold" style={{ color: C.heading }}>
                {l.label}
              </a>
            ))}
          </div>
          <div className="pt-4 grid grid-cols-2 gap-2">
            <Link href="/login" onClick={() => setOpen(false)} className="axq-btn axq-btn-lilac">Login</Link>
            <a href="/signup" onClick={() => setOpen(false)} className="axq-btn axq-btn-lime">Get Started</a>
          </div>
        </div>
      )}
    </nav>
  );
}
