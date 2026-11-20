import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { encodeRating } from "@/lib/ticket-content";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const ticket = await prisma.supportTicket.findFirst({
    where: { id, sellerId: session.user.id },
    include: {
      messages: {
        where: { isInternal: false },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, role: true } } },
      },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ticket });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { action, rating, comment } = await req.json();

  const ticket = await prisma.supportTicket.findFirst({
    where: { id, sellerId: session.user.id },
  });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "close") {
    await prisma.supportTicket.update({
      where: { id },
      data: { status: "CLOSED", closedAt: new Date() },
    });
  }

  if (action === "rate") {
    if (ticket.status !== "RESOLVED" && ticket.status !== "CLOSED") return NextResponse.json({ error: "You can rate once the ticket is resolved" }, { status: 400 });
    if (rating !== "up" && rating !== "down") return NextResponse.json({ error: "Pick 👍 or 👎" }, { status: 400 });
    const already = await prisma.ticketMessage.findFirst({ where: { ticketId: id, message: { startsWith: "[[rating]]" } }, select: { id: true } });
    if (already) return NextResponse.json({ error: "You've already rated this ticket" }, { status: 400 });
    const msg = await prisma.ticketMessage.create({
      data: { ticketId: id, authorId: session.user.id, message: encodeRating(rating, typeof comment === "string" ? comment : undefined), isInternal: false },
      include: { author: { select: { id: true, name: true, role: true } } },
    });
    return NextResponse.json({ ok: true, message: msg });
  }

  return NextResponse.json({ ok: true });
}
