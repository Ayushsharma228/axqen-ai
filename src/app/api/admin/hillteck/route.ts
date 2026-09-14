import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getConfig, requestCODVerification } from "@/lib/hillteck";

// GET — dashboard stats + config status
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await getConfig();
  const today  = new Date();
  today.setHours(0, 0, 0, 0);

  const [stats, recent] = await Promise.all([
    prisma.order.groupBy({
      by:     ["confirmationStatus"],
      where:  { paymentMode: "COD" },
      _count: { id: true },
    }),
    prisma.order.findMany({
      where: {
        paymentMode: "COD",
        confirmationStatus: { not: "NOT_REQUIRED" },
      },
      select: {
        id: true, externalOrderId: true, customerName: true, totalAmount: true,
        confirmationStatus: true, confirmationRequestedAt: true,
        confirmationCompletedAt: true, confirmationFailedAt: true,
        confirmationChannel: true, status: true, createdAt: true,
        seller: { select: { name: true, brandName: true } },
      },
      orderBy: { confirmationRequestedAt: "desc" },
      take: 50,
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const row of stats) {
    counts[row.confirmationStatus] = row._count.id;
  }

  // Today's COD orders (all, regardless of confirmation)
  const todayCod = await prisma.order.count({
    where: { paymentMode: "COD", createdAt: { gte: today } },
  });

  return NextResponse.json({
    connected:  !!config,
    enabled:    config?.enabled ?? false,
    baseUrl:    config?.baseUrl ?? "",
    webhookUrl: `${process.env.NEXTAUTH_URL ?? ""}/api/webhooks/hillteck`,
    stats: {
      total_cod:    (counts["NOT_REQUIRED"] ?? 0) + (counts["PENDING"] ?? 0) +
                    (counts["CONFIRMED"] ?? 0) + (counts["FAILED"] ?? 0) + (counts["CANCELLED"] ?? 0),
      today_cod:    todayCod,
      pending:      counts["PENDING"]    ?? 0,
      confirmed:    counts["CONFIRMED"]  ?? 0,
      failed:       counts["FAILED"]     ?? 0,
      cancelled:    counts["CANCELLED"]  ?? 0,
      not_required: counts["NOT_REQUIRED"] ?? 0,
    },
    recent,
  });
}

// POST — manually trigger verification for a specific order
export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await req.json() as { orderId?: string };
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const config = await getConfig();
  if (!config) return NextResponse.json({ error: "HillTeck not configured" }, { status: 400 });

  const order = await prisma.order.findUnique({
    where:  { id: orderId },
    select: {
      id: true, externalOrderId: true, customerName: true,
      customerAddress: true, totalAmount: true,
      confirmationStatus: true, paymentMode: true,
      items: { select: { name: true, quantity: true, price: true } },
    },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

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
    data:  {
      confirmationStatus:      "PENDING" as never,
      confirmationRequestedAt: new Date(),
      confirmationChannel:     "HILLTECK",
    },
  });

  return NextResponse.json({ success: true });
}
