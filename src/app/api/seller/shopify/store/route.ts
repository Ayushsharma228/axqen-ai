import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getRouteSession(req);
    if (!session || session.user.role !== "SELLER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const store = await prisma.shopifyStore.findUnique({
      where: { sellerId: session.user.id },
      select: { id: true, storeName: true, storeUrl: true, createdAt: true, lastSyncAt: true, lastSyncError: true },
    });

    // Extra numbers for the Shopify page (additive: existing callers only read `store`)
    let stats = null;
    if (store) {
      const IST = 5.5 * 3600000;
      const nowIst = new Date(Date.now() + IST);
      const dayStart = new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate()) - IST);
      const monthStart = new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), 1) - IST);
      const base = { sellerId: session.user.id, source: "SHOPIFY" as const, status: { not: "HIDDEN" as never } };
      const [today, month, lastOrder, live] = await Promise.all([
        prisma.order.count({ where: { ...base, createdAt: { gte: dayStart } } }),
        prisma.order.count({ where: { ...base, createdAt: { gte: monthStart } } }),
        prisma.order.findFirst({ where: base, orderBy: { createdAt: "desc" }, select: { createdAt: true, externalOrderId: true } }),
        prisma.listingRequest.findMany({
          where: { sellerId: session.user.id, platform: "SHOPIFY", status: "LISTED" },
          distinct: ["productId"], select: { productId: true },
        }),
      ]);
      stats = {
        ordersToday: today,
        ordersThisMonth: month,
        lastOrderAt: lastOrder?.createdAt.toISOString() ?? null,
        lastOrderNumber: lastOrder?.externalOrderId ?? null,
        productsLive: live.length,
      };
    }

    return NextResponse.json({ store, stats });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await prisma.shopifyStore.deleteMany({ where: { sellerId: session.user.id } });
  return NextResponse.json({ success: true });
}
