import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  const dateWhere = (from || to) ? {
    createdAt: {
      ...(from ? { gte: new Date(from) }                       : {}),
      ...(to   ? { lte: new Date(to + "T23:59:59.999Z") }     : {}),
    },
  } : {};

  // ── Parallel queries ─────────────────────────────────────────────────────
  const [orders, settlements, sellerRows, supplierPaymentAgg, activeSellers, pendingWd, leadStages, waStatuses, activationStages, walletCreditAgg, orderChargeAgg] = await Promise.all([
    prisma.order.findMany({
      where: { ...dateWhere, status: { not: "HIDDEN" as never } },
      select: { status: true, totalAmount: true, createdAt: true, sellerId: true, packingCharge: true, productCost: true, shippingCharge: true, courier: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.settlement.findMany({
      where: dateWhere,
      select: {
        status: true, sellingPrice: true, platformFee: true, gstOnFees: true,
        netPayable: true, supplierPayable: true, platformEarnings: true,
        sellerId: true, createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    // Top sellers by GMV (from orders)
    prisma.order.groupBy({
      by:      ["sellerId"],
      where:   dateWhere,
      _count:  { id: true },
      _sum:    { totalAmount: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take:    10,
    }),
    prisma.supplierPayment.aggregate({
      where:  dateWhere,
      _sum:   { amount: true },
      _count: { id: true },
    }),
    prisma.user.count({ where: { role: "SELLER", accountStatus: "ACTIVE" } }),
    prisma.withdrawalRequest.aggregate({
      where: { status: "PENDING" },
      _count: { id: true },
      _sum:   { amount: true },
    }),
    prisma.lead.groupBy({ by: ["pipelineStage"], _count: { id: true } }),
    prisma.wAConversation.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.sellerActivation.groupBy({ by: ["currentStage"], _count: { id: true }, orderBy: { _count: { currentStage: "desc" } } }),
    // Net paid to sellers via wallet remittances (CREDIT = money sent to seller)
    prisma.walletTransaction.aggregate({
      where: { type: "CREDIT", ...dateWhere },
      _sum:   { amount: true },
      _count: { id: true },
    }),
    // Platform charges (packingCharge) + product cost aggregate from orders
    prisma.order.aggregate({
      where: { ...dateWhere, status: { not: "HIDDEN" as never } },
      _sum: { packingCharge: true, productCost: true, shippingCharge: true, totalAmount: true },
    }),
  ]);

  // ── Order trend (daily) ──────────────────────────────────────────────────
  const orderTrendMap = new Map<string, { total: number; delivered: number; rto: number; cancelled: number; revenue: number }>();
  let totalRevenue = 0;
  for (const o of orders) {
    const day = o.createdAt.toISOString().slice(0, 10);
    const cur = orderTrendMap.get(day) ?? { total: 0, delivered: 0, rto: 0, cancelled: 0, revenue: 0 };
    cur.total++;
    cur.revenue += o.totalAmount;
    totalRevenue += o.totalAmount;
    if (o.status === "DELIVERED")  cur.delivered++;
    if (o.status === "RTO")        cur.rto++;
    if (o.status === "CANCELLED")  cur.cancelled++;
    orderTrendMap.set(day, cur);
  }
  const orderTrend = Array.from(orderTrendMap.entries()).map(([date, v]) => ({ date, ...v }));

  // ── Settlement aggregates ─────────────────────────────────────────────────
  const settlementTrendMap = new Map<string, { count: number; grossRevenue: number; platformEarnings: number; netPayable: number }>();
  let sGross = 0, sFee = 0, sGst = 0, sNet = 0, sSupplier = 0, sPlatformEarnings = 0;
  const byStatus: Record<string, number> = {};

  for (const s of settlements) {
    sGross            += s.sellingPrice;
    sFee              += s.platformFee;
    sGst              += s.gstOnFees;
    sNet              += s.netPayable;
    sSupplier         += s.supplierPayable ?? 0;
    sPlatformEarnings += s.platformEarnings ?? 0;
    byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;

    const day = s.createdAt.toISOString().slice(0, 10);
    const cur = settlementTrendMap.get(day) ?? { count: 0, grossRevenue: 0, platformEarnings: 0, netPayable: 0 };
    cur.count++;
    cur.grossRevenue    += s.sellingPrice;
    cur.platformEarnings += (s.platformEarnings ?? 0);
    cur.netPayable      += s.netPayable;
    settlementTrendMap.set(day, cur);
  }
  const settlementTrend = Array.from(settlementTrendMap.entries()).map(([date, v]) => ({ date, ...v }));

  // ── Settlement funnel (all-time totals by status) ─────────────────────────
  const funnelAll = await prisma.settlement.groupBy({
    by: ["status"],
    _count: { id: true },
  });
  const funnel = Object.fromEntries(funnelAll.map(f => [f.status, f._count.id]));

  // ── Top sellers (enrich with names + real order/wallet earnings) ─────────
  const sellerIds = sellerRows.map(r => r.sellerId);
  const [sellerUsers, sellerOrderCharges, sellerWalletCredits] = await Promise.all([
    sellerIds.length > 0
      ? prisma.user.findMany({
          where:  { id: { in: sellerIds } },
          select: { id: true, name: true, email: true, brandName: true },
        })
      : Promise.resolve([]),
    sellerIds.length > 0
      ? prisma.order.groupBy({
          by:    ["sellerId"],
          where: { sellerId: { in: sellerIds }, ...dateWhere },
          _sum:  { packingCharge: true },
        })
      : Promise.resolve([]),
    sellerIds.length > 0
      ? prisma.walletTransaction.groupBy({
          by:    ["sellerId"],
          where: { sellerId: { in: sellerIds }, type: "CREDIT", ...dateWhere },
          _sum:  { amount: true },
        })
      : Promise.resolve([]),
  ]);

  const userMap        = Object.fromEntries(sellerUsers.map(u => [u.id, u]));
  const sellerChargeMap  = Object.fromEntries(sellerOrderCharges.map(s => [s.sellerId, s._sum]));
  const sellerWalletMap  = Object.fromEntries(sellerWalletCredits.map(s => [s.sellerId, s._sum]));

  const topSellers = sellerRows.map(row => ({
    id:               row.sellerId,
    name:             userMap[row.sellerId]?.name ?? null,
    email:            userMap[row.sellerId]?.email ?? "",
    brandName:        userMap[row.sellerId]?.brandName ?? null,
    orderCount:       row._count.id,
    gmv:              row._sum.totalAmount ?? 0,
    platformEarnings: sellerChargeMap[row.sellerId]?.packingCharge ?? 0,
    netPayable:       sellerWalletMap[row.sellerId]?.amount        ?? 0,
  }));

  // ── Order status counts ──────────────────────────────────────────────────
  const statusCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // ── Lead / CRM metrics ───────────────────────────────────────────────────
  const QUALIFIED_STAGES = new Set(["SALES_CALL_BOOKED", "DEMO_DONE", "PROPOSAL_SENT", "NEGOTIATION", "CLIENT"]);
  const leadByStage = Object.fromEntries(leadStages.map(l => [l.pipelineStage, l._count.id]));
  const totalLeads     = leadStages.reduce((a, l) => a + l._count.id, 0);
  const qualifiedLeads = leadStages.filter(l => QUALIFIED_STAGES.has(l.pipelineStage)).reduce((a, l) => a + l._count.id, 0);
  const waByStatus     = Object.fromEntries(waStatuses.map(w => [w.status, w._count.id]));
  const activationByStage = Object.fromEntries(activationStages.map(a => [a.currentStage, a._count.id]));

  // ── Remittance / order-based financials ──────────────────────────────────
  const totalPlatformCharges = orderChargeAgg._sum.packingCharge ?? 0;
  const totalProductCost     = orderChargeAgg._sum.productCost    ?? 0;
  const totalShipping        = orderChargeAgg._sum.shippingCharge ?? 0;
  const totalGMV             = orderChargeAgg._sum.totalAmount    ?? 0;
  const netPaidToSellers     = walletCreditAgg._sum.amount        ?? 0;
  const remittanceCount      = walletCreditAgg._count.id;

  // Revenue trend per day (from orders)
  const revenueTrendMap = new Map<string, { gmv: number; platformCharges: number; productCost: number }>();
  for (const o of orders) {
    const day = o.createdAt.toISOString().slice(0, 10);
    const cur = revenueTrendMap.get(day) ?? { gmv: 0, platformCharges: 0, productCost: 0 };
    cur.gmv            += o.totalAmount;
    cur.platformCharges += o.packingCharge ?? 0;
    cur.productCost    += o.productCost    ?? 0;
    revenueTrendMap.set(day, cur);
  }
  const revenueTrend = Array.from(revenueTrendMap.entries()).map(([date, v]) => ({ date, ...v }));

  // ── Courier performance ───────────────────────────────────────────────────
  // Only include orders with a named courier — blank/null orders skew the chart
  const courierMap = new Map<string, { total: number; delivered: number; rto: number }>();
  let courierUncategorized = 0;
  for (const o of orders) {
    const c = o.courier?.trim();
    if (!c) { courierUncategorized++; continue; }
    const cur = courierMap.get(c) ?? { total: 0, delivered: 0, rto: 0 };
    cur.total++;
    if (o.status === "DELIVERED") cur.delivered++;
    if (o.status === "RTO")       cur.rto++;
    courierMap.set(c, cur);
  }
  const courierStats = Array.from(courierMap.entries())
    .map(([courier, v]) => ({
      courier,
      total:        v.total,
      delivered:    v.delivered,
      rto:          v.rto,
      deliveryRate: v.total > 0 ? Math.round((v.delivered / v.total) * 100) : 0,
      rtoRate:      v.total > 0 ? Math.round((v.rto       / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({
    period: { from: from ?? null, to: to ?? null },
    orders: {
      trend:           orderTrend,
      totalOrders:     orders.length,
      deliveredOrders: statusCounts["DELIVERED"]  ?? 0,
      rtoOrders:       statusCounts["RTO"]        ?? 0,
      cancelledOrders: statusCounts["CANCELLED"]  ?? 0,
      activeOrders:    (statusCounts["PROCESSING"] ?? 0) + (statusCounts["SHIPPED"] ?? 0) + (statusCounts["IN_TRANSIT"] ?? 0),
      totalRevenue,
    },
    settlements: {
      count:            settlements.length,
      grossRevenue:     sGross,
      platformFee:      sFee,
      gstOnFees:        sGst,
      netPayable:       sNet,
      supplierPayable:  sSupplier,
      platformEarnings: sPlatformEarnings,
      trend:            settlementTrend,
      byStatus,
      funnel,
    },
    topSellers,
    supplierPayments: {
      totalPaid: supplierPaymentAgg._sum.amount ?? 0,
      count:     supplierPaymentAgg._count.id,
    },
    activeSellers,
    pendingWithdrawals: {
      count:  pendingWd._count.id ?? 0,
      amount: pendingWd._sum.amount ?? 0,
    },
    leads: { total: totalLeads, qualified: qualifiedLeads, byStage: leadByStage },
    whatsapp: waByStatus,
    activation: activationByStage,
    remittances: {
      netPaidToSellers,
      count: remittanceCount,
      platformCharges: totalPlatformCharges,
      productCost: totalProductCost,
      shipping: totalShipping,
      gmv: totalGMV,
      revenueTrend,
    },
    courierStats, courierUncategorized,
  });
}
