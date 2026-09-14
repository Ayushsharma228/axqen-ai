/**
 * HillTeck Webhook Receiver
 *
 * Give HillTeck this URL:  https://your-domain.com/api/webhooks/hillteck
 * They POST verification results and status updates here.
 *
 * No auth required (public endpoint) — we verify the signature instead.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getConfig, verifyWebhookSignature } from "@/lib/hillteck";

type HillteckWebhookBody = {
  event?:        string; // "VERIFICATION_RESULT" | "ORDER_NOTIFICATION_SENT" etc.
  reference_id?: string; // our externalOrderId — TODO: confirm field name with HillTeck
  status?:       string; // "CONFIRMED" | "FAILED" | "CANCELLED" | "NO_ANSWER" — TODO: confirm values
  channel?:      string; // "IVR" | "WHATSAPP"
  reason?:       string; // optional reason for failure
  timestamp?:    string;
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Verify signature if a webhook secret is configured
  const config = await getConfig();
  if (config?.webhookSecret) {
    const sig = req.headers.get("x-hillteck-signature") // TODO: confirm header name
              ?? req.headers.get("x-signature")
              ?? "";
    if (!verifyWebhookSignature(rawBody, sig, config.webhookSecret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let body: HillteckWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const referenceId = body.reference_id;
  if (!referenceId) {
    // Log and accept — don't reject non-order events (e.g. ping/test webhooks)
    console.log("[hillteck-webhook] non-order event:", body.event, body);
    return NextResponse.json({ ok: true });
  }

  const order = await prisma.order.findFirst({
    where: { externalOrderId: referenceId },
  });

  if (!order) {
    console.warn(`[hillteck-webhook] order not found: reference_id=${referenceId}`);
    return NextResponse.json({ ok: true }); // Accept to stop retries
  }

  const now = new Date();

  // Map HillTeck status → ConfirmationStatus enum
  // TODO: Replace status values with HillTeck's actual values once docs arrive
  const rawStatus = (body.status ?? "").toUpperCase();

  if (rawStatus === "CONFIRMED") {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        confirmationStatus:      "CONFIRMED" as never,
        confirmationCompletedAt: now,
        confirmationChannel:     body.channel ?? "HILLTECK",
        // Advance order to processing if it's still new
        ...(order.status === "NEW" ? { status: "PROCESSING" as never } : {}),
      },
    });
    console.log(`[hillteck-webhook] CONFIRMED order ${referenceId}`);

  } else if (rawStatus === "FAILED" || rawStatus === "REJECTED") {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        confirmationStatus:   "FAILED" as never,
        confirmationFailedAt: now,
        confirmationChannel:  body.channel ?? "HILLTECK",
        // Cancel the order on rejection
        status: "CANCELLED" as never,
      },
    });
    console.log(`[hillteck-webhook] FAILED/REJECTED order ${referenceId}, reason: ${body.reason}`);

  } else if (rawStatus === "CANCELLED" || rawStatus === "NO_ANSWER") {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        confirmationStatus:   "CANCELLED" as never,
        confirmationFailedAt: now,
        confirmationChannel:  body.channel ?? "HILLTECK",
        // Leave order as-is — admin decides what to do
      },
    });
    console.log(`[hillteck-webhook] NO_ANSWER/CANCELLED order ${referenceId}`);

  } else {
    console.log(`[hillteck-webhook] unknown status '${rawStatus}' for order ${referenceId}, body:`, body);
  }

  return NextResponse.json({ ok: true });
}
