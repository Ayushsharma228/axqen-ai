import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getShopifyAccessToken, registerWebhooks } from "@/lib/shopify";

export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = await prisma.shopifyStore.findUnique({ where: { sellerId: session.user.id } });
  if (!store) return NextResponse.json({ error: "No Shopify store connected" }, { status: 400 });

  const results = await registerWebhooks(store.storeUrl, await getShopifyAccessToken(store.id));
  return NextResponse.json({ ok: results.every((r) => r.status !== "failed"), results });
}
