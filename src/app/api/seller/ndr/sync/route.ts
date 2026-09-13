import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const NDR_KEYWORDS = [
  "undelivered", "delivery attempt", "ndr", "failed delivery",
  "not available", "refused", "wrong address", "out of delivery area",
  "door locked", "customer not contactable", "rescheduled",
  "return recommended", "consignee refused", "not delivered",
  "delivery failed", "unable to deliver",
];

type Scan = { ScanType?: string; Instructions?: string; ScanDateTime?: string };

function isNdrKeyword(s: string) {
  const lower = s.toLowerCase();
  return NDR_KEYWORDS.some(k => lower.includes(k));
}

type OrderRow = {
  id: string;
  awbNumber: string | null;
  ndrAttempts: number;
  ndrCreatedAt: Date | null;
};

async function syncFromTracking(
  orders: OrderRow[],
  token: string,
): Promise<number> {
  const waybills = orders.map(o => o.awbNumber).join(",");
  const res = await fetch(
    `https://track.delhivery.com/api/v1/packages/json/?waybill=${waybills}&token=${token}`,
    { headers: { Authorization: `Token ${token}`, Accept: "application/json" } }
  );
  if (!res.ok) return 0;

  const data = await res.json();
  const shipments: Array<{ Shipment: Record<string, unknown> }> = data.ShipmentData ?? [];
  let found = 0;

  for (const order of orders) {
    const shipment = shipments.find(s =>
      String(s.Shipment?.Waybill ?? s.Shipment?.AWB) === order.awbNumber
    )?.Shipment;
    if (!shipment) continue;

    const statusObj = shipment.Status as {
      Status?: string; StatusType?: string; Instructions?: string;
    } | null;
    const statusStr = statusObj?.Status ?? "";
    const statusType = statusObj?.StatusType ?? "";
    const scans = (shipment.Scans as Scan[] | null) ?? [];
    const udScans = scans.filter(s => s.ScanType?.toUpperCase() === "UD");

    const isNdr =
      udScans.length > 0 ||
      ["UD", "NDR"].includes(statusType.toUpperCase()) ||
      isNdrKeyword(statusStr);

    if (!isNdr) continue;

    const attemptCount = udScans.length > 0
      ? Math.max(udScans.length, order.ndrAttempts ?? 0)
      : (order.ndrAttempts ?? 0) + 1;

    if (attemptCount <= (order.ndrAttempts ?? 0) && order.ndrCreatedAt) continue;

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
    found++;
  }

  return found;
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
      ndrActionTaken: null,
    },
    select: { id: true, awbNumber: true, ndrAttempts: true, ndrCreatedAt: true },
  });

  if (orders.length === 0) return NextResponse.json({ found: 0, debug: "No active AWB orders" });

  const waybills = orders.map(o => o.awbNumber).join(",");
  let found = 0;

  // --- Primary: Delhivery's dedicated NDR endpoint ---
  try {
    const ndrRes = await fetch(
      `https://track.delhivery.com/api/p/psc/ndr/wbns/?wbns=${waybills}&token=${token}`,
      { headers: { Authorization: `Token ${token}`, Accept: "application/json" } }
    );

    if (ndrRes.ok) {
      const rawText = await ndrRes.text();
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(rawText); } catch { /* fall through to tracking API */ }

      const ndrList: Array<Record<string, unknown>> =
        (data.ndr as Array<Record<string, unknown>>) ??
        (data.ShipmentData as Array<Record<string, unknown>>) ??
        [];

      for (const order of orders) {
        const ndrEntry = ndrList.find(n => {
          const wbn = String(n.waybill ?? n.Waybill ?? n.wbn ?? n.AWB ?? "");
          return wbn === order.awbNumber;
        });
        if (!ndrEntry) continue;

        const reason = String(
          ndrEntry.reason ?? ndrEntry.Reason ?? ndrEntry.remarks ??
          ndrEntry.Instructions ?? "Delivery attempt failed"
        );
        const attempts = Number(ndrEntry.attempts ?? ndrEntry.attempt_count ?? 0);
        const attemptCount = attempts > 0
          ? Math.max(attempts, order.ndrAttempts ?? 0)
          : (order.ndrAttempts ?? 0) + 1;

        if (attemptCount <= (order.ndrAttempts ?? 0) && order.ndrCreatedAt) continue;

        const status = String(ndrEntry.status ?? ndrEntry.Status ?? ndrEntry.reason_code ?? "NDR");

        await prisma.order.update({
          where: { id: order.id },
          data: {
            ndrStatus: status,
            ndrReason: reason,
            ndrAttempts: attemptCount,
            ndrCreatedAt: order.ndrCreatedAt ?? new Date(),
          },
        });
        found++;
      }
    }
  } catch {
    // NDR-specific endpoint unavailable; fall through to tracking API
  }

  // --- Fallback: general tracking API + scan history ---
  // Run for orders the NDR endpoint didn't match
  if (found < orders.length) {
    const unmatched = orders.filter(o => {
      // We already updated some — skip those
      // (We track by found count, so just re-check all; duplicate update is idempotent)
      return true;
    });
    const extra = await syncFromTracking(unmatched, token);
    found = Math.max(found, extra); // don't double-count
  }

  return NextResponse.json({ found, total: orders.length });
}

// Debug endpoint: GET ?awb=XXX to see raw Delhivery response for one AWB
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.DELHIVERY_API_TOKEN;
  if (!token) return NextResponse.json({ error: "Delhivery not configured" }, { status: 500 });

  const awb = new URL(req.url).searchParams.get("awb");
  if (!awb) return NextResponse.json({ error: "awb param required" }, { status: 400 });

  const [trackRes, ndrRes] = await Promise.all([
    fetch(`https://track.delhivery.com/api/v1/packages/json/?waybill=${awb}&token=${token}`,
      { headers: { Authorization: `Token ${token}`, Accept: "application/json" } }),
    fetch(`https://track.delhivery.com/api/p/psc/ndr/wbns/?wbns=${awb}&token=${token}`,
      { headers: { Authorization: `Token ${token}`, Accept: "application/json" } }),
  ]);

  const [trackText, ndrText] = await Promise.all([trackRes.text(), ndrRes.text()]);
  const safeParse = (t: string) => { try { return JSON.parse(t); } catch { return t; } };
  const trackData = safeParse(trackText);

  // Parse scan history for UD events
  const shipment = trackData?.ShipmentData?.[0]?.Shipment ?? null;
  const scans: Scan[] = shipment?.Scans ?? [];
  const udScans = scans.filter((s: Scan) => s.ScanType?.toUpperCase() === "UD");

  return NextResponse.json({
    tracking: { status: trackRes.status, body: trackData },
    ndr:      { status: ndrRes.status,   body: safeParse(ndrText) },
    analysis: {
      current_status:      shipment?.Status?.Status,
      current_status_type: shipment?.Status?.StatusType,
      total_scans:         scans.length,
      ud_scans_count:      udScans.length,
      ud_scans:            udScans,
      would_detect_as_ndr: udScans.length > 0 ||
        ["UD", "NDR"].includes((shipment?.Status?.StatusType ?? "").toUpperCase()) ||
        NDR_KEYWORDS.some((k: string) => (shipment?.Status?.Status ?? "").toLowerCase().includes(k)),
    },
  });
}
