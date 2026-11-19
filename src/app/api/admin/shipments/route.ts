import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { loadCourierScans, shipmentStage, type CourierScan } from "@/lib/courier-scans";
import { SHIPDAAK_COURIER_PREFIX } from "@/lib/shipdaak";

// READ-ONLY shipments desk: orders on the move, stuck shipments, and courier/state performance. GET ?sellerId=
const STUCK_DAYS = 3;
const DAY = 86400000;
const DELIVERED_SCAN = /delivered/i;

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sellerId = req.nextUrl.searchParams.get("sellerId") || "";
  const scope = sellerId ? { sellerId } : {};
  const now = Date.now();
  // Start of today in IST
  const ist = new Date(now + 5.5 * 3600000);
  const todayStart = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 5.5 * 3600000);
  const since30 = new Date(now - 30 * DAY);

  const select = {
    id: true, externalOrderId: true, status: true, awbNumber: true, courier: true, paymentMode: true, totalAmount: true,
    customerName: true, customerAddress: true, createdAt: true, updatedAt: true, dispatchedAt: true,
    seller: { select: { name: true, email: true, brandName: true } },
  } as const;

  const [active, deliveredToday, recent] = await Promise.all([
    prisma.order.findMany({ where: { ...scope, status: { in: ["PROCESSING", "SHIPPED", "IN_TRANSIT"] } }, select, orderBy: { createdAt: "asc" }, take: 3000 }),
    prisma.order.findMany({ where: { ...scope, status: "DELIVERED", updatedAt: { gte: todayStart } }, select, orderBy: { updatedAt: "desc" }, take: 500 }),
    prisma.order.findMany({
      where: { ...scope, createdAt: { gte: since30 }, courier: { not: null }, status: { in: ["SHIPPED", "IN_TRANSIT", "DELIVERED", "RTO"] } },
      select: { id: true, status: true, courier: true, customerAddress: true },
      take: 10000,
    }),
  ]);

  const scans = await loadCourierScans([...active, ...deliveredToday].map(o => o.id));
  type Row = (typeof active)[number];
  const toRow = (o: Row) => {
    const list: CourierScan[] = scans.get(o.id) ?? [];
    const stage = o.status === "PROCESSING" && !o.awbNumber ? "READY_TO_SHIP" : shipmentStage(o.status, list);
    const last = list[0] ?? null;
    const lastAt = last ? new Date(last.time).getTime() : (o.dispatchedAt ?? o.updatedAt).getTime();
    const idleDays = Math.floor((now - lastAt) / DAY);
    const a = (o.customerAddress ?? {}) as Record<string, string | undefined>;
    return {
      id: o.id, externalOrderId: o.externalOrderId, status: o.status, stage,
      awbNumber: o.awbNumber, courier: o.courier?.replace(SHIPDAAK_COURIER_PREFIX, "") ?? null, viaShipdaak: !!o.courier?.startsWith(SHIPDAAK_COURIER_PREFIX),
      paymentMode: o.paymentMode, totalAmount: o.totalAmount, customerName: o.customerName,
      city: a.city ?? null, state: a.state ?? a.province ?? null, pincode: a.pincode ?? a.zip ?? null,
      seller: o.seller.brandName || o.seller.name || o.seller.email,
      createdAt: o.createdAt.toISOString(),
      lastScan: last ? { status: last.status, location: last.location, time: last.time } : null,
      idleDays,
      stuck: !!o.awbNumber && stage !== "READY_TO_SHIP" && idleDays >= STUCK_DAYS,
    };
  };
  const rows = active.map(toRow);
  const today = deliveredToday.map(toRow);

  // Courier performance, last 30 days (orders with a courier)
  const cMap = new Map<string, { courier: string; total: number; delivered: number; rto: number; days: number[] }>();
  const sMap = new Map<string, { state: string; total: number; delivered: number; rto: number }>();
  for (const o of recent) {
    const c = (o.courier ?? "").replace(SHIPDAAK_COURIER_PREFIX, "") || "Unknown";
    const cr = cMap.get(c) ?? { courier: c, total: 0, delivered: 0, rto: 0, days: [] };
    cr.total++; if (o.status === "DELIVERED") cr.delivered++; if (o.status === "RTO") cr.rto++;
    cMap.set(c, cr);
    const a = (o.customerAddress ?? {}) as Record<string, string | undefined>;
    const st = (a.state || a.province || "Unknown").trim() || "Unknown";
    const sr = sMap.get(st) ?? { state: st, total: 0, delivered: 0, rto: 0 };
    sr.total++; if (o.status === "DELIVERED") sr.delivered++; if (o.status === "RTO") sr.rto++;
    sMap.set(st, sr);
  }
  // Average days from first courier scan to the delivered scan
  const deliveredIds = recent.filter(o => o.status === "DELIVERED").slice(0, 3000);
  const dScans = await loadCourierScans(deliveredIds.map(o => o.id));
  for (const o of deliveredIds) {
    const list = dScans.get(o.id) ?? [];
    if (list.length < 2) continue;
    const del = list.find(s => DELIVERED_SCAN.test(s.status) && !/undelivered|not delivered/i.test(s.status));
    const first = list[list.length - 1];
    if (!del) continue;
    const d = (new Date(del.time).getTime() - new Date(first.time).getTime()) / DAY;
    if (d >= 0 && d < 30) cMap.get((o.courier ?? "").replace(SHIPDAAK_COURIER_PREFIX, "") || "Unknown")?.days.push(d);
  }
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
  const couriers = [...cMap.values()].map(c => ({
    courier: c.courier, total: c.total, delivered: c.delivered, rto: c.rto, inTransit: c.total - c.delivered - c.rto,
    deliveredPct: pct(c.delivered, c.delivered + c.rto), rtoPct: pct(c.rto, c.delivered + c.rto),
    avgDays: c.days.length ? Math.round((c.days.reduce((s, x) => s + x, 0) / c.days.length) * 10) / 10 : null,
  })).sort((a, b) => b.total - a.total);
  const states = [...sMap.values()].map(s => ({
    ...s, deliveredPct: pct(s.delivered, s.delivered + s.rto), rtoPct: pct(s.rto, s.delivered + s.rto),
  })).filter(s => s.delivered + s.rto >= 3).sort((a, b) => b.total - a.total).slice(0, 20);

  const count = (k: string) => rows.filter(r => r.stage === k).length;
  return NextResponse.json({
    rows, deliveredToday: today, couriers, states,
    counts: {
      READY_TO_SHIP: count("READY_TO_SHIP"), READY_FOR_PICKUP: count("READY_FOR_PICKUP"), IN_TRANSIT: count("IN_TRANSIT"),
      OUT_FOR_DELIVERY: count("OUT_FOR_DELIVERY"), STUCK: rows.filter(r => r.stuck).length, DELIVERED_TODAY: today.length,
    },
    stuckDays: STUCK_DAYS,
  });
}
