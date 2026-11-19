import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { productStats } from "@/lib/product-analytics";

// Stock per catalogue product (the stock sellers see), with 30-day order pace and days of stock left.
async function admin(req: NextRequest) {
  const s = await getRouteSession(req);
  return s?.user.role === "ADMIN" ? s : null;
}

export async function GET(req: NextRequest) {
  if (!(await admin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [products, variants, s] = await Promise.all([
    prisma.product.findMany({ where: { status: "APPROVED" }, select: { id: true, name: true, sku: true, images: true, category: true, stock: true, updatedAt: true }, orderBy: { name: "asc" } }),
    prisma.productVariant.findMany({ select: { id: true, productId: true, name: true, sku: true, stock: true } }),
    productStats({ days: 30 }),
  ]);
  const rows = products.map(p => {
    const st = s.stats.get(p.id);
    const orders30 = st?.orders ?? 0;
    const perDay = orders30 / 30;
    return {
      ...p, updatedAt: p.updatedAt.toISOString(), orders30, perDay: Math.round(perDay * 10) / 10,
      daysLeft: perDay > 0 ? Math.floor(p.stock / perDay) : null,
      variants: variants.filter(v => v.productId === p.id),
    };
  });
  return NextResponse.json({ rows });
}

// PATCH { productId, stock } or { variantId, stock }
export async function PATCH(req: NextRequest) {
  if (!(await admin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({})) as { productId?: string; variantId?: string; stock?: unknown };
  const stock = Number(b.stock);
  if (!Number.isInteger(stock) || stock < 0 || stock > 10_000_000) return NextResponse.json({ error: "Stock should be a whole number, 0 or more" }, { status: 400 });
  if (b.variantId) {
    await prisma.productVariant.update({ where: { id: b.variantId }, data: { stock } });
    return NextResponse.json({ ok: true });
  }
  if (!b.productId) return NextResponse.json({ error: "productId required" }, { status: 400 });
  await prisma.product.update({ where: { id: b.productId }, data: { stock } });
  return NextResponse.json({ ok: true });
}
