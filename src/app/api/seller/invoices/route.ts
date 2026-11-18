import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Seller's AXP invoices. GET ?month=YYYY-MM (IST) &search=
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sellerId = session.user.id;
  const sp = req.nextUrl.searchParams;
  const month = sp.get("month");
  const search = sp.get("search")?.trim();

  let range: { gte: Date; lt: Date } | undefined;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    range = { gte: new Date(Date.UTC(y, m - 1, 1) - 5.5 * 3600000), lt: new Date(Date.UTC(y, m, 1) - 5.5 * 3600000) };
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      sellerId,
      status: { in: ["ISSUED", "CANCELLED"] },
      ...(range ? { issueDate: range } : {}),
      ...(search ? { number: { contains: search, mode: "insensitive" } } : {}),
    },
    orderBy: [{ issueDate: "desc" }, { seq: "desc" }],
    take: 500,
    select: { id: true, number: true, status: true, issueDate: true, orderId: true, taxableTotal: true, cgst: true, sgst: true, igst: true, total: true },
  });

  const orders = await prisma.order.findMany({
    where: { id: { in: invoices.map(i => i.orderId) }, sellerId },
    select: { id: true, externalOrderId: true, customerName: true },
  });
  const byId = new Map(orders.map(o => [o.id, o]));

  // Months that have invoices, for the month picker
  const months = await prisma.$queryRaw<{ m: string }[]>`
    SELECT DISTINCT to_char(("issueDate" + interval '330 minutes'), 'YYYY-MM') AS m
    FROM invoices WHERE "sellerId" = ${sellerId} AND status IN ('ISSUED','CANCELLED') AND "issueDate" IS NOT NULL
    ORDER BY m DESC`;

  const issued = invoices.filter(i => i.status === "ISSUED");
  return NextResponse.json({
    invoices: invoices.map(i => ({
      ...i,
      issueDate: i.issueDate?.toISOString() ?? null,
      orderNumber: byId.get(i.orderId)?.externalOrderId ?? null,
      customerName: byId.get(i.orderId)?.customerName ?? null,
    })),
    totals: {
      count: issued.length,
      taxable: issued.reduce((s, i) => s + i.taxableTotal, 0),
      tax: issued.reduce((s, i) => s + i.cgst + i.sgst + i.igst, 0),
      total: issued.reduce((s, i) => s + i.total, 0),
    },
    months: months.map(r => r.m),
  });
}
