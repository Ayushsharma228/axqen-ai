import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const escalationThreshold = new Date(Date.now() - 2 * 86400000); // 2 days ago

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const [orders, actioned, escalatedCount] = await Promise.all([
    prisma.order.findMany({
      where: {
        sellerId: session.user.id,
        ndrActionTaken: null,
        // Show: orders with NDR data, OR orders that became RTO without NDR captured
        OR: [
          { ndrStatus: { not: null } },
          { status: "RTO", ndrStatus: null, awbNumber: { not: null }, createdAt: { gte: thirtyDaysAgo } },
        ],
      },
      select: {
        id: true, externalOrderId: true, customerName: true,
        customerAddress: true, totalAmount: true, awbNumber: true,
        trackingUrl: true, ndrReason: true, ndrStatus: true,
        ndrAttempts: true, ndrActionTaken: true, createdAt: true,
        ndrCreatedAt: true,
      },
      orderBy: { ndrCreatedAt: "asc" }, // oldest (most urgent) first
    }),
    prisma.order.findMany({
      where: {
        sellerId: session.user.id,
        ndrStatus: { not: null },
        ndrActionTaken: { not: null },
      },
      select: {
        id: true, externalOrderId: true, customerName: true,
        awbNumber: true, ndrReason: true, ndrActionTaken: true,
        ndrAttempts: true, createdAt: true, ndrCreatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.order.count({
      where: {
        sellerId: session.user.id,
        ndrStatus: { not: null },
        ndrActionTaken: null,
        ndrCreatedAt: { lt: escalationThreshold },
      },
    }),
  ]);

  return NextResponse.json({ pending: orders, actioned, escalatedCount });
}
