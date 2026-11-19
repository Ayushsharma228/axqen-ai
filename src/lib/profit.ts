// Shared profit calculation (Profit & Analytics page, AI Intelligence).
// Delivered-only revenue, RTO counted as a loss, ads and the AXQEN fee deducted.
import { prisma } from "@/lib/prisma";

export async function platformFeePerOrder() {
  try {
    const cfg = await prisma.platformConfig.findUnique({ where: { key: "PLATFORM_FEE" } });
    if (cfg) return parseFloat(cfg.value) || 20;
  } catch { /* default */ }
  return 20;
}

type AddrJson = { state?: string; province?: string } | null;

export async function computeProfit(sellerId: string, days: number | null) {
  const seller = await prisma.user.findUnique({ where: { id: sellerId }, select: { dataStartDate: true } });
  const since = days ? new Date(Date.now() - days * 86400000) : null;
  const floor = seller?.dataStartDate ?? null;
  const gte = floor && since ? (floor > since ? floor : since) : (floor ?? since);

  const [orders, ads, fee] = await Promise.all([
    prisma.order.findMany({
      where: { sellerId, status: { not: "HIDDEN" as never }, ...(gte ? { createdAt: { gte } } : {}) },
      select: {
        status: true, totalAmount: true, createdAt: true, customerAddress: true,
        productCost: true, shippingCharge: true, packingCharge: true, rtoCharge: true,
        items: { select: { name: true, quantity: true, price: true } },
      },
    }),
    prisma.adSpend.findMany({
      where: { sellerId, ...(gte ? { date: { gte } } : {}) },
      select: { amount: true, date: true },
    }),
    platformFeePerOrder(),
  ]);

  const month = (d: Date) => new Date(d.getTime() + 5.5 * 3600000).toISOString().slice(0, 7); // IST month
  const S = {
    orders: orders.length, delivered: 0, rto: 0, cancelled: 0, inTransit: 0, inTransitValue: 0,
    revenue: 0, productCost: 0, shipping: 0, packing: 0, platformFee: 0, rtoLoss: 0, adSpend: 0, costsMissing: 0,
  };
  type Bucket = { delivered: number; rto: number; units: number; revenue: number; costs: number; rtoLoss: number; costsMissing: number };
  const blank = (): Bucket => ({ delivered: 0, rto: 0, units: 0, revenue: 0, costs: 0, rtoLoss: 0, costsMissing: 0 });
  const months = new Map<string, Bucket & { ads: number }>();
  const products = new Map<string, Bucket>();
  const states = new Map<string, Bucket>();
  const getM = (k: string) => { let b = months.get(k); if (!b) { b = { ...blank(), ads: 0 }; months.set(k, b); } return b; };

  for (const o of orders) {
    if (o.status === "CANCELLED") { S.cancelled++; continue; }
    const isDel = o.status === "DELIVERED", isRto = o.status === "RTO";
    if (!isDel && !isRto) { S.inTransit++; S.inTransitValue += o.totalAmount; continue; }

    const missing = o.productCost == null;
    if (missing) S.costsMissing++;
    const prod = o.productCost ?? 0, ship = o.shippingCharge ?? 0, pack = o.packingCharge ?? 0, ret = o.rtoCharge ?? 0;

    let rev = 0, costs = 0, loss = 0;
    if (isDel) {
      S.delivered++;
      rev = o.totalAmount;
      costs = prod + ship + pack + fee;
      S.revenue += rev; S.productCost += prod; S.shipping += ship; S.packing += pack; S.platformFee += fee;
    } else {
      S.rto++;
      loss = prod + ret + pack;
      S.rtoLoss += loss;
    }

    const m = getM(month(o.createdAt));
    m.delivered += isDel ? 1 : 0; m.rto += isRto ? 1 : 0; m.revenue += rev; m.costs += costs; m.rtoLoss += loss; m.costsMissing += missing ? 1 : 0;

    const st = ((o.customerAddress as AddrJson)?.state || (o.customerAddress as AddrJson)?.province || "Unknown").trim();
    const sb = states.get(st) ?? blank();
    sb.delivered += isDel ? 1 : 0; sb.rto += isRto ? 1 : 0; sb.revenue += rev; sb.costs += costs; sb.rtoLoss += loss; sb.costsMissing += missing ? 1 : 0;
    states.set(st, sb);

    // Split order-level money across its items by each item's share of the item total.
    const itemTotal = o.items.reduce((s, i) => s + i.price * i.quantity, 0);
    for (const it of o.items) {
      const share = itemTotal > 0 ? (it.price * it.quantity) / itemTotal : 1 / Math.max(1, o.items.length);
      const pb = products.get(it.name) ?? blank();
      pb.delivered += isDel ? 1 : 0; pb.rto += isRto ? 1 : 0;
      pb.units += isDel ? it.quantity : 0;
      pb.revenue += rev * share; pb.costs += costs * share; pb.rtoLoss += loss * share;
      pb.costsMissing += missing ? 1 : 0;
      products.set(it.name, pb);
    }
  }

  for (const a of ads) {
    S.adSpend += a.amount;
    getM(month(a.date)).ads += a.amount;
  }

  const net = S.revenue - S.productCost - S.shipping - S.packing - S.platformFee - S.rtoLoss - S.adSpend;
  const rows = (map: Map<string, Bucket>) => [...map.entries()].map(([label, b]) => {
    const profit = b.revenue - b.costs - b.rtoLoss;
    return {
      label, delivered: b.delivered, rto: b.rto, units: b.units,
      revenue: Math.round(b.revenue), costs: Math.round(b.costs), rtoLoss: Math.round(b.rtoLoss),
      profit: Math.round(profit),
      margin: b.revenue > 0 ? Math.round((profit / b.revenue) * 100) : null,
      rtoPct: b.delivered + b.rto > 0 ? Math.round((b.rto / (b.delivered + b.rto)) * 100) : null,
      costsMissing: b.costsMissing,
    };
  });

  return {
    summary: {
      ...Object.fromEntries(Object.entries(S).map(([k, v]) => [k, Math.round(v)])),
      platformFeePerOrder: fee,
      netProfit: Math.round(net),
      margin: S.revenue > 0 ? Math.round((net / S.revenue) * 100) : null,
      profitPerDelivered: S.delivered > 0 ? Math.round(net / S.delivered) : null,
      rtoPct: S.delivered + S.rto > 0 ? Math.round((S.rto / (S.delivered + S.rto)) * 100) : null,
    },
    byMonth: [...months.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([m, b]) => ({
      month: m, delivered: b.delivered, rto: b.rto,
      revenue: Math.round(b.revenue), costs: Math.round(b.costs), rtoLoss: Math.round(b.rtoLoss), ads: Math.round(b.ads),
      net: Math.round(b.revenue - b.costs - b.rtoLoss - b.ads), costsMissing: b.costsMissing,
    })),
    byProduct: rows(products).sort((a, b) => b.revenue - a.revenue).slice(0, 50),
    byState: rows(states).filter(r => r.delivered + r.rto >= 2).sort((a, b) => b.revenue - a.revenue).slice(0, 36),
  }
}
