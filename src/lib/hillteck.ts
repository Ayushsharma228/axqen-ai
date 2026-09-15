/**
 * HillTeck Integration Client
 *
 * HillTeck handles COD order verification (AI call + WhatsApp) and
 * WhatsApp order notifications for AXQEN sellers.
 *
 * TODO when API docs arrive:
 *  1. Replace BASE_URL with the real HillTeck API base
 *  2. Replace ENDPOINT_* paths with real paths
 *  3. Confirm auth header format (Bearer token vs X-Api-Key vs query param)
 *  4. Confirm request body field names
 *  5. Set HILLTECK_WEBHOOK_SECRET to verify incoming webhooks
 */

import { prisma } from "@/lib/prisma";

// ── Config ────────────────────────────────────────────────────────────────────

export type HillteckConfig = {
  apiKey:    string;
  baseUrl:   string;
  enabled:   boolean;
  webhookSecret: string;
};

export async function getConfig(): Promise<HillteckConfig | null> {
  const rows = await prisma.platformConfig.findMany({
    where: { key: { in: ["HILLTECK_API_KEY", "HILLTECK_BASE_URL", "HILLTECK_ENABLED", "HILLTECK_WEBHOOK_SECRET"] } },
  });
  const map: Record<string, string> = Object.fromEntries(rows.map(r => [r.key, r.value]));

  const apiKey = map["HILLTECK_API_KEY"] ?? "";
  if (!apiKey) return null;

  return {
    apiKey,
    baseUrl:       map["HILLTECK_BASE_URL"] ?? "https://api.hillteck.com",  // TODO: confirm with HillTeck
    enabled:       (map["HILLTECK_ENABLED"] ?? "false") === "true",
    webhookSecret: map["HILLTECK_WEBHOOK_SECRET"] ?? "",
  };
}

// ── COD Verification ─────────────────────────────────────────────────────────

type OrderForVerification = {
  id:              string;
  externalOrderId: string;
  customerName:    string | null;
  customerAddress: { phone?: string; city?: string; state?: string } | null;
  totalAmount:     number;
  items:           { name: string; quantity: number; price: number }[];
};

/**
 * Push a COD order to HillTeck for verification (AI call + WhatsApp).
 * Returns true if the request was accepted, false otherwise.
 *
 * TODO: Update endpoint and payload once HillTeck shares API docs.
 */
export async function requestCODVerification(
  order: OrderForVerification,
  config: HillteckConfig,
): Promise<boolean> {
  const phone = (order.customerAddress as { phone?: string } | null)?.phone ?? "";
  if (!phone) return false;

  try {
    const res = await fetch(`${config.baseUrl}/orders/verify`, { // TODO: confirm endpoint
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`, // TODO: confirm auth header
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        // TODO: map to HillTeck's actual field names
        reference_id:   order.externalOrderId,
        customer_name:  order.customerName ?? "",
        customer_phone: phone,
        amount:         order.totalAmount,
        items: order.items.map(i => ({
          name: i.name, quantity: i.quantity, price: i.price,
        })),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[hillteck] verify error ${res.status}: ${text}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[hillteck] verify fetch failed:", err);
    return false;
  }
}

// ── WhatsApp Notifications ────────────────────────────────────────────────────

export type NotificationEvent =
  | "ORDER_CONFIRMED"
  | "ORDER_SHIPPED"
  | "ORDER_DELIVERED"
  | "ORDER_CANCELLED"
  | "COD_TO_PREPAID"; // sends a payment link

type OrderForNotification = {
  externalOrderId: string;
  customerName:    string | null;
  customerAddress: { phone?: string } | null;
  awbNumber:       string | null;
  totalAmount:     number;
};

/**
 * Send a WhatsApp notification via HillTeck for an order event.
 *
 * TODO: Update endpoint and payload once HillTeck shares API docs.
 */
export async function sendWhatsAppNotification(
  event:  NotificationEvent,
  order:  OrderForNotification,
  config: HillteckConfig,
): Promise<boolean> {
  const phone = (order.customerAddress as { phone?: string } | null)?.phone ?? "";
  if (!phone) return false;

  try {
    const res = await fetch(`${config.baseUrl}/whatsapp/send`, { // TODO: confirm endpoint
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        // TODO: map to HillTeck's actual field names + template names
        event,
        phone,
        customer_name: order.customerName ?? "",
        order_id:      order.externalOrderId,
        awb:           order.awbNumber ?? "",
        amount:        order.totalAmount,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[hillteck] wa-notify error ${res.status}: ${text}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[hillteck] wa-notify fetch failed:", err);
    return false;
  }
}

// ── Webhook Signature Verification ───────────────────────────────────────────

import { createHmac } from "crypto";

/**
 * Verify that an incoming webhook request is genuinely from HillTeck.
 * TODO: Confirm signature algorithm and header name once HillTeck shares docs.
 */
export function verifyWebhookSignature(
  payload:   string,
  signature: string,
  secret:    string,
): boolean {
  if (!secret) return true; // Skip verification if no secret configured
  try {
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    // TODO: confirm HillTeck sends "sha256=<hex>" or just "<hex>"
    const received = signature.startsWith("sha256=") ? signature.slice(7) : signature;
    return expected === received;
  } catch {
    return false;
  }
}
