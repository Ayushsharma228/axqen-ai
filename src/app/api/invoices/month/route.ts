import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getInvoiceSettings } from "@/lib/invoices";

// All invoices of one month for printing in one go. GET ?month=YYYY-MM (&sellerId= for admins)
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || !["SELLER", "ADMIN"].includes(session.user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const month = sp.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "month=YYYY-MM required" }, { status: 400 });
  const sellerId = session.user.role === "SELLER" ? session.user.id : sp.get("sellerId") || undefined;
  if (!sellerId) return NextResponse.json({ error: "sellerId required" }, { status: 400 });

  const [y, m] = month.split("-").map(Number);
  const range = { gte: new Date(Date.UTC(y, m - 1, 1) - 5.5 * 3600000), lt: new Date(Date.UTC(y, m, 1) - 5.5 * 3600000) };

  const invoices = await prisma.invoice.findMany({
    where: { sellerId, status: { in: ["ISSUED", "CANCELLED"] }, issueDate: range },
    orderBy: [{ issueDate: "asc" }, { seq: "asc" }],
    take: 1000,
  });
  const [orders, settings] = await Promise.all([
    prisma.order.findMany({ where: { id: { in: invoices.map(i => i.orderId) } }, select: { id: true, externalOrderId: true } }),
    getInvoiceSettings(),
  ]);
  const num = new Map(orders.map(o => [o.id, o.externalOrderId]));
  return NextResponse.json({ invoices: invoices.map(i => ({ ...i, orderNumber: num.get(i.orderId) ?? null })), settings });
}
