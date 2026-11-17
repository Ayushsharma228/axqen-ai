import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { PLATFORM_SCOPES, appUrl, normalizeShopDomain, signState } from "@/lib/shopify";

// One-click connect through the AXQEN AI platform app: the seller only enters their store name.
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.redirect(`${appUrl()}/login`);
  }

  const shop = normalizeShopDomain(new URL(req.url).searchParams.get("shop"));
  if (!shop) return NextResponse.redirect(`${appUrl()}/seller/shopify?error=invalid_store`);

  const apiKey = process.env.SHOPIFY_API_KEY;
  if (!apiKey) return NextResponse.redirect(`${appUrl()}/seller/shopify?error=not_configured`);

  const state = signState({ sellerId: session.user.id, shop, mode: "platform" });
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", apiKey);
  url.searchParams.set("scope", PLATFORM_SCOPES);
  url.searchParams.set("redirect_uri", `${appUrl()}/api/shopify/callback`);
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
