// Approved copy source: AXQEN_AI_Website_Copywriting_Brief.pdf — preserve wording unless a change is requested.

export const NAV = [
  { label: "Platform",     href: "#features" },
  { label: "Solutions",    href: "#audience" },
  { label: "Integrations", href: "#integrations" },
  { label: "Pricing",      href: "#plans" },
  { label: "Resources",    href: "#faqs" },
];

export const HERO = {
  eyebrow: "AI Commerce Operating System",
  headlineLead: "Run, automate and grow your e-commerce business with",
  headlineBrand: "AXQEN AI.",
  sub: "One connected commerce platform to manage your stores, products, suppliers, orders, shipping and business performance. Bring your day-to-day operations together and build a clearer path to growth.",
  primaryCta: "Get Started",
  secondaryCta: "Book a Demo",
  points: ["Store and marketplace operations", "Connected order workflows", "Business performance visibility"],
};

// TODO(product owner): confirm live + tested status for each integration before flipping to "live".
export const INTEGRATIONS: { short: string; name: string; color: string; status: "live" | "planned" }[] = [
  { short: "S",  name: "Shopify",    color: "#5E8E3E", status: "live" },
  { short: "A",  name: "Amazon",     color: "#FF9900", status: "live" },
  { short: "SR", name: "Shiprocket", color: "#7B3FE4", status: "live" },
  { short: "F",  name: "Flipkart",   color: "#2874F0", status: "planned" },
  { short: "M",  name: "Meesho",     color: "#F43397", status: "planned" },
  { short: "E",  name: "Easebuzz",   color: "#1E9BD7", status: "planned" },
];
export const INTEGRATIONS_HEADING = "Connect the platforms you already use.";

export const CAPABILITIES_HEADING = "Everything you need to manage your commerce operations.";
export const CAPABILITIES = [
  { title: "Store setup and management",      desc: "Get your online store set up and manage key store information in one place." },
  { title: "Product and supplier management", desc: "Organise product information and coordinate with suppliers." },
  { title: "Order processing",                desc: "Bring order activity into a structured workflow from confirmation through dispatch." },
  { title: "Shipping and tracking",           desc: "Manage shipping updates and order movement through fulfilment." },
  { title: "NDR and RTO management",          desc: "Track delivery exceptions, follow-ups and return-to-origin workflows." },
  { title: "Wallet and remittance",           desc: "View relevant wallet and remittance information where supported." },
  { title: "Profit and analytics",            desc: "Review sales, costs and operational metrics." },
];

export const STEPS = [
  { n: "01", title: "Onboard",         desc: "Share business details and complete onboarding." },
  { n: "02", title: "Set up",          desc: "Configure your store, products and operating workflows." },
  { n: "03", title: "Launch",          desc: "Start processing orders through connected workflows." },
  { n: "04", title: "Manage and grow", desc: "Monitor operations and business performance." },
];

export const FEATURES = [
  { id: "orders",    title: "Centralised order management",     desc: "Keep order activity organised in a single workflow. Help your team follow each order from confirmation through processing and dispatch." },
  { id: "channels",  title: "Multi-channel store management",   desc: "Bring supported sales-channel activity into a more coordinated operating view and reduce the need to switch between disconnected panels." },
  { id: "products",  title: "Product and supplier management",  desc: "Organise product details and supplier coordination so teams can manage sourcing and fulfilment with better structure." },
  { id: "shipping",  title: "Shipping and tracking",            desc: "Keep shipping information and tracking updates accessible to the people managing order fulfilment." },
  { id: "ndr",       title: "NDR and RTO workflows",            desc: "Track delivery exceptions and return-to-origin cases, and coordinate the required follow-up actions." },
  { id: "wallet",    title: "Wallet and remittance visibility", desc: "Access wallet and remittance information in the platform where these capabilities are available." },
  { id: "analytics", title: "Business analytics",               desc: "Review sales and operational indicators to understand what is happening across your business." },
];

export const AUDIENCES = [
  { title: "Beginners starting e-commerce", desc: "A structured starting point for store and operations." },
  { title: "Shopify store owners",          desc: "Coordinate the operational work behind your storefront." },
  { title: "Marketplace sellers",           desc: "Organise supported marketplace workflows." },
  { title: "Multi-channel sellers",         desc: "Work towards a more unified view of orders and operations." },
  { title: "Growing D2C brands",            desc: "Build repeatable workflows as operational complexity increases." },
];

export const PRICING = {
  heading: "Straightforward plans. Clear operating costs.",
  sub: "Choose a setup plan based on the level of support and capabilities your business needs. Delivered-order and fulfilment-related charges apply separately.",
  plans: [
    {
      id: "starter", name: "Starter", price: "₹9,999", popular: false, lead: null as string | null,
      features: [
        "Professional Shopify Store Setup", "1-Year Domain", "Payment Gateway Integration Assistance",
        "Up to 100 Product Imports", "Product Research and Selection", "Supplier Integration",
        "AXQEN AI Dashboard Access", "Meta Ads Campaign Setup and Management", "Order Confirmation and Processing",
        "Supplier and Order Management", "Shipping and Tracking Management", "NDR Management",
        "Initial Training", "30 Days Post-Setup Support",
      ],
    },
    {
      id: "growth", name: "Growth", price: "₹19,999", popular: true, lead: "Everything in Starter, plus:",
      features: [
        "Meta Pixel Setup", "Premium Shopify Theme", "Product Listing and Page Optimization",
        "Conversion-Focused Store Optimization", "Supplier Coordination and Management",
        "Zero AXQEN RTO Management Fees for 12 Months", "Shipping and Courier Integration",
        "Priority Support", "Real-Time Reports",
      ],
    },
    {
      id: "scale", name: "Scale", price: "₹39,999", popular: false, lead: "Everything in Growth, plus:",
      features: [
        "Dedicated Account Manager", "Unlimited Product Import", "Priority Operations", "Advanced Analytics",
        "Dedicated Team Training", "Custom Branding", "Priority Processing",
        "Lifetime Zero AXQEN RTO Management Fees", "Monthly Business Strategy Calls",
      ],
    },
  ],
  terms: [
    "Platform and operations fee: ₹20 + 18% GST per delivered order.",
    "Forward shipping: actual courier cost + ₹10.",
    "Product procurement: supplier product cost + applicable GST + ₹10.",
    "Meta Ads budget is funded separately by the client.",
    "Cancelled orders: ₹0 platform fee.",
    "No monthly subscription.",
  ],
  rtoBenefits: [
    { plan: "Growth", text: "Zero AXQEN RTO management fee for 12 months from purchase date. During the benefit period, AXQEN absorbs applicable forward and reverse shipping costs on RTO orders." },
    { plan: "Scale",  text: "Lifetime zero AXQEN RTO management fee. AXQEN absorbs applicable forward and reverse shipping costs on RTO orders for the lifetime benefit period." },
  ],
  // TODO(product owner): legal/finance review of GST treatment, RTO benefit scope, exclusions, cancellation and refund terms.
};

export const FAQS = [
  { q: "What is AXQEN AI?", a: "AXQEN AI is an AI Commerce Operating System designed to bring key e-commerce workflows such as store management, products, suppliers, orders, shipping, NDR/RTO and business visibility into one connected platform." },
  { q: "Who can use AXQEN AI?", a: "AXQEN is designed for people starting an e-commerce business, Shopify store owners, marketplace sellers, multi-channel sellers and growing D2C brands. Capabilities depend on the selected plan and supported integrations." },
  { q: "How does onboarding work?", a: "The client shares business details, selects a plan, completes payment and submits required KYC documents. After verification and agreement completion, the onboarding team proceeds with the agreed setup." },
  { q: "Which platforms are supported?", a: "The intended ecosystem includes Shopify, Amazon, Flipkart and Meesho, alongside relevant shipping and payment integrations. Integrations marked “Coming soon” on this page are not yet live." },
  { q: "Do I need technical knowledge?", a: "The service is designed to help clients with setup and operational workflows. Client involvement depends on the selected plan and tasks being completed." },
  { q: "How does pricing work?", a: "AXQEN offers one-time setup plans. A per-delivered-order platform and operations fee, shipping charges and product procurement costs may also apply as described on the pricing page." },
  { q: "Can I upgrade my plan?", a: "Contact the AXQEN team to review available upgrade options and applicable commercial terms." },
];

export const FINAL_CTA = {
  heading: "Bring your commerce operations together.",
  sub: "Build a more connected way to manage your stores, products, orders and fulfilment workflows with AXQEN AI.",
  primary: "Get Started Today",
  secondary: "Book a Demo",
};

export const SEO = {
  title: "AXQEN AI | AI Commerce Operating System for E-commerce Businesses",
  description: "Manage e-commerce store operations, products, suppliers, orders, shipping and business performance with AXQEN AI, an integrated commerce operating system.",
  keywords: [
    "AXQEN AI", "AI Commerce Operating System", "e-commerce operations platform", "commerce operating system",
    "Shopify operations management", "multi-channel order management", "supplier management for e-commerce",
    "NDR and RTO management",
  ],
};
