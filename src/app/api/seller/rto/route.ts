import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { rtoBoard } from "@/lib/rto-query";

// Read-only RTO view for the signed-in seller. GET ?tab&days&search
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const seller = await prisma.user.findUnique({ where: { id: session.user.id }, select: { dataStartDate: true } });

  const data = await rtoBoard({
    scope: {
      sellerId: session.user.id,
      ...(seller?.dataStartDate ? { createdAt: { gte: seller.dataStartDate } } : {}),
    },
    tab: (sp.get("tab") ?? "IN_TRANSIT").toUpperCase(),
    days: Number(sp.get("days") ?? "") || null,
    search: sp.get("search")?.trim() || undefined,
  });
  return NextResponse.json(data);
}
