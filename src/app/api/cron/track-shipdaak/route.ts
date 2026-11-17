/**
 * Cron: track-shipdaak (every 2 hours, see vercel.json)
 * Shipdaak has no tracking webhooks, so active Shipdaak shipments are polled and
 * order status / NDR fields are updated. Status only moves forward.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SHIPDAAK_COURIER_PREFIX, mapShipdaakStatus, shipdaakConfigured, trackShipment } from "@/lib/shipdaak";

const RANK: Record<string, number> = { NEW: 0, PROCESSING: 1, SHIPPED: 2, IN_TRANSIT: 3, DELIVERED: 4, RTO: 4, CANCELLED: 4 };
const MAX_PER_RUN = 250;

const NOTIFY: Record<string, (ext: string, awb: string) => { title: string; msg: string }> = {
  IN_TRANSIT: (e, a) => ({ title: "Order In Transit",    msg: `Order ${e} is in transit. AWB: ${a}` }),
  DELIVERED:  (e, a) => ({ title: "Order Delivered",     msg: `Order ${e} has been delivered. AWB: ${a}` }),
  RTO:        (e, a) => ({ title: "Order RTO Initiated", msg: `Order ${e} is being returned. AWB: ${a}` }),
};

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!shipdaakConfigured()) return NextResponse.json({ skipped: "Shipdaak not configured" });

  const orders = await prisma.order.findMany({
    where: {
      awbNumber: { not: null },
      courier:   { startsWith: SHIPDAAK_COURIER_PREFIX },
      status:    { notIn: ["DELIVERED", "CANCELLED", "RTO", "HIDDEN"] as never[] },
    },
    select: { id: true, externalOrderId: true, status: true, awbNumber: true, sellerId: true, supplierId: true, ndrStatus: true, ndrAttempts: true, ndrCreatedAt: true },
    orderBy: { dispatchedAt: "asc" },
    take: MAX_PER_RUN,
  });

  let updated = 0;
  const errors: string[] = [];

  for (const o of orders) {
    const awb = o.awbNumber as string;
    let t;
    try {
      t = await trackShipment(awb);
    } catch (err) {
      errors.push(`${awb}: ${err instanceof Error ? err.message : "track failed"}`);
      continue;
    }
    if (!t) continue;

    const { status, ndr } = mapShipdaakStatus(t);
    const latest = t.history?.[0];
    const data: Record<string, unknown> = {};

    if (status && (status === "RTO" || (RANK[status] ?? -1) > (RANK[o.status] ?? -1))) data.status = status;

    if (ndr) {
      const reason = latest?.message || t.status || "Delivery attempt failed";
      const isNew = o.ndrStatus !== reason;
      data.ndrStatus = reason;
      data.ndrReason = reason;
      if (isNew) data.ndrAttempts = (o.ndrAttempts ?? 0) + 1;
      if (!o.ndrCreatedAt) data.ndrCreatedAt = new Date();
    }

    if (!Object.keys(data).length) continue;

    await prisma.order.update({ where: { id: o.id }, data });
    await prisma.orderTimeline.create({
      data: {
        orderId:   o.id,
        actorId:   o.supplierId ?? o.sellerId,
        actorRole: "SYSTEM",
        event:     latest?.statusCode || String(data.status ?? "NDR"),
        details:   `Shipdaak: ${t.status}${latest?.location ? ` (${latest.location})` : ""}${ndr ? " · delivery exception" : ""}`,
        metadata:  { awb, shipdaakStatus: t.status, rtoStatus: t.rtoStatus ?? null, latest: latest ?? null },
      },
    });

    const n = typeof data.status === "string" ? NOTIFY[data.status] : undefined;
    if (n && o.sellerId) {
      const { title, msg } = n(o.externalOrderId, awb);
      await prisma.notification.create({
        data: { userId: o.sellerId, type: "ORDER_UPDATE", title, message: msg, data: { orderId: o.id, awb, status: String(data.status) } },
      }).catch(() => {});
    }
    updated++;
  }

  return NextResponse.json({ checked: orders.length, updated, errors: errors.slice(0, 20) });
}
