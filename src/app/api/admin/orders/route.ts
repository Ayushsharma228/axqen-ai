import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search     = searchParams.get("search")     ?? "";
  const status     = searchParams.get("status")     ?? "";
  const sellerId   = searchParams.get("sellerId")   ?? "";
  const supplierId = searchParams.get("supplierId") ?? "";
  const dateFrom   = searchParams.get("dateFrom")   ?? "";
  const dateTo     = searchParams.get("dateTo")     ?? "";
  const source     = searchParams.get("source")     ?? "";
  const ndrOnly    = searchParams.get("ndr")        === "true";
  const page       = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit      = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));

  // status can be a single value or comma-separated list
  const statusList = status ? status.split(",").map(s => s.trim()).filter(Boolean) : [];

  const where = {
    ...(sellerId   ? { sellerId }   : {}),
    ...(supplierId ? { supplierId } : {}),
    ...(statusList.length === 1
      ? { status: statusList[0] as never }
      : statusList.length > 1
        ? { status: { in: statusList as never[] } }
        : {}),
    ...(ndrOnly ? { ndrStatus: { not: null } } : {}),
    ...(source     ? { source: source as never } : {}),
    ...(dateFrom || dateTo ? {
      createdAt: {
        ...(dateFrom ? { gte: new Date(dateFrom) }                               : {}),
        ...(dateTo   ? { lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999)) } : {}),
      },
    } : {}),
    ...(search ? {
      OR: [
        { externalOrderId: { contains: search, mode: "insensitive" as const } },
        { customerName:    { contains: search, mode: "insensitive" as const } },
        { awbNumber:       { contains: search, mode: "insensitive" as const } },
        { items: { some: { name: { contains: search, mode: "insensitive" as const } } } },
      ],
    } : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip:    (page - 1) * limit,
      take:    limit,
      include: {
        seller:   { select: { id: true, name: true, email: true } },
        supplier: { select: { id: true, name: true, email: true } },
        items:    { select: { name: true, quantity: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return NextResponse.json({ orders, total, page, pages: Math.ceil(total / limit), limit });
}

// PATCH — bulk date update
export async function PATCH(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderIds, orderDate } = await req.json() as { orderIds: string[]; orderDate: string };
  if (!orderIds?.length) return NextResponse.json({ error: "No order IDs provided" }, { status: 400 });
  if (!orderDate) return NextResponse.json({ error: "orderDate required" }, { status: 400 });

  const { count } = await prisma.order.updateMany({
    where: { id: { in: orderIds } },
    data: { createdAt: new Date(orderDate) },
  });
  return NextResponse.json({ updated: count });
}

// DELETE — single or bulk
export async function DELETE(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderIds } = await req.json() as { orderIds: string[] };
  if (!orderIds?.length) return NextResponse.json({ error: "No order IDs provided" }, { status: 400 });

  const { count } = await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  return NextResponse.json({ deleted: count });
}

// POST — manually create an order
export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    sellerId, externalOrderId, customerName, customerPhone,
    customerAddress, totalAmount, status, items, orderDate,
  } = body;

  if (!sellerId || !externalOrderId || !totalAmount) {
    return NextResponse.json({ error: "sellerId, externalOrderId and totalAmount are required" }, { status: 400 });
  }

  try {
    const order = await prisma.order.create({
      data: {
        sellerId,
        externalOrderId,
        source: "OTHER",
        status: (status || "NEW") as never,
        customerName: customerName || null,
        customerAddress: customerPhone
          ? { phone: customerPhone, address: customerAddress || "" }
          : customerAddress
            ? { address: customerAddress }
            : Prisma.JsonNull,
        totalAmount: parseFloat(totalAmount),
        createdAt: orderDate ? new Date(orderDate) : new Date(),
        items: {
          create: (items ?? []).map((item: { name: string; quantity: number; price: number }) => ({
            name:     item.name,
            quantity: Number(item.quantity) || 1,
            price:    Number(item.price)    || 0,
          })),
        },
      },
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    console.error("Manual order creation error:", err);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
