import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status   = searchParams.get("status")   ?? "";
  const priority = searchParams.get("priority") ?? "";
  const category = searchParams.get("category") ?? "";
  const search   = searchParams.get("search")   ?? "";

  const where: Record<string, unknown> = {};
  if (status)   where.status   = status;
  if (priority) where.priority = priority;
  if (category) where.category = category;
  if (search) {
    where.OR = [
      { subject: { contains: search, mode: "insensitive" } },
      { seller: { name: { contains: search, mode: "insensitive" } } },
      { seller: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [tickets, stats] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: [{ status: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
      include: {
        seller:     { select: { id: true, name: true, email: true, brandName: true } },
        assignedTo: { select: { id: true, name: true } },
        messages:   { orderBy: { createdAt: "desc" }, where: { isInternal: false }, take: 1, select: { createdAt: true, isInternal: true, message: true, author: { select: { role: true } } } },
        _count:     { select: { messages: true } },
      },
    }),
    prisma.supportTicket.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
  ]);

  return NextResponse.json({ tickets, stats });
}
