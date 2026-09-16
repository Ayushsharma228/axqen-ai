/**
 * AiSensy Webhook Receiver
 *
 * Configure in AiSensy: Settings → Webhooks → https://your-domain.com/api/webhooks/hillteck
 *
 * AiSensy fires this when a customer replies to a WhatsApp campaign message.
 * The payload identifies the customer by their WhatsApp number (waId).
 * We look up the most recent PENDING COD order for that phone number.
 *
 * AiSensy webhook payload shape:
 * {
 *   waId:         string,   // customer WhatsApp number (E.164 without +, e.g. "919876543210")
 *   campaignName: string,   // name of the API Campaign that triggered this
 *   messageType:  string,   // "button" for quick-reply taps, "text" for free-form
 *   text?:        string,   // quick-reply button label OR free-form text
 *   button?:      { text: string },  // alternative location for button label
 *   timestamp?:   string | number,
 * }
 *
 * Quick-reply button labels to recognise (set in your AiSensy template):
 *   Confirm  → marks order CONFIRMED
 *   Cancel   → marks order FAILED + CANCELLED
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature, getConfig } from "@/lib/hillteck";

function normalisePhone(raw: string): string[] {
  const digits = raw.replace(/\D/g, "");
  const variants: string[] = [];
  if (digits.length === 12 && digits.startsWith("91")) {
    variants.push(`+${digits}`, digits.slice(2)); // +91XXXXXXXXXX and bare 10-digit
  } else if (digits.length === 10) {
    variants.push(digits, `+91${digits}`, `91${digits}`);
  } else {
    variants.push(`+${digits}`, digits);
  }
  return variants;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const config = await getConfig();
  if (config?.webhookSecret) {
    const sig = req.headers.get("x-aisensy-signature")
              ?? req.headers.get("x-signature")
              ?? "";
    if (!verifyWebhookSignature(rawBody, sig, config.webhookSecret)) {
      console.error("[aisensy-webhook] signature mismatch");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const waId = (body.waId as string | undefined)?.replace(/\D/g, "");
  if (!waId) {
    console.log("[aisensy-webhook] no waId — skipping:", body);
    return NextResponse.json({ ok: true });
  }

  // Button label is in text or body.button.text depending on AiSensy version
  const buttonLabel = (
    (body.text as string)
    ?? ((body.button as Record<string, unknown>)?.text as string)
    ?? ""
  ).trim().toLowerCase();

  if (!buttonLabel) {
    console.log("[aisensy-webhook] no button text — skipping:", body);
    return NextResponse.json({ ok: true });
  }

  const phoneVariants = normalisePhone(waId);

  // Find the most recent PENDING COD order whose customerAddress.phone matches
  const orders = await prisma.order.findMany({
    where: {
      paymentMode:        "COD",
      confirmationStatus: "PENDING",
      status:             { notIn: ["DELIVERED", "CANCELLED", "RTO"] },
    },
    select: {
      id: true, sellerId: true, externalOrderId: true, customerAddress: true,
    },
    orderBy: { confirmationRequestedAt: "desc" },
    take:    200,
  });

  const order = orders.find(o => {
    const phone = ((o.customerAddress as Record<string, unknown> | null)?.phone as string | undefined) ?? "";
    const digits = phone.replace(/\D/g, "");
    return phoneVariants.some(v => v.replace(/\D/g, "") === digits);
  });

  if (!order) {
    console.warn(`[aisensy-webhook] no PENDING order for waId=${waId}`);
    return NextResponse.json({ ok: true });
  }

  const now = new Date();

  if (buttonLabel === "confirm" || buttonLabel.startsWith("confirm")) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        confirmationStatus:      "CONFIRMED" as never,
        confirmationCompletedAt: now,
      },
    });

    await prisma.orderTimeline.create({
      data: {
        orderId:   order.id,
        event:     "Customer confirmed order via WhatsApp",
        eventType: "ORDER_UPDATED",
        actorRole: "CUSTOMER",
        metadata:  { channel: "WHATSAPP", buttonLabel },
      },
    });

    await prisma.notification.create({
      data: {
        userId:  order.sellerId,
        type:    "ORDER_UPDATE",
        title:   "Order Confirmed ✅",
        message: `Customer confirmed order ${order.externalOrderId} via WhatsApp.`,
        data:    { orderId: order.id },
      },
    });

    console.log(`[aisensy-webhook] CONFIRMED order=${order.externalOrderId}`);

  } else if (buttonLabel === "cancel" || buttonLabel.startsWith("cancel")) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        confirmationStatus:   "FAILED" as never,
        confirmationFailedAt: now,
        status:               "CANCELLED" as never,
      },
    });

    await prisma.orderTimeline.create({
      data: {
        orderId:   order.id,
        event:     "Customer cancelled order via WhatsApp",
        eventType: "ORDER_UPDATED",
        actorRole: "CUSTOMER",
        metadata:  { channel: "WHATSAPP", buttonLabel },
      },
    });

    await prisma.notification.create({
      data: {
        userId:  order.sellerId,
        type:    "ORDER_UPDATE",
        title:   "Order Cancelled by Customer",
        message: `Customer cancelled order ${order.externalOrderId} via WhatsApp.`,
        data:    { orderId: order.id },
      },
    });

    console.log(`[aisensy-webhook] CANCELLED order=${order.externalOrderId}`);

  } else {
    console.log(`[aisensy-webhook] unrecognised reply "${buttonLabel}" for order=${order.externalOrderId}`);
  }

  return NextResponse.json({ ok: true });
}
