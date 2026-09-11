import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { OrderStatus, Prisma } from "@prisma/client";
import { decrypt } from "@/lib/encrypt";
import { inferPaymentMode } from "@/app/api/webhooks/shopify/orders/route";
import { ORDER_EVENTS } from "@/app/api/webhooks/shopify/orders/route";

function extractUtm(landingSite: string | null | undefined) {
  if (!landingSite) return { utmSource: null, utmMedium: null, utmCampaign: null };
  try {
    const url = new URL(landingSite.startsWith("http") ? landingSite : `https://x.com${landingSite}`);
    return {
      utmSource:   url.searchParams.get("utm_source"),
      utmMedium:   url.searchParams.get("utm_medium"),
      utmCampaign: url.searchParams.get("utm_campaign"),
    };
  } catch {
    return { utmSource: null, utmMedium: null, utmCampaign: null };
  }
}

function mapShopifyStatus(financial: string, fulfillment: string | null): OrderStatus {
  if (financial === "refunded" || financial === "voided") return OrderStatus.CANCELLED;
  if (fulfillment === "fulfilled") return OrderStatus.DELIVERED;
  if (fulfillment === "partial") return OrderStatus.SHIPPED;
  if (financial === "paid") return OrderStatus.PROCESSING;
  return OrderStatus.NEW;
}

// Orders in these states are locked — Shopify status does not overwrite AXQEN state.
const LOCKED_STATUSES: OrderStatus[] = ["PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "CANCELLED", "RTO"];

// Fetch all Shopify orders using cursor-based pagination (max 250/page).
// Returns the complete order list across all pages.
async function fetchAllShopifyOrders(
  storeUrl: string,
  accessToken: string,
): Promise<{ orders: Record<string, unknown>[]; pageCount: number }> {
  const orders: Record<string, unknown>[] = [];
  let url: string | null = `https://${storeUrl}/admin/api/2025-01/orders.json?status=any&limit=250`;
  let pageCount = 0;

  while (url) {
    const shopRes = await fetch(url, {
      headers: { "X-Shopify-Access-Token": accessToken },
    });

    if (!shopRes.ok) {
      throw new Error(`Shopify ${shopRes.status}: ${await shopRes.text()}`);
    }

    const data = await shopRes.json() as { orders?: Record<string, unknown>[] };
    const pageOrders = data.orders ?? [];
    orders.push(...pageOrders);
    pageCount++;

    // Follow the Link header for cursor-based pagination
    const linkHeader: string = shopRes.headers.get("Link") ?? "";
    const nextMatch: RegExpMatchArray | null = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    url = nextMatch ? nextMatch[1] : null;

    // Safety: bail out after 40 pages (~10,000 orders) to avoid runaway loops
    if (pageCount >= 40) break;
  }

  return { orders, pageCount };
}

export async function syncShopifyOrders(sellerId: string): Promise<{ created: number; updated: number; pages: number }> {
  const store = await prisma.shopifyStore.findUnique({ where: { sellerId } });
  if (!store) return { created: 0, updated: 0, pages: 0 };

  let shopifyOrders: Record<string, unknown>[];
  let pageCount: number;

  try {
    const result = await fetchAllShopifyOrders(store.storeUrl, decrypt(store.accessToken));
    shopifyOrders = result.orders;
    pageCount = result.pageCount;
  } catch (err) {
    // Record the sync failure on the store record
    const msg = err instanceof Error ? err.message : "Unknown sync error";
    await prisma.shopifyStore.update({
      where: { sellerId },
      data: { lastSyncError: msg },
    });
    throw err;
  }

  // Load existing orders (id + externalOrderId + operational state for lock check)
  const existingOrders = await prisma.order.findMany({
    where: { sellerId, source: "SHOPIFY" },
    select: { id: true, externalOrderId: true, status: true, awbNumber: true, courier: true },
  });
  const existingMap = new Map(existingOrders.map((o) => [o.externalOrderId, o]));

  type OrderCreateInput = Prisma.OrderCreateManyInput;
  const toCreate: OrderCreateInput[] = [];
  const toUpdate: {
    id: string; status: OrderStatus; paymentMode: import("@prisma/client").PaymentMode;
    customerName: string | null; customerEmail: string | null;
    customerAddress: Prisma.InputJsonValue | undefined;
    totalAmount: number; rawData: Prisma.InputJsonValue;
    utmSource: string | null; utmMedium: string | null; utmCampaign: string | null;
  }[] = [];

  // Only collect externalOrderIds in this sync batch for safe item replacement
  const syncedExternalIds: string[] = [];

  for (const so of shopifyOrders) {
    const externalId = (so.name as string) ?? String(so.id);
    const financialStatus = (so.financial_status as string) ?? "";
    const fulfillmentStatus: string | null = (so.fulfillment_status as string | null) ?? null;
    const status = mapShopifyStatus(financialStatus, fulfillmentStatus);
    const paymentMode = inferPaymentMode(so);

    const customerAddress: Prisma.InputJsonValue | undefined = so.shipping_address
      ? {
          address: (so.shipping_address as Record<string, unknown>).address1 ?? "",
          city:    (so.shipping_address as Record<string, unknown>).city ?? "",
          state:   (so.shipping_address as Record<string, unknown>).province ?? "",
          pincode: (so.shipping_address as Record<string, unknown>).zip ?? "",
          phone:   (so.shipping_address as Record<string, unknown>).phone || (so.customer as Record<string, unknown> | null)?.phone || "",
        }
      : undefined;
    const customerName = so.customer
      ? `${(so.customer as Record<string, unknown>).first_name ?? ""} ${(so.customer as Record<string, unknown>).last_name ?? ""}`.trim() || null
      : null;
    const utm = extractUtm(so.landing_site as string | undefined);
    const existing = existingMap.get(externalId);

    syncedExternalIds.push(externalId);

    if (existing) {
      const isLocked = existing.awbNumber || existing.courier || LOCKED_STATUSES.includes(existing.status);
      // For cancellations/refunds, always honour Shopify even if locked
      const isCancellation = financialStatus === "refunded" || financialStatus === "voided";
      const finalStatus: OrderStatus = isCancellation ? OrderStatus.CANCELLED : (isLocked ? existing.status : status);
      toUpdate.push({
        id: existing.id,
        status: finalStatus,
        paymentMode,
        customerName,
        customerEmail: (so.email as string) || (so.customer as Record<string, unknown> | null)?.email as string || null,
        customerAddress,
        totalAmount: parseFloat(so.total_price as string),
        rawData: so as Prisma.InputJsonValue,
        ...utm,
      });
    } else {
      toCreate.push({
        sellerId,
        externalOrderId: externalId,
        source: "SHOPIFY",
        status,
        paymentMode,
        customerName,
        customerEmail: (so.email as string) || (so.customer as Record<string, unknown> | null)?.email as string || null,
        customerAddress,
        totalAmount: parseFloat(so.total_price as string),
        currency: (so.currency as string) ?? "INR",
        rawData: so as Prisma.InputJsonValue,
        ...utm,
        ...(so.created_at ? { createdAt: new Date(so.created_at as string) } : {}),
      });
    }
  }

  if (toCreate.length > 0) await prisma.order.createMany({ data: toCreate, skipDuplicates: true });
  if (toUpdate.length > 0) {
    await Promise.all(
      toUpdate.map((u) =>
        prisma.order.update({
          where: { id: u.id },
          data: {
            status: u.status,
            paymentMode: u.paymentMode,
            customerName: u.customerName,
            customerEmail: u.customerEmail,
            customerAddress: u.customerAddress,
            totalAmount: u.totalAmount,
            rawData: u.rawData,
            utmSource: u.utmSource,
            utmMedium: u.utmMedium,
            utmCampaign: u.utmCampaign,
          },
        })
      )
    );
  }

  // Rebuild order items ONLY for the orders included in this sync batch.
  // Never touch items for orders that were not part of this fetch (older orders on pages we fetched).
  // Use the externalOrderIds from the current batch to scope the delete+recreate.
  if (syncedExternalIds.length > 0) {
    const batchOrders = await prisma.order.findMany({
      where: { sellerId, source: "SHOPIFY", externalOrderId: { in: syncedExternalIds } },
      select: { id: true, externalOrderId: true },
    });
    const batchOrderIdMap = new Map(batchOrders.map((o) => [o.externalOrderId, o.id]));
    const batchOrderIds = batchOrders.map((o) => o.id);

    // Delete items only for THIS batch's orders, then recreate from Shopify data
    if (batchOrderIds.length > 0) {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: batchOrderIds } } });
    }

    type ItemCreateInput = { orderId: string; name: string; sku: string | null; quantity: number; price: number };
    const allItems: ItemCreateInput[] = [];
    for (const so of shopifyOrders) {
      const externalId = (so.name as string) ?? String(so.id);
      const orderId = batchOrderIdMap.get(externalId);
      if (orderId && (so.line_items as Array<unknown>)?.length) {
        for (const item of so.line_items as { title: string; sku?: string; quantity: number; price: string }[]) {
          allItems.push({ orderId, name: item.title, sku: item.sku || null, quantity: item.quantity, price: parseFloat(item.price) });
        }
      }
    }
    if (allItems.length > 0) await prisma.orderItem.createMany({ data: allItems });
  }

  // Record successful sync timestamp and clear any prior error
  await prisma.shopifyStore.update({
    where: { sellerId },
    data: { lastSyncAt: new Date(), lastSyncError: null },
  });

  return { created: toCreate.length, updated: toUpdate.length, pages: pageCount };
}

export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncShopifyOrders(session.user.id);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    const status = msg.startsWith("Shopify 401") || msg.startsWith("Shopify 403") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
