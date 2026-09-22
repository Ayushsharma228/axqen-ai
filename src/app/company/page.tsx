import Link from "next/link";
import { Building2, FileText, ShieldCheck, Award, BadgeCheck } from "lucide-react";

const C = {
  gold:         "#0048DF",
  goldDim:      "rgba(0,72,223,0.08)",
  heading:      "#0A0E1A",
  body:         "#4B5563",
  muted:        "rgba(75,85,99,0.55)",
  green:        "#1D9E75",
  greenDim:     "rgba(29,158,117,0.12)",
  border:       "rgba(0,0,0,0.08)",
  card:         "#f1f3f5",
};

const DOCS = [
  {
    icon:  ShieldCheck,
    color: "#1D9E75",
    dim:   "rgba(29,158,117,0.1)",
    title: "GST Registration Certificate",
    desc:  "Goods & Services Tax registration issued by the Government of India.",
    number: "09AALCV7054P1ZD",
    label: "GSTIN",
    file:  null as string | null,
  },
  {
    icon:  Building2,
    color: "#0048DF",
    dim:   "rgba(0,72,223,0.08)",
    title: "Certificate of Incorporation (CIN)",
    desc:  "Incorporation certificate issued by the Ministry of Corporate Affairs confirming the company's legal existence.",
    number: "U63112UP2025PTC239392",
    label: "CIN",
    file:  null as string | null,
  },
  {
    icon:  Award,
    color: "#EF9F27",
    dim:   "rgba(239,159,39,0.1)",
    title: "Udyam Registration Certificate",
    desc:  "MSME Udyam registration issued by the Ministry of MSME, Government of India.",
    number: "UDYAM-UP-01-0192301",
    label: "Udyam No.",
    file:  null as string | null,
  },
  {
    icon:  BadgeCheck,
    color: "#7C6FF0",
    dim:   "rgba(124,111,240,0.1)",
    title: "DPIIT Startup India Recognition",
    desc:  "Startup India recognition certificate issued by the Department for Promotion of Industry and Internal Trade.",
    number: "DIPP239200",
    label: "DPIIT Ref.",
    file:  null as string | null,
  },
];

export default function CompanyPage() {
  return (
    <div style={{ background: "#f8f9fb", minHeight: "100vh" }}>
      {/* Navbar */}
      <nav style={{ background: "#fff", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 50 }}>
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/axqen-icon.png" alt="AXQEN" className="w-7 h-7 rounded-lg object-cover" />
            <span className="font-black text-base tracking-tight" style={{ color: C.heading }}>AXQEN</span>
          </Link>
          <Link href="/#apply" className="text-sm font-black px-5 py-2.5 rounded-lg" style={{ background: C.gold, color: "#fff" }}>
            Apply Now
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="py-14 px-6 text-center" style={{ background: "#fff", borderBottom: `1px solid ${C.border}` }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: C.goldDim }}>
          <Building2 className="w-7 h-7" style={{ color: C.gold }} />
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold mb-2" style={{ color: C.heading }}>
          Vrinandya Ventures Pvt. Ltd.
        </h1>
        <p className="text-sm mb-6 max-w-xl mx-auto" style={{ color: C.body }}>
          The company behind AXQEN — a legally registered Indian private limited company operating India&apos;s done-for-you COD dropshipping platform.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {[
            { label: "Pvt. Ltd. Company",  color: C.gold   },
            { label: "MSME Registered",     color: C.green  },
            { label: "DPIIT Recognised",    color: "#7C6FF0"},
            { label: "GST Registered",      color: "#EF9F27"},
          ].map((b) => (
            <span key={b.label} className="text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: `${b.color}12`, color: b.color }}>
              {b.label}
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">

        {/* Company info */}
        <div className="rounded-2xl p-6 mb-8" style={{ background: "#fff", border: `1px solid ${C.border}` }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: C.muted }}>Company Details</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { label: "Legal Name",     value: "Vrinandya Ventures Private Limited"                   },
              { label: "Brand",          value: "AXQEN"                                                   },
              { label: "Type",           value: "Private Limited Company"                                 },
              { label: "Incorporated",   value: "23 December 2025"                                        },
              { label: "PAN",            value: "AALCV7054P"                                              },
              { label: "Address",        value: "4/210 Unt Gali, Kacheri Ghat, Agra, UP – 282004"        },
              { label: "Email",          value: "connect@vrinandyaventures.in"                            },
              { label: "Website",        value: "axqen.app"                                               },
            ].map((r) => (
              <div key={r.label} className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold" style={{ color: C.muted }}>{r.label}</span>
                <span className="text-sm font-medium" style={{ color: C.heading }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Certificates */}
        <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: C.muted }}>
          Registrations &amp; Certificates
        </p>
        <div className="grid md:grid-cols-2 gap-5">
          {DOCS.map((doc) => {
            const Icon = doc.icon;
            return (
              <div key={doc.title} className="rounded-2xl overflow-hidden"
                style={{ background: "#fff", border: `1.5px solid ${C.border}` }}>

                {/* Card header */}
                <div className="p-5 flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: doc.dim }}>
                    <Icon className="w-5 h-5" style={{ color: doc.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold leading-tight mb-1" style={{ color: C.heading }}>{doc.title}</p>
                    <p className="text-xs leading-relaxed" style={{ color: C.body }}>{doc.desc}</p>
                  </div>
                </div>

                {/* Number + action */}
                <div className="px-5 pb-5 flex items-center justify-between gap-3"
                  style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                  <div>
                    <p className="text-xs" style={{ color: C.muted }}>{doc.label}</p>
                    <p className="text-sm font-mono font-bold" style={{ color: C.heading }}>{doc.number}</p>
                  </div>
                  {doc.file ? (
                    <a href={doc.file} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-opacity hover:opacity-80"
                      style={{ background: doc.dim, color: doc.color }}>
                      <FileText className="w-3.5 h-3.5" />
                      View Certificate
                    </a>
                  ) : (
                    <span className="text-xs px-3 py-2 rounded-lg font-medium" style={{ background: C.card, color: C.muted }}>
                      Certificate on file
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Trust note */}
        <div className="mt-8 rounded-2xl p-5 flex gap-3 items-start"
          style={{ background: C.goldDim, border: `1px solid rgba(0,72,223,0.15)` }}>
          <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: C.gold }} />
          <p className="text-sm" style={{ color: C.body }}>
            All registrations are issued by Government of India authorities and are publicly verifiable on their respective portals.
            For any compliance queries, write to{" "}
            <a href="mailto:connect@vrinandyaventures.in" className="font-semibold underline" style={{ color: C.gold }}>
              connect@vrinandyaventures.in
            </a>.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="py-8 px-6 text-center" style={{ background: "#fff", borderTop: `1px solid ${C.border}` }}>
        <p className="text-xs" style={{ color: C.muted }}>
          © {new Date().getFullYear()} Vrinandya Ventures Private Limited. All rights reserved.
        </p>
        <Link href="/" className="text-xs font-semibold mt-1 inline-block hover:opacity-70" style={{ color: C.gold }}>
          ← Back to AXQEN
        </Link>
      </div>
    </div>
  );
}
