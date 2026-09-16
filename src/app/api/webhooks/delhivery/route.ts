/**
 * Delhivery Status Webhook
 *
 * Configure in Delhivery panel: Settings → Webhooks → https://your-domain.com/api/webhooks/delhivery
 * Add query param for basic auth: ?token=<DELHIVERY_WEBHOOK_TOKEN>
 *
 * Delhivery fires this whenever a shipment status changes.
 * We look up the order by AWB number and update status accordingly.
 *
 * Delhivery webhook payload shape (POST, JSON or form-encoded):
 * {
 *   waybill:    string,   // AWB number
 *   status:     string,   // status text e.g. "In Transit", "Delivered"
 *   statusCode: string,   // status code e.g. "IT", "DL", "PU", "OD", "RTO"
 *   city?:      string,
 *   timestamp?: string,
 * }
 *
 * StatusCode → AXQEN OrderStatus mapping:
 *   MNF (Manifested)       → PROCESSING  (order registered, awaiting pickup)
 *   PU  (Picked Up)        → SHIPPED     (courier has the package)
 *   IT  (In Transit)       → IN_TRANSIT
 *   OD  (Out for Delivery) → IN_TRANSIT
 *   DL  (Delivered)        → DELIVERED
 *   RTO (Return to Origin) → RTO
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Map Delhivery status codes to AXQEN order statuses
const STATUS_MAP: Record<string, string> = {
  MNF: "PROCESSING",    // Manifested — in Delhivery system, not picked up yet
  PU:  "SHIPPED",       // Picked Up — courier has the package
  IT:  "IN_TRANSIT",    // In Transit
  OD:  "IN_TRANSIT",    // Out for Delivery
  DL:  "DELIVERED",     // Delivered
  RTO: "RTO",           // Return to Origin initiated
};


function normaliseStatusCode(code: string, statusText: string): string {
  const upper = code?.toUpperCase()?.trim();
  if (upper && STATUS_MAP[upper]) return upper;
  // Fall back to text matching when code is missing or unrecognised
  const lower = (statusText ?? "").toLowerCase();
  if (lower.includes("manifest"))         return "MNF";
  if (lower.includes("picked"))           return "PU";
  if (lower.includes("out for delivery")) return "OD";
  if (lower.includes("delivered"))        return "DL";
  if (lower.includes("transit"))          return "IT";
  if (lower.includes("rto") || lower.includes("return to origin")) return "RTO";
  return "";
}

export async function POST(req: NextRequest) {
  // Optional token auth — set DELHIVERY_WEBHOOK_TOKEN in env and pass ?token= in your webhook URL
  const expectedToken = process.env.DELHIVERY_WEBHOOK_TOKEN;
  if (expectedToken) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token") ?? req.headers.get("x-webhook-token") ?? "";
    if (token !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  const contentType = req.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    } else {
      body = await req.json();
    }
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Extract AWB and status — Delhivery sends in various field names
  const awb = (
    (body.waybill ?? body.AWB ?? body.awb_number ?? body.waybill_number ?? "") as string
  ).trim();

  const rawCode = ((body.statusCode ?? body.StatusCode ?? body.status_code ?? "") as string).trim();
  const rawText = ((body.status ?? body.Status ?? body.scan ?? body.Scan ?? "") as string).trim();
  const city    = ((body.city ?? body.City ?? body.location ?? "") as string).trim();

  if (!awb) {
    console.error("[Delhivery webhook] Missing AWB in payload", body);
    return NextResponse.json({ error: "Missing AWB" }, { status: 400 });
  }

  const statusCode = normaliseStatusCode(rawCode, rawText);
  const axqenStatus = statusCode ? STATUS_MAP[statusCode] : null;

  console.log(`[Delhivery webhook] AWB=${awb} code=${statusCode} axqen=${axqenStatus} city=${city}`);

  if (!axqenStatus) {
    // Unknown status — acknowledge but don't update
    return NextResponse.json({ received: true, note: "Unrecognised status, no update applied" });
  }

  // Look up order by AWB (either supplier or seller field)
  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { awbNumber: awb },
        { supplierTrackingNo: awb },
      ],
    },
    select: {
      id: true,
      status: true,
      externalOrderId: true,
      supplierId: true,
      sellerId: true,
    },
  });

  if (!order) {
    console.warn(`[Delhivery webhook] No order found for AWB ${awb}`);
    // Return 200 so Delhivery doesn't retry indefinitely
    return NextResponse.json({ received: true, note: "Order not found" });
  }

  // Determine if status should be updated (only move forward, not backward)
  const statusOrder = ["NEW", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "CANCELLED", "RTO"];
  const currentIdx  = statusOrder.indexOf(order.status);
  const newIdx      = statusOrder.indexOf(axqenStatus);

  // RTO is a special terminal state — always apply it
  const isRTO = axqenStatus === "RTO";
  if (!isRTO && newIdx !== -1 && currentIdx !== -1 && newIdx <= currentIdx) {
    return NextResponse.json({ received: true, note: "Status already at or past this stage" });
  }

  const eventLabel: Record<string, string> = {
    MNF: "PROCESSING",
    PU:  "SHIPPED",
    IT:  "IN_TRANSIT",
    OD:  "OUT_FOR_DELIVERY",
    DL:  "DELIVERED",
    RTO: "RTO_INITIATED",
  };

  await prisma.order.update({
    where: { id: order.id },
    data: { status: axqenStatus as never },
  });

  await prisma.orderTimeline.create({
    data: {
      orderId:   order.id,
      actorId:   order.supplierId ?? order.sellerId ?? undefined,
      actorRole: "SYSTEM",
      event:     eventLabel[statusCode] ?? statusCode,
      details:   `Delhivery: ${rawText || statusCode}${city ? ` (${city})` : ""}`,
      metadata:  { awb, delhiveryCode: statusCode, rawStatus: rawText, city },
    },
  });

  // Notify seller on key events
  if (["SHIPPED", "IN_TRANSIT", "DELIVERED", "RTO"].includes(axqenStatus) && order.sellerId) {
    const notifMap: Record<string, { title: string; message: (id: string) => string }> = {
      SHIPPED:    { title: "Order Picked Up",     message: (id) => `Order ${id} has been picked up by Delhivery. AWB: ${awb}` },
      IN_TRANSIT: { title: "Order In Transit",    message: (id) => `Order ${id} is in transit. AWB: ${awb}` },
      DELIVERED:  { title: "Order Delivered",     message: (id) => `Order ${id} has been delivered. AWB: ${awb}` },
      RTO:        { title: "Order RTO Initiated", message: (id) => `Order ${id} is being returned to origin. AWB: ${awb}` },
    };
    const notif = notifMap[axqenStatus];
    if (notif) {
      await prisma.notification.create({
        data: {
          userId:  order.sellerId,
          type:    "ORDER_UPDATE",
          title:   notif.title,
          message: notif.message(order.externalOrderId),
          data:    { orderId: order.id, awb, status: axqenStatus },
        },
      });
    }
  }

  return NextResponse.json({ received: true, orderId: order.id, status: axqenStatus });
}

// Delhivery also sends GET to verify webhook endpoint
export async function GET() {
  return NextResponse.json({ status: "ok", service: "AXQEN Delhivery Webhook" });
}
