import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getInvoiceSettings } from "@/lib/invoices";

// One invoice for printing. Sellers see only their own; admins see any.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getRouteSession(req);
  if (!session || !["SELLER", "ADMIN"].includes(session.user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({
    where: { id, status: { in: ["ISSUED", "CANCELLED"] }, ...(session.user.role === "SELLER" ? { sellerId: session.user.id } : {}) },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const [order, settings] = await Promise.all([
    prisma.order.findUnique({ where: { id: invoice.orderId }, select: { externalOrderId: true } }),
    getInvoiceSettings(),
  ]);
  return NextResponse.json({ invoices: [{ ...invoice, orderNumber: order?.externalOrderId ?? null }], settings });
}
