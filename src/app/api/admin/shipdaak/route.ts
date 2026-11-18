import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getCarrierTrackingUrl } from "@/lib/shipping-adapters";
import { BLOCKED_MESSAGE, ordersBlockedFor } from "@/lib/plan-billing";
import {
  SHIPDAAK_COURIER_PREFIX, createShipment, getCouriers, getLabel, listWarehouses, shipdaakConfigured,
} from "@/lib/shipdaak";

async function requireAdmin(req: NextRequest) {
  const session = await getRouteSession(req);
  return session?.user.role === "ADMIN" ? session : null;
}

// GET: warehouses + couriers for the Ship modal.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!shipdaakConfigured()) return NextResponse.json({ configured: false, warehouses: [], couriers: [] });
  try {
    const [warehouses, couriers] = await Promise.all([listWarehouses(), getCouriers()]);
    return NextResponse.json({ configured: true, warehouses, couriers });
  } catch (err) {
    return NextResponse.json({ configured: true, error: err instanceof Error ? err.message : "Shipdaak error", warehouses: [], couriers: [] }, { status: 502 });
  }
}

// POST { action: "ship", orderId, warehouseId, courierId?, weightKg, length, breadth, height }
// POST { action: "label", orderId }
export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!shipdaakConfigured()) return NextResponse.json({ error: "Shipdaak is not set up. Add SHIPDAAK_EMAIL and SHIPDAAK_PASSWORD in Vercel." }, { status: 400 });

  const body = await req.json();
  const order = await prisma.order.findUnique({ where: { id: body.orderId }, include: { items: true } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (body.action === "label") {
    if (!order.awbNumber || !order.courier?.startsWith(SHIPDAAK_COURIER_PREFIX)) {
      return NextResponse.json({ error: "This order wasn't shipped through Shipdaak" }, { status: 400 });
    }
    try {
      const url = await getLabel([order.awbNumber]);
      return NextResponse.json({ labelUrl: url });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Label failed" }, { status: 502 });
    }
  }

  if (body.action !== "ship") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  if (await ordersBlockedFor(order.sellerId)) return NextResponse.json({ error: BLOCKED_MESSAGE }, { status: 409 });

  if (order.awbNumber) return NextResponse.json({ error: `Order already has AWB ${order.awbNumber}` }, { status: 400 });
  if (["CANCELLED", "DELIVERED", "RTO", "HIDDEN"].includes(order.status)) {
    return NextResponse.json({ error: `Order is ${order.status.toLowerCase()} and can't be shipped` }, { status: 400 });
  }
  if (order.paymentMode === "UNKNOWN") {
    return NextResponse.json({ error: "Payment mode (COD or prepaid) is unknown for this order. Set it before shipping." }, { status: 400 });
  }

  const warehouseId = Number(body.warehouseId);
  if (!(warehouseId > 0)) return NextResponse.json({ error: "Choose a pickup warehouse" }, { status: 400 });

  const addr = (order.customerAddress ?? {}) as Record<string, string>;
  const phone   = (addr.phone ?? "").replace(/\D/g, "").slice(-10);
  const city    = addr.city ?? "";
  const state   = addr.state ?? addr.province ?? "";
  const pincode = (addr.pincode ?? addr.zip ?? "").replace(/\D/g, "");
  const address = [addr.address ?? addr.address1 ?? "", addr.address2 ?? ""].filter(Boolean).join(", ");
  const missing = [!phone && "phone", !address && "address", !city && "city", !state && "state", pincode.length !== 6 && "6-digit pincode"].filter(Boolean);
  if (missing.length) return NextResponse.json({ error: `Customer ${missing.join(", ")} missing or invalid on this order` }, { status: 400 });

  const num = (v: unknown, d: number) => (typeof v === "number" && v > 0 ? v : Number(v) > 0 ? Number(v) : d);

  let shipment;
  try {
    shipment = await createShipment({
      orderNo:     order.externalOrderId,
      payType:     order.paymentMode === "COD" ? "cod" : "prepaid",
      totalAmount: order.totalAmount,
      weightGrams: num(body.weightKg, 0.5) * 1000,
      length:      num(body.length, 23),
      breadth:     num(body.breadth, 13),
      height:      num(body.height, 4),
      warehouseId,
      courierId:   Number(body.courierId) > 0 ? Number(body.courierId) : undefined,
      consignee:   { name: order.customerName ?? "Customer", address1: address, city, state, pincode, phone },
      items:       order.items.length
        ? order.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, sku: i.sku }))
        : [{ name: "Product", quantity: 1, price: order.totalAmount }],
    });
  } catch (err) {
    return NextResponse.json({ error: `Shipdaak: ${err instanceof Error ? err.message : "shipment failed"}` }, { status: 502 });
  }

  const courier = `${SHIPDAAK_COURIER_PREFIX}${shipment.courier_name}`;
  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        awbNumber:    shipment.awb_number,
        courier,
        trackingUrl:  getCarrierTrackingUrl(shipment.courier_name, shipment.awb_number) || null,
        status:       "SHIPPED",
        dispatchedAt: new Date(),
      },
    }),
    prisma.orderTimeline.create({
      data: {
        orderId:   order.id,
        actorId:   session.user.id,
        actorRole: "ADMIN",
        event:     "DISPATCHED",
        details:   `Shipped via Shipdaak (${shipment.courier_name}) from AXQEN warehouse`,
        metadata:  { awb: shipment.awb_number, courier: shipment.courier_name, provider: "SHIPDAAK", shipdaakShipmentId: shipment.shipment_id, labelUrl: shipment.label ?? null, warehouseId },
      },
    }),
  ]);

  return NextResponse.json({ success: true, awb: shipment.awb_number, courier: shipment.courier_name, labelUrl: shipment.label ?? null });
}
