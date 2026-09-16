/**
 * AiSensy Integration
 *
 * Handles COD order verification and order notifications via WhatsApp templates.
 * API: https://backend.aisensy.com/campaign/t1/api/v2
 * Auth: apiKey in request body (Campaign API Key from AiSensy → Manage → API Key)
 *
 * Config stored in platformConfig table:
 *   HILLTECK_API_KEY          — Campaign API Key (JWT token from AiSensy)
 *   HILLTECK_ENABLED          — "true" / "false"
 *   HILLTECK_CAMPAIGN_COD     — Name of the API Campaign for COD verification
 *   HILLTECK_CAMPAIGN_SHIPPED — Name of the API Campaign for shipping notification
 *   HILLTECK_WEBHOOK_SECRET   — Optional: secret to verify incoming webhooks
 *
 * Templates to create in AiSensy (Campaigns → Templates):
 *
 * COD Verification template params (in order):
 *   {{1}} customer name
 *   {{2}} order number  (e.g. #1034)
 *   {{3}} seller name   (e.g. Vrinandya Store)
 *   {{4}} order amount  (e.g. 1499.00)
 *   {{5}} product names (e.g. Wireless Earbuds)
 *   Example: "Hi {{1}}, your order {{2}} from {{3}} for ₹{{4}} ({{5}}) has been placed.
 *             Reply to confirm or cancel."
 *   Add Quick Reply buttons: "Confirm" and "Cancel"
 *
 * Shipping Notification template params (in order):
 *   {{1}} customer name
 *   {{2}} order number
 *   {{3}} courier name  (e.g. BlueDart)
 *   {{4}} AWB number
 *   {{5}} tracking URL
 */

import { prisma } from "@/lib/prisma";
import { createHmac } from "crypto";

export type HillteckConfig = {
  apiKey:          string;
  baseUrl:         string;
  enabled:         boolean;
  webhookSecret:   string;
  campaignCOD:     string;
  campaignShipped: string;
};

export async function getConfig(): Promise<HillteckConfig | null> {
  const rows = await prisma.platformConfig.findMany({
    where: {
      key: {
        in: [
          "HILLTECK_API_KEY", "HILLTECK_BASE_URL", "HILLTECK_ENABLED",
          "HILLTECK_WEBHOOK_SECRET", "HILLTECK_CAMPAIGN_COD", "HILLTECK_CAMPAIGN_SHIPPED",
        ],
      },
    },
  });
  const map: Record<string, string> = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const apiKey = map["HILLTECK_API_KEY"] ?? "";
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl:         map["HILLTECK_BASE_URL"] ?? "https://backend.aisensy.com",
    enabled:         (map["HILLTECK_ENABLED"] ?? "false") === "true",
    webhookSecret:   map["HILLTECK_WEBHOOK_SECRET"] ?? "",
    campaignCOD:     map["HILLTECK_CAMPAIGN_COD"] ?? "",
    campaignShipped: map["HILLTECK_CAMPAIGN_SHIPPED"] ?? "",
  };
}

// Normalize to E.164 — handles bare 10-digit Indian numbers
function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (raw.startsWith("+") && digits.length >= 10) return `+${digits}`;
  return "";
}

// Core AiSensy campaign sender
async function sendCampaign(
  config:         HillteckConfig,
  campaignName:   string,
  destination:    string,
  userName:       string,
  templateParams: string[],
  source:         string,
): Promise<boolean> {
  try {
    const res = await fetch(`${config.baseUrl}/campaign/t1/api/v2`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey:         config.apiKey,
        campaignName,
        destination,
        userName,
        source,
        templateParams,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[aisensy] campaign="${campaignName}" ${res.status}: ${text}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[aisensy] sendCampaign failed:", err);
    return false;
  }
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
 * Send WhatsApp COD verification message via AiSensy.
 *
 * Template params sent (must match template order in AiSensy):
 *   {{1}} customer name
 *   {{2}} order number
 *   {{3}} seller name
 *   {{4}} order amount
 *   {{5}} product names
 */
export async function requestCODVerification(
  order:   OrderForVerification,
  config:  HillteckConfig,
  seller?: { name?: string | null; brandName?: string | null },
): Promise<boolean> {
  if (!config.campaignCOD) {
    console.warn("[aisensy] HILLTECK_CAMPAIGN_COD not configured in platform config");
    return false;
  }

  const phone = toE164((order.customerAddress?.phone as string) ?? "");
  if (!phone) {
    console.warn(`[aisensy] no valid phone for order ${order.externalOrderId}`);
    return false;
  }

  const sellerName = seller?.brandName || seller?.name || "AXQEN";
  const itemsStr   = order.items.map(i => i.name).join(", ");

  return sendCampaign(
    config,
    config.campaignCOD,
    phone,
    order.customerName ?? "Customer",
    [
      order.customerName ?? "Customer",   // {{1}}
      order.externalOrderId,              // {{2}}
      sellerName,                         // {{3}}
      order.totalAmount.toFixed(2),       // {{4}}
      itemsStr || "your order",           // {{5}}
    ],
    "COD_VERIFICATION",
  );
}

/**
 * Send WhatsApp shipping notification via AiSensy.
 *
 * Template params sent:
 *   {{1}} customer name
 *   {{2}} order number
 *   {{3}} courier name
 *   {{4}} AWB / tracking number
 *   {{5}} tracking URL
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
  if (!config.campaignShipped) return false;

  const phone = toE164((order.customerAddress?.phone as string) ?? "");
  if (!phone) return false;

  return sendCampaign(
    config,
    config.campaignShipped,
    phone,
    order.customerName ?? "Customer",
    [
      order.customerName ?? "Customer",   // {{1}}
      order.externalOrderId,              // {{2}}
      order.courier ?? "",                // {{3}}
      order.awbNumber ?? "",              // {{4}}
      order.trackingUrl ?? "",            // {{5}}
    ],
    "ORDER_SHIPPED",
  );
}

// Legacy alias
export const sendWhatsAppNotification = notifyFulfillment;

/**
 * AI Call — AiSensy is WhatsApp-only.
 * Falls back to sending a WhatsApp message instead.
 * For real AI voice calls, wire up a separate calling service.
 */
export async function requestAICall(
  order:   OrderForVerification,
  config:  HillteckConfig,
  seller?: { name?: string | null; brandName?: string | null },
): Promise<boolean> {
  console.warn("[aisensy] AI calling not supported — sending WhatsApp instead");
  return requestCODVerification(order, config, seller);
}

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
