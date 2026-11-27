import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appUrl, installAuthorizeUrl, normalizeShopDomain, verifyOAuthHmac } from "@/lib/shopify";

// App URL for the AXQEN AI Shopify app. Shopify opens this when a merchant installs or opens the app.
// Shopify's rule: authenticate with OAuth immediately, before showing anything. So:
//   - store not connected through the AXQEN AI app yet → straight to Shopify's permission screen
//   - already connected → the AXQEN page inside Shopify admin (/shopify/app)
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

  // Connected through the platform app = no per-seller client id, and an expiring token (new-style).
  const store = await prisma.shopifyStore.findFirst({ where: { storeUrl: shop, clientId: null, accessTokenExpiresAt: { not: null } }, select: { id: true } });
  if (store) return NextResponse.redirect(`${appUrl()}/shopify/app?${sp.toString()}`);

  const authorize = installAuthorizeUrl(shop);
  if (sp.get("embedded") !== "1") return NextResponse.redirect(authorize);

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
