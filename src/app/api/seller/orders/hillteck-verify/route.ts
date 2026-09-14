import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getConfig, requestCODVerification } from "@/lib/hillteck";

// POST — seller-triggered HillTeck verification for a specific order
export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId, channel } = await req.json() as { orderId?: string; channel?: "IVR" | "WHATSAPP" };
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const config = await getConfig();
  if (!config || !config.enabled)
    return NextResponse.json({ error: "HillTeck is not configured yet" }, { status: 503 });

  const order = await prisma.order.findFirst({
    where: { id: orderId, sellerId: session.user.id },
    select: {
      id: true, externalOrderId: true, customerName: true,
      customerAddress: true, totalAmount: true, confirmationStatus: true,
      items: { select: { name: true, quantity: true, price: true } },
    },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.confirmationStatus === "CONFIRMED")
    return NextResponse.json({ error: "Already confirmed" }, { status: 400 });

  const ok = await requestCODVerification(
    {
      id:              order.id,
      externalOrderId: order.externalOrderId,
      customerName:    order.customerName,
      customerAddress: order.customerAddress as { phone?: string } | null,
      totalAmount:     order.totalAmount,
      items:           order.items,
    },
    config,
  );

  if (!ok) return NextResponse.json({ error: "HillTeck request failed" }, { status: 502 });

  await prisma.order.update({
    where: { id: orderId },
    data: {
      confirmationStatus:      "PENDING" as never,
      confirmationRequestedAt: new Date(),
      confirmationChannel:     channel === "WHATSAPP" ? "WHATSAPP" : "IVR",
    },
  });

  return NextResponse.json({ success: true });
}
