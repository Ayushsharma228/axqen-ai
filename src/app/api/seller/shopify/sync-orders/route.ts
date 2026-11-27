import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getShopifyAccessToken, shopifyGraphql } from "@/lib/shopify";
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
const LOCKED_STATUSES: OrderStatus[] = ["PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "CANCELLED", "RTO", "HIDDEN"];

// Fetch all Shopify orders with the GraphQL Admin API (cursor pagination, 100 per page),
// converted to the REST-style shape the rest of AXQEN (and stored rawData / webhooks) already uses.
const ORDERS_QUERY = `query Orders($after: String) {
  orders(first: 100, after: $after, sortKey: CREATED_AT, reverse: true) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id legacyResourceId name createdAt email phone currencyCode
      displayFinancialStatus displayFulfillmentStatus paymentGatewayNames
      totalPriceSet { shopMoney { amount } }
      customerJourneySummary { firstVisit { landingPage } }
      shippingAddress { firstName lastName address1 address2 city province zip phone }
      lineItems(first: 100) { nodes { title sku quantity originalUnitPriceSet { shopMoney { amount } } } }
    }
  }
}`;

type GqlOrder = {
  id: string; legacyResourceId: string; name: string; createdAt: string; email: string | null; phone: string | null; currencyCode: string;
  displayFinancialStatus: string | null; displayFulfillmentStatus: string; paymentGatewayNames: string[];
  totalPriceSet: { shopMoney: { amount: string } };
  customerJourneySummary: { firstVisit: { landingPage: string | null } | null } | null;
  shippingAddress: { firstName: string | null; lastName: string | null; address1: string | null; address2: string | null; city: string | null; province: string | null; zip: string | null; phone: string | null } | null;
  lineItems: { nodes: { title: string; sku: string | null; quantity: number; originalUnitPriceSet: { shopMoney: { amount: string } } }[] };
};

const FULFILLMENT: Record<string, string> = { FULFILLED: "fulfilled", PARTIALLY_FULFILLED: "partial", RESTOCKED: "restocked" };

/** GraphQL order → the REST-style object AXQEN stores and reads (same keys as order webhooks). */
function toRestOrder(o: GqlOrder): Record<string, unknown> {
  const gateways = (o.paymentGatewayNames ?? []).join(", ");
  return {
    id: Number(o.legacyResourceId), admin_graphql_api_id: o.id, name: o.name, created_at: o.createdAt,
    email: o.email, currency: o.currencyCode,
    financial_status: (o.displayFinancialStatus ?? "").toLowerCase(),
    fulfillment_status: FULFILLMENT[o.displayFulfillmentStatus] ?? null,
    payment_gateway: gateways.toLowerCase(), payment_gateway_names: o.paymentGatewayNames ?? [],
    payment_details: { payment_method_name: gateways },
    total_price: o.totalPriceSet?.shopMoney?.amount ?? "0",
    landing_site: o.customerJourneySummary?.firstVisit?.landingPage ?? null,
    // Buyer details come from the order and its shipping address (the Customer object would need read_customers).
    customer: { first_name: o.shippingAddress?.firstName ?? null, last_name: o.shippingAddress?.lastName ?? null, email: o.email, phone: o.phone ?? o.shippingAddress?.phone ?? null },
    shipping_address: o.shippingAddress,
    line_items: (o.lineItems?.nodes ?? []).map(li => ({ title: li.title, sku: li.sku, quantity: li.quantity, price: li.originalUnitPriceSet?.shopMoney?.amount ?? "0" })),
    source: "graphql",
  };
}

async function fetchAllShopifyOrders(
  storeUrl: string,
  accessToken: string,
): Promise<{ orders: Record<string, unknown>[]; pageCount: number }> {
  const orders: Record<string, unknown>[] = [];
  let after: string | null = null;
  let pageCount = 0;

  do {
    const data: { orders: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: GqlOrder[] } } =
      await shopifyGraphql(storeUrl, accessToken, ORDERS_QUERY, { after });
    orders.push(...data.orders.nodes.map(toRestOrder));
    pageCount++;
    after = data.orders.pageInfo.hasNextPage ? data.orders.pageInfo.endCursor : null;
    // Safety: bail out after 100 pages (~10,000 orders) to avoid runaway loops
  } while (after && pageCount < 100);

  return { orders, pageCount };
}

export async function syncShopifyOrders(sellerId: string): Promise<{ created: number; updated: number; pages: number }> {
  const store = await prisma.shopifyStore.findUnique({ where: { sellerId } });
  if (!store) return { created: 0, updated: 0, pages: 0 };

  let shopifyOrders: Record<string, unknown>[];
  let pageCount: number;

  try {
    const result = await fetchAllShopifyOrders(store.storeUrl, await getShopifyAccessToken(store.id));
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

    const sa = so.shipping_address as Record<string, unknown> | null;
    const customerAddress: Prisma.InputJsonValue | undefined = sa
      ? {
          // Combine address1 + address2 (Shopify splits flat/house into address2)
          address: [sa.address1 ?? "", sa.address2 ?? ""].filter(Boolean).join(", "),
          city:    (sa.city     as string) ?? "",
          state:   (sa.province as string) ?? "",
          pincode: (sa.zip      as string) ?? "",
          phone:   (sa.phone    as string) || (so.customer as Record<string, unknown> | null)?.phone as string || "",
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
      // For cancellations/refunds, honour Shopify unless the order is HIDDEN (user deleted it)
      const isCancellation = financialStatus === "refunded" || financialStatus === "voided";
      const isHidden = existing.status === OrderStatus.HIDDEN;
      const finalStatus: OrderStatus = isHidden ? OrderStatus.HIDDEN : isCancellation ? OrderStatus.CANCELLED : (isLocked ? existing.status : status);
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
