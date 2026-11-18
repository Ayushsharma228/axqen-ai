import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encrypt";
import { MARKETPLACE_IDS } from "@/lib/amazon-sp";

const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code             = searchParams.get("spapi_oauth_code");
  const state            = searchParams.get("state");
  const sellingPartnerId = searchParams.get("selling_partner_id") ?? "";

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/seller/amazon?error=${reason}`, req.url));

  if (!code || !state) return fail("missing_params");

  // Verify state cookie
  const raw = req.cookies.get("amz_oauth")?.value;
  if (!raw) return fail("no_state_cookie");

  let ctx: { state: string; sellerId: string; marketplace: string };
  try {
    ctx = JSON.parse(Buffer.from(raw, "base64url").toString());
  } catch {
    return fail("bad_cookie");
  }

  if (ctx.state !== state) return fail("state_mismatch");

  // Exchange auth code → refresh token
  const tokenRes = await fetch(LWA_TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      grant_type:    "authorization_code",
      code,
      redirect_uri:  process.env.AMAZON_REDIRECT_URI ?? "https://www.axqen.app/api/seller/amazon/callback",
      client_id:     process.env.AMAZON_CLIENT_ID!,
      client_secret: process.env.AMAZON_CLIENT_SECRET!,
    }),
  });

  if (!tokenRes.ok) {
    console.error("[amazon/callback] token exchange:", await tokenRes.text());
    return fail("token_exchange_failed");
  }

  const tokens = await tokenRes.json() as { refresh_token: string };
  if (!tokens.refresh_token) return fail("no_refresh_token");

  const marketplace = MARKETPLACE_IDS[ctx.marketplace] ?? MARKETPLACE_IDS.IN;
  const credentials = {
    sellerId:           sellingPartnerId,
    marketplaceId:      marketplace.id,
    marketplaceCountry: ctx.marketplace,
    region:             marketplace.region,
    refreshToken:       encrypt(tokens.refresh_token),
    connectedAt:        new Date().toISOString(),
    lastSyncAt:         null,
  };

  await prisma.marketplaceAccount.upsert({
    where:  { sellerId_platform: { sellerId: ctx.sellerId, platform: "AMAZON" } },
    create: { sellerId: ctx.sellerId, platform: "AMAZON", isActive: true, credentials },
    update: { isActive: true, credentials },
  });

  const res = NextResponse.redirect(new URL("/seller/amazon?connected=oauth", req.url));
  res.cookies.delete("amz_oauth");
  return res;
}
