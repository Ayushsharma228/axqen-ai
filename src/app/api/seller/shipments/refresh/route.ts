import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SHIPDAAK_COURIER_PREFIX, shipdaakConfigured } from "@/lib/shipdaak";
import { SHIPDAAK_SYNC_SELECT, syncShipdaakOrder } from "@/lib/shipdaak-sync";

// Seller "Refresh tracking" for Shipdaak shipments (Delhivery-direct ones use /api/seller/deliveries/refresh-tracking).
export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!shipdaakConfigured()) return NextResponse.json({ updated: 0, checked: 0 });

  const orders = await prisma.order.findMany({
    where: {
      sellerId:  session.user.id,
      awbNumber: { not: null },
      courier:   { startsWith: SHIPDAAK_COURIER_PREFIX },
      status:    { notIn: ["DELIVERED", "CANCELLED", "RTO", "HIDDEN"] as never[] },
    },
    select: SHIPDAAK_SYNC_SELECT,
    orderBy: { updatedAt: "asc" },
    take: 40,
  });

  let updated = 0;
  for (const o of orders) {
    try { if (await syncShipdaakOrder(o)) updated++; } catch { /* keep going */ }
  }
  return NextResponse.json({ updated, checked: orders.length });
}
