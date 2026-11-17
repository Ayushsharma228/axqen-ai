// Courier scan history — every location/status update from the courier, stored as
// OrderTimeline rows (eventType COURIER_SCAN). No schema change; duplicates are skipped.
import { prisma } from "@/lib/prisma";
import type { ShipdaakTracking } from "@/lib/shipdaak";

export const COURIER_SCAN = "COURIER_SCAN";

export interface CourierScan {
  status: string;     // e.g. "In Transit", "Out For Delivery"
  location: string;   // e.g. "Patna_Hub (Bihar)"
  message: string;    // courier remark / instructions
  time: string;       // ISO
}

const iso = (v: unknown) => {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
};

export function scansFromShipdaak(t: ShipdaakTracking | null | undefined): CourierScan[] {
  return (t?.history ?? [])
    .map(h => ({
      status: (h.statusCode || h.message || "").toString(),
      location: (h.location ?? "").toString(),
      message: h.message && h.message !== h.statusCode ? h.message : "",
      time: iso(h.eventTime) ?? "",
    }))
    .filter(s => s.time);
}

type DelhiveryScanDetail = {
  Scan?: string; ScanType?: string; ScannedLocation?: string; Instructions?: string;
  ScanDateTime?: string; StatusDateTime?: string;
};
export function scansFromDelhivery(shipment: { Scans?: { ScanDetail?: DelhiveryScanDetail }[] } | null | undefined): CourierScan[] {
  return (shipment?.Scans ?? [])
    .map(s => s.ScanDetail ?? {})
    .map(d => ({
      status: (d.Scan || d.ScanType || "").toString(),
      location: (d.ScannedLocation ?? "").toString(),
      message: (d.Instructions ?? "").toString(),
      time: iso(d.ScanDateTime || d.StatusDateTime) ?? "",
    }))
    .filter(s => s.time);
}

const scanKey = (s: { time: string; status: string; location: string }) => `${s.time}|${s.status}|${s.location}`;

/** Store any scans not already saved for this order. Returns how many were added. */
export async function recordCourierScans(orderId: string, scans: CourierScan[], source: string): Promise<number> {
  if (!scans.length) return 0;
  const existing = await prisma.orderTimeline.findMany({
    where: { orderId, eventType: COURIER_SCAN },
    select: { metadata: true },
  });
  const seen = new Set(existing.map(e => scanKey((e.metadata ?? {}) as unknown as CourierScan)));
  const fresh = scans.filter(s => !seen.has(scanKey(s)));
  if (!fresh.length) return 0;
  await prisma.orderTimeline.createMany({
    data: fresh.map(s => ({
      orderId,
      actorRole: "SYSTEM",
      eventType: COURIER_SCAN,
      event: s.status || "Courier update",
      details: [s.location, s.message].filter(Boolean).join(" · ") || null,
      metadata: { ...s, source },
    })),
  });
  return fresh.length;
}

/** Read stored scans for many orders, newest first per order. */
export async function loadCourierScans(orderIds: string[]): Promise<Map<string, CourierScan[]>> {
  const out = new Map<string, CourierScan[]>();
  if (!orderIds.length) return out;
  const rows = await prisma.orderTimeline.findMany({
    where: { orderId: { in: orderIds }, eventType: COURIER_SCAN },
    select: { orderId: true, metadata: true },
  });
  for (const r of rows) {
    const m = (r.metadata ?? {}) as Partial<CourierScan>;
    if (!m.time) continue;
    const list = out.get(r.orderId) ?? [];
    list.push({ status: m.status ?? "", location: m.location ?? "", message: m.message ?? "", time: m.time });
    out.set(r.orderId, list);
  }
  for (const list of out.values()) list.sort((a, b) => b.time.localeCompare(a.time));
  return out;
}

export type ShipmentStage = "READY_FOR_PICKUP" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "RTO";

const OFD = /out\s*for\s*delivery|\bofd\b|dispatched\s*for\s*delivery|out_for_delivery/i;
const NOT_PICKED = /manifest|pickup\s*(scheduled|pending|generated|requested)|pending\s*pickup|not\s*picked|booked|awb\s*(assigned|generated)|ready\s*to\s*ship|order\s*placed|shipment\s*created/i;

/** Detailed shipment stage from the order status plus the latest courier scan. */
export function shipmentStage(status: string, scans: CourierScan[]): ShipmentStage {
  if (status === "RTO") return "RTO";
  if (status === "DELIVERED") return "DELIVERED";
  const latest = scans[0];
  const latestText = latest ? `${latest.status} ${latest.message}` : "";
  if (latest && OFD.test(latestText)) return "OUT_FOR_DELIVERY";
  if (status === "IN_TRANSIT") return "IN_TRANSIT";
  if (status === "SHIPPED") {
    if (!latest || NOT_PICKED.test(latestText)) return "READY_FOR_PICKUP";
    return "IN_TRANSIT";
  }
  return "READY_FOR_PICKUP"; // PROCESSING with an AWB
}
