import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encrypt";
import { getRouteSession } from "@/lib/session";
import { SHOPIFY_API_VERSION, appUrl, exchangeCodeForToken, normalizeShopDomain, registerWebhooks, tokenFields, verifyOAuthHmac, verifyState } from "@/lib/shopify";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const shop  = normalizeShopDomain(searchParams.get("shop"));
  const fail  = (reason: string) => NextResponse.redirect(`${appUrl()}/seller/shopify?error=${reason}`);

  if (!code || !shop) return fail("denied");

  // The state was signed when this seller started the connection; it must match the logged-in seller and shop.
  const state = verifyState(searchParams.get("state"));
  if (!state || state.shop !== shop) return fail("expired");
  const session = await getRouteSession(req);
  if (!session || session.user.id !== state.sellerId) return fail("session");
  const sellerId = state.sellerId;

  // Platform connections use the AXQEN AI app; "custom" is the older per-seller app flow.
  let clientId = process.env.SHOPIFY_API_KEY ?? "";
  let clientSecret = process.env.SHOPIFY_API_SECRET ?? "";
  if (state.mode === "custom") {
    const stored = await prisma.shopifyStore.findUnique({ where: { sellerId }, select: { clientId: true, clientSecret: true } });
    if (!stored?.clientId || !stored.clientSecret) return fail("error");
    clientId = stored.clientId;
    clientSecret = decrypt(stored.clientSecret);
  }
  if (!clientId || !clientSecret) return fail("not_configured");
  if (!verifyOAuthHmac(searchParams, clientSecret)) return fail("error");

  const tokenData = await exchangeCodeForToken(shop, clientId, clientSecret, code);
  if (!tokenData.access_token) return fail("error");
  const accessToken = tokenData.access_token;

  // One store can belong to only one seller.
  const owner = await prisma.shopifyStore.findFirst({ where: { storeUrl: shop }, select: { sellerId: true } });
  if (owner && owner.sellerId !== sellerId) return fail("store_in_use");

  const shopRes = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/shop.json`, {
    headers: { "X-Shopify-Access-Token": accessToken },
  });
  const shopData = (await shopRes.json().catch(() => ({}))) as { shop?: { name?: string } };
  const storeName = shopData.shop?.name ?? shop;

  const creds = state.mode === "platform" ? { clientId: null, clientSecret: null } : { clientId, clientSecret: encrypt(clientSecret) };
  await prisma.shopifyStore.upsert({
    where:  { sellerId },
    create: { sellerId, storeName, storeUrl: shop, ...tokenFields(tokenData), ...creds },
    update: { storeName, storeUrl: shop, ...tokenFields(tokenData), lastSyncError: null, lastSyncAt: null, ...creds },
  });

  await registerWebhooks(shop, accessToken).catch((err) => console.error("[shopify/callback] webhook registration failed:", err));

  return NextResponse.redirect(`${appUrl()}/seller/shopify?connected=1`);
}
