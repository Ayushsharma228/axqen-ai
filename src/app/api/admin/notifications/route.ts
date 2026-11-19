import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// GET               → { notifications (sent to sellers by admin, latest 100), unreadCount }  (original contract + unreadCount)
// GET ?view=inbox   → notifications addressed to the admin team (shared inbox) + unreadCount
// GET ?view=sent    → admin broadcasts grouped into one row per send, with recipient and read counts
async function adminIds() {
  return (await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })).map(u => u.id);
}

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const view = req.nextUrl.searchParams.get("view");
  const admins = await adminIds();
  const unreadCount = await prisma.notification.count({ where: { userId: { in: admins }, isRead: false } });

  if (view === "inbox") {
    const inbox = await prisma.notification.findMany({
      where: { userId: { in: admins } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, type: true, title: true, message: true, isRead: true, data: true, createdAt: true },
    });
    // The same event is sent to one admin, but de-duplicate in case several admins received it
    const seen = new Set<string>();
    const items = inbox.filter(n => {
      const k = `${n.title}|${n.message}|${Math.floor(n.createdAt.getTime() / 60000)}`;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    return NextResponse.json({ inbox: items, unreadCount });
  }

  if (view === "sent") {
    const rows = await prisma.notification.findMany({
      where: { type: "GENERAL", data: { path: ["adminSent"], equals: true } },
      orderBy: { createdAt: "desc" },
      take: 5000,
      select: { title: true, message: true, isRead: true, data: true, createdAt: true, user: { select: { id: true, name: true, email: true, brandName: true } } },
    });
    const groups = new Map<string, { title: string; message: string; category: string; createdAt: Date; recipients: number; read: number; seller: string | null }>();
    for (const r of rows) {
      const k = `${r.title}|${r.message}|${Math.floor(r.createdAt.getTime() / 120000)}`;
      const g = groups.get(k) ?? { title: r.title, message: r.message, category: String((r.data as Record<string, unknown> | null)?.category ?? "General"), createdAt: r.createdAt, recipients: 0, read: 0, seller: null };
      g.recipients++; if (r.isRead) g.read++;
      g.seller = g.recipients === 1 ? (r.user.brandName || r.user.name || r.user.email) : null;
      groups.set(k, g);
    }
    return NextResponse.json({ sent: [...groups.values()].slice(0, 100).map(g => ({ ...g, createdAt: g.createdAt.toISOString() })), unreadCount });
  }

  const notifications = await prisma.notification.findMany({
    where: { type: "GENERAL", data: { path: ["adminSent"], equals: true } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { id: true, name: true, email: true, brandName: true } } },
  });

  return NextResponse.json({ notifications, unreadCount });
}

export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { target, sellerId, category, title, message } = await req.json();
  if (!title?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Title and message are required" }, { status: 400 });
  }

  const data = { adminSent: true, category: category || "General" };

  if (target === "all") {
    const sellers = await prisma.user.findMany({
      where: { role: "SELLER" },
      select: { id: true },
    });
    await prisma.notification.createMany({
      data: sellers.map(s => ({
        userId: s.id,
        type: "GENERAL" as const,
        title: title.trim(),
        message: message.trim(),
        data,
      })),
    });
    return NextResponse.json({ sent: sellers.length });
  }

  if (!sellerId) {
    return NextResponse.json({ error: "sellerId required when target is not 'all'" }, { status: 400 });
  }

  await prisma.notification.create({
    data: { userId: sellerId, type: "GENERAL", title: title.trim(), message: message.trim(), data },
  });

  return NextResponse.json({ sent: 1 });
}

// PATCH { ids: string[] } or { all: true } → mark admin-team notifications read
export async function PATCH(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const b = await req.json().catch(() => ({})) as { ids?: string[]; all?: boolean };
  const admins = await adminIds();
  if (b.all) {
    await prisma.notification.updateMany({ where: { userId: { in: admins }, isRead: false }, data: { isRead: true } });
  } else if (Array.isArray(b.ids) && b.ids.length) {
    // Mark the matching copies for every admin so the shared inbox stays in sync
    const picked = await prisma.notification.findMany({ where: { id: { in: b.ids.slice(0, 200) }, userId: { in: admins } }, select: { title: true, message: true } });
    await prisma.notification.updateMany({
      where: { userId: { in: admins }, isRead: false, OR: picked.map(p => ({ title: p.title, message: p.message })) },
      data: { isRead: true },
    });
  } else {
    return NextResponse.json({ error: "ids or all required" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
