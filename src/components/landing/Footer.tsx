import { C, WA_LINK } from "./constants";
import { CAPABILITIES, AUDIENCES, CONTACT, SOCIALS } from "./content";

const COMPANY = [
  { label: "About",          href: "/about" },
  { label: "Contact",        href: "/company" },
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Terms",          href: "/legal/terms-of-service" },
];

const SUPPORT = [
  { label: "FAQ",         href: "/#faqs" },
  { label: "Blog",        href: "/blog" },
  { label: "Book a Demo", href: WA_LINK, external: true },
  { label: "Pricing",     href: "/#plans" },
];

// TODO(product owner): add registered company address and legal footer details.

function Col({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-widest text-white mb-4">{title}</p>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  );
}

const linkCls = "text-xs transition-colors hover:text-white";
const linkStyle = { color: "rgba(255,255,255,0.6)" };

export function Footer() {
  return (
    <footer style={{ background: C.heading }}>
      <div className="max-w-[1200px] mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img src="/axqen-icon.png" alt="" width={28} height={28} className="w-7 h-7 rounded-lg" />
              <span className="font-black text-sm text-white">AXQEN AI</span>
            </div>
            <p className="text-xs leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.6)" }}>
              The AI Commerce Operating System for running e-commerce operations from one connected platform.
            </p>
            <div className="flex flex-col gap-1.5 mb-5">
              <a href={CONTACT.phoneHref} className={linkCls} style={linkStyle}>{CONTACT.phone}</a>
              <a href={`mailto:${CONTACT.email}`} className={`${linkCls} break-all`} style={linkStyle}>{CONTACT.email}</a>
            </div>
            <div className="flex gap-2">
              {SOCIALS.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`AXQEN AI on ${s.name}`}
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-white/15"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  <img src={s.icon} alt="" width={16} height={16} className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          <Col title="Platform">
            {CAPABILITIES.map((c) => (
              <li key={c.title}><a href="/#features" className={linkCls} style={linkStyle}>{c.title}</a></li>
            ))}
          </Col>
          <Col title="Solutions">
            <li><a href="/dropshipping" className={linkCls} style={linkStyle}>Dropshipping provider</a></li>
            {AUDIENCES.map((a) => (
              <li key={a.title}><a href="/#audience" className={linkCls} style={linkStyle}>{a.title}</a></li>
            ))}
          </Col>
          <Col title="Company">
            {COMPANY.map((l) => (
              <li key={l.label}><a href={l.href} className={linkCls} style={linkStyle}>{l.label}</a></li>
            ))}
          </Col>
          <Col title="Support">
            {SUPPORT.map((l) => (
              <li key={l.label}>
                <a href={l.href} className={linkCls} style={linkStyle}
                  {...(l.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                  {l.label}
                </a>
              </li>
            ))}
          </Col>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-8 text-xs"
          style={{ borderTop: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)" }}>
          <p>
            © {new Date().getFullYear()} AXQEN AI · A product of{" "}
            <a href="/company" className="hover:text-white transition-colors">Vrinandya Ventures Pvt. Ltd.</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
