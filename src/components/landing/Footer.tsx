import { C } from "./constants";

const PLATFORM = [
  "Store Setup & Management",
  "Product & Supplier Management",
  "Order Processing",
  "Shipping & NDR Management",
  "RTO Management",
  "Profit & Analytics",
];

const SOLUTIONS = [
  "Beginners Starting Ecommerce",
  "Shopify Store Owners",
  "Amazon Sellers",
  "Multi-Channel Sellers",
  "Growing D2C Brands",
];

const COMPANY = [
  { label: "About",          href: "/about" },
  { label: "Careers",        href: "/careers" },
  { label: "Contact",        href: "/company" },
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Terms",          href: "/legal/terms-of-service" },
];

const SUPPORT = [
  { label: "Help Center",  href: "#" },
  { label: "FAQ",          href: "#faqs" },
  { label: "Book a Demo",  href: "#plans" },
  { label: "Pricing",      href: "#plans" },
];

const SOCIALS = [
  { label: "in", href: "#" },
  { label: "IG", href: "#" },
  { label: "X",  href: "#" },
  { label: "YT", href: "#" },
];

export function Footer() {
  return (
    <footer style={{ background: "#0A0E1A", color: "rgba(255,255,255,0.7)" }}>
      <div className="max-w-[1200px] mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white" style={{ background: C.indigo }}>A</div>
              <span className="font-black text-sm text-white">AXQEN <span style={{ color: C.indigo }}>AI</span></span>
            </div>
            <p className="text-xs leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.5)" }}>
              The AI Commerce Operating System that helps e-commerce businesses launch, manage, automate and scale their operations.
            </p>
            <div className="flex gap-2">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all hover:opacity-80"
                  style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          {/* Platform */}
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-white mb-4">Platform</p>
            <ul className="space-y-2.5">
              {PLATFORM.map((item) => (
                <li key={item}>
                  <a href="#features" className="text-xs hover:text-white transition-colors" style={{ color: "rgba(255,255,255,0.5)" }}>{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Solutions */}
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-white mb-4">Solutions</p>
            <ul className="space-y-2.5">
              {SOLUTIONS.map((item) => (
                <li key={item}>
                  <a href="#audience" className="text-xs hover:text-white transition-colors" style={{ color: "rgba(255,255,255,0.5)" }}>{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-white mb-4">Company</p>
            <ul className="space-y-2.5">
              {COMPANY.map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="text-xs hover:text-white transition-colors" style={{ color: "rgba(255,255,255,0.5)" }}>{item.label}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-white mb-4">Support</p>
            <ul className="space-y-2.5">
              {SUPPORT.map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="text-xs hover:text-white transition-colors" style={{ color: "rgba(255,255,255,0.5)" }}>{item.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-8"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            © {new Date().getFullYear()} AXQEN AI. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            Dashboard figures shown on this page are illustrative demo data.
          </p>
        </div>
      </div>
    </footer>
  );
}
