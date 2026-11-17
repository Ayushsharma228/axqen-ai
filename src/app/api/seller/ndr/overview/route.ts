import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NDR_ORDER_SELECT, buildNdrCards, ndrStats, ndrTab } from "@/lib/ndr";

// Read-only NDR view for the signed-in seller. GET ?tab=…&days
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const tab = (sp.get("tab") ?? "ACTION_NEEDED").toUpperCase();
  const days = Number(sp.get("days") ?? "") || null;

  const all = await prisma.order.findMany({
    where: {
      sellerId: session.user.id,
      ndrStatus: { not: null },
      ...(days ? { ndrCreatedAt: { gte: new Date(Date.now() - days * 86400000) } } : {}),
    },
    select: NDR_ORDER_SELECT,
    orderBy: { ndrCreatedAt: "asc" },
    take: 1500,
  });
  const { counts, saveRate } = ndrStats(all);
  const rows = (tab === "ALL" ? all : all.filter(o => ndrTab(o) === tab)).slice(0, 200);
  const cards = await buildNdrCards(rows);

  return NextResponse.json({
    ndrs: cards.sort((a, b) => (b.openedAt ?? "").localeCompare(a.openedAt ?? "")),
    counts, saveRate,
  });
}
