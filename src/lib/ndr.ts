// NDR (failed delivery) management — handled by the AXQEN team, shown read-only to sellers.
// Actions go to the right courier (Shipdaak or Delhivery). History lives in OrderTimeline.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SHIPDAAK_COURIER_PREFIX, ndrAction as shipdaakNdrAction, shipdaakConfigured } from "@/lib/shipdaak";
import { loadCourierScans, type CourierScan } from "@/lib/courier-scans";

export const NDR_ACTION = "NDR_ACTION";
export const NDR_ESCALATION = "NDR_ESCALATION";
export const ESCALATE_AFTER_HOURS = 24;

export type NdrTab = "ACTION_NEEDED" | "REATTEMPT" | "DELIVERED" | "RTO";

const FAILED = /undelivered|not\s*delivered|delivery\s*failed|failed\s*attempt|attempt(ed)?\s*(failed|unsuccessful)|not\s*available|unavailable|refused|door\s*locked|premises\s*closed|not\s*contactable|not\s*reachable|unreachable|wrong\s*address|incomplete\s*address|address\s*not\s*found|out\s*of\s*delivery\s*area|cod\s*(amount\s*)?not\s*ready|cash\s*not\s*ready|future\s*delivery|customer\s*(wants|requested)|\bndr\b/i;
export const isFailedAttemptScan = (s: CourierScan) => FAILED.test(`${s.status} ${s.message}`);

export function ndrTab(o: { status: string; ndrActionTaken: string | null }): NdrTab {
  if (o.status === "DELIVERED") return "DELIVERED";
  if (o.status === "RTO") return "RTO";
  return o.ndrActionTaken ? "REATTEMPT" : "ACTION_NEEDED";
}

export const NDR_ORDER_SELECT = {
  id: true, externalOrderId: true, status: true, paymentMode: true, totalAmount: true,
  customerName: true, customerAddress: true, awbNumber: true, courier: true,
  ndrReason: true, ndrStatus: true, ndrAttempts: true, ndrActionTaken: true, ndrCreatedAt: true,
  createdAt: true, updatedAt: true, sellerId: true,
} satisfies Prisma.OrderSelect;
type NdrOrderRow = Prisma.OrderGetPayload<{ select: typeof NDR_ORDER_SELECT }>;

export interface NdrCard {
  id: string; externalOrderId: string; status: string; tab: NdrTab;
  paymentMode: string; totalAmount: number;
  customerName: string | null; phone: string | null; address: string | null;
  city: string | null; state: string | null; pincode: string | null;
  awb: string | null; courier: string; isShipdaak: boolean;
  reason: string | null; attemptsCount: number;
  openedAt: string | null; hoursOpen: number | null;
  attempts: { time: string; reason: string; location: string }[];
  actions: { time: string; action: string; reattemptDate: string | null; note: string | null; by: string; courierMessage: string | null }[];
  escalations: { time: string; note: string | null }[];
  canEscalate: boolean;
}

/** Turn NDR orders into cards with attempt history, actions taken and escalations. */
export async function buildNdrCards(orders: NdrOrderRow[]): Promise<NdrCard[]> {
  const ids = orders.map(o => o.id);
  const [scans, rows] = await Promise.all([
    loadCourierScans(ids),
    ids.length
      ? prisma.orderTimeline.findMany({
          where: { orderId: { in: ids }, eventType: { in: [NDR_ACTION, NDR_ESCALATION] } },
          orderBy: { createdAt: "desc" },
          select: { orderId: true, eventType: true, metadata: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);
  const now = Date.now();

  return orders.map(o => {
    const addr = (o.customerAddress ?? {}) as Record<string, string>;
    const isShipdaak = o.courier?.startsWith(SHIPDAAK_COURIER_PREFIX) ?? false;
    const failed = (scans.get(o.id) ?? []).filter(isFailedAttemptScan);
    const attempts = failed.length
      ? failed.map(s => ({ time: s.time, reason: s.message || s.status, location: s.location }))
      : o.ndrCreatedAt
        ? [{ time: o.ndrCreatedAt.toISOString(), reason: o.ndrReason || o.ndrStatus || "Delivery attempt failed", location: "" }]
        : [];
    const mine = rows.filter(r => r.orderId === o.id);
    const actions = mine.filter(r => r.eventType === NDR_ACTION).map(r => {
      const m = (r.metadata ?? {}) as Record<string, string | null>;
      return {
        time: r.createdAt.toISOString(), action: String(m.action ?? ""),
        reattemptDate: m.reattemptDate ?? null, note: m.note ?? null,
        by: m.by ?? "AXQEN team", courierMessage: m.courierMessage ?? null,
      };
    });
    const escalations = mine.filter(r => r.eventType === NDR_ESCALATION).map(r => ({
      time: r.createdAt.toISOString(), note: ((r.metadata ?? {}) as Record<string, string | null>).note ?? null,
    }));
    const tab = ndrTab(o);
    // "Open since" = latest failed attempt that hasn't been acted on yet
    const openedAt = attempts[0]?.time ?? o.ndrCreatedAt?.toISOString() ?? null;
    const hoursOpen = openedAt ? (now - new Date(openedAt).getTime()) / 3600000 : null;
    const lastEscalation = escalations[0] ? new Date(escalations[0].time).getTime() : 0;
    return {
      id: o.id, externalOrderId: o.externalOrderId, status: o.status, tab,
      paymentMode: o.paymentMode, totalAmount: o.totalAmount,
      customerName: o.customerName, phone: addr.phone ?? null,
      address: addr.address ?? ([addr.address1, addr.address2].filter(Boolean).join(", ") || null),
      city: addr.city ?? null, state: addr.state ?? addr.province ?? null, pincode: addr.pincode ?? addr.zip ?? null,
      awb: o.awbNumber, courier: (isShipdaak ? o.courier!.slice(SHIPDAAK_COURIER_PREFIX.length) : o.courier) || "—", isShipdaak,
      reason: o.ndrReason || o.ndrStatus, attemptsCount: Math.max(o.ndrAttempts ?? 0, attempts.length),
      openedAt, hoursOpen,
      attempts, actions, escalations,
      canEscalate: tab === "ACTION_NEEDED" && (hoursOpen ?? 0) >= ESCALATE_AFTER_HOURS
        && now - lastEscalation >= ESCALATE_AFTER_HOURS * 3600000,
    };
  });
}

export function ndrStats(orders: { status: string; ndrActionTaken: string | null; ndrCreatedAt: Date | null }[]) {
  const c = { ACTION_NEEDED: 0, REATTEMPT: 0, DELIVERED: 0, RTO: 0, ALL: orders.length, OVERDUE: 0 };
  const now = Date.now();
  for (const o of orders) {
    const t = ndrTab(o);
    c[t]++;
    if (t === "ACTION_NEEDED" && o.ndrCreatedAt && now - o.ndrCreatedAt.getTime() >= ESCALATE_AFTER_HOURS * 3600000) c.OVERDUE++;
  }
  const done = c.DELIVERED + c.RTO;
  return { counts: c, saveRate: done ? Math.round((c.DELIVERED / done) * 100) : null };
}

// ── Taking action ────────────────────────────────────────────────────────────

export interface NdrActionInput {
  action: "REATTEMPT" | "RTO";
  reattemptDate?: string;     // YYYY-MM-DD
  name?: string; phone?: string; address?: string; city?: string; state?: string; pincode?: string;
  note?: string;
}

/** Sends the NDR action to the shipment's courier, then records it on the order. */
export async function takeNdrAction(orderId: string, input: NdrActionInput, actor: { id: string; label: string }) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");
  if (!order.awbNumber) throw new Error("This order has no AWB");
  if (["DELIVERED", "RTO", "CANCELLED"].includes(order.status)) throw new Error(`Order is already ${order.status.toLowerCase()}`);

  const prevAddr = (order.customerAddress ?? {}) as Record<string, string>;
  const phoneChanged = !!input.phone && input.phone.replace(/\D/g, "").slice(-10) !== (prevAddr.phone ?? "").replace(/\D/g, "").slice(-10);
  const addressChanged = !!input.address && input.address.trim() !== (prevAddr.address ?? "").trim();
  const isShipdaak = order.courier?.startsWith(SHIPDAAK_COURIER_PREFIX) ?? false;
  const messages: string[] = [];

  if (isShipdaak) {
    if (!shipdaakConfigured()) throw new Error("Shipdaak is not configured");
    const remarks = input.note?.trim() || "";
    if (input.action === "REATTEMPT") {
      if (phoneChanged) messages.push((await shipdaakNdrAction(order.awbNumber, { action: "change phone", phone: input.phone!, remarks })) ?? "");
      if (addressChanged) {
        messages.push((await shipdaakNdrAction(order.awbNumber, {
          action: "change address",
          name: input.name?.trim() || order.customerName || "Customer",
          address1: input.address!.trim(),
          address2: [input.city, input.state, input.pincode].filter(Boolean).join(", "),
          remarks,
        })) ?? "");
      }
      const date = input.reattemptDate || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      messages.push((await shipdaakNdrAction(order.awbNumber, { action: "re-attempt", reAttemptDate: date, remarks })) ?? "");
    } else {
      // Shipdaak has no "return to origin" NDR action; the courier returns it after the final attempt.
      messages.push("RTO noted in AXQEN. Shipdaak returns the shipment after the courier's final attempt.");
    }
  } else if (!order.courier || /delhivery/i.test(order.courier)) {
    const token = process.env.DELHIVERY_API_TOKEN;
    if (!token) throw new Error("Delhivery is not configured");
    const res = await fetch("https://track.delhivery.com/api/p/psc/ndr/wbns/", {
      method: "POST",
      headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        waybill: order.awbNumber,
        act: input.action === "REATTEMPT" ? "Reattempt" : "RTO",
        name: input.name || order.customerName || "",
        phone: input.phone || "",
        add: input.address || "",
        city: input.city || "",
        pin: input.pincode || "",
        state: input.state || "",
        country: "India",
        comments: input.note || (input.action === "REATTEMPT" ? "Re-attempt delivery" : "Return to origin"),
      }),
    });
    if (!res.ok) throw new Error(`Delhivery: ${(await res.text()).slice(0, 200)}`);
    messages.push("Sent to Delhivery");
  } else {
    messages.push(`Recorded in AXQEN — ${order.courier} has no NDR API connected; inform the courier directly.`);
  }

  const nextAddr = input.action === "REATTEMPT" && (addressChanged || phoneChanged)
    ? {
        ...prevAddr,
        ...(addressChanged ? { address: input.address!.trim(), city: input.city ?? prevAddr.city, state: input.state ?? prevAddr.state, pincode: input.pincode ?? prevAddr.pincode } : {}),
        ...(phoneChanged ? { phone: input.phone!.trim() } : {}),
      }
    : null;

  // Delhivery confirms RTO immediately (existing behaviour); Shipdaak waits for the courier's scan.
  const markRto = input.action === "RTO" && !isShipdaak && (!order.courier || /delhivery/i.test(order.courier));

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        ndrActionTaken: input.action,
        ...(nextAddr ? { customerAddress: nextAddr } : {}),
        ...(markRto ? { status: "RTO" as never } : {}),
      },
    }),
    prisma.orderTimeline.create({
      data: {
        orderId: order.id, actorId: actor.id, actorRole: "ADMIN", eventType: NDR_ACTION,
        event: input.action === "REATTEMPT" ? "NDR: re-attempt requested" : "NDR: return to origin",
        details: [input.reattemptDate && `Re-attempt on ${input.reattemptDate}`, phoneChanged && "phone updated", addressChanged && "address updated", input.note].filter(Boolean).join(" · ") || null,
        metadata: {
          action: input.action, reattemptDate: input.action === "REATTEMPT" ? (input.reattemptDate ?? null) : null,
          phoneChanged, addressChanged, note: input.note ?? null, by: actor.label,
          courierMessage: messages.filter(Boolean).join(" | ") || null,
        },
      },
    }),
    prisma.notification.create({
      data: {
        userId: order.sellerId, type: "ORDER_UPDATE",
        title: input.action === "REATTEMPT" ? "NDR: re-attempt scheduled" : "NDR: returning to origin",
        message: `Order ${order.externalOrderId}: the AXQEN team ${input.action === "REATTEMPT" ? `requested a re-attempt${input.reattemptDate ? ` on ${input.reattemptDate}` : ""}` : "marked it for return"}.`,
        data: { orderId: order.id },
      },
    }),
  ]);

  return { message: messages.join(" | ") };
}

/** Has a new failed attempt happened after the last NDR action? (re-opens the NDR) */
export async function failedAgainAfterAction(orderId: string, latestFailedScanTime: string | null | undefined) {
  if (!latestFailedScanTime) return false;
  const last = await prisma.orderTimeline.findFirst({
    where: { orderId, eventType: NDR_ACTION },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return !!last && new Date(latestFailedScanTime).getTime() > last.createdAt.getTime();
}
