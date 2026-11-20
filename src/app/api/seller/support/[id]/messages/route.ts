import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { encodeMessage } from "@/lib/ticket-content";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { message, attachments } = await req.json();
  const body = encodeMessage(String(message ?? ""), Array.isArray(attachments) ? attachments : []);
  if (!body)
    return NextResponse.json({ error: "Write a message or attach a screenshot" }, { status: 400 });

  const ticket = await prisma.supportTicket.findFirst({
    where: { id, sellerId: session.user.id },
  });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ticket.status === "CLOSED")
    return NextResponse.json({ error: "Ticket is closed" }, { status: 400 });

  const [msg] = await prisma.$transaction([
    prisma.ticketMessage.create({
      data: { ticketId: id, authorId: session.user.id, message: body, isInternal: false },
      include: { author: { select: { id: true, name: true, role: true } } },
    }),
    prisma.supportTicket.update({
      where: { id },
      data: { status: "OPEN", updatedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ message: msg });
}
