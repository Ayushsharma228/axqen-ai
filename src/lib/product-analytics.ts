import { prisma } from "@/lib/prisma";

/**
 * Per-product order performance, read-only. Order items are matched to catalogue products by
 * productId, else by SKU (the same rule invoices use).
 */
export interface ProductStats {
  orders: number; units: number; delivered: number; rto: number; moving: number; cancelled: number;
  deliveredValue: number; deliveredPct: number | null; rtoPct: number | null; orderingSellers: number;
}

const MOVING = new Set(["NEW", "PROCESSING", "SHIPPED", "IN_TRANSIT"]);
const blank = () => ({ orders: new Set<string>(), units: 0, delivered: new Set<string>(), rto: new Set<string>(), moving: new Set<string>(), cancelled: new Set<string>(), value: 0, sellers: new Set<string>() });

export async function productStats(opts: { days: number | null; productId?: string }) {
  const since = opts.days ? new Date(Date.now() - opts.days * 86400000) : null;
  const [products, items] = await Promise.all([
    prisma.product.findMany({ where: opts.productId ? { id: opts.productId } : {}, select: { id: true, sku: true } }),
    prisma.orderItem.findMany({
      where: { order: { status: { not: "HIDDEN" }, ...(since ? { createdAt: { gte: since } } : {}) } },
      select: {
        productId: true, sku: true, quantity: true, price: true,
        order: { select: { id: true, status: true, sellerId: true, customerAddress: true, seller: { select: { name: true, brandName: true, email: true } } } },
      },
      take: 100000,
    }),
  ]);
  const bySku = new Map(products.filter(p => p.sku).map(p => [p.sku!.trim().toLowerCase(), p.id]));
  const ids = new Set(products.map(p => p.id));

  const agg = new Map<string, ReturnType<typeof blank>>();
  // Drill-down for a single product
  const sellers = new Map<string, { name: string; b: ReturnType<typeof blank> }>();
  const states = new Map<string, ReturnType<typeof blank>>();

  const add = (b: ReturnType<typeof blank>, it: (typeof items)[number]) => {
    const o = it.order;
    b.orders.add(o.id);
    b.sellers.add(o.sellerId);
    if (o.status === "DELIVERED") { b.delivered.add(o.id); b.units += it.quantity; b.value += it.price * it.quantity; }
    else if (o.status === "RTO") b.rto.add(o.id);
    else if (o.status === "CANCELLED") b.cancelled.add(o.id);
    else if (MOVING.has(o.status)) b.moving.add(o.id);
  };

  for (const it of items) {
    const pid = it.productId && ids.has(it.productId) ? it.productId : it.sku ? bySku.get(it.sku.trim().toLowerCase()) : undefined;
    if (!pid) continue;
    let b = agg.get(pid);
    if (!b) { b = blank(); agg.set(pid, b); }
    add(b, it);
    if (opts.productId) {
      const s = sellers.get(it.order.sellerId) ?? { name: it.order.seller.brandName || it.order.seller.name || it.order.seller.email, b: blank() };
      add(s.b, it); sellers.set(it.order.sellerId, s);
      const a = (it.order.customerAddress ?? {}) as Record<string, string | undefined>;
      const st = (a.state || a.province || "Unknown").trim() || "Unknown";
      const sb = states.get(st) ?? blank();
      add(sb, it); states.set(st, sb);
    }
  }

  const out = (b: ReturnType<typeof blank>): ProductStats => {
    const d = b.delivered.size, r = b.rto.size;
    return {
      orders: b.orders.size, units: b.units, delivered: d, rto: r, moving: b.moving.size, cancelled: b.cancelled.size,
      deliveredValue: Math.round(b.value), deliveredPct: d + r ? Math.round((d / (d + r)) * 100) : null, rtoPct: d + r ? Math.round((r / (d + r)) * 100) : null,
      orderingSellers: b.sellers.size,
    };
  };
  return {
    stats: new Map([...agg.entries()].map(([k, v]) => [k, out(v)])),
    bySeller: [...sellers.values()].map(s => ({ seller: s.name, ...out(s.b) })).sort((a, b) => b.orders - a.orders),
    byState: [...states.entries()].map(([state, b]) => ({ state, ...out(b) })).sort((a, b) => b.orders - a.orders).slice(0, 20),
  };
}

export const EMPTY_STATS: ProductStats = { orders: 0, units: 0, delivered: 0, rto: 0, moving: 0, cancelled: 0, deliveredValue: 0, deliveredPct: null, rtoPct: null, orderingSellers: 0 };
