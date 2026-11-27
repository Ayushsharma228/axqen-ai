import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encrypt";
import { reportError } from "@/lib/errors";

// ── Access tokens ─────────────────────────────────────────────────────────────
// New public apps must use expiring offline tokens (~1h) plus a refresh token.
// Older connections with non-expiring tokens are swapped for an expiring pair on first use (see migrateToExpiringToken).

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

// When Shopify refuses to swap a store's old token (store paused, or a token made in the store admin),
// we wait a day before trying again, remembered in PlatformConfig so restarts don't retry every hour.
const RETRY_UPGRADE_MS = 24 * 60 * 60_000;
const upgradeKey = (storeId: string) => `SHOPIFY_TOKEN_UPGRADE_FAIL:${storeId}`;
async function upgradeRecentlyFailed(storeId: string) {
  const row = await prisma.platformConfig.findUnique({ where: { key: upgradeKey(storeId) }, select: { value: true } }).catch(() => null);
  return !!row && Date.now() - Number(row.value) < RETRY_UPGRADE_MS;
}
async function rememberUpgradeFailure(storeId: string) {
  const value = String(Date.now());
  await prisma.platformConfig.upsert({ where: { key: upgradeKey(storeId) }, create: { key: upgradeKey(storeId), value, label: "Shopify token upgrade failed at" }, update: { value } }).catch(() => null);
}

/**
 * Swaps a non-expiring offline token for an expiring token pair (Shopify token exchange).
 * The old token stops working once this succeeds, so the new pair is saved before it is used.
 * If saving fails, retrying with the same old token within 7 days returns the same pair.
 */
async function migrateToExpiringToken(storeId: string, shop: string, clientId: string, clientSecret: string, oldToken: string): Promise<string | null> {
  try {
    const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        grant_type:           "urn:ietf:params:oauth:grant-type:token-exchange",
        client_id:            clientId,
        client_secret:        clientSecret,
        subject_token:        oldToken,
        subject_token_type:   "urn:shopify:params:oauth:token-type:offline-access-token",
        requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
        expiring:             "1",
      }),
    });
    const raw = await res.text();
    let t: TokenResponse = {};
    try { t = JSON.parse(raw) as TokenResponse; } catch { /* not JSON */ }
    if (!res.ok || !t.access_token || !t.refresh_token) {
      const reason = t.error_description || t.error || `HTTP ${res.status}${raw ? ` ${raw.slice(0, 120)}` : ""}`;
      console.warn(`[shopify] token migration skipped for ${shop}: ${reason}`);
      await rememberUpgradeFailure(storeId);
      await prisma.shopifyStore.update({ where: { id: storeId }, data: { lastSyncError: "Shopify needs you to reconnect your store. Open Shopify in AXQEN and connect again." } }).catch(() => null);
      await reportError("Shopify token upgrade", new Error(`Old token could not be upgraded: ${reason}`), shop);
      return null;
    }
    await prisma.shopifyStore.update({ where: { id: storeId }, data: { ...tokenFields(t), lastSyncError: null } });
    await prisma.platformConfig.deleteMany({ where: { key: upgradeKey(storeId) } }).catch(() => null);
    console.log(`[shopify] migrated ${shop} to an expiring offline token`);
    return t.access_token;
  } catch (err) {
    console.warn(`[shopify] token migration failed for ${shop}:`, err);
    return null;
  }
}

/** Returns a usable access token for the store, refreshing it first if it is about to expire. */
export async function getShopifyAccessToken(storeId: string): Promise<string> {
  const store = await prisma.shopifyStore.findUnique({ where: { id: storeId } });
  if (!store) throw new Error("Shopify store not found");

  const clientId = store.clientId || process.env.SHOPIFY_API_KEY;
  const clientSecret = (store.clientSecret ? decrypt(store.clientSecret) : "") || process.env.SHOPIFY_API_SECRET;

  const expiresAt = store.accessTokenExpiresAt?.getTime();
  if (!expiresAt) {
    // Old non-expiring token: Shopify now blocks these, so swap it once for an expiring pair.
    if (store.accessToken && clientId && clientSecret && !(await upgradeRecentlyFailed(storeId))) {
      const migrated = await migrateToExpiringToken(storeId, store.storeUrl, clientId, clientSecret, decrypt(store.accessToken));
      if (migrated) return migrated;
    }
    return decrypt(store.accessToken);
  }
  if (expiresAt - Date.now() > 2 * 60_000 || !store.refreshToken) {
    return decrypt(store.accessToken);
  }

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

/** A sync problem only the seller can fix (paused store, removed access). Shown to them; not a system error. */
export class SellerActionError extends Error {}

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
// mode "install": started from Shopify (App Store / admin install), so there is no AXQEN seller yet (sellerId "").
type StatePayload = { sellerId: string; shop: string; mode: "platform" | "custom" | "install"; exp: number };

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
    if ((!p.sellerId && p.mode !== "install") || !p.shop || p.exp < Date.now()) return null;
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
    if (store?.clientSecret) secrets.add(decrypt(store.clientSecret));
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

// ── Installs started from Shopify (no AXQEN login yet) ────────────────────────
// After OAuth, if the store isn't linked to a seller yet, its tokens wait here (PlatformConfig, encrypted)
// until a seller logs in to AXQEN and claims the store with a signed link shown inside Shopify admin.
const PENDING_TTL_MS = 7 * 24 * 60 * 60_000;
const pendingKey = (shop: string) => `SHOPIFY_PENDING:${shop}`;
type PendingInstall = { storeName: string; at: number } & ReturnType<typeof tokenFields>;

export async function savePendingInstall(shop: string, storeName: string, t: TokenResponse) {
  const fields = tokenFields(t);
  const value = JSON.stringify({ storeName, at: Date.now(), ...fields });
  await prisma.platformConfig.upsert({ where: { key: pendingKey(shop) }, create: { key: pendingKey(shop), value, label: "Shopify install waiting for an AXQEN seller" }, update: { value } });
}

export async function getPendingInstall(shop: string): Promise<PendingInstall | null> {
  const row = await prisma.platformConfig.findUnique({ where: { key: pendingKey(shop) }, select: { value: true } });
  if (!row) return null;
  try {
    const p = JSON.parse(row.value) as PendingInstall & { accessTokenExpiresAt: string | null; refreshTokenExpiresAt: string | null };
    if (Date.now() - p.at > PENDING_TTL_MS) return null;
    return { ...p, accessTokenExpiresAt: p.accessTokenExpiresAt ? new Date(p.accessTokenExpiresAt) : null, refreshTokenExpiresAt: p.refreshTokenExpiresAt ? new Date(p.refreshTokenExpiresAt) : null };
  } catch { return null; }
}

export async function clearPendingInstall(shop: string) {
  await prisma.platformConfig.deleteMany({ where: { key: pendingKey(shop) } });
}

/** Signed, 7-day link payload that lets a logged-in seller claim a store installed from Shopify. */
export function signClaim(shop: string) {
  const body = Buffer.from(JSON.stringify({ shop, exp: Date.now() + PENDING_TTL_MS, k: "claim" })).toString("base64url");
  return `${body}.${createHmac("sha256", stateSecret()).update(body).digest("base64url")}`;
}

export function verifyClaim(token: string | null | undefined): string | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(sig, createHmac("sha256", stateSecret()).update(body).digest("base64url"))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { shop?: string; exp?: number; k?: string };
    return p.k === "claim" && p.shop && (p.exp ?? 0) > Date.now() ? normalizeShopDomain(p.shop) : null;
  } catch { return null; }
}

/** Shopify's OAuth permission page for the AXQEN AI app, for an install started from Shopify. */
export function installAuthorizeUrl(shop: string) {
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", process.env.SHOPIFY_API_KEY ?? "");
  url.searchParams.set("scope", PLATFORM_SCOPES);
  url.searchParams.set("redirect_uri", `${appUrl()}/api/shopify/callback`);
  url.searchParams.set("state", signState({ sellerId: "", shop, mode: "install" }));
  return url.toString();
}

/** Where Shopify shows AXQEN inside the merchant's admin. */
export function adminAppUrl(shop: string) {
  return `https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY ?? ""}`;
}


/** Decrypts a stored (encrypted) token, e.g. from a pending install. */
export function decryptToken(value: string) {
  return decrypt(value);
}
