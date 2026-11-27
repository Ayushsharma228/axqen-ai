import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appUrl, getPendingInstall, getShopifyAccessToken, installAuthorizeUrl, normalizeShopDomain, shopifyGraphql, topLevelRedirectResponse, verifyOAuthHmac } from "@/lib/shopify";

// App URL for the AXQEN AI Shopify app. Shopify opens this when a merchant installs or opens the app.
// Shopify's rule: authenticate with OAuth immediately after install AND reinstall, before showing anything. So:
//   - opened outside the admin frame (that's what an install/reinstall does) → always Shopify's permission screen
//   - opened inside the admin, and AXQEN holds a working token for the store → the AXQEN page (/shopify/app)
//   - opened inside the admin without a working token → permission screen (top window, via App Bridge)
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const shop = normalizeShopDomain(sp.get("shop"));
  const secret = process.env.SHOPIFY_API_SECRET ?? "";
  if (!shop || !secret || !verifyOAuthHmac(sp, secret)) {
    return new NextResponse("This link didn't come from Shopify. Open AXQEN AI from your Shopify admin.", { status: 400 });
  }
  const ts = Number(sp.get("timestamp") ?? 0);
  if (!ts || Math.abs(Date.now() / 1000 - ts) > 600) {
    return new NextResponse("This link has expired. Open AXQEN AI again from your Shopify admin.", { status: 400 });
  }

  const authorize = installAuthorizeUrl(shop);
  if (sp.get("embedded") !== "1") return NextResponse.redirect(authorize);

  // Inside the admin: only skip OAuth when the stored token really works (a stale row after a missed
  // uninstall webhook must not bypass authentication on reinstall).
  const store = await prisma.shopifyStore.findFirst({ where: { storeUrl: shop, clientId: null, accessTokenExpiresAt: { not: null } }, select: { id: true } });
  if (store) {
    const works = await getShopifyAccessToken(store.id)
      .then(token => shopifyGraphql(shop, token, `{ shop { id } }`))
      .then(() => true, () => false);
    if (works) return NextResponse.redirect(`${appUrl()}/shopify/app?${sp.toString()}`);
  }
  // Just approved but not linked to an AXQEN seller yet: show the app ("Finish connecting"), don't loop back to OAuth.
  if (!store && (await getPendingInstall(shop))) return NextResponse.redirect(`${appUrl()}/shopify/app?${sp.toString()}`);

  // Inside the admin frame: Shopify's permission page can't open in a frame, so move the whole window.
  return topLevelRedirectResponse(shop, authorize);
}
