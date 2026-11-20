import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// READ-ONLY. Which integrations are set up (only whether each key is present — never the values),
// plus how many sellers use each and the scheduled jobs.
const has = (...keys: string[]) => keys.every(k => !!process.env[k]?.trim());
const missing = (...keys: string[]) => keys.filter(k => !process.env[k]?.trim());

const JOBS: { path: string; schedule: string; what: string }[] = [
  { path: "sync-orders", schedule: "Every hour", what: "Pulls new Shopify orders for every connected store" },
  { path: "verify-cod-orders", schedule: "Every hour", what: "Scores new COD orders for RTO risk" },
  { path: "issue-invoices", schedule: "Every hour (:40)", what: "Issues AXP invoices for newly delivered orders" },
  { path: "track-shipdaak", schedule: "Every 2 hours", what: "Updates Shipdaak shipment status and courier scans" },
  { path: "refresh-tracking", schedule: "Daily 11:30 AM IST", what: "Refreshes tracking for shipped orders" },
  { path: "sync-ndr", schedule: "Daily 12:30 PM IST", what: "Pulls failed deliveries (NDR) from couriers" },
  { path: "sync-meta-ads", schedule: "Every 8 hours", what: "Syncs ad spend from sellers' connected Meta accounts" },
  { path: "auto-payout", schedule: "Mondays 7 PM IST", what: "Prepares the weekly payout run" },
  { path: "plan-renewals", schedule: "Daily 2 AM IST", what: "Creates Marketplace plan renewals that have come due" },
  { path: "arya-followup", schedule: "Daily 3:30 PM IST", what: "AI follow-ups for leads (AI features are paused)" },
];

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [shopify, amazon, meta] = await Promise.all([
    prisma.shopifyStore.count(),
    prisma.marketplaceAccount.count({ where: { platform: "AMAZON", isActive: true } }),
    prisma.user.count({ where: { role: "SELLER", metaAccessToken: { not: null }, metaAdAccountId: { not: null }, metaTokenExpiresAt: { gt: new Date() } } }),
  ]);
  const selfConnect = process.env.NEXT_PUBLIC_AMAZON_SELF_CONNECT === "1";

  const integrations = [
    { group: "Sales channels", name: "Shopify app", ok: has("SHOPIFY_API_KEY", "SHOPIFY_API_SECRET"), missing: missing("SHOPIFY_API_KEY", "SHOPIFY_API_SECRET", "SHOPIFY_WEBHOOK_SECRET"), detail: `${shopify} store${shopify === 1 ? "" : "s"} connected`, href: "/admin/sellers" },
    { group: "Sales channels", name: "Amazon SP-API", ok: has("AMAZON_CLIENT_ID", "AMAZON_CLIENT_SECRET"), missing: missing("AMAZON_CLIENT_ID", "AMAZON_CLIENT_SECRET", "AMAZON_REDIRECT_URI"), detail: `${amazon} seller${amazon === 1 ? "" : "s"} connected · seller self-connect ${selfConnect ? "on" : "off (waiting for app approval)"}`, href: "/admin/amazon" },
    { group: "Shipping", name: "Shipdaak", ok: has("SHIPDAAK_EMAIL", "SHIPDAAK_PASSWORD"), missing: missing("SHIPDAAK_EMAIL", "SHIPDAAK_PASSWORD"), detail: "Book shipments, labels and tracking", href: "/admin/delivery" },
    { group: "Shipping", name: "Delhivery", ok: has("DELHIVERY_API_TOKEN"), missing: missing("DELHIVERY_API_TOKEN", "DELHIVERY_WEBHOOK_TOKEN"), detail: "Direct Delhivery AWBs, tracking and NDR", href: "/admin/delivery" },
    { group: "Marketing", name: "Meta ads (AXQEN account)", ok: has("META_ADS_TOKEN", "META_AD_ACCOUNT_ID"), missing: missing("META_ADS_TOKEN", "META_AD_ACCOUNT_ID"), detail: "Import campaign spend from AXQEN's ad account", href: "/admin/ad-spend" },
    { group: "Marketing", name: "Meta app (seller connect)", ok: has("META_APP_ID", "META_APP_SECRET"), missing: missing("META_APP_ID", "META_APP_SECRET"), detail: `${meta} seller${meta === 1 ? "" : "s"} with a live Meta connection`, href: "/admin/ad-spend" },
    { group: "Payments & files", name: "Razorpay", ok: has("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"), missing: missing("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"), detail: "Plan payments at signup and ad wallet recharges", href: null },
    { group: "Payments & files", name: "Cloudinary", ok: has("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"), missing: missing("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"), detail: "Product images and KYC documents", href: null },
    { group: "Messaging", name: "Email (Resend)", ok: has("RESEND_API_KEY"), missing: missing("RESEND_API_KEY"), detail: "KYC, signup and account emails", href: null },
    { group: "Messaging", name: "SMS OTP (Fast2SMS)", ok: has("FAST2SMS_API_KEY"), missing: missing("FAST2SMS_API_KEY"), detail: "Phone verification codes", href: null },
    { group: "Messaging", name: "WhatsApp Cloud API", ok: has("WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"), missing: missing("WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"), detail: "WhatsApp messages from AXQEN's number", href: null },
    { group: "AI", name: "Claude (Anthropic)", ok: has("ANTHROPIC_API_KEY"), missing: missing("ANTHROPIC_API_KEY"), detail: "Ask AXQEN and AI Intelligence for sellers", href: null },
    { group: "System", name: "Scheduled jobs", ok: has("CRON_SECRET"), missing: missing("CRON_SECRET"), detail: `${JOBS.length} jobs run on Vercel`, href: null },
  ];

  return NextResponse.json({ integrations, jobs: JOBS });
}
