// One Shipdaak shipment → poll tracking, save every scan, move status forward, raise NDR,
// notify the seller. Shared by the track-shipdaak cron and the seller's Refresh button.
import { prisma } from "@/lib/prisma";
import { mapShipdaakStatus, trackShipment, SHIPDAAK_COURIER_PREFIX, shipdaakConfigured } from "@/lib/shipdaak";
import { recordCourierScans, scansFromShipdaak } from "@/lib/courier-scans";
import { failedAgainAfterAction } from "@/lib/ndr";

const RANK: Record<string, number> = { NEW: 0, PROCESSING: 1, SHIPPED: 2, IN_TRANSIT: 3, DELIVERED: 4, RTO: 4, CANCELLED: 4 };

const NOTIFY: Record<string, (ext: string, awb: string) => { title: string; msg: string }> = {
  IN_TRANSIT: (e, a) => ({ title: "Order In Transit",    msg: `Order ${e} is in transit. AWB: ${a}` }),
  DELIVERED:  (e, a) => ({ title: "Order Delivered",     msg: `Order ${e} has been delivered. AWB: ${a}` }),
  RTO:        (e, a) => ({ title: "Order RTO Initiated", msg: `Order ${e} is being returned. AWB: ${a}` }),
};

/** Active shipments plus returns still on their way back (RTO, not yet received, last 45 days). */
export const trackableWhere = () => ({
  OR: [
    { status: { notIn: ["DELIVERED", "CANCELLED", "RTO", "HIDDEN"] as never[] } },
    {
      status: "RTO" as never,
      updatedAt: { gte: new Date(Date.now() - 45 * 86400000) },
      timeline: { none: { eventType: "RTO_RECEIVED" } },
    },
  ],
});

export const SHIPDAAK_SYNC_SELECT = {
  id: true, externalOrderId: true, status: true, awbNumber: true, sellerId: true, supplierId: true, courier: true,
  ndrStatus: true, ndrAttempts: true, ndrCreatedAt: true, ndrActionTaken: true,
} as const;

export interface ShipdaakSyncOrder {
  id: string; externalOrderId: string; status: string; awbNumber: string | null; courier?: string | null;
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

  // AWB entered by hand (booked in the Shipdaak panel): Shipdaak knows it, so mark it as a Shipdaak shipment from now on.
  if (o.courier !== undefined && !(o.courier ?? "").startsWith(SHIPDAAK_COURIER_PREFIX)) {
    data.courier = `${SHIPDAAK_COURIER_PREFIX}${(o.courier || t.courierName || "Courier").trim()}`;
  }

  if (status && status !== o.status && (status === "RTO" || (RANK[status] ?? -1) > (RANK[o.status] ?? -1))) data.status = status;

  // Remember Shipdaak's return AWB once the parcel is on its way back.
  if (t.rtoAwb && (status === "RTO" || o.status === "RTO")) {
    const known = await prisma.orderTimeline.findFirst({ where: { orderId: o.id, eventType: "RTO_INFO" }, select: { id: true } });
    if (!known) {
      await prisma.orderTimeline.create({
        data: { orderId: o.id, actorRole: "SYSTEM", eventType: "RTO_INFO", event: "Return AWB assigned", details: t.rtoAwb, metadata: { rtoAwb: t.rtoAwb } },
      }).catch(() => {});
    }
  }

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
  if (!data.status && !data.ndrStatus) return true; // only the courier label was corrected
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

// ── Tracking run (cron, admin "Sync tracking now", seller Refresh) ───────────
const LAST_RUN_KEY = "TRACK_SHIPDAAK_LAST_RUN";

/**
 * Poll Shipdaak for active shipments. Orders booked from AXQEN ("Shipdaak · …") go first; then orders whose
 * AWB was typed in by hand. AWBs Shipdaak doesn't recognise (e.g. booked directly with Delhivery) are skipped.
 */
export async function runShipdaakTracking(opts: { sellerId?: string; limit?: number; record?: boolean } = {}) {
  if (!shipdaakConfigured()) return { configured: false, checked: 0, updated: 0, notShipdaak: 0, errors: [] as string[] };
  const limit = opts.limit ?? 250;
  const base = { awbNumber: { not: null }, ...(opts.sellerId ? { sellerId: opts.sellerId } : {}), ...trackableWhere() };
  const booked = await prisma.order.findMany({
    where: { ...base, courier: { startsWith: SHIPDAAK_COURIER_PREFIX } },
    select: SHIPDAAK_SYNC_SELECT, orderBy: { updatedAt: "asc" }, take: limit,
  });
  const manual = booked.length < limit ? await prisma.order.findMany({
    where: { ...base, OR: [{ courier: null }, { NOT: { courier: { startsWith: SHIPDAAK_COURIER_PREFIX } } }], status: { in: ["PROCESSING", "SHIPPED", "IN_TRANSIT"] } },
    select: SHIPDAAK_SYNC_SELECT, orderBy: { updatedAt: "asc" }, take: limit - booked.length,
  }) : [];

  let updated = 0, notShipdaak = 0;
  const errors: string[] = [];
  for (const o of [...booked, ...manual]) {
    const isManual = !(o.courier ?? "").startsWith(SHIPDAAK_COURIER_PREFIX);
    try {
      if (await syncShipdaakOrder(isManual ? o : { ...o, courier: undefined })) updated++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "track failed";
      if (isManual) notShipdaak++; else errors.push(`${o.awbNumber}: ${msg}`);
    }
  }
  const result = { configured: true, checked: booked.length + manual.length, booked: booked.length, manual: manual.length, updated, notShipdaak, errors: errors.slice(0, 20) };
  if (opts.record) {
    await prisma.platformConfig.upsert({
      where: { key: LAST_RUN_KEY },
      update: { value: JSON.stringify({ at: new Date().toISOString(), ...result }) },
      create: { key: LAST_RUN_KEY, value: JSON.stringify({ at: new Date().toISOString(), ...result }), label: "Last Shipdaak tracking run" },
    }).catch(() => {});
  }
  return result;
}

export async function lastShipdaakRun(): Promise<Record<string, unknown> | null> {
  const r = await prisma.platformConfig.findUnique({ where: { key: LAST_RUN_KEY } });
  try { return r ? JSON.parse(r.value) : null; } catch { return null; }
}
