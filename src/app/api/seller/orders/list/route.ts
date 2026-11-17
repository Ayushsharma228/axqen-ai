import { NextRequest, NextResponse } from "next/server";
import { Prisma, OrderStatus } from "@prisma/client";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CONF_EVENT, foldConfirmation, outcomeMeta } from "@/lib/order-confirmation";

// Paged, filterable order list for the seller's All Orders page.
// GET ?tab=ALL|NEW|CONFIRMED|SHIPPED|DELIVERED|RTO|CANCELLED &from&to &payment=COD|PREPAID
//     &source=SHOPIFY|AMAZON|OTHER &product &search &page &limit (max 100; export=1 allows 5000)

const TAB_STATUSES: Record<string, OrderStatus[]> = {
  NEW:       ["NEW"],
  CONFIRMED: ["PROCESSING"],
  SHIPPED:   ["SHIPPED", "IN_TRANSIT"],
  DELIVERED: ["DELIVERED"],
  RTO:       ["RTO"],
  CANCELLED: ["CANCELLED"],
};

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sellerId = session.user.id;
  const sp = req.nextUrl.searchParams;
  const tab = (sp.get("tab") ?? "ALL").toUpperCase();
  const from = sp.get("from");
  const to = sp.get("to");
  const payment = sp.get("payment");
  const source = sp.get("source");
  const product = sp.get("product")?.trim();
  const search = sp.get("search")?.trim();
  const isExport = sp.get("export") === "1";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = isExport ? 5000 : Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "50", 10) || 50));

  // Same hard floor as the other seller order endpoints: never before dataStartDate.
  const seller = await prisma.user.findUnique({ where: { id: sellerId }, select: { dataStartDate: true } });
  const dataStart = seller?.dataStartDate ?? null;
  const fromDate = from ? new Date(from) : null;
  const gte = dataStart && fromDate ? (dataStart > fromDate ? dataStart : fromDate) : (dataStart ?? fromDate);
  const lte = to ? new Date(to + "T23:59:59.999Z") : null;

  const base: Prisma.OrderWhereInput = {
    sellerId,
    status: { not: "HIDDEN" },
    ...(gte || lte ? { createdAt: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } } : {}),
    ...(payment === "COD" || payment === "PREPAID" ? { paymentMode: payment } : {}),
    ...(source === "SHOPIFY" || source === "AMAZON" || source === "OTHER" ? { source } : {}),
    ...(product ? { items: { some: { name: { contains: product, mode: "insensitive" } } } } : {}),
    ...(search ? {
      OR: [
        { externalOrderId: { contains: search, mode: "insensitive" } },
        { customerName:    { contains: search, mode: "insensitive" } },
        { customerEmail:   { contains: search, mode: "insensitive" } },
        { awbNumber:       { contains: search, mode: "insensitive" } },
        { customerAddress: { path: ["phone"], string_contains: search } },
      ],
    } : {}),
  };
  const where: Prisma.OrderWhereInput = TAB_STATUSES[tab]
    ? { AND: [base, { status: { in: TAB_STATUSES[tab] } }] }
    : base;

  const [orders, total, grouped, productRows] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, externalOrderId: true, source: true, status: true, paymentMode: true,
        customerName: true, customerEmail: true, customerAddress: true,
        totalAmount: true, awbNumber: true, courier: true,
        supplierStatus: true, ndrStatus: true, ndrActionTaken: true,
        createdAt: true,
        items: { select: { id: true, name: true, sku: true, quantity: true, price: true } },
      },
    }),
    prisma.order.count({ where }),
    prisma.order.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    isExport ? Promise.resolve([]) : prisma.orderItem.findMany({
      where: { order: { sellerId } },
      distinct: ["name"],
      select: { name: true },
      orderBy: { name: "asc" },
      take: 300,
    }),
  ]);

  // Tab counts (same filters, every status)
  const byStatus = Object.fromEntries(grouped.map(g => [g.status, g._count._all])) as Record<string, number>;
  const counts: Record<string, number> = { ALL: grouped.reduce((s, g) => s + g._count._all, 0) };
  for (const [k, statuses] of Object.entries(TAB_STATUSES)) {
    counts[k] = statuses.reduce((s, st) => s + (byStatus[st] ?? 0), 0);
  }

  // Latest confirmation call for NEW orders on this page
  const newIds = orders.filter(o => o.status === "NEW").map(o => o.id);
  const confRows = newIds.length
    ? await prisma.orderTimeline.findMany({
        where: { orderId: { in: newIds }, eventType: { in: [CONF_EVENT.ATTEMPT, CONF_EVENT.FINAL] } },
        select: { orderId: true, eventType: true, metadata: true, createdAt: true },
      })
    : [];
  const conf = foldConfirmation(confRows);

  // Repeat-customer count (all-time) for customers on this page, by email
  const emails = [...new Set(orders.map(o => o.customerEmail?.toLowerCase()).filter(Boolean) as string[])];
  const repeat = new Map<string, number>();
  if (emails.length && !isExport) {
    const rows = await prisma.order.groupBy({
      by: ["customerEmail"],
      where: { sellerId, customerEmail: { in: orders.map(o => o.customerEmail).filter(Boolean) as string[] } },
      _count: { _all: true },
    });
    for (const r of rows) if (r.customerEmail) repeat.set(r.customerEmail.toLowerCase(), r._count._all);
  }

  return NextResponse.json({
    orders: orders.map(o => {
      let callNote: string | null = null;
      const c = conf.get(o.id);
      if (c) {
        const idx = c.attempts.map((a, i) => (a ? i : -1)).filter(i => i >= 0).pop();
        if (idx !== undefined) callNote = `Call ${idx + 1}: ${outcomeMeta(c.attempts[idx]!.outcome)?.label ?? ""}`;
      }
      return {
        ...o,
        createdAt: o.createdAt.toISOString(),
        callNote,
        customerOrderCount: o.customerEmail ? repeat.get(o.customerEmail.toLowerCase()) ?? 1 : 1,
      };
    }),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    counts,
    products: productRows.map(p => p.name),
  });
}
