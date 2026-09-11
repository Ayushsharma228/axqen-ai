import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sellerId = session.user.id;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const delayThreshold = new Date(Date.now() - 24 * 3600000);

  const [
    autoDispatched,
    codOrdersToday,
    ndrEscalated,
    supplierDelays,
    humanActions,
  ] = await Promise.all([
    // Orders AXQEN auto-dispatched today (AWB assigned today, not manually set)
    prisma.order.count({
      where: {
        sellerId,
        awbNumber: { not: null },
        updatedAt: { gte: todayStart },
        status: { in: ["SHIPPED", "IN_TRANSIT", "DELIVERED"] },
      },
    }),

    // New orders ingested today (AXQEN picks these up for confirmation/processing)
    prisma.order.count({
      where: {
        sellerId,
        createdAt: { gte: todayStart },
      },
    }),

    // NDR cases escalated (open NDRs older than 2 days — same threshold as NDR route)
    prisma.order.count({
      where: {
        sellerId,
        ndrStatus: { not: null },
        ndrActionTaken: null,
        ndrCreatedAt: { lt: new Date(Date.now() - 2 * 86400000) },
      },
    }),

    // Supplier delays: orders assigned to a supplier >24h ago but still not dispatched
    prisma.order.count({
      where: {
        sellerId,
        supplierId: { not: null },
        supplierStatus: { in: ["ACCEPTED", "PROCESSING", "PACKED"] },
        updatedAt: { lt: delayThreshold },
      },
    }),

    // Human actions = only orders that genuinely need seller input:
    // NEW with no supplier assigned (not auto-handled) + open NDRs
    prisma.order.count({
      where: {
        sellerId,
        OR: [
          { status: "NEW", supplierId: null },
          { ndrStatus: { not: null }, ndrActionTaken: null },
        ],
      },
    }),
  ]);

  // Time saved estimate (minutes per action type)
  const timeSaved =
    autoDispatched * 8 +
    codOrdersToday * 3 +
    ndrEscalated   * 5 +
    supplierDelays * 4;

  const hours   = Math.floor(timeSaved / 60);
  const minutes = timeSaved % 60;
  const timeSavedLabel =
    hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return NextResponse.json({
    autoDispatched,
    codOrdersToday,
    ndrEscalated,
    supplierDelays,
    humanActions,
    timeSaved,
    timeSavedLabel,
  });
}
