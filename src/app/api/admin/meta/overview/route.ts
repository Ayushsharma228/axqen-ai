import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// READ-ONLY Meta ads overview per seller: recharges, spend, ad wallet balance, and what the spend returned.
// GET ?days=7|30|90 (omit for all time). Balance is always all-time (recharges − spend).
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const days = Number(req.nextUrl.searchParams.get("days") ?? "") || null;
  const since = days ? new Date(Date.now() - days * 86400000) : null;

  const [sellers, spendAll, spendRange, rechAll, rechRange, lastSpend, delivered, mappings] = await Promise.all([
    prisma.user.findMany({
      where: { role: "SELLER" },
      select: { id: true, name: true, email: true, brandName: true, metaAdAccountId: true, metaTokenExpiresAt: true, metaAccessToken: true },
    }),
    prisma.adSpend.groupBy({ by: ["sellerId"], _sum: { amount: true } }),
    prisma.adSpend.groupBy({ by: ["sellerId"], where: since ? { date: { gte: since } } : {}, _sum: { amount: true, clicks: true, impressions: true } }),
    prisma.metaRecharge.groupBy({ by: ["sellerId"], _sum: { amount: true } }),
    prisma.metaRecharge.groupBy({ by: ["sellerId"], where: since ? { date: { gte: since } } : {}, _sum: { amount: true } }),
    prisma.adSpend.groupBy({ by: ["sellerId"], _max: { date: true } }),
    prisma.order.groupBy({ by: ["sellerId"], where: { status: "DELIVERED", ...(since ? { createdAt: { gte: since } } : {}) }, _count: { id: true }, _sum: { totalAmount: true } }),
    prisma.platformConfig.findUnique({ where: { key: "META_CAMPAIGN_MAPPINGS" } }).catch(() => null),
  ]);
  const m = <T extends { sellerId: string }>(rows: T[]) => new Map(rows.map(r => [r.sellerId, r]));
  const sA = m(spendAll), sR = m(spendRange), rA = m(rechAll), rR = m(rechRange), last = m(lastSpend), del = m(delivered);
  let mappedSellers = new Set<string>();
  try { mappedSellers = new Set(Object.values(JSON.parse(mappings?.value ?? "{}") as Record<string, string>)); } catch { /* none */ }
  const now = Date.now();

  const rows = sellers.map(s => {
    const spent = sR.get(s.id)?._sum.amount ?? 0;
    const delCount = del.get(s.id)?._count.id ?? 0, delValue = del.get(s.id)?._sum.totalAmount ?? 0;
    const expires = s.metaTokenExpiresAt?.getTime() ?? null;
    const connection = s.metaAccessToken && s.metaAdAccountId
      ? (expires && expires < now ? "EXPIRED" : expires && expires - now < 7 * 86400000 ? "EXPIRING" : "CONNECTED")
      : mappedSellers.has(s.id) ? "AXQEN_CAMPAIGNS" : "NONE";
    return {
      id: s.id, name: s.brandName || s.name || s.email, email: s.email,
      connection, adAccountId: s.metaAdAccountId, tokenExpiresAt: s.metaTokenExpiresAt?.toISOString() ?? null,
      recharged: Math.round(rR.get(s.id)?._sum.amount ?? 0),
      spent: Math.round(spent),
      clicks: sR.get(s.id)?._sum.clicks ?? 0, impressions: sR.get(s.id)?._sum.impressions ?? 0,
      balance: Math.round((rA.get(s.id)?._sum.amount ?? 0) - (sA.get(s.id)?._sum.amount ?? 0)),
      lastSpend: last.get(s.id)?._max.date?.toISOString() ?? null,
      delivered: delCount, deliveredValue: Math.round(delValue),
      costPerDelivered: delCount && spent ? Math.round(spent / delCount) : null,
      roas: spent ? Math.round((delValue / spent) * 100) / 100 : null,
    };
  }).filter(r => r.spent || r.recharged || r.balance || r.connection !== "NONE");

  const sum = (k: "recharged" | "spent" | "delivered" | "deliveredValue") => rows.reduce((n, r) => n + r[k], 0);
  const spent = sum("spent");
  return NextResponse.json({
    sellers: rows.sort((a, b) => b.spent - a.spent),
    totals: {
      spent, recharged: sum("recharged"),
      balance: rows.reduce((n, r) => n + r.balance, 0),
      lowBalance: rows.filter(r => r.balance < 0).length,
      roas: spent ? Math.round((sum("deliveredValue") / spent) * 100) / 100 : null,
      costPerDelivered: spent && sum("delivered") ? Math.round(spent / sum("delivered")) : null,
      tokenIssues: rows.filter(r => r.connection === "EXPIRED" || r.connection === "EXPIRING").length,
    },
  });
}
