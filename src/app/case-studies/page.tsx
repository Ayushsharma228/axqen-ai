"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const C = {
  navy:         "#ffffff",
  card:         "#f1f3f5",
  gold:         "#0048DF",
  goldDim:      "rgba(0,72,223,0.08)",
  heading:      "#0A0E1A",
  body:         "#4B5563",
  muted:        "rgba(75,85,99,0.55)",
  green:        "#1D9E75",
  greenDim:     "rgba(29,158,117,0.12)",
  amber:        "#EF9F27",
  amberDim:     "rgba(239,159,39,0.12)",
  border:       "rgba(0,0,0,0.08)",
  borderStrong: "rgba(0,0,0,0.14)",
};

const CASES = [
  {
    id:       "thezolfkart",
    seller:   "TheZolfKart",
    initials: "TZ",
    product:  "HD Security Camera",
    price:    "₹799",
    days:     31,
    period:   "1 July – 31 July 2026",
    niche:    "Electronics & Gadgets",
    color:    C.amber,
    colorDim: C.amberDim,
    tagline:  "20.81x ROAS on a ₹799 security camera in 31 days.",
    kpis: [
      { label: "Meta ROAS",         value: "20.81x",   star: true  },
      { label: "Shopify Orders",    value: "157"               },
      { label: "Collected Revenue", value: "₹81,498"          },
      { label: "Net Profit",        value: "₹13,119"          },
    ],
    shopify: [
      { label: "Units Sold",        value: "157"        },
      { label: "Gross Sales",       value: "₹1,27,041"  },
      { label: "Sales Reversals",   value: "₹1,598"     },
      { label: "Total Sales",       value: "₹1,25,443"  },
    ],
    meta: [
      { label: "Ad Spend",          value: "₹5,720"     },
      { label: "Purchases",         value: "149"         },
      { label: "Cost Per Purchase", value: "₹38.39"      },
      { label: "Campaign ROAS",     value: "20.81x", star: true },
      { label: "CTR",               value: "2.28%"       },
      { label: "Meta Tracked",      value: "149 orders"  },
    ],
    fulfillment: [
      { label: "Total Orders",   value: "157"     },
      { label: "Delivered",      value: "102", positive: true },
      { label: "RTO",            value: "55",  negative: true },
      { label: "Delivery Rate",  value: "64.97%", positive: true },
      { label: "RTO Rate",       value: "35.03%", negative: true },
    ],
    unitEconomics: [
      { label: "Selling Price",        value: "₹799"  },
      { label: "Product + Shipping",   value: "₹349"  },
      { label: "AXQEN Platform Fee",   value: "₹20"   },
      { label: "Gross Margin / Unit",  value: "₹430"  },
    ],
    profitCalc: [
      { label: "Collected Revenue",     value: "₹81,498",  positive: true  },
      { label: "Product + Shipping",    value: "−₹35,598", negative: true  },
      { label: "AXQEN Platform Charges",value: "−₹2,040",  negative: true  },
      { label: "Meta Ads Spend",        value: "−₹5,720",  negative: true  },
      { label: "Shopify / App Cost",    value: "−₹20",     negative: true  },
      { label: "One-Time Service Fee",  value: "−₹25,000", negative: true  },
      { label: "Net Profit",            value: "₹13,119",  positive: true, bold: true },
    ],
    images: [
      { src: "/testimonials/shopify-thezolfcart.png.png", alt: "TheZolfKart Shopify Dashboard", caption: "Shopify Sales Dashboard — July 2026" },
      { src: "/testimonials/meta-thezolfcart.png.png",    alt: "TheZolfKart Meta Ads",          caption: "Meta Ads Manager — Campaign Results" },
    ],
  },
  {
    id:       "hyperloop",
    seller:   "Hyperloop Global",
    initials: "HG",
    product:  "Premium Detox Foot Patch",
    price:    "₹499",
    days:     37,
    period:   "25 June – 31 July 2026",
    niche:    "Health & Wellness",
    color:    C.green,
    colorDim: C.greenDim,
    tagline:  "₹44,910 revenue with 74.38% delivery rate in 37 days.",
    kpis: [
      { label: "Meta ROAS",         value: "7.11x",    star: true  },
      { label: "Shopify Orders",    value: "121"               },
      { label: "Collected Revenue", value: "₹44,910"          },
      { label: "Net Profit",        value: "₹21,550"          },
    ],
    shopify: [
      { label: "Units Sold",        value: "121"       },
      { label: "Gross Sales",       value: "₹60,379"   },
      { label: "Sales Reversals",   value: "₹0"        },
      { label: "Total Sales",       value: "₹60,379"   },
    ],
    meta: [
      { label: "Ad Spend",          value: "₹8,489"     },
      { label: "Purchases",         value: "121"         },
      { label: "Cost Per Purchase", value: "₹70.16"      },
      { label: "Campaign ROAS",     value: "7.11x", star: true },
      { label: "CTR",               value: "1.25%"       },
      { label: "Meta Tracked",      value: "109 orders"  },
    ],
    fulfillment: [
      { label: "Total Orders",   value: "121"     },
      { label: "Delivered",      value: "90",   positive: true },
      { label: "RTO",            value: "31",   negative: true },
      { label: "Delivery Rate",  value: "74.38%", positive: true },
      { label: "RTO Rate",       value: "25.62%", negative: true },
    ],
    unitEconomics: [
      { label: "Selling Price",        value: "₹499" },
      { label: "Product + Shipping",   value: "₹145" },
      { label: "AXQEN Platform Fee",   value: "₹20"  },
      { label: "Gross Margin / Unit",  value: "₹334" },
    ],
    profitCalc: [
      { label: "Collected Revenue",     value: "₹44,910",  positive: true  },
      { label: "Product + Shipping",    value: "−₹13,050", negative: true  },
      { label: "AXQEN Platform Charges",value: "−₹1,800",  negative: true  },
      { label: "Meta Ads Spend",        value: "−₹8,489",  negative: true  },
      { label: "Shopify / App Cost",    value: "−₹20",     negative: true  },
      { label: "Net Profit",            value: "₹21,550",  positive: true, bold: true },
    ],
    images: [
      { src: "/testimonials/Shopify-hyperloopglobal.png", alt: "Hyperloop Global Shopify Dashboard", caption: "Shopify Sales Dashboard — Jun–Jul 2026" },
      { src: "/testimonials/meta-hyperloopglobal.png",    alt: "Hyperloop Global Meta Ads",          caption: "Meta Ads Manager — Campaign Results" },
    ],
  },
  {
    id:       "bazarx",
    seller:   "The BazarX",
    initials: "BX",
    product:  "Premium Detox Foot Patch",
    price:    "₹599",
    days:     17,
    period:   "1 April – 17 April 2026",
    niche:    "Health & Wellness",
    color:    C.gold,
    colorDim: C.goldDim,
    tagline:  "258 orders and ₹40,699 net profit in just 17 days.",
    kpis: [
      { label: "Meta ROAS",         value: "9.58x",    star: true  },
      { label: "Shopify Orders",    value: "258"               },
      { label: "Collected Revenue", value: "₹78,469"          },
      { label: "Net Profit",        value: "₹40,699"          },
    ],
    shopify: [
      { label: "Units Sold",        value: "258"        },
      { label: "Gross Sales",       value: "₹1,28,742"  },
      { label: "Sales Reversals",   value: "₹0"         },
      { label: "Total Sales",       value: "₹1,28,742"  },
    ],
    meta: [
      { label: "Ad Spend",          value: "₹16,134"    },
      { label: "Purchases",         value: "258"         },
      { label: "Cost Per Purchase", value: "₹62.54"      },
      { label: "Campaign ROAS",     value: "7.98x", star: true },
      { label: "CTR",               value: "1.32%"       },
      { label: "Meta Tracked",      value: "227 orders"  },
    ],
    fulfillment: [
      { label: "Total Orders",   value: "258"     },
      { label: "Delivered",      value: "131",  positive: true },
      { label: "RTO",            value: "63",   negative: true },
      { label: "Delivery Rate",  value: "50.78%", positive: true },
      { label: "RTO Rate",       value: "24.42%", negative: true },
    ],
    unitEconomics: [
      { label: "Selling Price",        value: "₹599" },
      { label: "Product + Shipping",   value: "₹145" },
      { label: "AXQEN Platform Fee",   value: "₹20"  },
      { label: "Gross Margin / Unit",  value: "₹434" },
    ],
    profitCalc: [
      { label: "Collected Revenue",     value: "₹78,469",  positive: true  },
      { label: "Product + Shipping",    value: "−₹18,995", negative: true  },
      { label: "AXQEN Platform Charges",value: "−₹2,620",  negative: true  },
      { label: "Meta Ads Spend",        value: "−₹16,134", negative: true  },
      { label: "Shopify / App Cost",    value: "−₹20",     negative: true  },
      { label: "Net Profit",            value: "₹40,699",  positive: true, bold: true },
    ],
    images: [],
  },
];

function StatRow({ label, value, positive, negative, bold }: { label: string; value: string; positive?: boolean; negative?: boolean; bold?: boolean }) {
  const color = positive ? C.green : negative ? "#E24B4A" : C.heading;
  return (
    <div className="flex justify-between items-center py-2.5" style={{ borderBottom: `1px solid ${C.border}` }}>
      <span className="text-sm" style={{ color: C.body, fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span className="text-sm font-bold" style={{ color: bold ? color : color }}>{value}</span>
    </div>
  );
}

export default function CaseStudiesPage() {
  const [active, setActive] = useState(0);
  const cs = CASES[active];

  return (
    <div style={{ background: "#f8f9fb", minHeight: "100vh" }}>
      {/* Navbar */}
      <nav style={{ background: "#fff", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 50 }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
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
      <div className="py-16 px-6 text-center" style={{ background: "#fff", borderBottom: `1px solid ${C.border}` }}>
        <span className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-4" style={{ background: C.goldDim, color: C.gold }}>
          Verified Results
        </span>
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4" style={{ color: C.heading }}>
          Case Studies
        </h1>
        <p className="text-base md:text-lg max-w-2xl mx-auto" style={{ color: C.body }}>
          Real campaigns, real numbers — verified from Shopify dashboards and Meta Ads Manager.
          No cherry-picked days, no inflated figures.
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Tabs */}
        <div className="flex gap-3 mb-10 flex-wrap">
          {CASES.map((c, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className="flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: active === i ? c.color : "#fff",
                color:      active === i ? "#fff"   : C.body,
                border:     `1.5px solid ${active === i ? c.color : C.border}`,
                boxShadow:  active === i ? `0 4px 16px ${c.color}33` : "none",
              }}
            >
              <span className="w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center"
                style={{ background: active === i ? "rgba(255,255,255,0.2)" : `${c.color}18`, color: active === i ? "#fff" : c.color }}>
                {c.initials}
              </span>
              <div className="text-left">
                <p className="leading-tight">{c.seller}</p>
                <p className="text-xs opacity-75 leading-tight">{c.days} days · {c.niche}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Case Study */}
        <div key={active}>
          {/* Header */}
          <div className="rounded-2xl p-6 mb-6 flex flex-wrap items-center gap-4 justify-between"
            style={{ background: "#fff", border: `1.5px solid ${C.border}` }}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-base font-extrabold text-white"
                style={{ background: cs.color }}>
                {cs.initials}
              </div>
              <div>
                <h2 className="text-xl font-extrabold" style={{ color: C.heading }}>{cs.seller}</h2>
                <p className="text-sm" style={{ color: C.body }}>{cs.product} · {cs.price} · {cs.period}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: `${cs.color}12`, color: cs.color }}>{cs.niche}</span>
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: C.goldDim, color: C.gold }}>{cs.days}-Day Campaign</span>
            </div>
          </div>

          {/* Tagline */}
          <div className="rounded-2xl p-6 mb-6" style={{ background: `${cs.color}10`, border: `1.5px solid ${cs.color}25` }}>
            <p className="text-lg font-bold" style={{ color: cs.color }}>&ldquo;{cs.tagline}&rdquo;</p>
          </div>

          {/* Top KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {cs.kpis.map((k) => (
              <div key={k.label} className="rounded-2xl p-5" style={{ background: k.star ? `${cs.color}10` : "#fff", border: `1.5px solid ${k.star ? cs.color + "30" : C.border}` }}>
                <p className="text-3xl font-extrabold mb-1" style={{ color: k.star ? cs.color : C.heading }}>{k.value}</p>
                <p className="text-xs" style={{ color: C.body }}>{k.label}</p>
              </div>
            ))}
          </div>

          {/* Detail grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Shopify Performance */}
            <div className="rounded-2xl p-6" style={{ background: "#fff", border: `1.5px solid ${C.border}` }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: C.muted }}>Shopify Performance</p>
              {cs.shopify.map((r) => <StatRow key={r.label} {...r} />)}
            </div>

            {/* Meta Ads */}
            <div className="rounded-2xl p-6" style={{ background: "#fff", border: `1.5px solid ${C.border}` }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: C.muted }}>Meta Ads Performance</p>
              {cs.meta.map((r) => <StatRow key={r.label} {...r} positive={r.star} />)}
            </div>

            {/* Fulfillment */}
            <div className="rounded-2xl p-6" style={{ background: "#fff", border: `1.5px solid ${C.border}` }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: C.muted }}>Order Fulfillment</p>
              {cs.fulfillment.map((r) => <StatRow key={r.label} {...r} />)}
            </div>

            {/* Unit Economics */}
            <div className="rounded-2xl p-6" style={{ background: "#fff", border: `1.5px solid ${C.border}` }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: C.muted }}>Unit Economics</p>
              {cs.unitEconomics.map((r) => <StatRow key={r.label} {...r} />)}
            </div>
          </div>

          {/* Profit Calculation */}
          <div className="rounded-2xl p-6 mb-6" style={{ background: "#fff", border: `1.5px solid ${C.border}` }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: C.muted }}>Profit Calculation</p>
            <div className="max-w-md">
              {cs.profitCalc.map((r) => <StatRow key={r.label} {...r} />)}
            </div>
          </div>

          {/* What AXQEN Did */}
          <div className="rounded-2xl p-6 mb-6" style={{ background: "#fff", border: `1.5px solid ${C.border}` }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: C.muted }}>What AXQEN Handled End-to-End</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {["Product Selection", "Store Setup", "Product Page Development", "Ad Creative Production", "Meta Ads Management", "Order Processing & Fulfillment"].map((w) => (
                <div key={w} className="flex items-center gap-2.5 p-3 rounded-xl" style={{ background: C.card }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.greenDim }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke={C.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span className="text-sm font-medium" style={{ color: C.heading }}>{w}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Screenshots */}
          {cs.images.length > 0 && (
            <div className="rounded-2xl p-6 mb-6" style={{ background: "#fff", border: `1.5px solid ${C.border}` }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: C.muted }}>Campaign Screenshots</p>
              <div className="grid md:grid-cols-2 gap-4">
                {cs.images.map((img) => (
                  <div key={img.src} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                    <Image src={img.src} alt={img.alt} width={800} height={500} className="w-full object-cover" />
                    <p className="text-xs py-2 px-3" style={{ color: C.muted, background: C.card }}>{img.caption}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Continuation note */}
          <div className="rounded-2xl p-6" style={{ background: C.goldDim, border: `1.5px solid rgba(0,72,223,0.15)` }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.gold }}>Ongoing Engagement</p>
            <p className="text-sm" style={{ color: C.body }}>
              This case study covers Month 1 only. Following these results, the seller chose to continue into Month 2.
              The data above is independently verifiable from Shopify and Meta Ads Manager dashboards.
            </p>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="py-16 px-6 text-center" style={{ background: "#fff", borderTop: `1px solid ${C.border}` }}>
        <h2 className="text-2xl font-extrabold mb-3" style={{ color: C.heading }}>Ready to be the next case study?</h2>
        <p className="text-sm mb-6" style={{ color: C.body }}>Limited spots available. Our team handles everything — you focus on scaling.</p>
        <Link href="/#apply" className="inline-block text-sm font-black px-8 py-3.5 rounded-xl" style={{ background: C.gold, color: "#fff" }}>
          Apply Now
        </Link>
      </div>
    </div>
  );
}
