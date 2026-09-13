import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const STATUS_RANK: Record<string, number> = {
  NEW: 0, PROCESSING: 1, SHIPPED: 2, IN_TRANSIT: 3,
  DELIVERED: 4, RTO: 4, CANCELLED: 4,
};

// "return recommended" is NDR (courier recommending RTO) — not actual RTO yet.
// Only treat as RTO when the package is physically being returned.
const RTO_PHRASES = [
  "rto", "return to origin", "returned to origin",
  "reverse transit", "reverse pickup", "rt initiated",
  "rto initiated", "returned",
];
const NDR_PHRASES = ["return recommended", "return recommendation", "return recom"];

function isActualRTO(s: string, returnedAt?: string | null): boolean {
  if (returnedAt) return true;
  const lower = s.toLowerCase();
  // Explicitly exclude NDR-phase statuses even if they contain "return"
  if (NDR_PHRASES.some(p => lower.includes(p))) return false;
  return RTO_PHRASES.some(p => lower.includes(p));
}

function mapDelhiveryStatus(status: string, returnedAt?: string | null): string {
  const s = status?.toLowerCase() ?? "";
  if (isActualRTO(s, returnedAt))                                  return "RTO";
  if (s.includes("delivered"))                                     return "DELIVERED";
  if (s.includes("transit") || s.includes("out for delivery"))    return "IN_TRANSIT";
  if (s.includes("dispatch") || s.includes("picked"))             return "SHIPPED";
  if (s.includes("cancel"))                                        return "CANCELLED";
  return "";
}

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.DELHIVERY_API_TOKEN;
  if (!token) return NextResponse.json({ error: "Delhivery not configured" }, { status: 500 });

  // Only refresh Delhivery orders — other carriers have their own tracking
  const orders = await prisma.order.findMany({
    where: {
      awbNumber: { not: null },
      status: { notIn: ["DELIVERED", "CANCELLED", "RTO"] },
      OR: [
        { courier: null },
        { courier: { contains: "delhivery", mode: "insensitive" } },
      ],
    },
    select: { id: true, awbNumber: true, status: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const order of orders) {
    if (!order.awbNumber) continue;

    try {
      const res = await fetch(
        `https://track.delhivery.com/api/v1/packages/json/?waybill=${order.awbNumber}&token=${token}`,
        { headers: { Authorization: `Token ${token}`, Accept: "application/json" } }
      );

      if (!res.ok) { skipped++; continue; }

      const data = await res.json();
      const shipment = data.ShipmentData?.[0]?.Shipment;
      if (!shipment) { skipped++; continue; }

      const statusStr = (shipment.Status as { Status?: string } | null)?.Status ?? "";
      const returnedAt = (shipment as { ReturnedAt?: string | null }).ReturnedAt ?? null;
      const dbStatus = mapDelhiveryStatus(statusStr, returnedAt);
      if (!dbStatus) { skipped++; continue; }

      const currentRank = STATUS_RANK[order.status] ?? 0;
      const newRank     = STATUS_RANK[dbStatus] ?? 0;
      if (dbStatus !== "RTO" && dbStatus !== "CANCELLED" && newRank <= currentRank) {
        skipped++; continue;
      }

      await prisma.order.update({
        where: { id: order.id },
        data: { status: dbStatus as never },
      });

      updated++;
    } catch {
      skipped++;
    }
  }

  console.log(`[cron] refresh-tracking: updated=${updated} skipped=${skipped} total=${orders.length}`);
  return NextResponse.json({ updated, skipped, total: orders.length });
}
