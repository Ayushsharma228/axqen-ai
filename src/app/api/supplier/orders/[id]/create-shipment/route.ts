import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  shiprocketCreateShipment,
  customCreateShipment,
  getCarrierTrackingUrl,
  ShipmentInput,
} from "@/lib/shipping-adapters";
import { decrypt } from "@/lib/encrypt";
import { SHIPDAAK_COURIER_PREFIX, createShipment as shipdaakCreateShipment, ensureShipdaakWarehouse, shipdaakConfigured } from "@/lib/shipdaak";

// Virtual provider for the AXQEN platform Shipdaak account (not stored per supplier).
const SHIPDAAK_PROVIDER_ID = "SHIPDAAK";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SUPPLIER")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { providerId, shipmentMode, weight, length, breadth, height, warehouseId, courierId } = await req.json();
  if (!providerId) return NextResponse.json({ error: "providerId required" }, { status: 400 });
  const resolvedMode: "Surface" | "Express" = shipmentMode === "Express" ? "Express" : "Surface";

  // Fetch order (must belong to this supplier)
  const order = await prisma.order.findFirst({
    where: { id, supplierId: session.user.id },
    include: { items: true, purchaseOrder: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.supplierStatus === "DISPATCHED")
    return NextResponse.json({ error: "Order already dispatched" }, { status: 400 });

  // Parse customer address
  const addr = (order.customerAddress ?? {}) as Record<string, string>;
  const phone   = (addr.phone   ?? "").replace(/\D/g, "").slice(-10);
  const city    = addr.city    ?? "";
  const state   = addr.state   ?? addr.province ?? "";
  const pincode = addr.pincode ?? addr.zip      ?? "";
  const address = addr.address ?? addr.address1 ?? "";

  if (!phone || !pincode || !city) {
    return NextResponse.json({ error: "Order is missing customer phone, city or pincode" }, { status: 400 });
  }

  const productDesc = order.items.map((i) => `${i.name} x${i.quantity}`).join(", ") || "Product";

  const input: ShipmentInput = {
    externalOrderId: order.externalOrderId,
    customerName:    order.customerName ?? "Customer",
    address, city, state, pincode, phone,
    totalAmount: order.totalAmount,
    productDesc,
    weight:  typeof weight  === "number" && weight  > 0 ? weight  : 0.5,
    length:  typeof length  === "number" && length  > 0 ? length  : 23,
    breadth: typeof breadth === "number" && breadth > 0 ? breadth : 13,
    height:  typeof height  === "number" && height  > 0 ? height  : 4,
    shipmentMode: resolvedMode,
  };

  let result: { awb: string; courier: string; trackingUrl?: string; labelUrl?: string };

  // ── AXQEN Shipping via Shipdaak (platform account) ──
  if (providerId === SHIPDAAK_PROVIDER_ID) {
    if (!shipdaakConfigured()) return NextResponse.json({ error: "AXQEN Shipping is not set up yet. Contact admin." }, { status: 400 });
    if (order.paymentMode === "UNKNOWN") {
      return NextResponse.json({ error: "This order's payment mode (COD or prepaid) is unknown. Ask admin to set it before shipping." }, { status: 400 });
    }

    const warehouse = await prisma.warehouse.findFirst({
      where: { supplierId: session.user.id, status: "APPROVED", ...(warehouseId ? { id: warehouseId } : {}) },
      orderBy: { createdAt: "asc" },
    });
    if (!warehouse) {
      return NextResponse.json({ error: "You need an approved pickup warehouse first. Add one under Warehouse and wait for admin approval." }, { status: 400 });
    }

    try {
      const shipdaakWarehouseId = await ensureShipdaakWarehouse(warehouse.id);
      const shipment = await shipdaakCreateShipment({
        orderNo:     order.externalOrderId,
        payType:     order.paymentMode === "COD" ? "cod" : "prepaid",
        totalAmount: order.totalAmount,
        weightGrams: (input.weight ?? 0.5) * 1000,
        length: input.length ?? 23, breadth: input.breadth ?? 13, height: input.height ?? 4,
        warehouseId: shipdaakWarehouseId,
        courierId:   typeof courierId === "number" && courierId > 0 ? courierId : undefined,
        consignee:   { name: input.customerName, address1: address, city, state, pincode, phone },
        items:       order.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, sku: i.sku })),
      });
      result = {
        awb:      shipment.awb_number,
        courier:  `${SHIPDAAK_COURIER_PREFIX}${shipment.courier_name}`,
        labelUrl: shipment.label,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Shipment creation failed";
      return NextResponse.json({ error: `AXQEN Shipping: ${msg}` }, { status: 502 });
    }

    return finishDispatch({ id, order, sessionUserId: session.user.id, result, providerLabel: "AXQEN Shipping", providerType: "SHIPDAAK", resolvedMode });
  }

  // Fetch provider credentials (full, unmasked)
  const provider = await prisma.supplierShippingProvider.findFirst({
    where: { id: providerId, supplierId: session.user.id, isActive: true },
  });
  if (!provider) return NextResponse.json({ error: "Shipping provider not found" }, { status: 404 });

  const plainApiKey    = provider.apiKey    ? decrypt(provider.apiKey)    : null;
  const plainApiSecret = provider.apiSecret ? decrypt(provider.apiSecret) : null;

  try {
    if (provider.provider === "SHIPROCKET") {
      if (!plainApiKey || !plainApiSecret)
        return NextResponse.json({ error: "Shiprocket email/password not configured" }, { status: 400 });
      result = await shiprocketCreateShipment(plainApiKey, plainApiSecret, input);
    } else if (provider.provider === "DELHIVERY") {
      return NextResponse.json({ error: "Delhivery API shipment creation is disabled. Enter the AWB manually from the admin orders panel." }, { status: 400 });
    } else if (provider.provider === "CUSTOM") {
      if (!plainApiKey || !provider.baseUrl)
        return NextResponse.json({ error: "Custom provider API key/URL not configured" }, { status: 400 });
      result = await customCreateShipment(plainApiKey, provider.baseUrl, input);
    } else {
      return NextResponse.json({ error: "Unknown provider type" }, { status: 400 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Shipment creation failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  return finishDispatch({ id, order, sessionUserId: session.user.id, result, providerLabel: provider.label, providerType: provider.provider, resolvedMode });
}

type DispatchOrder = { externalOrderId: string; purchaseOrder: { id: string } | null };

async function finishDispatch(p: {
  id: string;
  order: DispatchOrder;
  sessionUserId: string;
  result: { awb: string; courier: string; trackingUrl?: string; labelUrl?: string };
  providerLabel: string;
  providerType: string;
  resolvedMode: string;
}) {
  const { id, order, result } = p;
  const ops: any[] = [
    prisma.order.update({
      where: { id },
      data: {
        supplierStatus:    "DISPATCHED",
        status:            "SHIPPED",
        dispatchedAt:      new Date(),
        supplierTrackingNo: result.awb,
        supplierCourier:   result.courier,
        // Mirror to seller-visible fields
        awbNumber:   result.awb,
        courier:     result.courier,
        trackingUrl: result.trackingUrl ?? (getCarrierTrackingUrl(result.courier, result.awb) || null),
      },
    }),
    prisma.orderTimeline.create({
      data: {
        orderId:   id,
        actorId:   p.sessionUserId,
        actorRole: "SUPPLIER",
        event:     "DISPATCHED",
        details:   `Auto-dispatched via ${p.providerLabel} (${p.resolvedMode})`,
        metadata:  { awb: result.awb, courier: result.courier, provider: p.providerType, shipmentMode: p.resolvedMode, labelUrl: result.labelUrl ?? null },
      },
    }),
  ];

  if (order.purchaseOrder) {
    ops.push(prisma.purchaseOrder.update({
      where: { id: order.purchaseOrder.id },
      data: { status: "DISPATCHED", dispatchedAt: new Date() },
    }));
  }

  // Notify admins
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  for (const a of admins) {
    ops.push(prisma.notification.create({
      data: {
        userId:  a.id,
        type:    "ORDER_UPDATE",
        title:   "Order Dispatched",
        message: `Order ${order.externalOrderId} dispatched via ${p.providerLabel}. AWB: ${result.awb}`,
        data:    { orderId: id, awb: result.awb },
      },
    }));
  }

  await prisma.$transaction(ops);

  return NextResponse.json({ success: true, awb: result.awb, courier: result.courier, trackingUrl: result.trackingUrl, labelUrl: result.labelUrl ?? null });
}