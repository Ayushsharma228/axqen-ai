import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// READ-ONLY customers across all sellers, grouped by phone (name when there is no phone).
// GET ?search&sellerId&filter=all|repeat|highRto&sort=recent|orders|rto|spend&page
// GET ?key=<customer key> → that customer's orders
const HIGH_RTO_MIN = 2;
type Addr = { phone?: string; city?: string; state?: string; province?: string; pincode?: string; zip?: string };
const keyOf = (name: string | null, a: Addr) => {
  const p = (a.phone ?? "").replace(/\D/g, "").slice(-10);
  return p.length === 10 ? `p:${p}` : `n:${(name ?? "").trim().toLowerCase()}`;
};

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const sellerId = sp.get("sellerId") || "";
  const key = sp.get("key");

  const orders = await prisma.order.findMany({
    where: { status: { not: "HIDDEN" }, ...(sellerId ? { sellerId } : {}), OR: [{ customerName: { not: null } }, { customerAddress: { not: undefined } }] },
    select: {
      id: true, externalOrderId: true, status: true, totalAmount: true, createdAt: true, customerName: true, customerAddress: true, paymentMode: true,
      sellerId: true, seller: { select: { name: true, brandName: true, email: true } }, items: { select: { name: true, quantity: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20000,
  });

  if (key) {
    const mine = orders.filter(o => keyOf(o.customerName, (o.customerAddress ?? {}) as Addr) === key);
    return NextResponse.json({
      orders: mine.slice(0, 50).map(o => ({
        id: o.id, externalOrderId: o.externalOrderId, status: o.status, totalAmount: o.totalAmount, paymentMode: o.paymentMode,
        createdAt: o.createdAt.toISOString(), seller: o.seller.brandName || o.seller.name || o.seller.email,
        items: o.items.map(i => `${i.name} ×${i.quantity}`).join(", "),
      })),
    });
  }

  type Row = {
    key: string; name: string; phone: string | null; city: string | null; state: string | null; pincode: string | null;
    orders: number; delivered: number; rto: number; cancelled: number; open: number; spend: number;
    cod: number; sellers: Map<string, string>; first: Date; last: Date;
  };
  const map = new Map<string, Row>();
  for (const o of orders) {
    const a = (o.customerAddress ?? {}) as Addr;
    const k = keyOf(o.customerName, a);
    if (k === "n:") continue;
    let r = map.get(k);
    if (!r) {
      const p = (a.phone ?? "").replace(/\D/g, "").slice(-10);
      r = {
        key: k, name: o.customerName?.trim() || "—", phone: p.length === 10 ? p : null,
        city: a.city ?? null, state: a.state ?? a.province ?? null, pincode: a.pincode ?? a.zip ?? null,
        orders: 0, delivered: 0, rto: 0, cancelled: 0, open: 0, spend: 0, cod: 0, sellers: new Map(), first: o.createdAt, last: o.createdAt,
      };
      map.set(k, r);
    }
    r.orders++;
    if (o.status === "DELIVERED") { r.delivered++; r.spend += o.totalAmount; }
    else if (o.status === "RTO") r.rto++;
    else if (o.status === "CANCELLED") r.cancelled++;
    else r.open++;
    if (o.paymentMode === "COD") r.cod++;
    r.sellers.set(o.sellerId, o.seller.brandName || o.seller.name || o.seller.email);
    if (o.createdAt < r.first) r.first = o.createdAt;
  }

  let rows = [...map.values()];
  const summary = {
    customers: rows.length,
    repeat: rows.filter(r => r.orders > 1).length,
    highRto: rows.filter(r => r.rto >= HIGH_RTO_MIN).length,
    multiSeller: rows.filter(r => r.sellers.size > 1).length,
  };

  const q = (sp.get("search") ?? "").trim().toLowerCase();
  if (q) rows = rows.filter(r => r.name.toLowerCase().includes(q) || (r.phone ?? "").includes(q.replace(/\D/g, "") || "~") || (r.city ?? "").toLowerCase().includes(q) || (r.pincode ?? "").includes(q));
  const filter = sp.get("filter");
  if (filter === "repeat") rows = rows.filter(r => r.orders > 1);
  if (filter === "highRto") rows = rows.filter(r => r.rto >= HIGH_RTO_MIN);
  const sort = sp.get("sort") ?? (filter === "highRto" ? "rto" : "recent");
  rows.sort((a, b) =>
    sort === "orders" ? b.orders - a.orders
    : sort === "rto" ? b.rto - a.rto || b.orders - a.orders
    : sort === "spend" ? b.spend - a.spend
    : b.last.getTime() - a.last.getTime());

  const limit = 50;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const total = rows.length;
  const pageRows = rows.slice((page - 1) * limit, page * limit).map(r => {
    const done = r.delivered + r.rto;
    return {
      key: r.key, name: r.name, phone: r.phone, city: r.city, state: r.state, pincode: r.pincode,
      orders: r.orders, delivered: r.delivered, rto: r.rto, cancelled: r.cancelled, open: r.open, cod: r.cod,
      spend: Math.round(r.spend), rtoPct: done ? Math.round((r.rto / done) * 100) : null,
      sellers: [...r.sellers.values()], first: r.first.toISOString(), last: r.last.toISOString(),
    };
  });

  return NextResponse.json({ rows: pageRows, total, page, pages: Math.max(1, Math.ceil(total / limit)), summary, highRtoMin: HIGH_RTO_MIN });
}
