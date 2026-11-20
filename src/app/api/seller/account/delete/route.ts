import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Account deletion requests (required by the App Store and Play Store).
// The request is recorded and handed to the team as a support ticket; nothing is wiped here,
// so pending payouts can be settled first and tax records kept as the law requires.
const keyFor = (sellerId: string) => `ACCOUNT_DELETION:${sellerId}`;

type DeletionRequest = { requestedAt: string; ticketId: string; ticketNumber: number; reason: string };

async function current(sellerId: string): Promise<DeletionRequest | null> {
  const row = await prisma.platformConfig.findUnique({ where: { key: keyFor(sellerId) }, select: { value: true } });
  if (!row) return null;
  try { return JSON.parse(row.value) as DeletionRequest; } catch { return null; }
}

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ request: await current(session.user.id) });
}

export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sellerId = session.user.id;

  const { password, confirm, reason } = await req.json().catch(() => ({}));
  if (String(confirm ?? "").trim().toUpperCase() !== "DELETE") return NextResponse.json({ error: "Type DELETE to confirm" }, { status: 400 });
  if (!password) return NextResponse.json({ error: "Enter your password" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: sellerId }, select: { password: true, email: true, name: true, brandName: true } });
  if (!user || !(await bcrypt.compare(String(password), user.password))) return NextResponse.json({ error: "That password isn't right" }, { status: 400 });

  const existing = await current(sellerId);
  if (existing) return NextResponse.json({ request: existing });

  const why = String(reason ?? "").trim().slice(0, 1000);
  const ticket = await prisma.supportTicket.create({
    data: {
      sellerId, subject: "Account deletion request", category: "ACCOUNT", priority: "HIGH",
      messages: { create: { authorId: sellerId, isInternal: false, message: `Please delete my AXQEN account (${user.email}).${why ? `\n\nReason: ${why}` : ""}` } },
    },
    select: { id: true, ticketNumber: true },
  });

  const request: DeletionRequest = { requestedAt: new Date().toISOString(), ticketId: ticket.id, ticketNumber: ticket.ticketNumber, reason: why };
  await prisma.platformConfig.create({ data: { key: keyFor(sellerId), value: JSON.stringify(request), label: "Account deletion request" } });

  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await Promise.all(admins.map(a => prisma.notification.create({
    data: {
      userId: a.id, type: "ORDER_UPDATE",
      title: `Account deletion request · ticket #${ticket.ticketNumber}`,
      message: `${user.brandName || user.name || user.email} asked to delete their account.`,
      data: { ticketId: ticket.id, kind: "SUPPORT_TICKET" },
    },
  }).catch(() => null)));

  return NextResponse.json({ request });
}

/** Seller changes their mind before the team has closed the account. */
export async function DELETE(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sellerId = session.user.id;
  const existing = await current(sellerId);
  if (!existing) return NextResponse.json({ request: null });

  await prisma.platformConfig.delete({ where: { key: keyFor(sellerId) } });
  await prisma.ticketMessage.create({ data: { ticketId: existing.ticketId, authorId: sellerId, isInternal: false, message: "I've cancelled my account deletion request. Please keep my account." } }).catch(() => null);
  return NextResponse.json({ request: null });
}
