// Blog registry. Add a post here + a body file in ./_posts to publish it; /blog, the sitemap and internal links read from this list.
export type PostMeta = {
  slug: string;
  title: string;
  seoTitle: string;
  description: string;
  excerpt: string;
  keywords: string[];
  date: string; // ISO yyyy-mm-dd
  author: string;
  readingMinutes: number;
  imageAlt: string;
  flow?: string[];
  faqs?: { q: string; a: string }[];
};

export const POSTS: PostMeta[] = [
  {
    slug: "start-dropshipping-business-india",
    title: "How to Start a Dropshipping Business in India in 2027",
    seoTitle: "How to Start a Dropshipping Business in India (2027 Guide)",
    description:
      "A step-by-step guide to starting dropshipping in India in 2027, with a sample startup budget, unit economics and a supplier evaluation checklist.",
    excerpt:
      "The steps, a sample ₹38,500 first-month budget, a worked profit example for 100 orders and a supplier checklist, so you start with the numbers in front of you.",
    keywords: [
      "how to start dropshipping business in India",
      "dropshipping in India 2027",
      "dropshipping startup cost India",
      "COD dropshipping",
      "Indian dropshipping suppliers",
    ],
    date: "2026-11-16",
    author: "Ayush Sharma",
    readingMinutes: 8,
    imageAlt:
      "Step-by-step flow of a dropshipping business in India, from customer order to supplier dispatch, delivery and profit",
    flow: ["Orders", "Supplier", "Delivery", "Profit"],
    faqs: [
      { q: "Is dropshipping legal in India?", a: "Yes. It is a normal retail business model. You still need to follow tax, invoicing and consumer protection rules." },
      { q: "How much money do I need to start dropshipping in India?", a: "The sample plan above comes to about ₹38,500 for the first month, most of it for ad testing and a shipping and RTO buffer. Your figure will depend on your platform, product and ad costs." },
      { q: "How long before a dropshipping store becomes profitable?", a: "There is no fixed timeline. Expect the first month to be testing. Judge products on net profit after returns, not on order count." },
      { q: "Can I start without any experience?", a: "Yes. Start with one niche and a few products, and learn operations before you increase ad spend." },
    ],
  },
];

POSTS.push({
  slug: "profitable-shopify-store-india",
  title: "Complete Guide to Building a Profitable Shopify Store in India",
  seoTitle: "Build a Profitable Shopify Store in India (Complete Guide)",
  description:
    "Build a Shopify store in India that makes profit, not just sales: setup walkthrough, pricing calculations, RTO control and a launch checklist.",
  excerpt:
    "Price first, then setup, then operations, then launch. Includes break-even ad cost at three price points, a 10-step Shopify setup and a launch checklist.",
  keywords: [
    "Shopify store in India",
    "build Shopify store India",
    "Shopify setup guide",
    "Shopify pricing strategy",
    "Shopify COD India",
    "Shopify launch checklist",
  ],
  date: "2026-11-17",
  author: "Ayush Sharma",
  readingMinutes: 7,
  imageAlt: "Shopify store on a mobile phone next to a profit calculation for an Indian online store",
  flow: ["Break-even ad cost: ₹336"],
  faqs: [
    { q: "Is Shopify good for Indian sellers?", a: "Yes. It is quick to launch and supports Indian payment gateways and courier integrations. Profit still depends on your product, pricing and return rates." },
    { q: "How do I price a product on Shopify?", a: "Start from costs, not competitors. Calculate what is left after product, shipping, payment fees and RTO, then check that your ad cost per order sits well below that figure." },
    { q: "How long does it take to build a Shopify store?", a: "A basic store can go live in a few days. Making it profitable takes weeks of testing products, prices and delivery performance." },
    { q: "Do I need a developer?", a: "Not for a standard store. You may want help later for custom features." },
  ],
});

// TODO(product owner): paste the exact Razorpay and ClickPost source URLs; citations render as plain text until then.
export const SOURCES: { razorpay?: string; clickpost?: string } = {};

export const SITE = "https://www.axqen.app";

export const postUrl = (slug: string) => `${SITE}/blog/${slug}`;

export function getPost(slug: string) {
  return POSTS.find((p) => p.slug === slug);
}

export function isPublished(slug: string) {
  return POSTS.some((p) => p.slug === slug);
}

export function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
