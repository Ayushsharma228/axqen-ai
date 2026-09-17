import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getRouteSession(req);
    if (!session || session.user.role !== "ADMIN")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = req.nextUrl;
    const search     = searchParams.get("search")   ?? "";
    const sellerId   = searchParams.get("sellerId") ?? "";
    const repeatOnly = searchParams.get("repeat")   === "true";
    const page       = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
    const limit      = Math.min(200, parseInt(searchParams.get("limit") ?? "50"));

    // Fetch orders with only the fields needed for customer aggregation
    const orders = await prisma.order.findMany({
      where: {
        customerName: { not: null },
        ...(sellerId ? { sellerId } : {}),
      },
      select: {
        customerName:    true,
        customerAddress: true,
        status:          true,
        totalAmount:     true,
        createdAt:       true,
      },
      orderBy: { createdAt: "desc" },
      take: 10000, // more than enough for any realistic dataset
    });

    // Group by (customerName + phone) client-side
    type AggRow = {
      customerName: string;
      phone: string;
      totalOrders: number;
      deliveredOrders: number;
      rtoOrders: number;
      cancelledOrders: number;
      totalSpend: number;
      lastOrderAt: Date;
      firstOrderAt: Date;
    };

    const map = new Map<string, AggRow>();

    for (const o of orders) {
      const name  = (o.customerName ?? "").trim();
      const addr  = (o.customerAddress ?? {}) as Record<string, string>;
      const phone = (addr.phone ?? "").trim();
      const key   = `${name.toLowerCase()}||${phone}`;

      if (!map.has(key)) {
        map.set(key, {
          customerName:    name,
          phone,
          totalOrders:     0,
          deliveredOrders: 0,
          rtoOrders:       0,
          cancelledOrders: 0,
          totalSpend:      0,
          lastOrderAt:     o.createdAt,
          firstOrderAt:    o.createdAt,
        });
      }
      const row = map.get(key)!;
      row.totalOrders++;
      row.totalSpend += o.totalAmount;
      if (o.status === "DELIVERED") row.deliveredOrders++;
      if (o.status === "RTO")       row.rtoOrders++;
      if (o.status === "CANCELLED") row.cancelledOrders++;
      if (o.createdAt > row.lastOrderAt)  row.lastOrderAt  = o.createdAt;
      if (o.createdAt < row.firstOrderAt) row.firstOrderAt = o.createdAt;
    }

    // Filter by search
    let rows = [...map.values()];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.customerName.toLowerCase().includes(q) ||
        r.phone.includes(q)
      );
    }
    // Filter repeat only
    if (repeatOnly) rows = rows.filter(r => r.totalOrders > 1);

    // Sort: most orders first, then most recent
    rows.sort((a, b) => b.totalOrders - a.totalOrders || b.lastOrderAt.getTime() - a.lastOrderAt.getTime());

    // Summary (from full unfiltered data)
    const allRows = [...map.values()];
    const summaryTotalCustomers  = allRows.length;
    const summaryRepeatCustomers = allRows.filter(r => r.totalOrders > 1).length;
    const summaryTotalOrders     = allRows.reduce((s, r) => s + r.totalOrders, 0);
    const summaryTotalDelivered  = allRows.reduce((s, r) => s + r.deliveredOrders, 0);

    // Paginate
    const total    = rows.length;
    const pages    = Math.ceil(total / limit);
    const pageRows = rows.slice((page - 1) * limit, page * limit);

    const customers = pageRows.map(r => ({
      customerName:    r.customerName,
      phone:           r.phone || null,
      totalOrders:     r.totalOrders,
      deliveredOrders: r.deliveredOrders,
      rtoOrders:       r.rtoOrders,
      cancelledOrders: r.cancelledOrders,
      totalSpend:      Math.round(r.totalSpend),
      lastOrderAt:     r.lastOrderAt,
      firstOrderAt:    r.firstOrderAt,
      isRepeat:        r.totalOrders > 1,
      deliveryRate:    r.totalOrders > 0
        ? Math.round(r.deliveredOrders / r.totalOrders * 100)
        : 0,
    }));

    return NextResponse.json({
      customers,
      total,
      page,
      pages,
      summary: {
        totalCustomers:  summaryTotalCustomers,
        repeatCustomers: summaryRepeatCustomers,
        totalOrders:     summaryTotalOrders,
        totalDelivered:  summaryTotalDelivered,
      },
    });
  } catch (err) {
    console.error("[customers API]", err);
    return NextResponse.json({ error: "Failed to load customers" }, { status: 500 });
  }
}
