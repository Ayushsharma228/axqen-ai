import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getRouteSession(req);
    if (!session || session.user.role !== "SELLER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const search = searchParams.get("search");
    const productFilter = searchParams.get("product");
    const statusFilter = searchParams.get("status");
    const limitParam = searchParams.get("limit");
    const limitNum = limitParam ? parseInt(limitParam, 10) : undefined;

    const seller = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { dataStartDate: true },
    });
    const dataStart = seller?.dataStartDate ?? null;

    // Effective lower bound: max(dataStartDate, from) so the hard floor always applies
    const fromDate = from ? new Date(from) : null;
    const gteDate = dataStart && fromDate
      ? (dataStart > fromDate ? dataStart : fromDate)
      : (dataStart ?? fromDate ?? null);
    const lteDate = to ? new Date(to + "T23:59:59.999Z") : null;
    const createdAtFilter = (gteDate || lteDate) ? {
      createdAt: {
        ...(gteDate ? { gte: gteDate } : {}),
        ...(lteDate ? { lte: lteDate } : {}),
      },
    } : {};

    const orders = await prisma.order.findMany({
      where: {
        sellerId: session.user.id,
        ...createdAtFilter,
        ...(statusFilter && statusFilter !== "ALL" ? { status: statusFilter as import("@prisma/client").OrderStatus } : {}),
        ...(search ? {
          OR: [
            { externalOrderId: { contains: search, mode: "insensitive" } },
            { customerName: { contains: search, mode: "insensitive" } },
            { customerEmail: { contains: search, mode: "insensitive" } },
          ],
        } : {}),
        ...(productFilter ? { items: { some: { name: { contains: productFilter, mode: "insensitive" } } } } : {}),
      },
      orderBy: { createdAt: "desc" },
      ...(limitNum ? { take: limitNum } : {}),
      select: {
        id: true, externalOrderId: true, source: true, status: true,
        customerName: true, customerEmail: true, customerAddress: true,
        totalAmount: true, currency: true, awbNumber: true, trackingUrl: true, courier: true,
        paymentMode: true,
        ndrStatus: true, ndrActionTaken: true, ndrAttempts: true, ndrCreatedAt: true,
        supplierId: true, supplierStatus: true,
        confirmationStatus: true,
        productCost: true, shippingCharge: true, packingCharge: true, rtoCharge: true,
        utmSource: true, utmMedium: true, utmCampaign: true,
        createdAt: true, updatedAt: true,
        items: { select: { id: true, name: true, sku: true, quantity: true, price: true } },
      },
    });

    const totalRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
    const totalItems = orders.reduce((s, o) => s + o.items.reduce((si, i) => si + i.quantity, 0), 0);

    // Top product by quantity
    const productCounts: Record<string, number> = {};
    orders.forEach((o) => o.items.forEach((i) => {
      productCounts[i.name] = (productCounts[i.name] || 0) + i.quantity;
    }));
    const topProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Repeat customer data — count all-time orders per customer (email preferred, phone fallback)
    const allSellerOrders = await prisma.order.findMany({
      where: { sellerId: session.user.id },
      select: { id: true, customerEmail: true, customerAddress: true },
    });

    function customerKey(email: string | null, addr: unknown): string | null {
      if (email) return `email:${email.toLowerCase()}`;
      const phone = (addr as Record<string, string> | null)?.phone;
      return phone ? `phone:${phone.replace(/\s+/g, "")}` : null;
    }

    const keyCount: Record<string, number> = {};
    allSellerOrders.forEach((o) => {
      const k = customerKey(o.customerEmail, o.customerAddress);
      if (k) keyCount[k] = (keyCount[k] ?? 0) + 1;
    });

    const ordersWithRepeat = orders.map((o) => {
      const k = customerKey(o.customerEmail, o.customerAddress);
      return { ...o, customerOrderCount: k ? (keyCount[k] ?? 1) : 1 };
    });

    return NextResponse.json({ orders: ordersWithRepeat, stats: { totalOrders: orders.length, totalRevenue, totalItems, topProduct } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
