import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const from     = searchParams.get("from")     ?? "";
  const to       = searchParams.get("to")       ?? "";
  const sellerId = searchParams.get("sellerId") ?? "";

  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["SHIPPED", "IN_TRANSIT", "DELIVERED", "RTO"] },
      ...(sellerId ? { sellerId } : {}),
      ...((from || to) ? {
        createdAt: {
          ...(from ? { gte: new Date(from) }                   : {}),
          ...(to   ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
        },
      } : {}),
    },
    select: { status: true, createdAt: true, ndrStatus: true },
    orderBy: { createdAt: "asc" },
  });

  const map = new Map<string, { shipped: number; inTransit: number; delivered: number; rto: number; ndr: number }>();
  for (const o of orders) {
    const day = o.createdAt.toISOString().slice(0, 10);
    const cur = map.get(day) ?? { shipped: 0, inTransit: 0, delivered: 0, rto: 0, ndr: 0 };
    if (o.status === "SHIPPED")    cur.shipped++;
    if (o.status === "IN_TRANSIT") cur.inTransit++;
    if (o.status === "DELIVERED")  cur.delivered++;
    if (o.status === "RTO")        cur.rto++;
    if (o.ndrStatus)               cur.ndr++;
    map.set(day, cur);
  }

  const trend = Array.from(map.entries()).map(([date, v]) => ({ date, ...v }));
  return NextResponse.json({ trend });
}
