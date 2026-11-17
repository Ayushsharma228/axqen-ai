import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { rtoBoard } from "@/lib/rto-query";
import { RTO_CLAIM, RTO_RECEIVED } from "@/lib/rto";

// GET ?tab&days&sellerId&search — all sellers' returns
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const sellerId = sp.get("sellerId") || undefined;
  const data = await rtoBoard({
    scope: sellerId ? { sellerId } : {},
    tab: (sp.get("tab") ?? "BACK_AT_WAREHOUSE").toUpperCase(),
    days: Number(sp.get("days") ?? "") || null,
    search: sp.get("search")?.trim() || undefined,
    withSeller: true,
  });
  return NextResponse.json(data);
}

// POST { orderId, action: "receive", condition: GOOD|DAMAGED|MISSING, note?, rtoCharge? }
// POST { orderId, action: "claim", status: RAISED|SETTLED|REJECTED, amount?, note? }
export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const orderId = String(body.orderId ?? "");
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, status: true, sellerId: true, externalOrderId: true } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status !== "RTO") return NextResponse.json({ error: "This order is not an RTO" }, { status: 400 });

  const by = session.user.name || "AXQEN team";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;

  if (body.action === "receive") {
    const condition = String(body.condition ?? "");
    if (!["GOOD", "DAMAGED", "MISSING"].includes(condition)) return NextResponse.json({ error: "Pick a condition" }, { status: 400 });
    const charge = body.rtoCharge === "" || body.rtoCharge == null ? null : Number(body.rtoCharge);
    if (charge !== null && (!isFinite(charge) || charge < 0)) return NextResponse.json({ error: "RTO charge must be a positive number" }, { status: 400 });
    const label = condition === "GOOD" ? "received in good condition" : condition === "DAMAGED" ? "received damaged" : "marked missing (not received)";

    await prisma.$transaction([
      prisma.orderTimeline.create({
        data: {
          orderId, actorId: session.user.id, actorRole: "ADMIN", eventType: RTO_RECEIVED,
          event: `Return ${label}`, details: note, metadata: { condition, note, by },
        },
      }),
      ...(charge !== null ? [prisma.order.update({ where: { id: orderId }, data: { rtoCharge: charge } })] : []),
      prisma.notification.create({
        data: {
          userId: order.sellerId, type: "ORDER_UPDATE",
          title: condition === "GOOD" ? "Return received" : condition === "DAMAGED" ? "Return received damaged" : "Return missing",
          message: `Order ${order.externalOrderId}: return ${label}.${note ? ` Note: ${note}` : ""}`,
          data: { orderId },
        },
      }),
    ]);
    return NextResponse.json({ success: true });
  }

  if (body.action === "claim") {
    const status = String(body.status ?? "");
    if (!["RAISED", "SETTLED", "REJECTED"].includes(status)) return NextResponse.json({ error: "Invalid claim status" }, { status: 400 });
    const amount = body.amount === "" || body.amount == null ? null : Number(body.amount);
    if (amount !== null && (!isFinite(amount) || amount < 0)) return NextResponse.json({ error: "Claim amount must be a positive number" }, { status: 400 });
    await prisma.orderTimeline.create({
      data: {
        orderId, actorId: session.user.id, actorRole: "ADMIN", eventType: RTO_CLAIM,
        event: `Courier claim ${status.toLowerCase()}`, details: [amount !== null ? `₹${amount}` : null, note].filter(Boolean).join(" · ") || null,
        metadata: { status, amount, note, by },
      },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
