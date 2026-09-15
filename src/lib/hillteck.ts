/**
 * PrimeAssist Integration
 *
 * Handles COD order verification and order notifications via WhatsApp AI workflows.
 * API base: https://api.primeassist.ai
 * Auth:     X-Api-Key header (store-scoped, generated in PrimeAssist → Integration → API Key)
 * Docs:     https://primeassist1.gitlab.io/docs/
 *
 * Config stored in platformConfig table under keys:
 *   HILLTECK_API_KEY, HILLTECK_BASE_URL, HILLTECK_ENABLED, HILLTECK_WEBHOOK_SECRET
 */

import { prisma } from "@/lib/prisma";
import { createHmac } from "crypto";

export type HillteckConfig = {
  apiKey:        string;
  baseUrl:       string;
  enabled:       boolean;
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
    baseUrl:       map["HILLTECK_BASE_URL"] ?? "https://api.primeassist.ai",
    enabled:       (map["HILLTECK_ENABLED"] ?? "false") === "true",
    webhookSecret: map["HILLTECK_WEBHOOK_SECRET"] ?? "",
  };
}

// Normalize to E.164. Handles bare 10-digit Indian numbers and 91-prefixed numbers.
function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (raw.startsWith("+") && digits.length >= 10) return `+${digits}`;
  return "";
}

type OrderForVerification = {
  id:              string;
  externalOrderId: string;
  customerName:    string | null;
  customerAddress: Record<string, unknown> | null;
  totalAmount:     number;
  items:           { name: string; quantity: number; price: number }[];
};

/**
 * Trigger a PrimeAssist WhatsApp COD verification workflow.
 *
 * Uses trigger_type=order_created with event_id=order.id (AXQEN UUID).
 * The (event_id, trigger_type) pair is unique per PrimeAssist store, so
 * calling this twice for the same order returns 409 — handled as success.
 *
 * Seller should configure an "order_created" workflow in PrimeAssist that:
 *   1. Sends WhatsApp: "Your order {{order.number}} from {{seller.name}} — Confirm or Cancel?"
 *   2. If confirmed + address missing → asks customer for full address
 *   3. Webhooks result back to /api/webhooks/primeassist
 */
export async function requestCODVerification(
  order:   OrderForVerification,
  config:  HillteckConfig,
  seller?: { name?: string | null; brandName?: string | null },
): Promise<boolean> {
  const addr     = order.customerAddress;
  const phone    = toE164((addr?.phone as string) ?? "");
  if (!phone) {
    console.warn(`[primeassist] no valid phone for order ${order.externalOrderId}`);
    return false;
  }

  const addrStr    = [addr?.houseNo, addr?.street, addr?.address, addr?.city, addr?.state, addr?.pincode]
    .filter(Boolean).join(", ");
  const itemsStr   = order.items.map(i => i.name).join(", ");
  const sellerName = seller?.brandName || seller?.name || "";

  try {
    const res = await fetch(`${config.baseUrl}/api/v1/merchants/trigger_event`, {
      method:  "POST",
      headers: { "X-Api-Key": config.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        trigger_type: "order_created",
        event_id:     order.id,
        phone,
        data: {
          "{{order.number}}":        order.externalOrderId,
          "{{order.amount}}":        order.totalAmount.toFixed(2),
          "{{order.products.name}}": itemsStr,
          "{{customer.name}}":       order.customerName ?? "",
          "{{customer.phone}}":      phone,
          ...(sellerName ? { "{{seller.name}}":   sellerName } : {}),
          ...(addrStr    ? { "{{order.address}}": addrStr    } : {}),
        },
      }),
    });

    if (res.status === 409) {
      // Already queued — idempotent
      return true;
    }
    if (!res.ok) {
      const text = await res.text();
      console.error(`[primeassist] trigger_event ${res.status} order=${order.externalOrderId}: ${text}`);
      return false;
    }
    const ack = await res.json() as { matched_workflows?: number };
    if ((ack.matched_workflows ?? 0) === 0) {
      console.warn(`[primeassist] 0 workflows matched for order_created — configure a workflow in PrimeAssist dashboard`);
    }
    return true;
  } catch (err) {
    console.error("[primeassist] trigger_event failed:", err);
    return false;
  }
}

/**
 * Trigger a WhatsApp shipping notification when an order is fulfilled.
 * Uses trigger_type=fulfillment_created; event_id=`${order.id}-fulfilled`.
 */
export async function notifyFulfillment(
  order: {
    id:              string;
    externalOrderId: string;
    customerName:    string | null;
    customerAddress: Record<string, unknown> | null;
    awbNumber:       string | null;
    courier:         string | null;
    trackingUrl:     string | null;
  },
  config: HillteckConfig,
): Promise<boolean> {
  const phone = toE164((order.customerAddress?.phone as string) ?? "");
  if (!phone) return false;

  try {
    const res = await fetch(`${config.baseUrl}/api/v1/merchants/trigger_event`, {
      method:  "POST",
      headers: { "X-Api-Key": config.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        trigger_type: "fulfillment_created",
        event_id:     `${order.id}-fulfilled`,
        phone,
        data: {
          "{{order.number}}":                       order.externalOrderId,
          "{{customer.name}}":                      order.customerName ?? "",
          "{{order.fulfillment.tracking.company}}": order.courier ?? "",
          "{{order.fulfillment.tracking.number}}":  order.awbNumber ?? "",
          "{{order.fulfillment.tracking.url}}":     order.trackingUrl ?? "",
        },
      }),
    });
    if (res.status === 409) return true;
    if (!res.ok) { console.error(`[primeassist] fulfillment notify ${res.status}`); return false; }
    return true;
  } catch (err) {
    console.error("[primeassist] fulfillment notify failed:", err);
    return false;
  }
}

// Legacy alias — kept for any older callers
export const sendWhatsAppNotification = notifyFulfillment;

export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!secret) return true;
  try {
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    const received = signature.startsWith("sha256=") ? signature.slice(7) : signature;
    return expected === received;
  } catch {
    return false;
  }
}
