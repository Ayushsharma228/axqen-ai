import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const PAGE = 50;

// Read-only audit trail for admins. Filters: area, seller, actor email, text in path; paged by cursor.
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const area = sp.get("area"), q = sp.get("q")?.trim(), cursor = sp.get("cursor"), sellerId = sp.get("sellerId");
  const where: Prisma.AuditLogWhereInput = {
    ...(area ? { area } : {}),
    ...(sellerId ? { sellerId } : {}),
    ...(q ? { OR: [{ actorEmail: { contains: q, mode: "insensitive" } }, { path: { contains: q, mode: "insensitive" } }, { sellerId: q }] } : {}),
  };

  const [rows, areas] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: PAGE + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) }),
    prisma.auditLog.groupBy({ by: ["area"], _count: { _all: true }, orderBy: { area: "asc" } }),
  ]);

  // Show seller names next to ids.
  const ids = [...new Set(rows.map(r => r.sellerId).filter(Boolean))] as string[];
  const sellers = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, brandName: true, email: true } }) : [];
  const nameOf = new Map(sellers.map(s => [s.id, s.brandName || s.name || s.email]));

  const page = rows.slice(0, PAGE).map(r => ({ ...r, sellerName: r.sellerId ? nameOf.get(r.sellerId) ?? null : null }));
  return NextResponse.json({ rows: page, nextCursor: rows.length > PAGE ? rows[PAGE - 1].id : null, areas: areas.map(a => ({ area: a.area, count: a._count._all })) });
}
