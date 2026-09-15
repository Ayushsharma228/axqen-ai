/**
 * PrimeAssist workflow completion webhook.
 *
 * PrimeAssist calls this URL when a customer responds to a WhatsApp workflow.
 * Configure the callback URL in PrimeAssist dashboard:
 *   Workflows → [your workflow] → Webhook URL
 *   → https://your-domain.com/api/webhooks/primeassist
 *
 * Expected payload:
 * {
 *   event_id:        string,   // AXQEN order ID sent as event_id when triggering
 *   trigger_type:    string,   // e.g. "order_created"
 *   status:          "confirmed" | "cancelled" | "no_response",
 *   customer_reply?: string,   // raw customer message (if provided)
 *   address?:        string,   // updated address if customer provided one
 * }
 *
 * NOTE: Exact field names depend on PrimeAssist's webhook payload format.
 * Update field names below once PrimeAssist shares their webhook docs.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature, getConfig } from "@/lib/hillteck";

export async function POST(req: NextRequest) {
  const rawBody  = await req.text();
  const signature = req.headers.get("x-primeassist-signature")
    ?? req.headers.get("x-signature")
    ?? "";

  // Verify signature if secret is configured
  const config = await getConfig();
  if (config?.webhookSecret && !verifyWebhookSignature(rawBody, signature, config.webhookSecret)) {
    console.error("[primeassist webhook] signature mismatch");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderId    = payload.event_id as string | undefined;
  const status     = (payload.status as string | undefined)?.toLowerCase();
  const newAddress = payload.address as string | undefined;

  if (!orderId || !status) {
    console.warn("[primeassist webhook] missing event_id or status", payload);
    return NextResponse.json({ ok: true }); // 200 so PrimeAssist doesn't retry
  }

  const order = await prisma.order.findUnique({
    where:  { id: orderId },
    select: { id: true, sellerId: true, externalOrderId: true, customerAddress: true },
  });

  if (!order) {
    console.warn(`[primeassist webhook] unknown order: ${orderId}`);
    return NextResponse.json({ ok: true });
  }

  if (status === "confirmed") {
    const addrPatch = newAddress
      ? { customerAddress: { ...(order.customerAddress as object ?? {}), address: newAddress } }
      : {};

    await prisma.order.update({
      where: { id: orderId },
      data:  {
        confirmationStatus:      "CONFIRMED" as never,
        confirmationCompletedAt: new Date(),
        ...addrPatch,
      },
    });

    await prisma.orderTimeline.create({
      data: {
        orderId,
        event:     "Customer confirmed order via WhatsApp",
        eventType: "ORDER_UPDATED",
        actorRole: "CUSTOMER",
        metadata:  {
          channel: "WHATSAPP",
          ...(newAddress ? { updatedAddress: newAddress } : {}),
        },
      },
    });

    await prisma.notification.create({
      data: {
        userId:  order.sellerId,
        type:    "ORDER_UPDATE",
        title:   "Order Confirmed ✅",
        message: `Customer confirmed order ${order.externalOrderId} via WhatsApp.${newAddress ? " Address updated." : ""}`,
        data:    { orderId },
      },
    });

  } else if (status === "cancelled" || status === "no_response") {
    const isCancelled = status === "cancelled";

    await prisma.order.update({
      where: { id: orderId },
      data:  {
        confirmationStatus:   "FAILED" as never,
        confirmationFailedAt: new Date(),
        status:               "CANCELLED" as never,
      },
    });

    await prisma.orderTimeline.create({
      data: {
        orderId,
        event: isCancelled
          ? "Customer cancelled order via WhatsApp"
          : "No response to WhatsApp — order auto-cancelled",
        eventType: "ORDER_UPDATED",
        actorRole: "CUSTOMER",
        metadata:  { channel: "WHATSAPP", status },
      },
    });

    await prisma.notification.create({
      data: {
        userId:  order.sellerId,
        type:    "ORDER_UPDATE",
        title:   isCancelled ? "Order Cancelled by Customer" : "Order Auto-Cancelled (No Response)",
        message: isCancelled
          ? `Customer cancelled order ${order.externalOrderId} via WhatsApp.`
          : `No response to WhatsApp for order ${order.externalOrderId} — auto-cancelled.`,
        data:    { orderId },
      },
    });

  } else {
    console.warn(`[primeassist webhook] unknown status "${status}" for order ${orderId}`);
  }

  console.log(`[primeassist webhook] order=${order.externalOrderId} status=${status}`);
  return NextResponse.json({ ok: true });
}
