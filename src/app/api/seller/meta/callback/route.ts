import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encrypt";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/seller/profile?meta=denied`);
  }

  const sellerId = Buffer.from(state, "base64").toString("utf8");

  const appId      = process.env.META_APP_ID!;
  const appSecret  = process.env.META_APP_SECRET!;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/seller/meta/callback`;

  // Exchange code for access token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
  );
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/seller/settings?meta=error`);
  }

  // Exchange for long-lived token (60 days)
  const longRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
  );
  const longData = await longRes.json();
  const accessToken = longData.access_token || tokenData.access_token;
  const expiresIn   = longData.expires_in ?? 5184000; // default 60 days

  // Fetch their ad accounts
  const adRes = await fetch(
    `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`
  );
  const adData = await adRes.json();
  const adAccount = adData.data?.[0]; // use first active ad account

  await prisma.user.update({
    where: { id: sellerId },
    data: {
      metaAccessToken:    encrypt(accessToken),
      metaAdAccountId:    adAccount?.id ?? null,
      metaTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
    },
  });

  return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/seller/profile?meta=connected`);
}
