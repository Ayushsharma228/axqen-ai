import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { productStats, EMPTY_STATS } from "@/lib/product-analytics";

// READ-ONLY products with pricing and order performance. GET ?days=30|90 (omit for all time)
// GET ?id=<productId>&days → one product with variants and its results by seller and by state
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const days = Number(sp.get("days") ?? "") || null;
  const id = sp.get("id");

  const select = {
    id: true, name: true, sku: true, images: true, status: true, category: true, description: true, adminNote: true,
    price: true, costPrice: true, suggestedPrice: true, invoicePrice: true, invoiceShipping: true, invoicePacking: true,
    hsn: true, gstRate: true, stock: true, weight: true, length: true, width: true, height: true, moq: true, createdAt: true,
    supplier: { select: { id: true, name: true, email: true } },
  } as const;

  if (id) {
    const [product, variants, listed, s] = await Promise.all([
      prisma.product.findUnique({ where: { id }, select }),
      prisma.productVariant.findMany({ where: { productId: id }, select: { id: true, name: true, sku: true, price: true, stock: true } }),
      prisma.listingRequest.findMany({ where: { productId: id }, select: { status: true, platform: true, seller: { select: { name: true, brandName: true, email: true } } } }),
      productStats({ days, productId: id }),
    ]);
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    return NextResponse.json({
      product, variants, stats: s.stats.get(id) ?? EMPTY_STATS, bySeller: s.bySeller, byState: s.byState,
      listings: listed.map(l => ({ status: l.status, platform: l.platform, seller: l.seller.brandName || l.seller.name || l.seller.email })),
    });
  }

  const [products, listedBy, s] = await Promise.all([
    prisma.product.findMany({ select, orderBy: { createdAt: "desc" } }),
    prisma.listingRequest.groupBy({ by: ["productId", "sellerId"], where: { status: "LISTED" } }),
    productStats({ days }),
  ]);
  const listedCount = new Map<string, number>();
  for (const l of listedBy) if (l.productId) listedCount.set(l.productId, (listedCount.get(l.productId) ?? 0) + 1);

  const rows = products.map(p => ({ ...p, listedSellers: listedCount.get(p.id) ?? 0, stats: s.stats.get(p.id) ?? EMPTY_STATS }));
  return NextResponse.json({
    products: rows,
    summary: {
      total: rows.length,
      approved: rows.filter(r => r.status === "APPROVED").length,
      pending: rows.filter(r => r.status === "PENDING").length,
      missingPricing: rows.filter(r => r.status === "APPROVED" && (r.invoicePrice == null || !r.hsn || r.gstRate == null)).length,
      outOfStock: rows.filter(r => r.status === "APPROVED" && r.stock <= 0).length,
    },
  });
}
