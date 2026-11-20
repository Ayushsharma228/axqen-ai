import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encrypt";
import { appUrl, normalizeShopDomain, signState } from "@/lib/shopify";

export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { storeUrl, clientId, clientSecret } = await req.json();
  if (!storeUrl || !clientId || !clientSecret) {
    return NextResponse.json({ error: "Store URL, Client ID, and Client Secret are required" }, { status: 400 });
  }

  const domain = normalizeShopDomain(storeUrl);
  if (!domain) return NextResponse.json({ error: "Enter a valid store name, e.g. mystore" }, { status: 400 });

  // Store credentials so callback can use them
  await prisma.shopifyStore.upsert({
    where: { sellerId: session.user.id },
    update: { storeUrl: domain, clientId, clientSecret: encrypt(clientSecret), accessToken: "" },
    create: { sellerId: session.user.id, storeUrl: domain, storeName: domain, accessToken: "", clientId, clientSecret: encrypt(clientSecret) },
  });

  const scopes = "read_products,write_products,read_orders,write_orders,read_inventory,write_inventory";
  const redirectUri = `${appUrl()}/api/shopify/callback`;
  const state = signState({ sellerId: session.user.id, shop: domain, mode: "custom" });

  const authUrl = `https://${domain}/admin/oauth/authorize?client_id=${encodeURIComponent(clientId)}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

  return NextResponse.json({ authUrl });
}
