import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getConfig, requestCODVerification, requestAICall } from "@/lib/hillteck";

// POST — seller manually sends WhatsApp or triggers AI call for a specific order
export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId, mode } = await req.json() as { orderId?: string; mode?: "whatsapp" | "call" };
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const config = await getConfig();
  if (!config || !config.enabled)
    return NextResponse.json({ error: "WhatsApp notifications are not configured yet" }, { status: 503 });

  const [order, seller] = await Promise.all([
    prisma.order.findFirst({
      where:  { id: orderId, sellerId: session.user.id },
      select: {
        id: true, externalOrderId: true, customerName: true,
        customerAddress: true, totalAmount: true, confirmationStatus: true,
        items: { select: { name: true, quantity: true, price: true } },
      },
    }),
    prisma.user.findUnique({
      where:  { id: session.user.id },
      select: { name: true, brandName: true },
    }),
  ]);

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.confirmationStatus === "CONFIRMED")
    return NextResponse.json({ error: "Already confirmed" }, { status: 400 });

  const orderPayload = {
    id:              order.id,
    externalOrderId: order.externalOrderId,
    customerName:    order.customerName,
    customerAddress: order.customerAddress as Record<string, unknown> | null,
    totalAmount:     order.totalAmount,
    items:           order.items,
  };

  const isCall = mode === "call";
  const ok = isCall
    ? await requestAICall(orderPayload, config, seller ?? undefined)
    : await requestCODVerification(orderPayload, config, seller ?? undefined);

  if (!ok) return NextResponse.json({ error: "WhatsApp send failed — check campaign config" }, { status: 502 });

  await prisma.order.update({
    where: { id: orderId },
    data: {
      confirmationStatus:      "PENDING" as never,
      confirmationRequestedAt: new Date(),
      confirmationChannel:     isCall ? "IVR" : "WHATSAPP",
    },
  });

  return NextResponse.json({ success: true });
}
