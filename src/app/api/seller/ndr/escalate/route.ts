import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NDR_ESCALATION, NDR_ORDER_SELECT, NDR_VISIBLE_FROM, buildNdrCards } from "@/lib/ndr";

// Seller escalates an NDR that has had no action for 24h+ → every admin gets a notification.
export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId, note } = (await req.json()) as { orderId?: string; note?: string };
  const order = await prisma.order.findFirst({
    where: { id: orderId ?? "", sellerId: session.user.id, ndrStatus: { not: null }, ndrCreatedAt: { gte: NDR_VISIBLE_FROM } },
    select: NDR_ORDER_SELECT,
  });
  if (!order) return NextResponse.json({ error: "NDR not found" }, { status: 404 });

  const [card] = await buildNdrCards([order]);
  if (!card.canEscalate) {
    return NextResponse.json({ error: "You can escalate once an NDR has had no action for 24 hours, and once per day." }, { status: 400 });
  }

  const text = (note ?? "").trim().slice(0, 500) || null;
  const [admins, seller] = await Promise.all([
    prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { brandName: true, name: true } }),
  ]);
  const who = seller?.brandName || seller?.name || "A seller";
  const hours = Math.round(card.hoursOpen ?? 0);

  await prisma.$transaction([
    prisma.orderTimeline.create({
      data: {
        orderId: order.id, actorId: session.user.id, actorRole: "SELLER", eventType: NDR_ESCALATION,
        event: "NDR escalated by seller", details: text, metadata: { note: text, hoursOpen: hours },
      },
    }),
    ...admins.map(a => prisma.notification.create({
      data: {
        userId: a.id, type: "ORDER_UPDATE",
        title: "NDR escalated by seller",
        message: `${who} escalated the NDR on order ${order.externalOrderId}: open ${hours}h with no action.${text ? ` Note: ${text}` : ""}`,
        data: { orderId: order.id, kind: "NDR_ESCALATION" },
      },
    })),
  ]);
  return NextResponse.json({ success: true });
}
