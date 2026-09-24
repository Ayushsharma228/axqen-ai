import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

async function getPlatformFeePerOrder(): Promise<number> {
  try {
    const cfg = await prisma.platformConfig.findUnique({ where: { key: "PLATFORM_FEE" } });
    if (cfg) return parseFloat(cfg.value) || 20;
  } catch { /* ignore */ }
  return 20;
}

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sellerId = session.user.id;
  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const seller = await prisma.user.findUnique({
    where: { id: sellerId },
    select: { dataStartDate: true },
  });
  const dataStart = seller?.dataStartDate ?? null;

  const fromDate = from ? new Date(from) : null;
  const gteDate = dataStart && fromDate
    ? (dataStart > fromDate ? dataStart : fromDate)
    : (dataStart ?? fromDate ?? null);
  const lteDate = to ? new Date(to + "T23:59:59.999Z") : null;
  const dateWhere = (gteDate || lteDate) ? {
    createdAt: {
      ...(gteDate ? { gte: gteDate } : {}),
      ...(lteDate ? { lte: lteDate } : {}),
    },
  } : {};

  const [orders, walletTxns, adSpendRows, store, platformFeePerOrder] = await Promise.all([
    prisma.order.findMany({
      where: { sellerId, ...dateWhere, status: { not: "HIDDEN" as import("@prisma/client").OrderStatus } },
      select: {
        id: true,
        externalOrderId: true,
        status: true,
        supplierStatus: true,
        supplierId: true,
        courier: true,
        totalAmount: true,
        packingCharge: true,
        productCost: true,
        shippingCharge: true,
        rtoCharge: true,
        createdAt: true,
        updatedAt: true,
        customerAddress: true,
        ndrStatus: true,
        ndrActionTaken: true,
        paymentMode: true,
        confirmationStatus: true,
        items: { select: { name: true, sku: true, quantity: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.walletTransaction.findMany({
      where: { sellerId },
      select: { type: true, amount: true, bankTxId: true, createdAt: true },
    }),
    prisma.adSpend.findMany({
      where: { sellerId, ...(gteDate || lteDate ? { date: { ...(gteDate ? { gte: gteDate } : {}), ...(lteDate ? { lte: lteDate } : {}) } } : {}) },
      select: { amount: true, date: true },
    }),
    prisma.shopifyStore.findFirst({
      where: { sellerId },
      select: { storeUrl: true, storeName: true, lastSyncAt: true, lastSyncError: true },
    }),
    getPlatformFeePerOrder(),
  ]);

  const total = orders.length;

  const delivered  = orders.filter((o) => o.status === "DELIVERED");
  const rto        = orders.filter((o) => o.status === "RTO");
  const cancelled  = orders.filter((o) => o.status === "CANCELLED");
  const inTransit  = orders.filter((o) => o.status === "IN_TRANSIT" || o.status === "SHIPPED");

  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  const trendMap = new Map<string, { delivered: number; rto: number; cancelled: number; total: number }>();
  for (const o of orders) {
    const day = o.createdAt.toISOString().slice(0, 10);
    const cur = trendMap.get(day) ?? { delivered: 0, rto: 0, cancelled: 0, total: 0 };
    cur.total++;
    if (o.status === "DELIVERED") cur.delivered++;
    if (o.status === "RTO") cur.rto++;
    if (o.status === "CANCELLED") cur.cancelled++;
    trendMap.set(day, cur);
  }
  const trend = Array.from(trendMap.entries()).map(([date, v]) => ({ date, ...v }));

  const productMap = new Map<string, { orders: number; units: number; delivered: number; rto: number }>();
  const skuMap = new Map<string, string>();
  for (const o of orders) {
    for (const item of o.items) {
      const cur = productMap.get(item.name) ?? { orders: 0, units: 0, delivered: 0, rto: 0 };
      cur.orders++;
      cur.units += item.quantity;
      if (o.status === "DELIVERED") cur.delivered++;
      if (o.status === "RTO") cur.rto++;
      productMap.set(item.name, cur);
      if (!skuMap.has(item.name) && item.sku) skuMap.set(item.name, item.sku);
    }
  }

  const topProducts = Array.from(productMap.entries())
    .sort((a, b) => b[1].orders - a[1].orders)
    .slice(0, 10)
    .map(([name, v]) => ({
      name,
      sku: skuMap.get(name) ?? "—",
      orders: v.orders,
      units: v.units,
      delPct: v.orders > 0 ? Math.round((v.delivered / v.orders) * 100) : 0,
      rtoPct: v.orders > 0 ? Math.round((v.rto / v.orders) * 100) : 0,
    }));

  const productDistribution = topProducts.slice(0, 5).map((p) => ({
    name: p.name,
    value: p.orders,
  }));

  type AddrJson = { state?: string; province?: string; city?: string; zip?: string } | null;
  const stateMap = new Map<string, { total: number; rto: number; delivered: number }>();
  for (const o of orders) {
    if (o.status === "CANCELLED") continue;
    const addr = o.customerAddress as AddrJson;
    const state = addr?.state || addr?.province || null;
    if (!state) continue;
    const key = state.trim();
    const cur = stateMap.get(key) ?? { total: 0, rto: 0, delivered: 0 };
    cur.total++;
    if (o.status === "RTO") cur.rto++;
    if (o.status === "DELIVERED") cur.delivered++;
    stateMap.set(key, cur);
  }
  const rtoByState = Array.from(stateMap.entries())
    .filter(([, v]) => v.total >= 2)
    .map(([state, v]) => ({
      state,
      total: v.total,
      delivered: v.delivered,
      rto: v.rto,
      rtoPct: Math.round((v.rto / v.total) * 100),
      deliveryPct: Math.round((v.delivered / v.total) * 100),
    }))
    .sort((a, b) => b.rto - a.rto)
    .slice(0, 15);

  // Gross revenue (all orders, for the KPI card)
  const totalRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
  const avgRevenue = total > 0 ? totalRevenue / total : 0;

  // P&L — DELIVERED orders only (realised revenue).
  // Track whether cost data is actually available so the UI can show "—" vs ₹0.
  const deliveredWithProductCost = delivered.filter(o => o.productCost !== null && o.productCost !== undefined);
  const deliveredWithShipping    = delivered.filter(o => o.shippingCharge !== null && o.shippingCharge !== undefined);

  const totalGMV         = delivered.reduce((s, o) => s + o.totalAmount, 0);
  const totalProductCost = delivered.reduce((s, o) => s + (o.productCost ?? 0), 0);
  const totalShipping    = delivered.reduce((s, o) => s + (o.shippingCharge ?? 0), 0);
  const totalPackingCost = delivered.reduce((s, o) => s + (o.packingCharge ?? 0), 0);
  const totalRtoCharge   = rto.reduce((s, o) => s + (o.rtoCharge ?? 0), 0);

  // AXQEN platform fee: flat ₹{platformFeePerOrder} per delivered order (from PlatformConfig)
  // This is distinct from packingCharge (a fulfilment/packaging cost owned by the supplier).
  const totalPlatformFee = delivered.length * platformFeePerOrder;

  const totalEarned = walletTxns
    .filter((t) => t.type === "CREDIT" && t.bankTxId !== null)
    .reduce((acc, t) => acc + t.amount, 0);

  const totalAdSpend = adSpendRows.reduce((s, r) => s + r.amount, 0);
  const adSpendByDay = new Map<string, number>();
  for (const r of adSpendRows) {
    const day = r.date.toISOString().slice(0, 10);
    adSpendByDay.set(day, (adSpendByDay.get(day) ?? 0) + r.amount);
  }

  // Daily earnings trend — delivered orders only
  const earningsTrendMap = new Map<string, { gmv: number; platformFee: number; productCost: number; adSpend: number; count: number }>();
  for (const o of delivered) {
    const day = o.createdAt.toISOString().slice(0, 10);
    const cur = earningsTrendMap.get(day) ?? { gmv: 0, platformFee: 0, productCost: 0, adSpend: 0, count: 0 };
    cur.gmv         += o.totalAmount;
    cur.platformFee += platformFeePerOrder;   // AXQEN fee per delivered order
    cur.productCost += o.productCost ?? 0;
    cur.count++;
    earningsTrendMap.set(day, cur);
  }
  for (const [day, spend] of adSpendByDay) {
    const cur = earningsTrendMap.get(day) ?? { gmv: 0, platformFee: 0, productCost: 0, adSpend: 0, count: 0 };
    cur.adSpend = spend;
    earningsTrendMap.set(day, cur);
  }
  const earningsTrend = Array.from(earningsTrendMap.entries())
    .map(([date, v]) => ({
      date, ...v,
      netProfit: v.gmv - v.productCost - v.platformFee - v.adSpend,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const walletBalance = walletTxns
    .filter(t => t.bankTxId !== null)
    .reduce((acc, t) => t.type === "CREDIT" ? acc + t.amount : acc - t.amount, 0);

  const upcomingAmount = walletTxns
    .filter(t => t.bankTxId === null && t.type === "CREDIT")
    .reduce((acc, t) => acc + t.amount, 0);

  let prevPeriod: {
    totalOrders: number; deliveryRate: number; rtoRate: number; totalRevenue: number; netProfit: number;
  } | null = null;

  if (gteDate && lteDate) {
    const duration  = lteDate.getTime() - gteDate.getTime();
    const prevLte   = new Date(gteDate.getTime() - 1);
    const prevGte   = new Date(prevLte.getTime() - duration);
    const prevOrders = await prisma.order.findMany({
      where: { sellerId, createdAt: { gte: prevGte, lte: prevLte }, status: { not: "HIDDEN" as import("@prisma/client").OrderStatus } },
      select: { status: true, totalAmount: true, packingCharge: true, productCost: true, shippingCharge: true, rtoCharge: true },
    });
    const pt  = prevOrders.length;
    const pd  = prevOrders.filter(o => o.status === "DELIVERED").length;
    const pr  = prevOrders.filter(o => o.status === "RTO").length;
    const pgmv = prevOrders.filter(o => o.status === "DELIVERED").reduce((s, o) => s + o.totalAmount, 0);
    const ppc  = prevOrders.filter(o => o.status === "DELIVERED").reduce((s, o) => s + (o.productCost  ?? 0), 0);
    const psh  = prevOrders.filter(o => o.status === "DELIVERED").reduce((s, o) => s + (o.shippingCharge ?? 0), 0);
    const ppf  = pd * platformFeePerOrder;
    const prtc = prevOrders.filter(o => o.status === "RTO").reduce((s, o) => s + (o.rtoCharge ?? 0), 0);
    prevPeriod = {
      totalOrders:  pt,
      deliveryRate: pt > 0 ? Math.round(pd / pt * 100) : 0,
      rtoRate:      pt > 0 ? Math.round(pr / pt * 100) : 0,
      totalRevenue: pgmv,
      netProfit:    pgmv - ppc - psh - ppf - prtc,
    };
  }

  const unassignedNewOrders = orders.filter(o => o.status === "NEW" && !o.supplierId);
  const unassignedCount = unassignedNewOrders.length;
  const autoHandledCount = orders.filter(o => o.status === "NEW" && !!o.supplierId).length;

  const delayThreshold = new Date(Date.now() - 24 * 3600000);
  const supplierDelayCount = orders.filter(o =>
    o.supplierId !== null &&
    ["ACCEPTED", "PROCESSING", "PACKED"].includes(o.supplierStatus ?? "") &&
    o.updatedAt < delayThreshold
  ).length;

  const pipeline = {
    new:        orders.filter(o => o.status === "NEW").length,
    confirmed:  orders.filter(o => o.supplierStatus === "ACCEPTED" || o.supplierStatus === "ASSIGNED").length,
    processing: orders.filter(o =>
      o.supplierStatus === "PROCESSING" || o.supplierStatus === "PACKED" || o.supplierStatus === "READY_TO_SHIP" ||
      (o.status === "PROCESSING" && !["ACCEPTED","ASSIGNED","PROCESSING","PACKED","READY_TO_SHIP","DISPATCHED"].includes(o.supplierStatus ?? ""))
    ).length,
    shipped:    orders.filter(o => o.status === "SHIPPED").length,
    inTransit:  orders.filter(o => o.status === "IN_TRANSIT").length,
    delivered:  delivered.length,
    ndr:        orders.filter(o => o.ndrStatus !== null && o.ndrActionTaken === null).length,
    rtoRisk:    orders.filter(o => o.ndrStatus !== null).length,
    cancelled:  cancelled.length,
  };

  return NextResponse.json({
    totalOrders: total,
    deliveryRate: pct(delivered.length),
    deliveredCount: delivered.length,
    rtoRate: pct(rto.length),
    rtoCount: rto.length,
    cancelledRate: pct(cancelled.length),
    cancelledCount: cancelled.length,
    inTransitRate: pct(inTransit.length),
    inTransitCount: inTransit.length,
    totalRevenue,
    avgRevenue,
    trend,
    topProducts,
    productDistribution,
    rtoByState,
    store: store ? {
      storeUrl: store.storeUrl,
      storeName: store.storeName,
      lastSyncAt: store.lastSyncAt?.toISOString() ?? null,
      lastSyncError: store.lastSyncError ?? null,
    } : null,
    earnings: {
      totalGMV,
      totalProductCost,
      totalShipping,
      totalPackingCost,       // separate from platform fee
      totalPlatformFee,       // AXQEN flat fee = platformFeePerOrder × delivered.length
      platformFeePerOrder,    // for UI display
      totalRtoCharge,
      totalEarned,
      totalAdSpend,
      // Availability flags — UI should show "—" not "₹0" when cost data not tracked
      productCostTracked: deliveredWithProductCost.length,   // count of delivered orders with cost data
      shippingTracked:    deliveredWithShipping.length,
      deliveredCount: delivered.length,
      netProfit: totalGMV - totalProductCost - totalShipping - totalPlatformFee - totalRtoCharge - totalAdSpend,
      margin: totalGMV > 0
        ? Math.round(((totalGMV - totalProductCost - totalShipping - totalPlatformFee - totalRtoCharge - totalAdSpend) / totalGMV) * 100)
        : 0,
      settledCount: delivered.length,
      earningsTrend,
    },
    wallet: { balance: walletBalance, upcoming: upcomingAmount },
    pipeline,
    unassignedCount,
    autoHandledCount,
    supplierDelayCount,
    prevPeriod,
    computedAt: new Date().toISOString(),
  });
}
