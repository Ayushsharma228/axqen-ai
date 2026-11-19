import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// AXQEN team accounts: Admin, Sales and the team's own Supplier account(s). Sellers are managed in Admin → Sellers.
// No deletes: removing access replaces the password with a random one and marks the account SUSPENDED.
const TEAM_ROLES = ["ADMIN", "SALES", "SUPPLIER"] as const;
type TeamRole = (typeof TEAM_ROLES)[number];
const isTeamRole = (r: unknown): r is TeamRole => TEAM_ROLES.includes(r as TeamRole);

async function admin(req: NextRequest) {
  const s = await getRouteSession(req);
  return s?.user.role === "ADMIN" ? s : null;
}
function checkPassword(p: unknown): string | null {
  const s = typeof p === "string" ? p : "";
  if (s.length < 8) return "Password should be at least 8 characters";
  if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) return "Use letters and at least one number";
  return null;
}

export async function GET(req: NextRequest) {
  const session = await admin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [users, products, tickets] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: [...TEAM_ROLES] } },
      select: { id: true, name: true, email: true, phone: true, role: true, accountStatus: true, createdAt: true, updatedAt: true },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    prisma.product.groupBy({ by: ["supplierId"], _count: { id: true } }),
    prisma.supportTicket.groupBy({ by: ["assignedToId"], where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_SELLER"] } }, _count: { id: true } }),
  ]);
  const p = new Map(products.map(x => [x.supplierId, x._count.id]));
  const t = new Map(tickets.map(x => [x.assignedToId, x._count.id]));
  return NextResponse.json({
    me: session.user.id,
    team: users.map(u => ({ ...u, createdAt: u.createdAt.toISOString(), updatedAt: u.updatedAt.toISOString(), products: p.get(u.id) ?? 0, openTickets: t.get(u.id) ?? 0 })),
  });
}

// POST { name, email, phone?, role, password } → add a team account
export async function POST(req: NextRequest) {
  if (!(await admin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const name = String(b.name ?? "").trim(), email = String(b.email ?? "").trim().toLowerCase(), phone = String(b.phone ?? "").replace(/\D/g, "").slice(-10) || null;
  if (!name) return NextResponse.json({ error: "Add their name" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  if (!isTeamRole(b.role)) return NextResponse.json({ error: "Pick Admin, Sales or Supplier account" }, { status: 400 });
  const bad = checkPassword(b.password);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  const user = await prisma.user.create({
    data: { name, email, phone, role: b.role, password: await bcrypt.hash(String(b.password), 12), accountStatus: "ACTIVE", onboardingDone: true },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: user.id }, { status: 201 });
}

// PATCH { id, action: "resetPassword" | "restoreAccess", password } | { id, action: "removeAccess" } | { id, action: "setRole", role }
export async function PATCH(req: NextRequest) {
  const session = await admin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const id = String(b.id ?? "");
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, accountStatus: true } });
  if (!user || !isTeamRole(user.role)) return NextResponse.json({ error: "Team member not found" }, { status: 404 });
  const self = id === session.user.id;
  const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", accountStatus: { not: "SUSPENDED" } } });

  switch (b.action) {
    case "resetPassword":
    case "restoreAccess": {
      const bad = checkPassword(b.password);
      if (bad) return NextResponse.json({ error: bad }, { status: 400 });
      await prisma.user.update({ where: { id }, data: { password: await bcrypt.hash(String(b.password), 12), accountStatus: "ACTIVE" } });
      return NextResponse.json({ ok: true });
    }
    case "removeAccess": {
      if (self) return NextResponse.json({ error: "You can't remove your own access" }, { status: 400 });
      if (user.role === "ADMIN" && activeAdmins <= 1) return NextResponse.json({ error: "This is the only admin left" }, { status: 400 });
      const random = crypto.randomBytes(32).toString("hex");
      await prisma.user.update({ where: { id }, data: { password: await bcrypt.hash(random, 12), accountStatus: "SUSPENDED" } });
      return NextResponse.json({ ok: true });
    }
    case "setRole": {
      if (self) return NextResponse.json({ error: "You can't change your own role" }, { status: 400 });
      if (!isTeamRole(b.role)) return NextResponse.json({ error: "Pick Admin, Sales or Supplier account" }, { status: 400 });
      if (user.role === "ADMIN" && b.role !== "ADMIN" && activeAdmins <= 1) return NextResponse.json({ error: "This is the only admin left" }, { status: 400 });
      await prisma.user.update({ where: { id }, data: { role: b.role } });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
