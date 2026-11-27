import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPendingInstall, verifySessionToken } from "@/lib/shopify";

// GET with "Authorization: Bearer <App Bridge session token>" — live connection status for the AXQEN page
// inside the merchant's Shopify admin. The session token proves which store is asking.
export async function GET(req: NextRequest) {
  const shop = verifySessionToken(req.headers.get("authorization"));
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store = await prisma.shopifyStore.findFirst({
    where: { storeUrl: shop },
    select: { storeName: true, lastSyncAt: true, lastSyncError: true, sellerId: true, seller: { select: { brandName: true, name: true } } },
  });
  if (!store) {
    const pending = await getPendingInstall(shop);
    return NextResponse.json({ shop, connected: false, waitingForSeller: !!pending });
  }
  const orders = await prisma.order.count({ where: { sellerId: store.sellerId, source: "SHOPIFY" } });
  return NextResponse.json({
    shop, connected: true, storeName: store.storeName,
    account: store.seller.brandName || store.seller.name,
    lastSyncAt: store.lastSyncAt?.toISOString() ?? null, lastSyncError: store.lastSyncError, orders,
  });
}
