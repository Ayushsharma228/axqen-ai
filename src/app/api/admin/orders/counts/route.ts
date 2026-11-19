import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// READ-ONLY order counts per status for the All Orders tabs. Same filters as GET /api/admin/orders (minus status).
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const sellerId = sp.get("sellerId") ?? "", source = sp.get("source") ?? "", search = sp.get("search") ?? "";
  const dateFrom = sp.get("dateFrom") ?? "", dateTo = sp.get("dateTo") ?? "";

  const rows = await prisma.order.groupBy({
    by: ["status"],
    where: {
      status: { not: "HIDDEN" },
      ...(sellerId ? { sellerId } : {}),
      ...(source ? { source: source as never } : {}),
      ...(dateFrom || dateTo ? {
        createdAt: {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo ? { lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999)) } : {}),
        },
      } : {}),
      ...(search ? {
        OR: [
          { externalOrderId: { contains: search, mode: "insensitive" as const } },
          { customerName: { contains: search, mode: "insensitive" as const } },
          { awbNumber: { contains: search, mode: "insensitive" as const } },
          { items: { some: { name: { contains: search, mode: "insensitive" as const } } } },
        ],
      } : {}),
    },
    _count: { id: true },
  });
  const counts: Record<string, number> = Object.fromEntries(rows.map(r => [r.status, r._count.id]));
  counts.ALL = rows.reduce((n, r) => n + r._count.id, 0);
  return NextResponse.json({ counts });
}
