import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CONF_EVENT_TYPES, foldConfirmation, emptyConfirmation, outcomeMeta } from "@/lib/order-confirmation";

// Read-only view of the AXQEN team's confirmation calls for the signed-in seller.
// GET ?days=1|7|30 (omit for all time)
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sellerId = session.user.id;
  const days = Number(req.nextUrl.searchParams.get("days") ?? "") || null;

  const orders = await prisma.order.findMany({
    where: {
      sellerId,
      status: { not: "HIDDEN" as never },
      ...(days ? { createdAt: { gte: new Date(Date.now() - days * 86400000) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true, externalOrderId: true, status: true, paymentMode: true, totalAmount: true,
      customerName: true, customerAddress: true, createdAt: true,
      confirmationStatus: true, confirmationChannel: true, confirmationCompletedAt: true, confirmationFailedAt: true,
      items: { select: { name: true, quantity: true } },
    },
  });

  const rows = orders.length
    ? await prisma.orderTimeline.findMany({
        where: { orderId: { in: orders.map(o => o.id) }, eventType: { in: CONF_EVENT_TYPES } },
        select: { orderId: true, eventType: true, metadata: true, createdAt: true },
      })
    : [];
  const state = foldConfirmation(rows);

  type View = "IN_PROGRESS" | "CONFIRMED" | "CANCELLED";
  const list = orders.map(o => {
    const c = state.get(o.id) ?? emptyConfirmation();
    let view: View;
    let doneAt: string | null = null;
    if (c.final?.value === "ORDER_PLACE" || c.final?.value === "ORDER_DISPATCH") {
      view = "CONFIRMED"; doneAt = c.final.at;
    } else if (c.final?.value === "CANCELLED") {
      view = "CANCELLED"; doneAt = c.final.at;
    } else if (o.status === "CANCELLED") {
      view = "CANCELLED"; doneAt = o.confirmationFailedAt?.toISOString() ?? null;
    } else if (o.status === "NEW") {
      view = "IN_PROGRESS";
    } else {
      view = "CONFIRMED"; doneAt = o.confirmationCompletedAt?.toISOString() ?? null;
    }

    // Reason category for cancellations: the last call outcome recorded.
    let reason: string | null = null;
    if (view === "CANCELLED") {
      const last = [...c.attempts].reverse().find(Boolean);
      if (last) reason = last.outcome === "CANCEL_ORDER" ? "Customer cancelled" : outcomeMeta(last.outcome)?.label ?? null;
      else if (o.confirmationChannel === "WHATSAPP") reason = "Customer cancelled on WhatsApp";
      else reason = "Not recorded";
    }

    const addr = (o.customerAddress ?? {}) as Record<string, unknown>;
    return {
      id: o.id,
      externalOrderId: o.externalOrderId,
      paymentMode: o.paymentMode,
      totalAmount: o.totalAmount,
      customerName: o.customerName,
      city: (addr.city as string) ?? null,
      state: ((addr.state ?? addr.province) as string) ?? null,
      items: o.items,
      createdAt: o.createdAt.toISOString(),
      view, doneAt, reason,
      confirmation: c,
    };
  });

  const confirmed = list.filter(o => o.view === "CONFIRMED");
  const cancelled = list.filter(o => o.view === "CANCELLED");
  const timed = confirmed
    .filter(o => o.doneAt)
    .map(o => (new Date(o.doneAt!).getTime() - new Date(o.createdAt).getTime()) / 3600000)
    .filter(h => h >= 0);

  const reasonMap = new Map<string, number>();
  for (const o of cancelled) reasonMap.set(o.reason ?? "Not recorded", (reasonMap.get(o.reason ?? "Not recorded") ?? 0) + 1);

  return NextResponse.json({
    orders: list,
    stats: {
      received:   list.length,
      inProgress: list.filter(o => o.view === "IN_PROGRESS").length,
      confirmed:  confirmed.length,
      cancelled:  cancelled.length,
      avgHoursToConfirm: timed.length ? timed.reduce((s, h) => s + h, 0) / timed.length : null,
      within24hPct: timed.length ? Math.round((timed.filter(h => h <= 24).length / timed.length) * 100) : null,
      reasons: [...reasonMap.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    },
  });
}
