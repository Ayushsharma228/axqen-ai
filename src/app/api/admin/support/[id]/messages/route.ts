import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { encodeMessage, parseMessage } from "@/lib/ticket-content";
import { emailTicketReply } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { message, isInternal, attachments } = await req.json();
  const body = encodeMessage(String(message ?? ""), Array.isArray(attachments) ? attachments : []);
  if (!body)
    return NextResponse.json({ error: "Write a message or attach a screenshot" }, { status: 400 });

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: { id: true, sellerId: true, subject: true, ticketNumber: true, status: true, seller: { select: { email: true, name: true, brandName: true } } },
  });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const internal = Boolean(isInternal);

  const [msg] = await prisma.$transaction([
    prisma.ticketMessage.create({
      data: { ticketId: id, authorId: session.user.id, message: body, isInternal: internal },
      include: { author: { select: { id: true, name: true, role: true } } },
    }),
    prisma.supportTicket.update({
      where: { id },
      data: {
        status: ticket.status === "OPEN" || ticket.status === "WAITING_ON_SELLER"
          ? "IN_PROGRESS" : ticket.status,
        updatedAt: new Date(),
      },
    }),
  ]);

  // Notify seller (public replies only)
  if (!internal) {
    // Email the seller too, so they don't miss the reply
    if (ticket.seller?.email) {
      const p = parseMessage(body);
      emailTicketReply({
        to: ticket.seller.email, name: ticket.seller.name || ticket.seller.brandName || "there",
        ticketNumber: ticket.ticketNumber, subject: ticket.subject, ticketId: id,
        reply: p.text || "We've attached screenshots to your ticket.", screenshots: p.images.length,
      }).catch(() => {});
    }
    await prisma.notification.create({
      data: {
        userId: ticket.sellerId,
        type:   "GENERAL",
        title:  `Reply on Ticket #${ticket.ticketNumber}`,
        message: `Support replied to your ticket "${ticket.subject}". Tap to view.`,
        data: { category: "General", ticketId: id },
      },
    });
  }

  return NextResponse.json({ message: msg });
}
