"use client";
import { useState } from "react";
import { C } from "./constants";
import { useInView } from "./useInView";

const FEATURES = [
  {
    id: "orders",
    label: "Centralized Order Management",
    icon: "🛒",
    heading: "Centralized Order Management",
    desc: "Orders from every connected channel arrive in a single queue, so your team works from one list instead of switching between seller panels.",
    preview: "orders",
  },
  {
    id: "multichannel",
    label: "Multi-Channel Store Management",
    icon: "🏪",
    heading: "Multi-Channel Store Management",
    desc: "Connect Shopify, Amazon, Flipkart and Meesho stores. Manage listings, inventory and orders from a single dashboard.",
    preview: "multichannel",
  },
  {
    id: "products",
    label: "Product and Supplier Management",
    icon: "📦",
    heading: "Product and Supplier Management",
    desc: "One catalogue for all your products. Link each SKU to its supplier, set margins, and sync stock levels automatically.",
    preview: "products",
  },
  {
    id: "automation",
    label: "Automated Order Processing",
    icon: "⚡",
    heading: "Automated Order Processing",
    desc: "New orders are automatically assigned, confirmed with suppliers, and dispatched — no manual forwarding, no missed orders.",
    preview: "automation",
  },
  {
    id: "ndr",
    label: "NDR and RTO Management",
    icon: "↩️",
    heading: "NDR and RTO Management",
    desc: "Act on failed deliveries before they become returns. Track every RTO and see the exact cost impact on your business.",
    preview: "ndr",
  },
  {
    id: "shipping",
    label: "Shipping and Tracking",
    icon: "🚚",
    heading: "Shipping and Tracking",
    desc: "Live shipment tracking across all couriers. Customers get updates, you get visibility — from dispatch to doorstep.",
    preview: "shipping",
  },
  {
    id: "wallet",
    label: "Wallet and Remittance",
    icon: "💰",
    heading: "Wallet and Remittance",
    desc: "Your earnings collect in your wallet. Full remittance breakdowns show every rupee — selling price, cost, shipping, deductions.",
    preview: "wallet",
  },
];

type OrdersPreview = { id: string; channel: string; items: number; status: string; color: string };

const ORDERS_DATA: OrdersPreview[] = [
  { id: "#AX-10482", channel: "Shopify",  items: 2, status: "Processing", color: C.indigo },
  { id: "#AX-10481", channel: "Amazon",   items: 1, status: "Shipped",    color: "#1D9E75" },
  { id: "#AX-10480", channel: "Flipkart", items: 3, status: "Delivered",  color: "#6B7280" },
  { id: "#AX-10479", channel: "Meesho",   items: 1, status: "NDR raised", color: "#F59E0B" },
];

function OrdersPanel() {
  return (
    <div style={{ padding: "16px", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.heading }}>All orders</span>
        <span style={{ fontSize: 10, background: "#EFF6FF", color: C.indigo, padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>Demo data</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
        {[{ label: "New today", val: "48" }, { label: "To process", val: "17" }, { label: "In transit", val: "176" }].map((s) => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.heading, letterSpacing: "-0.03em" }}>{s.val}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ORDERS_DATA.map((o) => (
          <div key={o.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "#F9FAFB", borderRadius: 8, border: "1px solid #E5E7EB" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.heading }}>{o.id}</span>
            <span style={{ fontSize: 11, color: "#6B7280" }}>{o.channel} · {o.items} item{o.items > 1 ? "s" : ""}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: o.color, background: `${o.color}15`, padding: "2px 8px", borderRadius: 20 }}>{o.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GenericPanel({ feature }: { feature: typeof FEATURES[0] }) {
  return (
    <div style={{ padding: "24px", background: "#F9FAFB", border: `1px solid ${C.border}`, borderRadius: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 32 }}>{feature.icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.heading }}>{feature.heading}</div>
      <div style={{ fontSize: 13, color: C.body, lineHeight: 1.6 }}>{feature.desc}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {["Real-time sync", "Multi-channel", "Auto-update"].map((tag) => (
          <span key={tag} style={{ fontSize: 10, fontWeight: 600, color: C.indigo, background: C.indigoDim, border: `1px solid ${C.indigoBorder}`, padding: "3px 10px", borderRadius: 20 }}>{tag}</span>
        ))}
      </div>
    </div>
  );
}

export function ProductCatalogue() {
  const [active, setActive] = useState(0);
  const { ref, inView } = useInView();

  const current = FEATURES[active];

  return (
    <section
      id="platform-features"
      className="py-24 px-6"
      style={{ background: C.navy }}
      ref={ref}
    >
      <div
        className="max-w-[1200px] mx-auto transition-all duration-700"
        style={{ opacity: inView ? 1 : 0, transform: inView ? "none" : "translateY(24px)" }}
      >
        <div className="text-center mb-14">
          <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: C.indigo }}>
            Platform Features
          </p>
          <h2
            className="text-3xl md:text-4xl font-black mb-4"
            style={{ color: C.heading, letterSpacing: "-0.025em" }}
          >
            Every part of the order journey,<br className="hidden md:block" /> in one place.
          </h2>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left tabs */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="flex flex-col gap-1">
              {FEATURES.map((f, i) => (
                <button
                  key={f.id}
                  onClick={() => setActive(i)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all"
                  style={{
                    background: active === i ? C.indigoDim : "transparent",
                    border: active === i ? `1px solid ${C.indigoBorder}` : "1px solid transparent",
                    color: active === i ? C.indigo : C.body,
                    fontWeight: active === i ? 600 : 400,
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{f.icon}</span>
                  <span>{f.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right preview */}
          <div className="flex-1 min-w-0">
            {current.preview === "orders" ? (
              <OrdersPanel />
            ) : (
              <GenericPanel feature={current} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
