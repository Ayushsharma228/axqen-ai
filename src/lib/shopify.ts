import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

export const SHOPIFY_API_VERSION = "2026-10";

// Must match the scopes on the AXQEN AI app (Shopify Dev Dashboard → version 1.0).
export const PLATFORM_SCOPES = [
  "read_orders",
  "write_products",
  "write_inventory",
  "read_locations",
  "read_merchant_managed_fulfillment_orders",
  "write_merchant_managed_fulfillment_orders",
].join(",");

export const ORDER_WEBHOOK_TOPICS = ["orders/create", "orders/updated", "orders/cancelled"];

export function appUrl() {
  return (process.env.NEXTAUTH_URL ?? "https://www.axqen.app").replace(/\/$/, "");
}

/** "mystore", "mystore.myshopify.com" or "https://mystore.myshopify.com/" → "mystore.myshopify.com"; null if invalid. */
export function normalizeShopDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!s.endsWith(".myshopify.com")) s = `${s}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s) ? s : null;
}

// ── OAuth state: signed so the callback can trust which seller started the connection ──
type StatePayload = { sellerId: string; shop: string; mode: "platform" | "custom"; exp: number };

function stateSecret() {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is not set");
  return s;
}

export function signState(p: Omit<StatePayload, "exp">): string {
  const body = Buffer.from(JSON.stringify({ ...p, exp: Date.now() + 15 * 60_000 })).toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state: string | null): StatePayload | null {
  if (!state) return null;
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StatePayload;
    if (!p.sellerId || !p.shop || p.exp < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Verifies the HMAC Shopify adds to OAuth redirects (query string, hex). */
export function verifyOAuthHmac(searchParams: URLSearchParams, secret: string): boolean {
  const hmac = searchParams.get("hmac");
  if (!hmac) return false;
  const message = [...searchParams.entries()]
    .filter(([k]) => k !== "hmac" && k !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return safeEqual(createHmac("sha256", secret).update(message).digest("hex"), hmac);
}

/**
 * Verifies a webhook body. Shopify signs with the secret of the app that registered the webhook:
 * the AXQEN AI platform app, or (for older connections) the seller's own custom app.
 */
export async function verifyWebhook(rawBody: string, hmacHeader: string | null, shopDomain: string | null): Promise<boolean> {
  if (!hmacHeader) return false;
  const secrets = new Set<string>();
  if (process.env.SHOPIFY_API_SECRET) secrets.add(process.env.SHOPIFY_API_SECRET);
  if (process.env.SHOPIFY_WEBHOOK_SECRET) secrets.add(process.env.SHOPIFY_WEBHOOK_SECRET);
  if (shopDomain) {
    const store = await prisma.shopifyStore.findFirst({ where: { storeUrl: shopDomain }, select: { clientSecret: true } });
    if (store?.clientSecret) secrets.add(store.clientSecret);
  }
  for (const secret of secrets) {
    const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
    if (safeEqual(digest, hmacHeader)) return true;
  }
  return false;
}

/** Registers order + uninstall webhooks on a store, pointing at the canonical app URL. Idempotent. */
export async function registerWebhooks(storeUrl: string, accessToken: string) {
  const base = appUrl();
  const targets = [
    ...ORDER_WEBHOOK_TOPICS.map((topic) => ({ topic, address: `${base}/api/webhooks/shopify/orders` })),
    { topic: "app/uninstalled", address: `${base}/api/shopify/webhooks` },
  ];

  const headers = { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken };
  const results: { topic: string; status: "registered" | "already_exists" | "failed" }[] = [];

  // Drop webhooks pointing at old/temporary addresses so Shopify doesn't keep calling them.
  try {
    const list = await fetch(`https://${storeUrl}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`, { headers });
    if (list.ok) {
      const { webhooks = [] } = (await list.json()) as { webhooks?: { id: number; topic: string; address: string }[] };
      for (const w of webhooks) {
        const wanted = targets.some((t) => t.topic === w.topic && t.address === w.address);
        const ours = w.address.includes("/api/webhooks/shopify/orders") || w.address.includes("/api/shopify/webhooks");
        if (ours && !wanted) {
          await fetch(`https://${storeUrl}/admin/api/${SHOPIFY_API_VERSION}/webhooks/${w.id}.json`, { method: "DELETE", headers }).catch(() => {});
        }
      }
    }
  } catch {
    // Listing is best-effort; registration below still runs.
  }

  for (const t of targets) {
    try {
      const res = await fetch(`https://${storeUrl}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`, {
        method: "POST",
        headers,
        body: JSON.stringify({ webhook: { topic: t.topic, address: t.address, format: "json" } }),
      });
      results.push({ topic: t.topic, status: res.ok ? "registered" : res.status === 422 ? "already_exists" : "failed" });
    } catch {
      results.push({ topic: t.topic, status: "failed" });
    }
  }
  return results;
}
