import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NDR_VISIBLE_FROM } from "@/lib/ndr";

// Small counts for the seller sidebar badges.
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sellerId = session.user.id;

  const seller = await prisma.user.findUnique({ where: { id: sellerId }, select: { dataStartDate: true } });
  const floor = seller?.dataStartDate ? { createdAt: { gte: seller.dataStartDate } } : {};

  const [codBeingCalled, ndrOpen] = await Promise.all([
    // New orders the AXQEN team is still confirming
    prisma.order.count({ where: { sellerId, status: "NEW", ...floor } }),
    // Failed deliveries with no action yet (same rules as the NDR page)
    prisma.order.count({
      where: {
        sellerId,
        ndrStatus: { not: null },
        ndrActionTaken: null,
        status: { notIn: ["DELIVERED", "RTO", "CANCELLED", "HIDDEN"] as never[] },
        ndrCreatedAt: { gte: NDR_VISIBLE_FROM },
      },
    }),
  ]);

  return NextResponse.json({ codBeingCalled, ndrOpen });
}
