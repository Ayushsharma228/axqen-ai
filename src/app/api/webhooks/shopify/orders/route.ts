import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rankSuppliers } from "@/lib/automation/supplier-assignment";
import { getConfig, requestCODVerification } from "@/lib/hillteck";
import crypto from "crypto";
import { PaymentMode } from "@prisma/client";

// Structured event type constants shared across webhook + sync
export const ORDER_EVENTS = {
  ORDER_CREATED:           "ORDER_CREATED",
  ORDER_UPDATED:           "ORDER_UPDATED",
  ORDER_PAID:              "ORDER_PAID",
  ORDER_CANCELLED:         "ORDER_CANCELLED",
  ORDER_FULFILLED:         "ORDER_FULFILLED",
  SUPPLIER_ASSIGNED:       "SUPPLIER_ASSIGNED",
  PURCHASE_ORDER_CREATED:  "PURCHASE_ORDER_CREATED",
  PAYMENT_MODE_SET:        "PAYMENT_MODE_SET",
} as const;

// Fail CLOSED — reject all requests when secret is not configured.
// Never fall back to accepting unauthenticated webhooks.
function verifyHmac(body: string, hmacHeader: string | null): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Shopify Webhook] SHOPIFY_WEBHOOK_SECRET is not set — rejecting request. Configure this env var in Vercel.");
    return false;
  }
  if (!hmacHeader) return false;
  const digest = crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
}

function generatePoNumber(): string {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PO-${datePart}-${rand}`;
}

// Infer COD vs Prepaid from the Shopify order payload.
// Uses gateway and payment_details — never falls back to paymentReference string.
export function inferPaymentMode(order: Record<string, unknown>): PaymentMode {
  const gateway = ((order.payment_gateway as string) ?? "").toLowerCase().trim();
  const financialStatus = ((order.financial_status as string) ?? "").toLowerCase().trim();

  // Explicit COD gateways used in India
  const COD_GATEWAYS = ["cash_on_delivery", "cod", "cash on delivery", "cash_on_delivery_india"];
  if (COD_GATEWAYS.includes(gateway)) return "COD";

  // payment_details.payment_method_name can also indicate COD for some gateways
  const pd = order.payment_details as Record<string, unknown> | null;
  const methodName = ((pd?.payment_method_name as string) ?? "").toLowerCase();
  if (methodName.includes("cod") || methodName.includes("cash_on_delivery") || methodName.includes("cash on delivery")) {
    return "COD";
  }

  // Manual gateway + pending financial status is the typical Shopify COD setup
  if (gateway === "manual" && financialStatus === "pending") return "COD";

  // Known prepaid gateways (India + global)
  const PREPAID_GATEWAYS = [
    "razorpay", "paytm", "cashfree", "stripe", "paypal",
    "shopify_payments", "upi", "phonepe", "googlepay", "amazon_pay",
    "instamojo", "billdesk", "ccavenue", "hdfc", "icici",
  ];
  if (PREPAID_GATEWAYS.some(g => gateway.includes(g))) return "PREPAID";

  // Financial status = paid strongly implies prepaid (money already collected)
  if (financialStatus === "paid") return "PREPAID";

  return "UNKNOWN";
}

// Map Shopify fulfillment/financial status to AXQEN OrderStatus.
// Only used for orders that are NOT yet locked in AXQEN's workflow.
function mapShopifyStatus(financial: string, fulfillment: string | null): import("@prisma/client").OrderStatus {
  if (financial === "refunded" || financial === "voided") return "CANCELLED";
  if (fulfillment === "fulfilled") return "DELIVERED";
  if (fulfillment === "partial") return "SHIPPED";
  if (financial === "paid") return "PROCESSING";
  return "NEW";
}

// AXQEN-owned fields that must never be overwritten by Shopify sync/webhooks
const AXQEN_PROTECTED_FIELDS = new Set([
  "supplierId", "supplierStatus", "supplierNote",
  "expectedDispatchDate", "expectedDeliveryDate",
  "dispatchedAt", "supplierTrackingNo", "supplierCourier",
  "awbNumber", "trackingUrl", "courier",
  "productCost", "shippingCharge", "packingCharge", "rtoCharge",
  "ndrReason", "ndrStatus", "ndrAttempts", "ndrActionTaken", "ndrCreatedAt",
  "confirmationStatus", "confirmationRequestedAt", "confirmationCompletedAt",
  "confirmationFailedAt", "confirmationChannel",
]);
void AXQEN_PROTECTED_FIELDS; // referenced in comments, not used in code directly

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  const shopDomain = req.headers.get("x-shopify-shop-domain");
  const topic = req.headers.get("x-shopify-topic");

  // Authenticate first — fail closed
  if (!verifyHmac(rawBody, hmac)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const HANDLED_TOPICS = ["orders/created", "orders/paid", "orders/updated", "orders/cancelled", "orders/fulfilled"];
  if (!topic || !HANDLED_TOPICS.includes(topic)) {
    // Acknowledge unhandled topics so Shopify doesn't retry
    return NextResponse.json({ ok: true });
  }

  if (!shopDomain) {
    return NextResponse.json({ error: "Missing shop domain" }, { status: 400 });
  }

  let shopifyOrder: Record<string, unknown>;
  try {
    shopifyOrder = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Find the store and seller
  const store = await prisma.shopifyStore.findFirst({
    where: { storeUrl: shopDomain },
    include: { seller: { select: { id: true, name: true, brandName: true } } },
  });

  if (!store) {
    console.error(`[Shopify Webhook] Store not found for domain: ${shopDomain}`);
    return NextResponse.json({ ok: true }); // Always 200 to Shopify
  }

  const sellerId = store.sellerId;
  const externalOrderId = (shopifyOrder.name as string) ?? String(shopifyOrder.id);
  const paymentMode = inferPaymentMode(shopifyOrder);

  // Check if order already exists
  const existing = await prisma.order.findUnique({
    where: { sellerId_externalOrderId_source: { sellerId, externalOrderId, source: "SHOPIFY" } },
    select: { id: true, status: true, awbNumber: true, courier: true, supplierId: true },
  });

  if (existing) {
    // Idempotent update — overwrite only Shopify-owned fields, preserve AXQEN state
    return await handleExistingOrder(existing, shopifyOrder, topic, paymentMode, externalOrderId);
  }

  // New order — parse and create
  const customer = shopifyOrder.customer as Record<string, unknown> | null;
  const shippingAddress = shopifyOrder.shipping_address as Record<string, unknown> | null;
  const customerName = customer
    ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || null
    : null;
  const customerEmail = (shopifyOrder.email as string) || (customer?.email as string) || null;
  const customerAddress = shippingAddress
    ? {
        address: [shippingAddress.address1 ?? "", shippingAddress.address2 ?? ""].filter(Boolean).join(", "),
        city: shippingAddress.city ?? "",
        state: shippingAddress.province ?? "",
        pincode: shippingAddress.zip ?? "",
        phone: (shippingAddress.phone as string) || (customer?.phone as string) || "",
      }
    : undefined;

  const totalAmount = parseFloat((shopifyOrder.total_price as string) ?? "0");
  const lineItems = (shopifyOrder.line_items as Array<Record<string, unknown>>) ?? [];

  // Create order + items in one transaction
  const order = await prisma.order.create({
    data: {
      sellerId,
      externalOrderId,
      source: "SHOPIFY",
      status: "NEW",
      paymentMode,
      customerName,
      customerEmail,
      customerAddress: customerAddress ?? undefined,
      totalAmount,
      currency: (shopifyOrder.currency as string) ?? "INR",
      rawData: shopifyOrder as never,
      items: {
        create: lineItems.map(item => ({
          name: (item.title as string) ?? "Unknown",
          sku: (item.sku as string) || null,
          quantity: (item.quantity as number) ?? 1,
          price: parseFloat((item.price as string) ?? "0"),
        })),
      },
    },
  });

  await prisma.orderTimeline.create({
    data: {
      orderId: order.id,
      event: `Order ${externalOrderId} received from Shopify via webhook (${topic})`,
      eventType: ORDER_EVENTS.ORDER_CREATED,
      actorRole: "SYSTEM",
      metadata: { topic, paymentMode },
    },
  });

  // Auto-assign best supplier
  let supplierId: string | null = null;
  try {
    const ranked = await rankSuppliers(order.id, "best_performance");
    if (ranked.length > 0) {
      supplierId = ranked[0].supplierId;

      await prisma.order.update({
        where: { id: order.id },
        data: { supplierId, supplierStatus: "ASSIGNED" },
      });

      await prisma.orderTimeline.create({
        data: {
          orderId: order.id,
          event: `Auto-assigned to supplier. Score: ${ranked[0].score.toFixed(0)}/100`,
          eventType: ORDER_EVENTS.SUPPLIER_ASSIGNED,
          actorRole: "SYSTEM",
          metadata: { supplierId, score: ranked[0].score },
        },
      });

      const poNumber = generatePoNumber();
      await prisma.purchaseOrder.create({
        data: {
          poNumber,
          orderId: order.id,
          supplierId,
          sellerId,
          status: "SENT",
          sellingPrice: totalAmount,
          supplierCost: 0,
          items: {
            create: lineItems.map(item => ({
              name: (item.title as string) ?? "Unknown",
              sku: (item.sku as string) || null,
              quantity: (item.quantity as number) ?? 1,
              unitCost: 0,
            })),
          },
        },
      });

      await prisma.orderTimeline.create({
        data: {
          orderId: order.id,
          event: `Purchase order ${poNumber} sent to supplier automatically`,
          eventType: ORDER_EVENTS.PURCHASE_ORDER_CREATED,
          actorRole: "SYSTEM",
          metadata: { poNumber },
        },
      });

      await prisma.notification.create({
        data: {
          userId: supplierId,
          type: "ORDER_UPDATE",
          title: "New Order Assigned",
          message: `Order ${externalOrderId} has been assigned to you. PO: ${poNumber}. Please confirm and dispatch.`,
          data: { orderId: order.id, poNumber, externalOrderId },
        },
      });
    }
  } catch (err) {
    console.error("[Shopify Webhook] Auto-assign failed:", err);
  }

  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await Promise.all(
    admins.map(admin =>
      prisma.notification.create({
        data: {
          userId: admin.id,
          type: "ORDER_UPDATE",
          title: supplierId ? "✅ New Order — Auto-processed" : "⚠️ New Order — Needs Supplier",
          message: supplierId
            ? `Order ${externalOrderId} from ${store.storeName} received and auto-assigned. ₹${totalAmount}`
            : `Order ${externalOrderId} from ${store.storeName} received but no supplier matched. Manual assignment needed.`,
          data: { orderId: order.id, externalOrderId, sellerId },
        },
      })
    )
  );

  // Auto-trigger WhatsApp COD verification for new COD orders
  if (paymentMode === "COD" && customerAddress) {
    try {
      const paConfig = await getConfig();
      if (paConfig?.enabled) {
        const ok = await requestCODVerification(
          {
            id:              order.id,
            externalOrderId,
            customerName,
            customerAddress: customerAddress as Record<string, unknown>,
            totalAmount,
            items:           lineItems.map(i => ({
              name:     (i.title as string) ?? "Unknown",
              quantity: (i.quantity as number) ?? 1,
              price:    parseFloat((i.price as string) ?? "0"),
            })),
          },
          paConfig,
          { name: store.seller.name, brandName: store.seller.brandName },
        );
        if (ok) {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              confirmationStatus:      "PENDING" as never,
              confirmationRequestedAt: new Date(),
              confirmationChannel:     "WHATSAPP",
            },
          });
        }
      }
    } catch (err) {
      // Non-fatal — order is already saved; WhatsApp trigger failure should not block the webhook response
      console.error("[Shopify Webhook] AiSensy COD trigger failed:", err);
    }
  }

  return NextResponse.json({ ok: true, orderId: order.id });
}

// Handle an order that already exists in AXQEN — update only Shopify-owned fields.
// Never touch supplier assignment, NDR state, confirmation state, or AWB/courier.
async function handleExistingOrder(
  existing: { id: string; status: string; awbNumber: string | null; courier: string | null; supplierId: string | null },
  shopifyOrder: Record<string, unknown>,
  topic: string,
  paymentMode: PaymentMode,
  externalOrderId: string,
): Promise<NextResponse> {
  const financialStatus = (shopifyOrder.financial_status as string) ?? "";
  const fulfillmentStatus: string | null = (shopifyOrder.fulfillment_status as string | null) ?? null;

  // Orders with AWB or in a terminal/processing state are locked — don't revert AXQEN status
  const LOCKED_STATUSES = ["PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "CANCELLED", "RTO"];
  const isLocked = existing.awbNumber || existing.courier || LOCKED_STATUSES.includes(existing.status);
  const newStatus = isLocked
    ? (existing.status as import("@prisma/client").OrderStatus)
    : mapShopifyStatus(financialStatus, fulfillmentStatus as string | null);

  // For cancellations, always honour Shopify regardless of lock (terminal state)
  const isCancellation = topic === "orders/cancelled" || financialStatus === "refunded" || financialStatus === "voided";
  const finalStatus: import("@prisma/client").OrderStatus = isCancellation ? "CANCELLED" : newStatus;

  const customer = shopifyOrder.customer as Record<string, unknown> | null;
  const shippingAddress = shopifyOrder.shipping_address as Record<string, unknown> | null;
  const customerAddress = shippingAddress
    ? {
        address: [shippingAddress.address1 ?? "", shippingAddress.address2 ?? ""].filter(Boolean).join(", "),
        city: shippingAddress.city ?? "",
        state: shippingAddress.province ?? "",
        pincode: shippingAddress.zip ?? "",
        phone: (shippingAddress.phone as string) || (customer?.phone as string) || "",
      }
    : undefined;

  await prisma.order.update({
    where: { id: existing.id },
    data: {
      status: finalStatus,
      paymentMode,                // update in case Shopify later sets gateway
      customerName: customer
        ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || undefined
        : undefined,
      customerEmail: (shopifyOrder.email as string) || (customer?.email as string) || undefined,
      ...(customerAddress ? { customerAddress } : {}),
      totalAmount: parseFloat((shopifyOrder.total_price as string) ?? "0"),
      rawData: shopifyOrder as never,
    },
  });

  const eventTypeMap: Record<string, string> = {
    "orders/created":   ORDER_EVENTS.ORDER_CREATED,
    "orders/paid":      ORDER_EVENTS.ORDER_PAID,
    "orders/updated":   ORDER_EVENTS.ORDER_UPDATED,
    "orders/cancelled": ORDER_EVENTS.ORDER_CANCELLED,
    "orders/fulfilled": ORDER_EVENTS.ORDER_FULFILLED,
  };

  await prisma.orderTimeline.create({
    data: {
      orderId: existing.id,
      event: `Shopify ${topic} received — Shopify-owned fields updated`,
      eventType: eventTypeMap[topic] ?? ORDER_EVENTS.ORDER_UPDATED,
      actorRole: "SYSTEM",
      metadata: { topic, paymentMode, newStatus: finalStatus },
    },
  });

  return NextResponse.json({ ok: true, updated: true, orderId: existing.id });
}
