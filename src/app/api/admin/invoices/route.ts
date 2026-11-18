import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { issueInvoiceForOrder, runInvoiceIssuing } from "@/lib/invoices";

export const maxDuration = 60;

async function admin(req: NextRequest) {
  const s = await getRouteSession(req);
  return s?.user.role === "ADMIN" ? s : null;
}

// GET ?status=ISSUED|HELD|CANCELLED &sellerId &search &month=YYYY-MM
export async function GET(req: NextRequest) {
  if (!(await admin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const status = (sp.get("status") ?? "ISSUED").toUpperCase();
  const sellerId = sp.get("sellerId") || undefined;
  const search = sp.get("search")?.trim();
  const month = sp.get("month");
  let range: { gte: Date; lt: Date } | undefined;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    range = { gte: new Date(Date.UTC(y, m - 1, 1) - 5.5 * 3600000), lt: new Date(Date.UTC(y, m, 1) - 5.5 * 3600000) };
  }

  const where = {
    status,
    ...(sellerId ? { sellerId } : {}),
    ...(range && status !== "HELD" ? { issueDate: range } : {}),
    ...(search ? { OR: [{ number: { contains: search, mode: "insensitive" as const } }, { orderId: search }] } : {}),
  };
  const [invoices, counts] = await Promise.all([
    prisma.invoice.findMany({ where, orderBy: status === "HELD" ? { updatedAt: "desc" } : [{ issueDate: "desc" }, { seq: "desc" }], take: 300 }),
    prisma.invoice.groupBy({ by: ["status"], _count: { _all: true }, ...(sellerId ? { where: { sellerId } } : {}) }),
  ]);
  const [orders, sellers] = await Promise.all([
    prisma.order.findMany({ where: { id: { in: invoices.map(i => i.orderId) } }, select: { id: true, externalOrderId: true } }),
    prisma.user.findMany({ where: { id: { in: [...new Set(invoices.map(i => i.sellerId))] } }, select: { id: true, brandName: true, name: true, email: true } }),
  ]);
  const num = new Map(orders.map(o => [o.id, o.externalOrderId]));
  const who = new Map(sellers.map(s => [s.id, s.brandName || s.name || s.email]));

  return NextResponse.json({
    invoices: invoices.map(i => ({
      id: i.id, number: i.number, status: i.status, heldReason: i.heldReason, cancelReason: i.cancelReason,
      issueDate: i.issueDate?.toISOString() ?? null, updatedAt: i.updatedAt.toISOString(),
      orderId: i.orderId, orderNumber: num.get(i.orderId) ?? null, sellerId: i.sellerId, seller: who.get(i.sellerId) ?? "—",
      taxableTotal: i.taxableTotal, tax: i.cgst + i.sgst + i.igst, total: i.total, placeOfSupply: i.placeOfSupply,
    })),
    counts: Object.fromEntries(counts.map(c => [c.status, c._count._all])),
  });
}

// POST { action: "run" } | { action: "retry", invoiceId } | { action: "retryAll" } | { action: "cancel", invoiceId, reason }
export async function POST(req: NextRequest) {
  if (!(await admin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { action?: string; invoiceId?: string; reason?: string };

  if (body.action === "run") return NextResponse.json(await runInvoiceIssuing(200));

  if (body.action === "retryAll") {
    const held = await prisma.invoice.findMany({ where: { status: "HELD" }, select: { orderId: true }, take: 300 });
    let issued = 0, stillHeld = 0;
    for (const h of held) {
      const r = await issueInvoiceForOrder(h.orderId).catch(() => null);
      if (r?.status === "ISSUED") issued++; else stillHeld++;
    }
    return NextResponse.json({ issued, held: stillHeld });
  }

  const inv = body.invoiceId ? await prisma.invoice.findUnique({ where: { id: body.invoiceId } }) : null;
  if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  if (body.action === "retry") {
    if (inv.status !== "HELD") return NextResponse.json({ error: "Only held invoices can be retried" }, { status: 400 });
    return NextResponse.json(await issueInvoiceForOrder(inv.orderId));
  }

  if (body.action === "cancel") {
    if (inv.status !== "ISSUED") return NextResponse.json({ error: "Only issued invoices can be cancelled" }, { status: 400 });
    const reason = (body.reason ?? "").trim();
    if (!reason) return NextResponse.json({ error: "Give a reason for cancelling" }, { status: 400 });
    // GST: a cancelled invoice keeps its number and stays on record; it is never deleted or reused.
    await prisma.invoice.update({ where: { id: inv.id }, data: { status: "CANCELLED", cancelReason: reason.slice(0, 300) } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
