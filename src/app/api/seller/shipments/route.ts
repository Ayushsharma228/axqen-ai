import { NextRequest, NextResponse } from "next/server";
import { Prisma, OrderStatus } from "@prisma/client";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SHIPDAAK_COURIER_PREFIX } from "@/lib/shipdaak";
import { loadCourierScans, shipmentStage, type ShipmentStage } from "@/lib/courier-scans";

// Seller Shipments list: detailed stage from courier scans, delay flags, courier performance.
// GET ?tab=ALL|READY_FOR_PICKUP|IN_TRANSIT|OUT_FOR_DELIVERY|DELIVERED|RTO &flag=DELAYED|STUCK
//     &days=7|30|90 (by order date; omit = all) &courier &payment=COD|PREPAID &search &page

const PAGE = 50;
const STUCK_HOURS = 72;
const ACTIVE: ShipmentStage[] = ["READY_FOR_PICKUP", "IN_TRANSIT", "OUT_FOR_DELIVERY"];

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sellerId = session.user.id;
  const sp = req.nextUrl.searchParams;
  const tab = (sp.get("tab") ?? "ALL").toUpperCase();
  const flag = (sp.get("flag") ?? "").toUpperCase();
  const days = Number(sp.get("days") ?? "") || null;
  const courierFilter = sp.get("courier") ?? "";
  const payment = sp.get("payment");
  const search = sp.get("search")?.trim();
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);

  const seller = await prisma.user.findUnique({ where: { id: sellerId }, select: { dataStartDate: true } });
  const floor = seller?.dataStartDate ?? null;
  const since = days ? new Date(Date.now() - days * 86400000) : null;
  const gte = floor && since ? (floor > since ? floor : since) : (floor ?? since);

  const where: Prisma.OrderWhereInput = {
    sellerId,
    status: { in: ["PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "RTO"] as OrderStatus[] },
    OR: [{ awbNumber: { not: null } }, { supplierTrackingNo: { not: null } }],
    ...(gte ? { createdAt: { gte } } : {}),
    ...(payment === "COD" || payment === "PREPAID" ? { paymentMode: payment } : {}),
    ...(search ? {
      AND: [{
        OR: [
          { externalOrderId:    { contains: search, mode: "insensitive" } },
          { awbNumber:          { contains: search, mode: "insensitive" } },
          { supplierTrackingNo: { contains: search, mode: "insensitive" } },
          { customerName:       { contains: search, mode: "insensitive" } },
          { customerAddress:    { path: ["phone"], string_contains: search } },
        ],
      }],
    } : {}),
  };

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 3000,
    select: {
      id: true, externalOrderId: true, status: true, paymentMode: true, totalAmount: true,
      awbNumber: true, supplierTrackingNo: true, courier: true, supplierCourier: true,
      customerName: true, customerAddress: true,
      createdAt: true, updatedAt: true, dispatchedAt: true, expectedDeliveryDate: true,
    },
  });

  const scans = await loadCourierScans(orders.map(o => o.id));
  const now = Date.now();
  const prettyCourier = (o: typeof orders[number]) => {
    const c = o.courier ?? o.supplierCourier ?? "";
    return (c.startsWith(SHIPDAAK_COURIER_PREFIX) ? c.slice(SHIPDAAK_COURIER_PREFIX.length) : c) || "—";
  };

  const enriched = orders.map(o => {
    const list = scans.get(o.id) ?? [];
    const stage = shipmentStage(o.status, list);
    const last = list[0] ?? null;
    const first = list[list.length - 1] ?? null;
    const start = o.dispatchedAt?.toISOString() ?? first?.time ?? o.createdAt.toISOString();
    const deliveredAt = stage === "DELIVERED" ? (last?.time ?? o.updatedAt.toISOString()) : null;
    const end = stage === "DELIVERED" ? deliveredAt! : stage === "RTO" ? (last?.time ?? o.updatedAt.toISOString()) : new Date(now).toISOString();
    const daysInTransit = Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 86400000));
    const edd = o.expectedDeliveryDate?.toISOString() ?? null;
    const lastActivity = new Date(last?.time ?? o.dispatchedAt ?? o.updatedAt).getTime();
    const active = ACTIVE.includes(stage);
    const eddEnd = edd ? new Date(edd).setUTCHours(23, 59, 59, 999) : null;
    return {
      o, stage, last, deliveredAt, daysInTransit, edd,
      courier: prettyCourier(o),
      delayed: active && eddEnd !== null && eddEnd < now,
      stuck: active && now - lastActivity > STUCK_HOURS * 3600000,
      onTime: stage === "DELIVERED" && eddEnd !== null ? new Date(deliveredAt!).getTime() <= eddEnd : null,
      scanCount: list.length,
    };
  });

  // Courier list + performance (over the whole date range, before tab/flag filters)
  const couriers = [...new Set(enriched.map(e => e.courier))].filter(c => c !== "—").sort();
  const delivered = enriched.filter(e => e.stage === "DELIVERED");
  const deliveredDays = delivered.map(e => e.daysInTransit);
  const withEdd = delivered.filter(e => e.onTime !== null);
  const byCourier = couriers.map(c => {
    const rows = enriched.filter(e => e.courier === c);
    const d = rows.filter(e => e.stage === "DELIVERED").length;
    const r = rows.filter(e => e.stage === "RTO").length;
    const dd = rows.filter(e => e.stage === "DELIVERED").map(e => e.daysInTransit);
    return {
      courier: c, shipments: rows.length, delivered: d, rto: r,
      rtoPct: d + r > 0 ? Math.round((r / (d + r)) * 100) : null,
      avgDays: dd.length ? +(dd.reduce((s, x) => s + x, 0) / dd.length).toFixed(1) : null,
    };
  }).sort((a, b) => b.shipments - a.shipments);

  const scoped = courierFilter ? enriched.filter(e => e.courier === courierFilter) : enriched;
  const counts: Record<string, number> = {
    ALL: scoped.length,
    READY_FOR_PICKUP: 0, IN_TRANSIT: 0, OUT_FOR_DELIVERY: 0, DELIVERED: 0, RTO: 0,
    DELAYED: scoped.filter(e => e.delayed).length,
    STUCK: scoped.filter(e => e.stuck).length,
  };
  for (const e of scoped) counts[e.stage]++;

  let filtered = tab === "ALL" ? scoped : scoped.filter(e => e.stage === tab);
  if (flag === "DELAYED") filtered = filtered.filter(e => e.delayed);
  if (flag === "STUCK") filtered = filtered.filter(e => e.stuck);

  const total = filtered.length;
  const pageRows = filtered.slice((page - 1) * PAGE, page * PAGE);

  // Delivery issues raised by the seller, for rows on this page
  const issues = pageRows.length
    ? await prisma.orderTimeline.findMany({
        where: { orderId: { in: pageRows.map(e => e.o.id) }, event: "DELIVERY_ISSUE" },
        orderBy: { createdAt: "desc" },
        select: { id: true, orderId: true, details: true, createdAt: true },
      })
    : [];

  return NextResponse.json({
    shipments: pageRows.map(e => {
      const addr = (e.o.customerAddress ?? {}) as Record<string, string>;
      return {
        id: e.o.id,
        externalOrderId: e.o.externalOrderId,
        status: e.o.status,
        stage: e.stage,
        awb: e.o.awbNumber ?? e.o.supplierTrackingNo,
        courier: e.courier,
        paymentMode: e.o.paymentMode,
        totalAmount: e.o.totalAmount,
        customerName: e.o.customerName,
        phone: addr.phone ?? null,
        city: addr.city ?? null,
        state: addr.state ?? addr.province ?? null,
        orderDate: e.o.createdAt.toISOString(),
        dispatchedAt: e.o.dispatchedAt?.toISOString() ?? null,
        edd: e.edd,
        deliveredAt: e.deliveredAt,
        daysInTransit: e.daysInTransit,
        delayed: e.delayed,
        stuck: e.stuck,
        lastScan: e.last,
        scanCount: e.scanCount,
        issues: issues.filter(i => i.orderId === e.o.id).map(i => ({ id: i.id, details: i.details, createdAt: i.createdAt.toISOString() })),
      };
    }),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE)),
    counts,
    couriers,
    performance: {
      avgDeliveryDays: deliveredDays.length ? +(deliveredDays.reduce((s, x) => s + x, 0) / deliveredDays.length).toFixed(1) : null,
      onTimePct: withEdd.length ? Math.round((withEdd.filter(e => e.onTime).length / withEdd.length) * 100) : null,
      byCourier,
    },
  });
}
