import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appUrl, getShopifyAccessToken, installAuthorizeUrl, normalizeShopDomain, shopifyGraphql, verifyOAuthHmac } from "@/lib/shopify";

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

  // Loaded inside the Shopify admin frame: Shopify's permission page can't open in a frame, so App Bridge
  // sends the whole admin window there.
  const apiKey = process.env.SHOPIFY_API_KEY ?? "";
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="shopify-api-key" content="${apiKey}">
<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
</head><body style="font-family:Inter,Arial,sans-serif;padding:24px;color:#0F1729">
<p>Taking you to Shopify to approve AXQEN AI…</p>
<script>window.open(${JSON.stringify(authorize)}, "_top");</script>
</body></html>`;
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": `frame-ancestors https://${shop} https://admin.shopify.com;`,
    },
  });
}
