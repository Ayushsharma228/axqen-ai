import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

async function admin(req: NextRequest) {
  const s = await getRouteSession(req);
  return s?.user.role === "ADMIN" ? s : null;
}

// Approved products with what Vrinandya charges sellers (GST-inclusive per unit). GET ?search=&missing=1
export async function GET(req: NextRequest) {
  if (!(await admin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const search = sp.get("search")?.trim();
  const products = await prisma.product.findMany({
    where: {
      status: "APPROVED" as never,
      ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { sku: { contains: search, mode: "insensitive" } }] } : {}),
    },
    orderBy: { name: "asc" },
    take: 500,
    select: {
      id: true, name: true, sku: true, images: true, price: true, costPrice: true,
      hsn: true, gstRate: true, invoicePrice: true, invoiceShipping: true, invoicePacking: true,
    },
  });
  const rows = sp.get("missing") === "1"
    ? products.filter(p => p.invoicePrice == null || p.gstRate == null || !p.hsn)
    : products;
  return NextResponse.json({
    products: rows,
    missingCount: products.filter(p => p.invoicePrice == null || p.gstRate == null || !p.hsn).length,
  });
}

// PATCH { productId, invoicePrice, invoiceShipping, invoicePacking, hsn, gstRate }
export async function PATCH(req: NextRequest) {
  if (!(await admin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const id = String(b.productId ?? "");
  const num = (v: unknown, name: string, max = 10000000) => {
    if (v === "" || v == null) return null;
    const n = Number(v);
    if (!isFinite(n) || n < 0 || n > max) throw new Error(`${name} must be a number between 0 and ${max}`);
    return Math.round(n * 100) / 100;
  };
  try {
    const invoicePrice = num(b.invoicePrice, "Product price");
    const invoiceShipping = num(b.invoiceShipping, "Shipping");
    const invoicePacking = num(b.invoicePacking, "Packing");
    const gstRate = num(b.gstRate, "GST rate", 28);
    const hsn = String(b.hsn ?? "").trim();
    if (hsn && !/^\d{4,8}$/.test(hsn)) throw new Error("HSN should be 4 to 8 digits");
    if (gstRate != null && ![0, 0.25, 3, 5, 12, 18, 28].includes(gstRate)) throw new Error("GST rate should be one of 0, 0.25, 3, 5, 12, 18, 28");
    const product = await prisma.product.update({
      where: { id },
      data: { invoicePrice, invoiceShipping, invoicePacking, gstRate, hsn: hsn || null },
      select: { id: true, invoicePrice: true, invoiceShipping: true, invoicePacking: true, gstRate: true, hsn: true },
    });
    return NextResponse.json({ product });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't save" }, { status: 400 });
  }
}
