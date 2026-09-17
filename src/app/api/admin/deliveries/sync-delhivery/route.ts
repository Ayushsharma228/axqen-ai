import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { delhiveryCreateShipment } from "@/lib/shipping-adapters";

async function fetchDelhiveryPickupLocation(token: string): Promise<string> {
  try {
    const res = await fetch("https://track.delhivery.com/api/backend/clientwarehouse/get/", {
      headers: { Authorization: `Token ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      const warehouses = (data?.results ?? data?.data ?? []) as { name: string }[];
      if (warehouses.length > 0) return warehouses[0].name;
    }
  } catch {}
  return "";
}

export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminToken = process.env.DELHIVERY_API_TOKEN;
  if (!adminToken) {
    return NextResponse.json({ error: "DELHIVERY_API_TOKEN not configured" }, { status: 500 });
  }

  const defaultPickup = process.env.DELHIVERY_PICKUP_LOCATION
    || await fetchDelhiveryPickupLocation(adminToken);

  if (!defaultPickup) {
    return NextResponse.json({ error: "No Delhivery pickup location found. Add DELHIVERY_PICKUP_LOCATION env var or create a pickup point in your Delhivery account." }, { status: 400 });
  }

  const orders = await prisma.order.findMany({
    where: {
      awbNumber: null,
      status: { notIn: ["CANCELLED", "DELIVERED", "RTO"] as never[] },
      customerAddress: { not: undefined },
    },
    include: { items: { select: { name: true, quantity: true } } },
    take: 100,
    orderBy: { createdAt: "asc" },
  });

  if (!orders.length) {
    return NextResponse.json({ created: 0, skipped: 0, errors: [], message: "All orders already have AWBs" });
  }

  // Per-supplier pickup locations
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
    const pickupLocation = (order.supplierId && pickupBySupplier[order.supplierId]) || defaultPickup;

    const addr = (order.customerAddress ?? {}) as Record<string, string>;
    const phone   = (addr.phone ?? "").replace(/\D/g, "").slice(-10);
    const pincode = addr.pincode ?? addr.zip ?? "";
    const city    = addr.city ?? "";

    if (!phone || !pincode || !city) {
      skipped++;
      errors.push(`#${order.externalOrderId}: missing phone/pincode/city`);
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
          awbNumber:          result.awb,
          courier:            result.courier,
          trackingUrl:        result.trackingUrl ?? null,
          supplierTrackingNo: result.awb,
          supplierCourier:    result.courier,
        },
      });

      await prisma.orderTimeline.create({
        data: {
          orderId:   order.id,
          actorRole: "ADMIN",
          actorId:   session.user.id,
          event:     "AWB_CREATED",
          details:   `Manually synced to Delhivery. AWB: ${result.awb}`,
          metadata:  { awb: result.awb, courier: result.courier, pickupLocation, manual: true },
        },
      });

      created++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`#${order.externalOrderId}: ${msg}`);
    }
  }

  return NextResponse.json({ created, skipped, errors, total: orders.length, pickupLocation: defaultPickup });
}
