/**
 * GET /api/cron/auto-awb-delhivery
 *
 * Runs every 5 minutes. Finds all orders without an AWB and auto-creates
 * Delhivery shipments using the admin DELHIVERY_API_TOKEN env var.
 * Pickup location: supplier's configured DELHIVERY provider baseUrl,
 * or DELHIVERY_PICKUP_LOCATION env var as fallback.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { delhiveryCreateShipment } from "@/lib/shipping-adapters";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminToken = process.env.DELHIVERY_API_TOKEN;
  if (!adminToken) {
    return NextResponse.json({ skipped: true, reason: "DELHIVERY_API_TOKEN not set" });
  }

  const defaultPickup = process.env.DELHIVERY_PICKUP_LOCATION ?? "";

  // Find orders that need AWB: no AWB, not cancelled/delivered/RTO, have supplier assigned
  const orders = await prisma.order.findMany({
    where: {
      awbNumber: null,
      status: { notIn: ["CANCELLED", "DELIVERED", "RTO"] as never[] },
      customerAddress: { not: undefined },
    },
    include: {
      items: { select: { name: true, quantity: true } },
    },
    take: 50,
    orderBy: { createdAt: "asc" },
  });

  if (!orders.length) {
    return NextResponse.json({ processed: 0, note: "No orders need AWB" });
  }

  // Pre-fetch supplier pickup locations (supplierId → pickup location name)
  const supplierIds = [...new Set(orders.map(o => o.supplierId).filter(Boolean) as string[])];
  const pickupBySupplier: Record<string, string> = {};
  if (supplierIds.length) {
    const providers = await prisma.supplierShippingProvider.findMany({
      where: { supplierId: { in: supplierIds }, provider: "DELHIVERY", isActive: true },
      select: { supplierId: true, baseUrl: true },
    });
    for (const p of providers) {
      if (p.baseUrl?.trim()) pickupBySupplier[p.supplierId] = p.baseUrl.trim();
    }
  }

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const order of orders) {
    const pickupLocation = (order.supplierId && pickupBySupplier[order.supplierId])
      || defaultPickup;

    if (!pickupLocation) {
      skipped++;
      errors.push(`Order ${order.externalOrderId}: no pickup location configured`);
      continue;
    }

    const addr = (order.customerAddress ?? {}) as Record<string, string>;
    const phone   = (addr.phone ?? "").replace(/\D/g, "").slice(-10);
    const pincode = addr.pincode ?? addr.zip ?? "";
    const city    = addr.city ?? "";

    if (!phone || !pincode || !city) {
      skipped++;
      errors.push(`Order ${order.externalOrderId}: missing phone/pincode/city`);
      continue;
    }

    try {
      const result = await delhiveryCreateShipment(adminToken, {
        externalOrderId: order.externalOrderId,
        customerName:    order.customerName ?? "Customer",
        address:         addr.address ?? addr.address1 ?? "",
        city,
        state:           addr.state ?? addr.province ?? "",
        pincode,
        phone,
        totalAmount:     order.totalAmount,
        productDesc:     order.items.map(i => `${i.name} x${i.quantity}`).join(", ") || "Product",
        weight: 0.5, length: 23, breadth: 13, height: 4,
        shipmentMode: "Surface",
      }, pickupLocation);

      await prisma.order.update({
        where: { id: order.id },
        data: {
          awbNumber:         result.awb,
          courier:           result.courier,
          trackingUrl:       result.trackingUrl ?? null,
          supplierTrackingNo: result.awb,
          supplierCourier:   result.courier,
        },
      });

      await prisma.orderTimeline.create({
        data: {
          orderId:   order.id,
          actorRole: "SYSTEM",
          event:     "AWB_CREATED",
          details:   `Auto-created Delhivery AWB: ${result.awb}`,
          metadata:  { awb: result.awb, courier: result.courier, auto: true },
        },
      });

      created++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Order ${order.externalOrderId}: ${msg}`);
    }
  }

  return NextResponse.json({ processed: orders.length, created, skipped, errors });
}
