import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emailNdrAlert } from "@/lib/email";

const NDR_KEYWORDS = [
  "undelivered", "delivery attempt", "ndr", "failed delivery",
  "not available", "refused", "wrong address", "out of delivery area",
  "door locked", "customer not contactable", "rescheduled",
  "return recommended", "consignee refused", "not delivered",
  "delivery failed", "unable to deliver",
];

type DelhiveryScan = {
  ScanType?: string;
  Instructions?: string;
  ScanDateTime?: string;
};

function detectNdr(
  statusStr: string,
  statusType: string,
  scans: DelhiveryScan[],
): { isNdr: boolean; udScans: DelhiveryScan[] } {
  const udScans = scans.filter(s => s.ScanType?.toUpperCase() === "UD");
  if (udScans.length > 0) return { isNdr: true, udScans };
  if (["UD", "NDR"].includes(statusType.toUpperCase())) return { isNdr: true, udScans };
  const s = statusStr.toLowerCase();
  const isNdr = NDR_KEYWORDS.some(k => s.includes(k));
  return { isNdr, udScans };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.DELHIVERY_API_TOKEN;
  if (!token) return NextResponse.json({ error: "Delhivery not configured" }, { status: 500 });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const orders = await prisma.order.findMany({
    where: {
      awbNumber: { not: null },
      ndrActionTaken: null,
      // Include RTO orders from last 30 days that never had NDR captured
      OR: [
        { status: { notIn: ["DELIVERED", "CANCELLED", "RTO"] } },
        { status: "RTO", ndrStatus: null, createdAt: { gte: thirtyDaysAgo } },
      ],
    },
    select: {
      id: true, awbNumber: true, ndrAttempts: true, ndrCreatedAt: true,
      externalOrderId: true,
      seller: { select: { name: true, email: true } },
    },
  });

  if (orders.length === 0) return NextResponse.json({ found: 0 });

  const waybills = orders.map(o => o.awbNumber).join(",");
  const res = await fetch(
    `https://track.delhivery.com/api/v1/packages/json/?waybill=${waybills}&token=${token}`,
    { headers: { Authorization: `Token ${token}`, Accept: "application/json" } }
  );

  if (!res.ok) return NextResponse.json({ error: "Delhivery API error" }, { status: 400 });

  const data = await res.json();
  const shipments: Array<{ Shipment: Record<string, unknown> }> = data.ShipmentData ?? [];
  let found = 0;

  for (const order of orders) {
    const shipment = shipments.find(s =>
      String(s.Shipment.Waybill ?? s.Shipment.AWB) === order.awbNumber
    )?.Shipment;
    if (!shipment) continue;

    const statusObj = shipment.Status as {
      Status?: string; StatusType?: string; Instructions?: string;
    } | null;
    const statusStr = statusObj?.Status ?? "";
    const statusType = statusObj?.StatusType ?? "";
    const scans = (shipment.Scans as DelhiveryScan[] | null) ?? [];

    const { isNdr, udScans } = detectNdr(statusStr, statusType, scans);
    if (!isNdr) continue;

    // Use UD scan count as authoritative attempt count; never decrement
    const attemptCount = udScans.length > 0
      ? Math.max(udScans.length, order.ndrAttempts ?? 0)
      : (order.ndrAttempts ?? 0) + 1;

    // Skip if no new attempt
    if (attemptCount === (order.ndrAttempts ?? 0) && order.ndrCreatedAt) continue;

    const ndrReason =
      udScans[0]?.Instructions ||
      statusObj?.Instructions ||
      statusStr ||
      "Delivery attempt failed";

    const ndrStatus = statusType.toUpperCase() === "UD"
      ? `UD - ${ndrReason.slice(0, 100)}`
      : (statusStr || "NDR");

    await prisma.order.update({
      where: { id: order.id },
      data: {
        ndrStatus,
        ndrReason,
        ndrAttempts: attemptCount,
        ndrCreatedAt: order.ndrCreatedAt ?? new Date(),
      },
    });

    if (order.seller?.email && attemptCount > (order.ndrAttempts ?? 0)) {
      emailNdrAlert({
        to:              order.seller.email,
        name:            order.seller.name ?? "Seller",
        externalOrderId: order.externalOrderId,
        ndrReason,
        ndrAttempts:     attemptCount,
        awbNumber:       order.awbNumber,
      }).catch(() => {});
    }
    found++;
  }

  console.log(`[cron] sync-ndr: found=${found} total=${orders.length}`);
  return NextResponse.json({ found, total: orders.length });
}
