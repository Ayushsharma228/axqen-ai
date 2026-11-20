import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Grouped server errors. GET lists them (open first); PATCH marks one fixed or reopens it.
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const show = req.nextUrl.searchParams.get("show") ?? "open";
  const rows = await prisma.errorEvent.findMany({
    where: show === "all" ? {} : show === "fixed" ? { resolvedAt: { not: null } } : { resolvedAt: null },
    orderBy: { lastSeenAt: "desc" },
    take: 200,
  });
  const open = await prisma.errorEvent.count({ where: { resolvedAt: null } });
  return NextResponse.json({ rows, open });
}

export async function PATCH(req: NextRequest) {
  const session = await getRouteSession(req);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, resolved } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const row = await prisma.errorEvent.update({ where: { id: String(id) }, data: { resolvedAt: resolved ? new Date() : null } }).catch(() => null);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ row });
}
