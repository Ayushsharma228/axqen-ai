import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encrypt";
import { getRouteSession } from "@/lib/session";
import { adminAppUrl, fetchShopName, appUrl, clearPendingInstall, exchangeCodeForToken, normalizeShopDomain, registerWebhooks, savePendingInstall, tokenFields, verifyOAuthHmac, verifyState } from "@/lib/shopify";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const shop  = normalizeShopDomain(searchParams.get("shop"));
  const fail  = (reason: string) => NextResponse.redirect(`${appUrl()}/seller/shopify?error=${reason}`);

  if (!code || !shop) return fail("denied");

  // The state was signed when this seller started the connection; it must match the logged-in seller and shop.
  const state = verifyState(searchParams.get("state"));
  if (!state || state.shop !== shop) return fail("expired");
  if (state.mode === "install") return completeShopifyInstall(req, shop, code, searchParams);
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

  const storeName = await fetchShopName(shop, accessToken);

  const creds = state.mode === "platform" ? { clientId: null, clientSecret: null } : { clientId, clientSecret: encrypt(clientSecret) };
  await prisma.shopifyStore.upsert({
    where:  { sellerId },
    create: { sellerId, storeName, storeUrl: shop, ...tokenFields(tokenData), ...creds },
    update: { storeName, storeUrl: shop, ...tokenFields(tokenData), lastSyncError: null, lastSyncAt: null, ...creds },
  });

  await registerWebhooks(shop, accessToken).catch((err) => console.error("[shopify/callback] webhook registration failed:", err));

  return NextResponse.redirect(`${appUrl()}/seller/shopify?connected=1`);
}

/**
 * Install started from Shopify (no AXQEN seller in the state). After approval:
 *  - store already belongs to a seller → refresh its access
 *  - a seller is logged in to AXQEN in this browser and has no other store → connect it to them
 *  - otherwise → hold the tokens; the page inside Shopify admin asks the merchant to log in to AXQEN to finish
 * Then back to AXQEN inside the Shopify admin.
 */
async function completeShopifyInstall(req: NextRequest, shop: string, code: string, searchParams: URLSearchParams) {
  const clientId = process.env.SHOPIFY_API_KEY ?? "";
  const clientSecret = process.env.SHOPIFY_API_SECRET ?? "";
  const failText = (msg: string) => new NextResponse(msg, { status: 400 });
  if (!clientId || !clientSecret) return failText("AXQEN AI isn't configured yet. Please contact AXQEN support.");
  if (!verifyOAuthHmac(searchParams, clientSecret)) return failText("This approval didn't come from Shopify. Please try installing again.");

  const tokenData = await exchangeCodeForToken(shop, clientId, clientSecret, code);
  if (!tokenData.access_token) return failText("Shopify didn't return access. Please try installing again.");

  const storeName = await fetchShopName(shop, tokenData.access_token);

  const owner = await prisma.shopifyStore.findFirst({ where: { storeUrl: shop }, select: { sellerId: true } });
  const session = await getRouteSession(req);
  const sellerId = owner?.sellerId
    ?? (session?.user.role === "SELLER" && !(await prisma.shopifyStore.findUnique({ where: { sellerId: session.user.id }, select: { id: true } })) ? session.user.id : null);

  if (sellerId) {
    await prisma.shopifyStore.upsert({
      where:  { sellerId },
      create: { sellerId, storeName, storeUrl: shop, ...tokenFields(tokenData), clientId: null, clientSecret: null },
      update: { storeName, storeUrl: shop, ...tokenFields(tokenData), clientId: null, clientSecret: null, lastSyncError: null },
    });
    await prisma.platformConfig.deleteMany({ where: { key: `SHOPIFY_TOKEN_UPGRADE_FAIL:${(await prisma.shopifyStore.findUnique({ where: { sellerId }, select: { id: true } }))?.id ?? ""}` } }).catch(() => null);
    await clearPendingInstall(shop);
    await registerWebhooks(shop, tokenData.access_token).catch(err => console.error("[shopify/install] webhook registration failed:", err));
  } else {
    await savePendingInstall(shop, storeName, tokenData);
  }
  return NextResponse.redirect(adminAppUrl(shop));
}

