import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { mapShipdaakStatus, normalizeShipdaakTracking, shipdaakConfigured, trackShipmentRaw } from "@/lib/shipdaak";
import { lastShipdaakRun, runShipdaakTracking } from "@/lib/shipdaak-sync";

export const maxDuration = 300;

// GET            → last tracking run
// GET ?awb=X     → what Shipdaak returns for one AWB, how AXQEN reads it, and the order it belongs to
// POST           → run tracking now (same as the 2-hourly job) and record it
async function admin(req: NextRequest) {
  const s = await getRouteSession(req);
  return s?.user.role === "ADMIN" ? s : null;
}

export async function GET(req: NextRequest) {
  if (!(await admin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const awb = req.nextUrl.searchParams.get("awb")?.trim();
  if (!awb) return NextResponse.json({ configured: shipdaakConfigured(), lastRun: await lastShipdaakRun() });

  const order = await prisma.order.findFirst({
    where: { awbNumber: awb },
    select: { id: true, externalOrderId: true, status: true, courier: true, updatedAt: true, _count: { select: { timeline: { where: { eventType: "COURIER_SCAN" } } } } },
  });
  try {
    const raw = await trackShipmentRaw(awb);
    const read = normalizeShipdaakTracking(raw.data ?? raw, awb);
    return NextResponse.json({
      order, raw,
      read: read ? { status: read.status, courier: read.courierName ?? null, scans: read.history?.length ?? 0, latest: read.history?.[0] ?? null } : null,
      axqenStatus: read ? mapShipdaakStatus(read) : null,
    });
  } catch (e) {
    return NextResponse.json({ order, error: e instanceof Error ? e.message : "Shipdaak tracking failed" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await admin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runShipdaakTracking({ record: true }));
}
