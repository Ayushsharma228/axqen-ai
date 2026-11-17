// RTO (return to origin): return journey from courier scans, receiving check and courier
// claims by the AXQEN team. Everything is stored as OrderTimeline rows — no schema change.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SHIPDAAK_COURIER_PREFIX } from "@/lib/shipdaak";
import { loadCourierScans, type CourierScan } from "@/lib/courier-scans";

export const RTO_RECEIVED = "RTO_RECEIVED";
export const RTO_CLAIM = "RTO_CLAIM";
export const RTO_INFO = "RTO_INFO";            // e.g. Shipdaak return AWB
export const RTO_OVERDUE_DAYS = 15;
export const RTO_TRACK_DAYS = 45;              // keep polling returns for this long

export type RtoStage = "IN_TRANSIT" | "BACK_AT_WAREHOUSE" | "RECEIVED" | "DAMAGED" | "MISSING";
export type Condition = "GOOD" | "DAMAGED" | "MISSING";

const RTO_SCAN = /\brto\b|return|reverse|undelivered.*origin/i;
const BACK = /rto[\s_-]*delivered|returned\s*to\s*(origin|shipper|seller|warehouse|client)|delivered\s*to\s*(origin|shipper|seller|warehouse|client)|return(ed)?\s*delivered|rto\s*received|dto/i;

export const RTO_ORDER_SELECT = {
  id: true, externalOrderId: true, status: true, paymentMode: true, totalAmount: true,
  customerName: true, customerAddress: true, awbNumber: true, courier: true,
  ndrReason: true, rtoCharge: true, createdAt: true, updatedAt: true, dispatchedAt: true, sellerId: true,
  items: { select: { name: true, quantity: true } },
} satisfies Prisma.OrderSelect;
type RtoOrderRow = Prisma.OrderGetPayload<{ select: typeof RTO_ORDER_SELECT }>;

export interface RtoCard {
  id: string; externalOrderId: string; stage: RtoStage;
  paymentMode: string; totalAmount: number; rtoCharge: number | null;
  customerName: string | null; city: string | null; state: string | null; pincode: string | null;
  products: string;
  courier: string; awb: string | null; returnAwb: string | null;
  reason: string;
  startedAt: string; daysInReturn: number; overdue: boolean;
  lastScan: CourierScan | null;
  returnScans: CourierScan[];
  received: { time: string; condition: Condition; note: string | null; by: string } | null;
  claim: { time: string; status: "RAISED" | "SETTLED" | "REJECTED"; amount: number | null; note: string | null } | null;
}

export async function buildRtoCards(orders: RtoOrderRow[]): Promise<RtoCard[]> {
  const ids = orders.map(o => o.id);
  const [scans, rows] = await Promise.all([
    loadCourierScans(ids),
    ids.length
      ? prisma.orderTimeline.findMany({
          where: { orderId: { in: ids }, eventType: { in: [RTO_RECEIVED, RTO_CLAIM, RTO_INFO] } },
          orderBy: { createdAt: "desc" },
          select: { orderId: true, eventType: true, metadata: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);
  const now = Date.now();

  return orders.map(o => {
    const all = scans.get(o.id) ?? [];
    const firstRtoIdx = all.map(s => RTO_SCAN.test(`${s.status} ${s.message}`)).lastIndexOf(true); // list is newest-first
    const returnScans = firstRtoIdx >= 0 ? all.slice(0, firstRtoIdx + 1) : [];
    const startedAt = returnScans.length ? returnScans[returnScans.length - 1].time : o.updatedAt.toISOString();
    const mine = rows.filter(r => r.orderId === o.id);
    const meta = (r?: { metadata: unknown }) => ((r?.metadata ?? {}) as Record<string, unknown>);
    const rec = mine.find(r => r.eventType === RTO_RECEIVED);
    const clm = mine.find(r => r.eventType === RTO_CLAIM);
    const info = mine.find(r => r.eventType === RTO_INFO);

    const received = rec ? {
      time: rec.createdAt.toISOString(), condition: String(meta(rec).condition ?? "GOOD") as Condition,
      note: (meta(rec).note as string) ?? null, by: (meta(rec).by as string) ?? "AXQEN team",
    } : null;
    const claim = clm ? {
      time: clm.createdAt.toISOString(), status: String(meta(clm).status ?? "RAISED") as "RAISED" | "SETTLED" | "REJECTED",
      amount: typeof meta(clm).amount === "number" ? (meta(clm).amount as number) : null, note: (meta(clm).note as string) ?? null,
    } : null;

    const back = returnScans.some(s => BACK.test(`${s.status} ${s.message}`));
    const stage: RtoStage = received
      ? (received.condition === "GOOD" ? "RECEIVED" : received.condition === "DAMAGED" ? "DAMAGED" : "MISSING")
      : back ? "BACK_AT_WAREHOUSE" : "IN_TRANSIT";
    const daysInReturn = Math.max(0, Math.floor(((received ? new Date(received.time).getTime() : now) - new Date(startedAt).getTime()) / 86400000));
    const addr = (o.customerAddress ?? {}) as Record<string, string>;
    const isShipdaak = o.courier?.startsWith(SHIPDAAK_COURIER_PREFIX) ?? false;

    return {
      id: o.id, externalOrderId: o.externalOrderId, stage,
      paymentMode: o.paymentMode, totalAmount: o.totalAmount, rtoCharge: o.rtoCharge ?? null,
      customerName: o.customerName, city: addr.city ?? null, state: addr.state ?? addr.province ?? null, pincode: addr.pincode ?? addr.zip ?? null,
      products: o.items.map(i => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join(", "),
      courier: (isShipdaak ? o.courier!.slice(SHIPDAAK_COURIER_PREFIX.length) : o.courier) || "—",
      awb: o.awbNumber, returnAwb: (meta(info).rtoAwb as string) || null,
      reason: rtoReason(o),
      startedAt, daysInReturn,
      overdue: stage === "IN_TRANSIT" && daysInReturn >= RTO_OVERDUE_DAYS,
      lastScan: returnScans[0] ?? all[0] ?? null,
      returnScans,
      received, claim,
    };
  });
}

export function rtoReason(o: { ndrReason: string | null }) {
  if (o.ndrReason) return `Delivery failed: ${o.ndrReason}`;
  return "Returned by courier";
}

/** Short reason bucket for the insights chart. */
export function reasonBucket(ndrReason: string | null): string {
  const r = (ndrReason ?? "").toLowerCase();
  if (!r) return "No reason recorded";
  if (/refus|reject|not\s*interested|cancel/.test(r)) return "Customer refused";
  if (/not\s*available|unavailable|door\s*locked|premises|not\s*reachable|not\s*contactable|unreachable|switch/.test(r)) return "Customer not reachable";
  if (/address|location|pincode|out\s*of\s*delivery/.test(r)) return "Address problem";
  if (/cod|cash|amount|money/.test(r)) return "COD not ready";
  if (/future|resched|later/.test(r)) return "Asked for later delivery";
  return "Other";
}

/** RTO % breakdowns over completed shipments (delivered + RTO). */
export function rtoInsights(rows: { status: string; customerAddress: unknown; courier: string | null; ndrReason: string | null; items: { name: string }[] }[]) {
  const by = (keyOf: (r: typeof rows[number]) => string[]) => {
    const m = new Map<string, { rto: number; total: number }>();
    for (const r of rows) for (const k of keyOf(r)) {
      if (!k) continue;
      const cur = m.get(k) ?? { rto: 0, total: 0 };
      cur.total++;
      if (r.status === "RTO") cur.rto++;
      m.set(k, cur);
    }
    return [...m.entries()]
      .filter(([, v]) => v.total >= 3 && v.rto > 0)
      .map(([label, v]) => ({ label, rto: v.rto, total: v.total, pct: Math.round((v.rto / v.total) * 100) }))
      .sort((a, b) => b.pct - a.pct || b.rto - a.rto)
      .slice(0, 8);
  };
  const addr = (r: typeof rows[number]) => (r.customerAddress ?? {}) as Record<string, string>;
  const reasonMap = new Map<string, number>();
  for (const r of rows) if (r.status === "RTO") {
    const b = reasonBucket(r.ndrReason);
    reasonMap.set(b, (reasonMap.get(b) ?? 0) + 1);
  }
  return {
    byState: by(r => [(addr(r).state ?? addr(r).province ?? "").trim()]),
    byPincode: by(r => [(addr(r).pincode ?? addr(r).zip ?? "").trim()]),
    byProduct: by(r => [...new Set(r.items.map(i => i.name))]),
    byCourier: by(r => [(r.courier ?? "").replace(SHIPDAAK_COURIER_PREFIX, "")]),
    byReason: [...reasonMap.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
  };
}
