import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SHIPDAAK_COURIER_PREFIX, shipdaakConfigured, trackShipment } from "@/lib/shipdaak";
import { loadCourierScans, recordCourierScans, scansFromShipdaak } from "@/lib/courier-scans";

type Event = { status: string; message: string; location: string; time: string };

// Live tracking for one shipment. Sellers only see their own orders; admins can see any.
export async function GET(req: NextRequest, { params }: { params: Promise<{ awb: string }> }) {
  const session = await getRouteSession(req);
  if (!session || !["SELLER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { awb } = await params;
  const order = await prisma.order.findFirst({
    where: {
      OR: [{ awbNumber: awb }, { supplierTrackingNo: awb }],
      ...(session.user.role === "SELLER" ? { sellerId: session.user.id } : {}),
    },
    select: {
      id: true, externalOrderId: true, status: true, createdAt: true, dispatchedAt: true,
      awbNumber: true, courier: true, trackingUrl: true, paymentMode: true, totalAmount: true,
      customerName: true, customerAddress: true, ndrStatus: true, ndrReason: true,
      timeline: { orderBy: { createdAt: "desc" }, select: { event: true, eventType: true, details: true, createdAt: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  const isShipdaak = order.courier?.startsWith(SHIPDAAK_COURIER_PREFIX) ?? false;
  let courier = isShipdaak ? order.courier!.slice(SHIPDAAK_COURIER_PREFIX.length) : order.courier;
  let liveStatus: string | null = null;
  let edd: string | null = null;
  let deliveredDate: string | null = null;
  let events: Event[] = [];
  let liveError: string | null = null;

  if (isShipdaak && shipdaakConfigured()) {
    try {
      const t = await trackShipment(order.awbNumber ?? awb);
      if (t) {
        liveStatus = t.status ?? null;
        courier = t.courierName || courier;
        edd = (t as { edd?: string | null }).edd ?? null;
        deliveredDate = t.deliveredDate ?? null;
        recordCourierScans(order.id, scansFromShipdaak(t), "shipdaak").catch(() => 0);
        events = (t.history ?? []).map((h) => ({
          status:   prettify(h.message || h.statusCode),
          message:  h.message && h.message !== h.statusCode ? h.message : "",
          location: h.location ?? "",
          time:     h.eventTime,
        }));
      }
    } catch (err) {
      liveError = err instanceof Error ? err.message : "Live tracking unavailable";
    }
  }

  // Saved courier scans (Delhivery and earlier Shipdaak polls) — full location history.
  if (!events.length) {
    const saved = (await loadCourierScans([order.id])).get(order.id) ?? [];
    events = saved.map((sc) => ({
      status: prettify(sc.status),
      message: sc.message,
      location: sc.location,
      time: sc.time,
    }));
  }

  // Fallback: AXQEN's own order timeline (manual AWBs, other couriers, or when live tracking fails).
  if (!events.length) {
    events = order.timeline.filter((e) => e.eventType !== "COURIER_SCAN").map((e) => ({
      status: prettify(e.event),
      message: e.details ?? "",
      location: "",
      time: e.createdAt.toISOString(),
    }));
  }

  const addr = (order.customerAddress ?? {}) as Record<string, string>;
  return NextResponse.json({
    awb: order.awbNumber ?? awb,
    orderId: order.id,
    orderNumber: order.externalOrderId,
    orderDate: order.createdAt,
    dispatchedAt: order.dispatchedAt,
    status: order.status,
    liveStatus,
    courier,
    edd,
    deliveredDate,
    paymentMode: order.paymentMode,
    amount: order.totalAmount,
    customer: { name: order.customerName, city: addr.city ?? "", state: addr.state ?? addr.province ?? "", pincode: addr.pincode ?? addr.zip ?? "" },
    ndr: order.ndrStatus ? { status: order.ndrStatus, reason: order.ndrReason } : null,
    externalTrackingUrl: order.trackingUrl,
    events,
    live: isShipdaak && !liveError && events.length > 0,
    liveError,
  });
}

function prettify(s: string) {
  if (!s) return "Update";
  const t = s.replace(/[_-]+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}
