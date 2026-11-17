import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordCourierScans, scansFromDelhivery } from "@/lib/courier-scans";

// Higher number = further along. Never let a sync move an order backwards.
const STATUS_RANK: Record<string, number> = {
  NEW: 0, PROCESSING: 1, SHIPPED: 2, IN_TRANSIT: 3,
  DELIVERED: 4, RTO: 4, CANCELLED: 4,
};

// Delhivery RTO statuses — check BEFORE generic "delivered"/"transit" to avoid misclassification
// Covers: "RTO Initiated", "RTO In Transit", "RTO Out for Delivery", "RTO Delivered",
//         "Reverse In Transit", "Reverse Pickup Initiated", "Reverse Pickup",
//         "Returned", "Return to Origin", "Return to Shipper"
const isRTO = (s: string) =>
  s.includes("rto") || s.includes("reverse") || s.includes("return");

function mapDelhiveryStatus(status: string, returnedAt?: string | null): string {
  const s = status?.toLowerCase() ?? "";
  if (isRTO(s) || returnedAt)                          return "RTO";
  if (s.includes("delivered"))                         return "DELIVERED";
  if (s.includes("transit") || s.includes("out for delivery")) return "IN_TRANSIT";
  if (s.includes("dispatch") || s.includes("picked"))  return "SHIPPED";
  if (s.includes("cancel"))                            return "CANCELLED";
  return "";   // unknown (e.g. "Manifested") — do not change current status
}

export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.DELHIVERY_API_TOKEN;
  if (!token) return NextResponse.json({ error: "Delhivery not configured" }, { status: 500 });

  const orders = await prisma.order.findMany({
    where: {
      sellerId: session.user.id,
      awbNumber: { not: null },
      status: { notIn: ["DELIVERED", "CANCELLED", "RTO"] },
      // Shipdaak shipments are synced from Shipdaak itself (see /api/seller/shipments/refresh).
      NOT: { courier: { startsWith: "Shipdaak · " } },
    },
    select: { id: true, awbNumber: true, status: true },
  });

  let updated = 0;

  for (const order of orders) {
    if (!order.awbNumber) continue;

    try {
      const res = await fetch(
        `https://track.delhivery.com/api/v1/packages/json/?waybill=${order.awbNumber}&token=${token}`,
        {
          headers: {
            Authorization: `Token ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!res.ok) continue;

      const data = await res.json();
      const shipment = data.ShipmentData?.[0]?.Shipment;
      if (!shipment) continue;

      // Save every courier scan (location history) before deciding on a status change
      await recordCourierScans(order.id, scansFromDelhivery(shipment), "delhivery").catch(() => 0);

      const statusStr = (shipment.Status as { Status?: string } | null)?.Status ?? "";
      const returnedAt = (shipment as { ReturnedAt?: string | null }).ReturnedAt ?? null;
      const dbStatus = mapDelhiveryStatus(statusStr, returnedAt);

      // Skip unknown statuses entirely
      if (!dbStatus) continue;

      // Never downgrade — only move forward in lifecycle (RTO/CANCELLED always allowed)
      const currentRank = STATUS_RANK[order.status] ?? 0;
      const newRank     = STATUS_RANK[dbStatus] ?? 0;
      if (dbStatus !== "RTO" && dbStatus !== "CANCELLED" && newRank <= currentRank) continue;

      await prisma.order.update({
        where: { id: order.id },
        data: { status: dbStatus as never },
      });

      updated++;
    } catch {
      // skip
    }
  }

  return NextResponse.json({ updated });
}
