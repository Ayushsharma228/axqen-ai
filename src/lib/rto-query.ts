// Shared RTO list query for the seller and admin RTO pages.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { RTO_ORDER_SELECT, buildRtoCards, rtoInsights, type RtoStage } from "@/lib/rto";

export async function rtoBoard(opts: {
  scope: Prisma.OrderWhereInput;     // seller scope or admin filters
  tab: string;                        // IN_TRANSIT | BACK_AT_WAREHOUSE | RECEIVED | DAMAGED_LOST | OVERDUE | ALL
  days: number | null;
  search?: string;
  withSeller?: boolean;
}) {
  const since = opts.days ? new Date(Date.now() - opts.days * 86400000) : null;
  const base: Prisma.OrderWhereInput = {
    AND: [opts.scope, since ? { createdAt: { gte: since } } : {}],
  };
  const searchWhere: Prisma.OrderWhereInput = opts.search ? {
    OR: [
      { externalOrderId: { contains: opts.search, mode: "insensitive" } },
      { awbNumber:       { contains: opts.search, mode: "insensitive" } },
      { customerName:    { contains: opts.search, mode: "insensitive" } },
    ],
  } : {};

  const [rtoOrders, completed] = await Promise.all([
    prisma.order.findMany({
      where: { AND: [base, searchWhere, { status: "RTO" }] },
      select: { ...RTO_ORDER_SELECT, ...(opts.withSeller ? { seller: { select: { id: true, name: true, brandName: true } } } : {}) },
      orderBy: { updatedAt: "desc" },
      take: 1500,
    }),
    prisma.order.findMany({
      where: { AND: [base, { status: { in: ["DELIVERED", "RTO"] } }] },
      select: { status: true, customerAddress: true, courier: true, ndrReason: true, items: { select: { name: true } } },
      take: 6000,
    }),
  ]);

  const cards = await buildRtoCards(rtoOrders);
  const sellerOf = new Map(
    (rtoOrders as (typeof rtoOrders[number] & { seller?: { id: string; name: string | null; brandName: string | null } })[])
      .map(o => [o.id, o.seller ?? null]),
  );

  const counts: Record<string, number> = { ALL: cards.length, IN_TRANSIT: 0, BACK_AT_WAREHOUSE: 0, RECEIVED: 0, DAMAGED_LOST: 0, OVERDUE: 0 };
  for (const c of cards) {
    if (c.stage === "DAMAGED" || c.stage === "MISSING") counts.DAMAGED_LOST++;
    else counts[c.stage]++;
    if (c.overdue) counts.OVERDUE++;
  }
  const inTab = (s: RtoStage, overdue: boolean) =>
    opts.tab === "ALL" ? true
    : opts.tab === "DAMAGED_LOST" ? s === "DAMAGED" || s === "MISSING"
    : opts.tab === "OVERDUE" ? overdue
    : s === opts.tab;

  const delivered = completed.filter(o => o.status === "DELIVERED").length;
  const rto = completed.filter(o => o.status === "RTO").length;

  return {
    rtos: cards
      .filter(c => inTab(c.stage, c.overdue))
      .slice(0, 200)
      .map(c => ({ ...c, seller: opts.withSeller ? sellerOf.get(c.id) ?? null : undefined })),
    counts,
    rtoRate: delivered + rto ? Math.round((rto / (delivered + rto)) * 100) : null,
    rtoCharges: cards.reduce((s, c) => s + (c.rtoCharge ?? 0), 0),
    insights: rtoInsights(completed),
  };
}
