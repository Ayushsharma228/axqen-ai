import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encrypt";

// ── Access tokens ─────────────────────────────────────────────────────────────
// New public apps must use expiring offline tokens (~1h) plus a refresh token.
// Older custom-app connections have non-expiring tokens (no accessTokenExpiresAt) and are used as-is.

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
};

/** Converts Shopify's token response into the encrypted fields stored on ShopifyStore. */
export function tokenFields(t: TokenResponse) {
  const now = Date.now();
  return {
    accessToken:           encrypt(t.access_token!),
    refreshToken:          t.refresh_token ? encrypt(t.refresh_token) : null,
    accessTokenExpiresAt:  t.expires_in ? new Date(now + t.expires_in * 1000) : null,
    refreshTokenExpiresAt: t.refresh_token_expires_in ? new Date(now + t.refresh_token_expires_in * 1000) : null,
  };
}

/** Exchanges an OAuth code for an expiring offline token. */
export async function exchangeCodeForToken(shop: string, clientId: string, clientSecret: string, code: string): Promise<TokenResponse> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, expiring: 1 }),
  });
  return (await res.json().catch(() => ({}))) as TokenResponse;
}

/** Returns a usable access token for the store, refreshing it first if it is about to expire. */
export async function getShopifyAccessToken(storeId: string): Promise<string> {
  const store = await prisma.shopifyStore.findUnique({ where: { id: storeId } });
  if (!store) throw new Error("Shopify store not found");

  const expiresAt = store.accessTokenExpiresAt?.getTime();
  if (!expiresAt || expiresAt - Date.now() > 2 * 60_000 || !store.refreshToken) {
    return decrypt(store.accessToken);
  }

  const clientId = store.clientId || process.env.SHOPIFY_API_KEY;
  const clientSecret = store.clientSecret || process.env.SHOPIFY_API_SECRET;
  if (!clientId || !clientSecret) throw new Error("Shopify app credentials are not configured");

  const res = await fetch(`https://${store.storeUrl}/admin/oauth/access_token`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    "refresh_token",
      refresh_token: decrypt(store.refreshToken),
    }),
  });
  const t = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !t.access_token) {
    const reason = t.error_description || t.error || `HTTP ${res.status}`;
    await prisma.shopifyStore.update({ where: { id: storeId }, data: { lastSyncError: `Access expired — please reconnect your store (${reason})` } }).catch(() => {});
    throw new Error(`Shopify token refresh failed: ${reason}`);
  }

  const fields = tokenFields(t);
  // Keep the existing refresh token if Shopify didn't rotate it.
  await prisma.shopifyStore.update({
    where: { id: storeId },
    data:  fields.refreshToken ? fields : { accessToken: fields.accessToken, accessTokenExpiresAt: fields.accessTokenExpiresAt },
  });
  return t.access_token;
}

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

// Canonical public URL for Shopify. Must exactly match the app's allowed redirect URL, and webhooks
// must not hit a redirect (axqen.app → www.axqen.app), so this is pinned rather than read from NEXTAUTH_URL.
export function appUrl() {
  return (process.env.SHOPIFY_APP_URL ?? "https://www.axqen.app").replace(/\/$/, "");
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
