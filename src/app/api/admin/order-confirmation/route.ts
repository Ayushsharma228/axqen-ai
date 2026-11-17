import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  CONF_EVENT, CONF_EVENT_TYPES, MAX_ATTEMPTS, foldConfirmation, emptyConfirmation,
  outcomeMeta, finalMeta,
} from "@/lib/order-confirmation";

async function requireAdmin(req: NextRequest) {
  const session = await getRouteSession(req);
  return session?.user.role === "ADMIN" ? session : null;
}

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD&search=&sellerId=
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  const search = (sp.get("search") ?? "").trim();
  const sellerId = sp.get("sellerId") ?? "";

  const orders = await prisma.order.findMany({
    where: {
      status: { not: "HIDDEN" as never },
      ...(sellerId ? { sellerId } : {}),
      ...(from || to ? {
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
        },
      } : {}),
      ...(search ? {
        OR: [
          { externalOrderId: { contains: search, mode: "insensitive" as const } },
          { customerName:    { contains: search, mode: "insensitive" as const } },
          { customerEmail:   { contains: search, mode: "insensitive" as const } },
        ],
      } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true, externalOrderId: true, status: true, paymentMode: true, totalAmount: true,
      customerName: true, customerEmail: true, customerAddress: true, createdAt: true,
      confirmationStatus: true,
      seller: { select: { id: true, name: true, brandName: true } },
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

  return NextResponse.json({
    orders: orders.map(o => ({ ...o, confirmation: state.get(o.id) ?? emptyConfirmation() })),
  });
}

// POST
//   { orderId, action: "attempt", attempt: 1-3, outcome: string | null }
//   { orderId, action: "final",   value: string | null }
//   { orderId, action: "remark",  text: string }
//   { orderId, action: "address", address, city, state, pincode, phone }
export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const orderId = String(body.orderId ?? "");
  const action = String(body.action ?? "");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, sellerId: true, status: true, externalOrderId: true, customerAddress: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const base = { orderId, actorId: session.user.id, actorRole: "ADMIN" };

  if (action === "attempt") {
    const attempt = Number(body.attempt);
    const outcome = body.outcome ? String(body.outcome) : null;
    if (!(attempt >= 1 && attempt <= MAX_ATTEMPTS)) return NextResponse.json({ error: "Invalid attempt" }, { status: 400 });
    if (outcome && !outcomeMeta(outcome)) return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });
    await prisma.orderTimeline.create({
      data: {
        ...base,
        eventType: CONF_EVENT.ATTEMPT,
        event: outcome ? `Confirmation call ${attempt}: ${outcomeMeta(outcome)!.label}` : `Confirmation call ${attempt} cleared`,
        metadata: { attempt, outcome },
      },
    });
    return NextResponse.json({ success: true });
  }

  if (action === "remark") {
    const text = String(body.text ?? "").trim().slice(0, 1000);
    await prisma.orderTimeline.create({
      data: { ...base, eventType: CONF_EVENT.REMARK, event: text ? `Confirmation note: ${text}` : "Confirmation note cleared", metadata: { text } },
    });
    return NextResponse.json({ success: true });
  }

  if (action === "address") {
    const prev = (order.customerAddress ?? {}) as Record<string, unknown>;
    const pick = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : undefined);
    const next: Record<string, unknown> = { ...prev };
    for (const k of ["address", "city", "state", "pincode", "phone"]) {
      const v = pick(k);
      if (v !== undefined) next[k] = v;
    }
    await prisma.$transaction([
      prisma.order.update({ where: { id: orderId }, data: { customerAddress: next as never } }),
      prisma.orderTimeline.create({
        data: { ...base, eventType: CONF_EVENT.ADDRESS, event: "Address corrected by AXQEN team on confirmation call", metadata: { before: prev, after: next } as never },
      }),
    ]);
    return NextResponse.json({ success: true, customerAddress: next });
  }

  if (action === "final") {
    const value = body.value ? String(body.value) : null;
    if (value && !finalMeta(value)) return NextResponse.json({ error: "Invalid final status" }, { status: 400 });

    const now = new Date();
    const orderData: Record<string, unknown> = {};

    if (value === "ORDER_PLACE" || value === "ORDER_DISPATCH") {
      if (order.status === "CANCELLED") {
        return NextResponse.json({ error: "This order is already cancelled" }, { status: 400 });
      }
      // Same move as the seller's Confirm: NEW → PROCESSING. Later stages are left alone.
      if (order.status === "NEW") orderData.status = "PROCESSING";
      orderData.confirmationStatus = "CONFIRMED";
      orderData.confirmationCompletedAt = now;
      orderData.confirmationChannel = "MANUAL";
    } else if (value === "CANCELLED") {
      if (!["NEW", "PROCESSING"].includes(order.status)) {
        return NextResponse.json({ error: "Only orders that haven't shipped can be cancelled here" }, { status: 400 });
      }
      orderData.status = "CANCELLED";
      orderData.confirmationStatus = "FAILED";
      orderData.confirmationFailedAt = now;
      orderData.confirmationChannel = "MANUAL";
    }

    const label = value ? finalMeta(value)!.label : "cleared";
    const ops = [
      prisma.orderTimeline.create({
        data: { ...base, eventType: CONF_EVENT.FINAL, event: `Confirmation final status: ${label}`, metadata: { value } },
      }),
      ...(Object.keys(orderData).length ? [prisma.order.update({ where: { id: orderId }, data: orderData as never })] : []),
    ];
    if (value === "CANCELLED") {
      ops.push(prisma.notification.create({
        data: {
          userId: order.sellerId,
          type: "ORDER_UPDATE",
          title: "Order cancelled after confirmation call",
          message: `Order ${order.externalOrderId} was cancelled by the AXQEN team. See COD Confirmation for the reason.`,
          data: { orderId },
        },
      }) as never);
    }
    await prisma.$transaction(ops as never);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
