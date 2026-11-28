import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { clearLoginFailures, isLoginLocked, LOCKED_MESSAGE, recordLoginFailure } from "@/lib/auth";
import { clearPendingInstall, decryptToken, getPendingInstall, registerWebhooks, verifySessionToken } from "@/lib/shopify";

// POST { email, password } with "Authorization: Bearer <App Bridge session token>".
// Lets a merchant link the store they just installed AXQEN AI on to their AXQEN seller account without
// leaving the Shopify admin (new tabs and cookies don't work reliably inside the admin frame).
// The session token proves which store is asking; the password proves which AXQEN account.
export async function POST(req: NextRequest) {
  const shop = verifySessionToken(req.headers.get("authorization"));
  if (!shop) return NextResponse.json({ error: "Open AXQEN AI from your Shopify admin and try again." }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { email?: string; password?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email || !password) return NextResponse.json({ error: "Enter your AXQEN email and password." }, { status: 400 });
  if (await isLoginLocked(email)) return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 429 });

  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, password: true, role: true } });
  const ok = user ? await bcrypt.compare(password, user.password) : false;
  if (!user || !ok) {
    await recordLoginFailure(email);
    return NextResponse.json({ error: "That email and password don't match. Check them and try again." }, { status: 400 });
  }
  await clearLoginFailures(email);
  if (user.role !== "SELLER") return NextResponse.json({ error: "Log in with an AXQEN seller account." }, { status: 403 });

  const owner = await prisma.shopifyStore.findFirst({ where: { storeUrl: shop }, select: { sellerId: true } });
  if (owner) {
    return owner.sellerId === user.id
      ? NextResponse.json({ ok: true, already: true })
      : NextResponse.json({ error: "This Shopify store is already connected to another AXQEN account. Contact connect@vrinandyaventures.in." }, { status: 409 });
  }
  const mine = await prisma.shopifyStore.findUnique({ where: { sellerId: user.id }, select: { storeUrl: true } });
  if (mine) return NextResponse.json({ error: `This AXQEN account is already connected to ${mine.storeUrl}. Disconnect it in AXQEN first, or use another account.` }, { status: 409 });

  const pending = await getPendingInstall(shop);
  if (!pending) return NextResponse.json({ error: "This store's approval has expired. Reopen AXQEN AI from your Shopify admin to approve it again." }, { status: 400 });

  await prisma.shopifyStore.create({
    data: {
      sellerId: user.id, storeName: pending.storeName, storeUrl: shop, clientId: null, clientSecret: null,
      accessToken: pending.accessToken, refreshToken: pending.refreshToken,
      accessTokenExpiresAt: pending.accessTokenExpiresAt, refreshTokenExpiresAt: pending.refreshTokenExpiresAt,
    },
  });
  await clearPendingInstall(shop);
  await registerWebhooks(shop, decryptToken(pending.accessToken)).catch(err => console.error("[shopify/link] webhook registration failed:", err));
  return NextResponse.json({ ok: true });
}
