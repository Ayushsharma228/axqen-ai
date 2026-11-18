import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import crypto from "crypto";

const APP_ID       = "amzn1.sp.solution.c3c38782-a77e-492d-b3bc-fb63c2732a5a";
// Must match the OAuth Redirect URI registered on the Amazon SP-API app exactly.
const CALLBACK_URL = process.env.AMAZON_REDIRECT_URI ?? "https://www.axqen.app/api/seller/amazon/callback";

const SC_URLS: Record<string, string> = {
  IN: "https://sellercentral.amazon.in",
  US: "https://sellercentral.amazon.com",
  UK: "https://sellercentral.amazon.co.uk",
  DE: "https://sellercentral.amazon.de",
  AE: "https://sellercentral.amazon.ae",
  JP: "https://sellercentral.amazon.co.jp",
};

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const marketplace = req.nextUrl.searchParams.get("marketplace") ?? "IN";
  const state       = crypto.randomBytes(20).toString("hex");

  // Pack state + context into a signed cookie value
  const cookiePayload = Buffer.from(JSON.stringify({
    state,
    sellerId:    session.user.id,
    marketplace,
  })).toString("base64url");

  const scBase  = SC_URLS[marketplace] ?? SC_URLS.IN;
  const authUrl = `${scBase}/apps/authorize/consent?application_id=${APP_ID}&state=${state}&redirect_uri=${encodeURIComponent(CALLBACK_URL)}&version=beta`;

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("amz_oauth", cookiePayload, {
    httpOnly: true,
    secure:   true,
    sameSite: "lax",
    maxAge:   600,
    path:     "/",
  });
  return res;
}
