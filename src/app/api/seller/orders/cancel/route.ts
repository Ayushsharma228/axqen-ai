import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getShopifyAccessToken } from "@/lib/shopify";

export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await req.json();
  if (!orderId) {
    return NextResponse.json({ error: "Order ID required" }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, sellerId: session.user.id },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status === "CANCELLED") {
    return NextResponse.json({ error: "Order already cancelled" }, { status: 400 });
  }

  // Cancel on Shopify if it's a Shopify order
  if (order.source === "SHOPIFY") {
    const store = await prisma.shopifyStore.findUnique({
      where: { sellerId: session.user.id },
    });

    if (store) {
      // Get numeric Shopify order ID from rawData
      const rawData = order.rawData as { id?: number | string } | null;
      const shopifyOrderId = rawData?.id;

      if (shopifyOrderId) {
        const cancelRes = await fetch(
          `https://${store.storeUrl}/admin/api/2025-01/orders/${shopifyOrderId}/cancel.json`,
          {
            method: "POST",
            headers: {
              "X-Shopify-Access-Token": await getShopifyAccessToken(store.id),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ reason: "customer" }),
          }
        );

        if (!cancelRes.ok) {
          const err = await cancelRes.json();
          return NextResponse.json(
            { error: err.errors ?? "Failed to cancel on Shopify" },
            { status: 400 }
          );
        }
      }
    }
  }

  // Update status in our DB
  await prisma.order.update({
    where: { id: orderId },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json({ success: true });
}
