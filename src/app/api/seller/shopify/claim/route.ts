import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { adminAppUrl, clearPendingInstall, decryptToken, getPendingInstall, registerWebhooks, verifyClaim } from "@/lib/shopify";

// POST { t } — the logged-in seller links a Shopify store that was installed from Shopify
// (the signed link comes from the AXQEN page inside the merchant's Shopify admin).
export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") return NextResponse.json({ error: "Log in with your AXQEN seller account" }, { status: 401 });

  const { t } = await req.json().catch(() => ({}));
  const shop = verifyClaim(typeof t === "string" ? t : null);
  if (!shop) return NextResponse.json({ error: "This link has expired. Open AXQEN AI in your Shopify admin and click the button again." }, { status: 400 });

  const sellerId = session.user.id;
  const owner = await prisma.shopifyStore.findFirst({ where: { storeUrl: shop }, select: { sellerId: true } });
  if (owner) {
    return owner.sellerId === sellerId
      ? NextResponse.json({ ok: true, shop, already: true, adminUrl: adminAppUrl(shop) })
      : NextResponse.json({ error: "This Shopify store is already connected to another AXQEN account. Contact AXQEN support." }, { status: 409 });
  }
  const mine = await prisma.shopifyStore.findUnique({ where: { sellerId }, select: { storeUrl: true } });
  if (mine) return NextResponse.json({ error: `Your account is already connected to ${mine.storeUrl}. Disconnect it first, then click the link again.` }, { status: 409 });

  const pending = await getPendingInstall(shop);
  if (!pending) return NextResponse.json({ error: "This store's approval has expired. Open AXQEN AI in your Shopify admin to approve it again." }, { status: 400 });

  await prisma.shopifyStore.create({
    data: {
      sellerId, storeName: pending.storeName, storeUrl: shop, clientId: null, clientSecret: null,
      accessToken: pending.accessToken, refreshToken: pending.refreshToken,
      accessTokenExpiresAt: pending.accessTokenExpiresAt, refreshTokenExpiresAt: pending.refreshTokenExpiresAt,
    },
  });
  await clearPendingInstall(shop);
  await registerWebhooks(shop, decryptToken(pending.accessToken)).catch(err => console.error("[shopify/claim] webhook registration failed:", err));
  return NextResponse.json({ ok: true, shop, storeName: pending.storeName, adminUrl: adminAppUrl(shop) });
}
