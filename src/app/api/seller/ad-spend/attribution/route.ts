import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sellerId = session.user.id;
  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const dateGte = from ? new Date(from) : defaultFrom;
  const dateLte = to   ? new Date(to + "T23:59:59") : new Date();

  const seller = await prisma.user.findUnique({
    where:  { id: sellerId },
    select: { metaAdAccountId: true },
  });

  const [spendRows, orders, recharges] = await Promise.all([
    prisma.adSpend.findMany({
      where: { sellerId, date: { gte: dateGte, lte: dateLte } },
      select: { campaignId: true, campaignName: true, amount: true, date: true, clicks: true, impressions: true },
    }),
    prisma.order.findMany({
      where: {
        sellerId,
        createdAt: { gte: dateGte, lte: dateLte },
        utmCampaign: { not: null },
        status: { notIn: ["CANCELLED"] },
      },
      select: {
        id: true, totalAmount: true, status: true, utmCampaign: true,
        productCost: true, shippingCharge: true, packingCharge: true, rtoCharge: true,
        items: { select: { name: true, quantity: true, price: true } },
      },
    }),
    prisma.metaRecharge.findMany({
      where: { sellerId, date: { gte: dateGte, lte: dateLte } },
      select: { amount: true, date: true, note: true },
    }),
  ]);

  interface CampaignData {
    campaignId:   string | null;
    campaignName: string;
    totalSpend:   number;
    totalClicks:  number;
    totalImpressions: number;
    orderCount:   number;
    deliveredCount: number;
    revenue:      number;           // delivered orders only
    allRevenue:   number;           // all non-cancelled orders
    rtoCount:     number;
    deliveredCosts: number;         // product + shipping + packing on delivered orders
    rtoCosts:     number;           // product + return shipping + packing on RTO orders
    costsMissing: number;           // delivered/RTO orders with no product cost yet
    products:     Record<string, { name: string; quantity: number; revenue: number }>;
  }

  const campaignMap: Record<string, CampaignData> = {};

  for (const row of spendRows) {
    const key = (row.campaignName ?? row.campaignId ?? "unknown").toLowerCase();
    if (!campaignMap[key]) {
      campaignMap[key] = {
        campaignId: row.campaignId,
        campaignName: row.campaignName ?? row.campaignId ?? "Unknown Campaign",
        totalSpend: 0, totalClicks: 0, totalImpressions: 0,
        orderCount: 0, deliveredCount: 0,
        revenue: 0, allRevenue: 0, rtoCount: 0,
        deliveredCosts: 0, rtoCosts: 0, costsMissing: 0,
        products: {},
      };
    }
    campaignMap[key].totalSpend       += row.amount;
    campaignMap[key].totalClicks      += row.clicks      ?? 0;
    campaignMap[key].totalImpressions += row.impressions ?? 0;
  }

  for (const order of orders) {
    const utmKey = (order.utmCampaign ?? "").toLowerCase();
    let matched = campaignMap[utmKey];
    if (!matched) {
      const foundKey = Object.keys(campaignMap).find(
        (k) => k.includes(utmKey) || utmKey.includes(k)
      );
      if (foundKey) matched = campaignMap[foundKey];
    }
    if (!matched) {
      if (!campaignMap[utmKey]) {
        campaignMap[utmKey] = {
          campaignId: null,
          campaignName: order.utmCampaign ?? "Unknown",
          totalSpend: 0, totalClicks: 0, totalImpressions: 0,
          orderCount: 0, deliveredCount: 0,
          revenue: 0, allRevenue: 0, rtoCount: 0,
          deliveredCosts: 0, rtoCosts: 0, costsMissing: 0,
          products: {},
        };
      }
      matched = campaignMap[utmKey];
    }

    matched.orderCount += 1;
    const isDelivered = order.status === "DELIVERED";
    const isRTO       = order.status === "RTO";

    if (isRTO) {
      matched.rtoCount += 1;
      matched.rtoCosts += (order.productCost ?? 0) + (order.rtoCharge ?? 0) + (order.packingCharge ?? 0);
      if (order.productCost == null) matched.costsMissing += 1;
    }
    if (isDelivered) {
      matched.deliveredCount += 1; matched.revenue += order.totalAmount;
      matched.deliveredCosts += (order.productCost ?? 0) + (order.shippingCharge ?? 0) + (order.packingCharge ?? 0);
      if (order.productCost == null) matched.costsMissing += 1;
    }
    if (!isRTO)       matched.allRevenue += order.totalAmount;

    for (const item of order.items) {
      const pKey = item.name;
      if (!matched.products[pKey])
        matched.products[pKey] = { name: item.name, quantity: 0, revenue: 0 };
      matched.products[pKey].quantity += item.quantity;
      if (isDelivered) matched.products[pKey].revenue += item.price * item.quantity;
    }
  }

  const campaigns = Object.values(campaignMap)
    .map((c) => {
      // ROAS = all received order revenue / spend
      const roas = c.totalSpend > 0 ? Math.round((c.allRevenue / c.totalSpend) * 100) / 100 : null;
      // CPC = spend / clicks
      const cpc  = c.totalClicks > 0 ? Math.round((c.totalSpend / c.totalClicks) * 100) / 100 : null;
      // CPR = spend / orders received (all non-cancelled)
      const cpr  = c.orderCount > 0 ? Math.round((c.totalSpend / c.orderCount) * 100) / 100 : null;
      // ROI = (delivered revenue - spend) / spend — delivered only
      const roi  = c.totalSpend > 0 ? Math.round(((c.revenue - c.totalSpend) / c.totalSpend) * 10000) / 100 : null;
      return {
        campaignId:      c.campaignId,
        campaignName:    c.campaignName,
        totalSpend:      Math.round(c.totalSpend * 100) / 100,
        totalClicks:     c.totalClicks,
        orderCount:      c.orderCount,
        deliveredCount:  c.deliveredCount,
        revenue:         Math.round(c.revenue * 100) / 100,
        allRevenue:      Math.round(c.allRevenue * 100) / 100,
        rtoCount:        c.rtoCount,
        roas, cpc, cpr, roi,
        // COD-true metrics (delivered only; RTO costs counted against the campaign)
        deliveredRoas:    c.totalSpend > 0 ? Math.round((c.revenue / c.totalSpend) * 100) / 100 : null,
        rtoPct:           c.deliveredCount + c.rtoCount > 0 ? Math.round((c.rtoCount / (c.deliveredCount + c.rtoCount)) * 100) : null,
        costPerDelivered: c.deliveredCount > 0 ? Math.round(c.totalSpend / c.deliveredCount) : null,
        profitAfterAds:   Math.round(c.revenue - c.deliveredCosts - c.rtoCosts - c.totalSpend),
        costsMissing:     c.costsMissing,
        verdict:          verdictFor(c),
        products:        Object.values(c.products).sort((a, b) => b.revenue - a.revenue),
      };
    })
    .sort((a, b) => b.totalSpend - a.totalSpend);

  const totalSpend      = campaigns.reduce((s, c) => s + c.totalSpend, 0);
  const totalRevenue    = campaigns.reduce((s, c) => s + c.revenue, 0);
  const totalAllRevenue = campaigns.reduce((s, c) => s + c.allRevenue, 0);
  const totalOrders     = campaigns.reduce((s, c) => s + c.orderCount, 0);
  const totalDelivered  = campaigns.reduce((s, c) => s + c.deliveredCount, 0);
  const totalClicks     = campaigns.reduce((s, c) => s + c.totalClicks, 0);
  // Summary uses same rules: ROAS = allRevenue, CPR = all orders, ROI = delivered
  const overallRoas     = totalSpend > 0 ? Math.round((totalAllRevenue / totalSpend) * 100) / 100 : null;
  const overallCpc      = totalClicks > 0 ? Math.round((totalSpend / totalClicks) * 100) / 100 : null;
  const overallCpr      = totalOrders > 0 ? Math.round((totalSpend / totalOrders) * 100) / 100 : null;
  const overallRoi      = totalSpend > 0 ? Math.round(((totalRevenue - totalSpend) / totalSpend) * 10000) / 100 : null;
  const totalRecharged  = recharges.reduce((s, r) => s + r.amount, 0);
  const rechargeBalance = Math.round((totalRecharged - totalSpend) * 100) / 100;

  // Store-level (all orders, tagged or not) for the COD-true tiles
  const [storeOrders, allRecharges, allSpend, spend7] = await Promise.all([
    prisma.order.findMany({
      where: { sellerId, createdAt: { gte: dateGte, lte: dateLte }, status: { notIn: ["CANCELLED", "HIDDEN"] as never[] } },
      select: { status: true, totalAmount: true, utmCampaign: true, productCost: true, shippingCharge: true, packingCharge: true, rtoCharge: true },
    }),
    prisma.metaRecharge.aggregate({ where: { sellerId }, _sum: { amount: true } }),
    prisma.adSpend.aggregate({ where: { sellerId }, _sum: { amount: true } }),
    prisma.adSpend.aggregate({ where: { sellerId, date: { gte: new Date(Date.now() - 7 * 86400000) } }, _sum: { amount: true } }),
  ]);
  const del = storeOrders.filter(o => o.status === "DELIVERED");
  const rto = storeOrders.filter(o => o.status === "RTO");
  const storeDeliveredRevenue = del.reduce((s, o) => s + o.totalAmount, 0);
  const storeCosts = del.reduce((s, o) => s + (o.productCost ?? 0) + (o.shippingCharge ?? 0) + (o.packingCharge ?? 0), 0)
    + rto.reduce((s, o) => s + (o.productCost ?? 0) + (o.rtoCharge ?? 0) + (o.packingCharge ?? 0), 0);
  const walletBalance = (allRecharges._sum.amount ?? 0) - (allSpend._sum.amount ?? 0);
  const dailyBurn = (spend7._sum.amount ?? 0) / 7;

  return NextResponse.json({
    campaigns,
    store: {
      orders: storeOrders.length,
      taggedOrders: storeOrders.filter(o => o.utmCampaign).length,
      delivered: del.length,
      rto: rto.length,
      inTransit: storeOrders.filter(o => !["DELIVERED", "RTO"].includes(o.status)).length,
      deliveredRevenue: storeDeliveredRevenue,
      deliveredRoas: totalSpend > 0 ? Math.round((storeDeliveredRevenue / totalSpend) * 100) / 100 : null,
      costPerDelivered: del.length > 0 ? Math.round(totalSpend / del.length) : null,
      profitAfterAds: Math.round(storeDeliveredRevenue - storeCosts - totalSpend),
      costsMissing: [...del, ...rto].filter(o => o.productCost == null).length,
    },
    wallet: {
      recharged: allRecharges._sum.amount ?? 0,
      spent: allSpend._sum.amount ?? 0,
      balance: walletBalance,
      dailyBurn: Math.round(dailyBurn),
      daysLeft: dailyBurn > 0 && walletBalance > 0 ? Math.floor(walletBalance / dailyBurn) : null,
    },
    summary: {
      totalSpend, totalRevenue, totalOrders, totalDelivered,
      totalClicks, overallRoas, overallCpc, overallCpr, overallRoi,
      totalRecharged, rechargeBalance,
    },
    recharges,
    adAccountId: seller?.metaAdAccountId ?? null,
  });
}

// Scale / Watch / Losing for a campaign, from delivered results (needs a few completed orders to judge).
function verdictFor(c: { totalSpend: number; deliveredCount: number; rtoCount: number; revenue: number; deliveredCosts: number; rtoCosts: number }) {
  if (c.totalSpend <= 0) return null;
  const done = c.deliveredCount + c.rtoCount;
  if (done < 3) return "LEARNING";
  const profit = c.revenue - c.deliveredCosts - c.rtoCosts - c.totalSpend;
  if (profit < 0) return "LOSING";
  if (c.rtoCount / done >= 0.3) return "WATCH";
  return "SCALE";
}
