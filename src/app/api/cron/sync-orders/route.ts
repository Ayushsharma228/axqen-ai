import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncShopifyOrders } from "@/app/api/seller/shopify/sync-orders/route";
import { syncForSeller as syncAmazonOrders } from "@/app/api/seller/amazon/sync-orders/route";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: { sellerId: string; shopify?: { created: number; updated: number; pages: number } | string; amazon?: number | string }[] = [];

  const shopifySellers = await prisma.shopifyStore.findMany({ select: { sellerId: true } });
  const amazonSellers = await prisma.marketplaceAccount.findMany({
    where: { platform: "AMAZON", isActive: true },
    select: { sellerId: true },
  });

  const sellerIds = new Set([
    ...shopifySellers.map((s) => s.sellerId),
    ...amazonSellers.map((s) => s.sellerId),
  ]);

  for (const sellerId of sellerIds) {
    const row: (typeof results)[0] = { sellerId };

    if (shopifySellers.some((s) => s.sellerId === sellerId)) {
      try {
        row.shopify = await syncShopifyOrders(sellerId);
      } catch (err) {
        row.shopify = err instanceof Error ? err.message : "error";
      }
    }

    if (amazonSellers.some((s) => s.sellerId === sellerId)) {
      try {
        const r = await syncAmazonOrders(sellerId);
        row.amazon = r.created + r.updated;
      } catch (err) {
        row.amazon = err instanceof Error ? err.message : "error";
      }
    }

    results.push(row);
  }

  return NextResponse.json({ ok: true, processed: sellerIds.size, results });
}
