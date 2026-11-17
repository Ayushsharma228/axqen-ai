// One Shipdaak shipment → poll tracking, save every scan, move status forward, raise NDR,
// notify the seller. Shared by the track-shipdaak cron and the seller's Refresh button.
import { prisma } from "@/lib/prisma";
import { mapShipdaakStatus, trackShipment } from "@/lib/shipdaak";
import { recordCourierScans, scansFromShipdaak } from "@/lib/courier-scans";
import { failedAgainAfterAction } from "@/lib/ndr";

const RANK: Record<string, number> = { NEW: 0, PROCESSING: 1, SHIPPED: 2, IN_TRANSIT: 3, DELIVERED: 4, RTO: 4, CANCELLED: 4 };

const NOTIFY: Record<string, (ext: string, awb: string) => { title: string; msg: string }> = {
  IN_TRANSIT: (e, a) => ({ title: "Order In Transit",    msg: `Order ${e} is in transit. AWB: ${a}` }),
  DELIVERED:  (e, a) => ({ title: "Order Delivered",     msg: `Order ${e} has been delivered. AWB: ${a}` }),
  RTO:        (e, a) => ({ title: "Order RTO Initiated", msg: `Order ${e} is being returned. AWB: ${a}` }),
};

export const SHIPDAAK_SYNC_SELECT = {
  id: true, externalOrderId: true, status: true, awbNumber: true, sellerId: true, supplierId: true,
  ndrStatus: true, ndrAttempts: true, ndrCreatedAt: true, ndrActionTaken: true,
} as const;

export interface ShipdaakSyncOrder {
  id: string; externalOrderId: string; status: string; awbNumber: string | null;
  sellerId: string; supplierId: string | null;
  ndrStatus: string | null; ndrAttempts: number | null; ndrCreatedAt: Date | null; ndrActionTaken: string | null;
}

/** Returns true when the order's status/NDR changed. Throws if Shipdaak tracking fails. */
export async function syncShipdaakOrder(o: ShipdaakSyncOrder): Promise<boolean> {
  const awb = o.awbNumber as string;
  const t = await trackShipment(awb);
  if (!t) return false;

  await recordCourierScans(o.id, scansFromShipdaak(t), "shipdaak").catch(() => 0);

  const { status, ndr } = mapShipdaakStatus(t);
  const latest = t.history?.[0];
  const data: Record<string, unknown> = {};

  if (status && (status === "RTO" || (RANK[status] ?? -1) > (RANK[o.status] ?? -1))) data.status = status;

  if (ndr) {
    const reason = latest?.message || t.status || "Delivery attempt failed";
    let isNew = o.ndrStatus !== reason;
    // A failure after the team already acted (e.g. re-attempt failed again) re-opens the NDR.
    if (o.ndrActionTaken && await failedAgainAfterAction(o.id, latest?.eventTime ? new Date(latest.eventTime).toISOString() : null)) {
      data.ndrActionTaken = null;
      isNew = true;
    }
    if (isNew || !o.ndrCreatedAt) {
      data.ndrStatus = reason;
      data.ndrReason = reason;
      if (isNew) data.ndrAttempts = (o.ndrAttempts ?? 0) + 1;
      if (!o.ndrCreatedAt) data.ndrCreatedAt = new Date();
    }
  }

  if (!Object.keys(data).length) return false;

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
  return true;
}
