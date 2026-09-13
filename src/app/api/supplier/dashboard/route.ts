import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

type AddrJson = { state?: string; province?: string } | null;

export async function GET(req: NextRequest) {
  try {
    const session = await getRouteSession(req);
    if (!session || session.user.role !== "SUPPLIER")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supplierId = session.user.id;

    const [orders, remittances, products] = await Promise.all([
      prisma.order.findMany({
        where: { supplierId },
        select: {
          id: true,
          status: true,
          supplierStatus: true,
          totalAmount: true,
          customerAddress: true,
          ndrStatus: true,
          ndrAttempts: true,
          items: {
            select: {
              price: true,
              quantity: true,
              product: { select: { costPrice: true } },
            },
          },
        },
      }),
      prisma.remittance.findMany({
        where: { supplierId },
        select: { amount: true },
      }),
      prisma.product.findMany({
        where: { supplierId },
        select: { status: true },
      }),
    ]);

    // ── Order counts ──────────────────────────────────────────────────────────
    const orderCounts = {
      pending:   orders.filter(o => o.supplierStatus === "ASSIGNED").length,
      active:    orders.filter(o => ["ACCEPTED","PROCESSING","PACKED","READY_TO_SHIP"].includes(o.supplierStatus ?? "")).length,
      shipped:   orders.filter(o => o.supplierStatus === "DISPATCHED").length,
      delivered: orders.filter(o => o.status === "DELIVERED").length,
      rto:       orders.filter(o => o.status === "RTO").length,
      cancelled: orders.filter(o => o.status === "CANCELLED").length,
      ndr:       orders.filter(o => (o.ndrAttempts ?? 0) > 0 || (o.ndrStatus !== null && o.ndrStatus !== "")).length,
      total:     orders.length,
    };

    // ── Product counts ────────────────────────────────────────────────────────
    const productCounts = {
      total:    products.length,
      approved: products.filter(p => p.status === "APPROVED").length,
      pending:  products.filter(p => p.status === "PENDING").length,
      rejected: products.filter(p => p.status === "REJECTED").length,
    };

    // ── Earnings ──────────────────────────────────────────────────────────────
    const deliveredOrders = orders.filter(o => o.status === "DELIVERED");
    const dispatchedOrders = orders.filter(o => o.supplierStatus === "DISPATCHED" && o.status !== "DELIVERED");

    // Revenue from delivered orders (item prices)
    const deliveredRevenue = deliveredOrders.reduce((sum, o) =>
      sum + o.items.reduce((s, i) => s + i.price * i.quantity, 0), 0);

    // Product cost from delivered orders (costPrice on product, if set)
    const productCosts = deliveredOrders.reduce((sum, o) =>
      sum + o.items.reduce((s, i) =>
        s + (i.product?.costPrice ?? 0) * i.quantity, 0), 0);

    // Paid = total remittances received
    const paid = remittances.reduce((sum, r) => sum + r.amount, 0);

    // Wallet balance = delivered revenue - paid
    const walletBalance = Math.max(0, deliveredRevenue - paid);

    // Our earnings = delivered revenue - product costs (gross margin)
    const ourEarnings = deliveredRevenue - productCosts;

    // Upcoming = revenue expected from dispatched-but-not-delivered orders
    const upcoming = dispatchedOrders.reduce((sum, o) =>
      sum + o.items.reduce((s, i) => s + i.price * i.quantity, 0), 0);

    // ── State-wise data ───────────────────────────────────────────────────────
    const stateMap = new Map<string, { total: number; delivered: number; rto: number }>();
    for (const o of orders) {
      if (o.status === "CANCELLED") continue;
      const addr = o.customerAddress as AddrJson;
      const state = addr?.state || addr?.province || null;
      if (!state) continue;
      const key = state.trim();
      const cur = stateMap.get(key) ?? { total: 0, delivered: 0, rto: 0 };
      cur.total++;
      if (o.status === "DELIVERED") cur.delivered++;
      if (o.status === "RTO")       cur.rto++;
      stateMap.set(key, cur);
    }

    const stateData = Array.from(stateMap.entries())
      .filter(([, v]) => v.total >= 1)
      .map(([state, v]) => ({
        state,
        total:       v.total,
        delivered:   v.delivered,
        rto:         v.rto,
        deliveryPct: v.total > 0 ? Math.round((v.delivered / v.total) * 100) : 0,
        rtoPct:      v.total > 0 ? Math.round((v.rto / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    return NextResponse.json({
      orderCounts,
      productCounts,
      earnings: {
        deliveredRevenue: Math.round(deliveredRevenue),
        productCosts:     Math.round(productCosts),
        ourEarnings:      Math.round(ourEarnings),
        paid:             Math.round(paid),
        walletBalance:    Math.round(walletBalance),
        upcoming:         Math.round(upcoming),
      },
      stateData,
    });
  } catch (err) {
    console.error("Supplier dashboard error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
