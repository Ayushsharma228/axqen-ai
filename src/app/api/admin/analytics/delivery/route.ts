/**
 * GET /api/admin/analytics/delivery
 * Returns courier breakdown and state breakdown for fulfilled orders.
 * Supports dateFrom, dateTo, sellerId query params.
 */

import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sellerId = searchParams.get("sellerId") ?? "";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo   = searchParams.get("dateTo")   ?? "";

  const baseWhere = {
    status: { in: ["SHIPPED", "IN_TRANSIT", "DELIVERED", "RTO"] as never[] },
    ...(sellerId ? { sellerId } : {}),
    ...(dateFrom || dateTo ? {
      createdAt: {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo   ? { lte: new Date(dateTo) }   : {}),
      },
    } : {}),
  };

  // ── Courier breakdown (Prisma groupBy — courier is a direct column) ─────────
  const [courierRows, courierDelivered, courierRto] = await Promise.all([
    prisma.order.groupBy({
      by: ["courier"],
      where: { ...baseWhere, courier: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    prisma.order.groupBy({
      by: ["courier"],
      where: { ...baseWhere, courier: { not: null }, status: "DELIVERED" },
      _count: { id: true },
    }),
    prisma.order.groupBy({
      by: ["courier"],
      where: { ...baseWhere, courier: { not: null }, status: "RTO" },
      _count: { id: true },
    }),
  ]);

  const deliveredMap = Object.fromEntries(courierDelivered.map(r => [r.courier ?? "", r._count.id]));
  const rtoMap       = Object.fromEntries(courierRto.map(r => [r.courier ?? "", r._count.id]));

  const couriers = courierRows.map(r => ({
    courier:   r.courier ?? "Unknown",
    total:     r._count.id,
    delivered: deliveredMap[r.courier ?? ""] ?? 0,
    rto:       rtoMap[r.courier ?? ""] ?? 0,
  }));

  // ── State breakdown (aggregate client-side from customerAddress JSON) ────────
  const orders = await prisma.order.findMany({
    where: { ...baseWhere, customerAddress: { not: undefined } },
    select: { customerAddress: true, status: true },
    take: 3000,
  });

  const stateMap: Record<string, { total: number; delivered: number; rto: number }> = {};
  for (const o of orders) {
    const addr  = (o.customerAddress ?? {}) as Record<string, string>;
    const state = (addr.state || addr.province || "Unknown").trim() || "Unknown";
    if (!stateMap[state]) stateMap[state] = { total: 0, delivered: 0, rto: 0 };
    stateMap[state].total++;
    if (o.status === "DELIVERED") stateMap[state].delivered++;
    if (o.status === "RTO")       stateMap[state].rto++;
  }

  const states = Object.entries(stateMap)
    .map(([state, v]) => ({ state, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return NextResponse.json({ couriers, states });
}
