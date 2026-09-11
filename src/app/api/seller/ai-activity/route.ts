import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Task-time assumptions (minutes per automated action).
// These are the ONLY place these values should live — frontend reads them from the API.
export const TIME_SAVED_RATES = {
  autoDispatchedMinutes:    8, // fully automated shipment dispatch
  newOrderIngestedMinutes:  3, // order ingestion + initial routing
  ndrOpenedMinutes:         5, // new NDR case created (response time saved)
  supplierDelayMinutes:     4, // automated supplier delay detection
} as const;

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sellerId = session.user.id;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Threshold for "supplier became delayed" — the 24h window that would have been crossed today.
  // An order where updatedAt is between 48h ago and 24h ago crossed the 24h staleness threshold today.
  const delayThreshold      = new Date(Date.now() - 24 * 3600000); // 24h ago
  const delayDetectedSince  = new Date(Date.now() - 48 * 3600000); // 48h ago

  const [
    autoDispatched,
    newOrdersToday,
    ndrOpenedToday,
    supplierDelaysDetectedToday,
    humanActionsNeeded,
  ] = await Promise.all([
    // Shipments auto-dispatched today — AWB assigned and status progressed today
    prisma.order.count({
      where: {
        sellerId,
        awbNumber: { not: null },
        updatedAt: { gte: todayStart },
        status: { in: ["SHIPPED", "IN_TRANSIT", "DELIVERED"] },
      },
    }),

    // New orders ingested today — AXQEN picks these up for routing and confirmation
    prisma.order.count({
      where: {
        sellerId,
        createdAt: { gte: todayStart },
      },
    }),

    // NDR cases OPENED today — ndrCreatedAt set today (new delivery failure events)
    prisma.order.count({
      where: {
        sellerId,
        ndrCreatedAt: { gte: todayStart },
        ndrStatus: { not: null },
      },
    }),

    // Supplier delays DETECTED today — orders whose 24h staleness window crossed today.
    // updatedAt is between 48h ago and 24h ago = became stale within the last 24h.
    prisma.order.count({
      where: {
        sellerId,
        supplierId: { not: null },
        supplierStatus: { in: ["ACCEPTED", "PROCESSING", "PACKED"] },
        updatedAt: { gte: delayDetectedSince, lt: delayThreshold },
      },
    }),

    // Current human attention count — snapshot state (not time-scoped).
    // Labelled accurately in the UI as "need your attention" not "acted on today".
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

  // Time saved — computed server-side using TIME_SAVED_RATES.
  // The frontend reads timeSavedRates and can reproduce this calculation exactly.
  const timeSaved =
    autoDispatched              * TIME_SAVED_RATES.autoDispatchedMinutes +
    newOrdersToday              * TIME_SAVED_RATES.newOrderIngestedMinutes +
    ndrOpenedToday              * TIME_SAVED_RATES.ndrOpenedMinutes +
    supplierDelaysDetectedToday * TIME_SAVED_RATES.supplierDelayMinutes;

  const hours   = Math.floor(timeSaved / 60);
  const minutes = timeSaved % 60;
  const timeSavedLabel = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return NextResponse.json({
    autoDispatched,
    newOrdersToday,
    ndrOpenedToday,
    supplierDelaysDetectedToday,
    humanActionsNeeded,
    timeSaved,
    timeSavedLabel,
    timeSavedRates: TIME_SAVED_RATES,  // expose so frontend can reproduce the formula
  });
}
