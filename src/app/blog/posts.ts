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
