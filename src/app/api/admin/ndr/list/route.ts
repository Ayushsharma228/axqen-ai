import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NDR_ORDER_SELECT, buildNdrCards, ndrSince, ndrStats, ndrTab } from "@/lib/ndr";

// GET ?tab=ACTION_NEEDED|REATTEMPT|DELIVERED|RTO|ALL &sellerId &search &days
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const tab = (sp.get("tab") ?? "ACTION_NEEDED").toUpperCase();
  const sellerId = sp.get("sellerId") || undefined;
  const search = sp.get("search")?.trim();
  const days = Number(sp.get("days") ?? "") || null;

  const where: Prisma.OrderWhereInput = {
    ndrStatus: { not: null },
    ...(sellerId ? { sellerId } : {}),
    ndrCreatedAt: { gte: ndrSince(days) },
    ...(search ? {
      OR: [
        { externalOrderId: { contains: search, mode: "insensitive" } },
        { awbNumber:       { contains: search, mode: "insensitive" } },
        { customerName:    { contains: search, mode: "insensitive" } },
        { customerAddress: { path: ["phone"], string_contains: search } },
      ],
    } : {}),
  };

  const all = await prisma.order.findMany({
    where,
    select: { ...NDR_ORDER_SELECT, seller: { select: { id: true, name: true, brandName: true } } },
    orderBy: { ndrCreatedAt: "asc" },
    take: 1500,
  });
  const { counts, saveRate } = ndrStats(all);
  const rows = (tab === "ALL" ? all : all.filter(o => ndrTab(o) === tab)).slice(0, 200);
  const cards = await buildNdrCards(rows);
  const sellerOf = new Map(rows.map(r => [r.id, r.seller]));

  return NextResponse.json({
    ndrs: cards
      .map(c => ({ ...c, seller: sellerOf.get(c.id) ?? null }))
      .sort((a, b) => tab === "ACTION_NEEDED"
        ? (b.hoursOpen ?? 0) - (a.hoursOpen ?? 0)
        : (b.openedAt ?? "").localeCompare(a.openedAt ?? "")),
    counts, saveRate,
  });
}
