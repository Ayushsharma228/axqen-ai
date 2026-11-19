import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

// Admin add / edit products. Products added here are approved straight away and belong to the
// AXQEN team's own supplier account (chosen once, remembered in PlatformConfig).
const HOUSE_KEY = "HOUSE_SUPPLIER_ID";
const GST_RATES = [0, 5, 12, 18, 28];

async function admin(req: NextRequest) {
  const s = await getRouteSession(req);
  return s?.user.role === "ADMIN" ? s : null;
}

// GET → supplier accounts a product can belong to, and the remembered default
export async function GET(req: NextRequest) {
  if (!(await admin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [suppliers, house, counts] = await Promise.all([
    prisma.user.findMany({ where: { role: "SUPPLIER" }, select: { id: true, name: true, email: true }, orderBy: { createdAt: "asc" } }),
    prisma.platformConfig.findUnique({ where: { key: HOUSE_KEY } }),
    prisma.product.groupBy({ by: ["supplierId"], _count: { id: true } }),
  ]);
  const byCount = new Map(counts.map(c => [c.supplierId, c._count.id]));
  const fallback = [...suppliers].sort((a, b) => (byCount.get(b.id) ?? 0) - (byCount.get(a.id) ?? 0))[0]?.id ?? null;
  return NextResponse.json({
    suppliers: suppliers.map(s => ({ ...s, products: byCount.get(s.id) ?? 0 })),
    houseSupplierId: house && suppliers.some(s => s.id === house.value) ? house.value : fallback,
  });
}

function num(v: FormDataEntryValue | null, int = false): number | null {
  if (v == null || String(v).trim() === "") return null;
  const n = int ? parseInt(String(v), 10) : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}
function str(v: FormDataEntryValue | null): string | null {
  const s = v == null ? "" : String(v).trim();
  return s || null;
}

async function readFields(fd: FormData) {
  const name = str(fd.get("name"));
  const sku = str(fd.get("sku"))?.toUpperCase() ?? null;
  const price = num(fd.get("price"));
  const gstRate = num(fd.get("gstRate"));
  const hsn = str(fd.get("hsn"))?.replace(/\D/g, "") || null;
  if (!name) throw new Error("Add a product name");
  if (!sku || sku.length !== 10) throw new Error("SKU must be exactly 10 characters");
  if (price == null || price <= 0) throw new Error("Add the catalogue price sellers see");
  if (gstRate != null && !GST_RATES.includes(gstRate)) throw new Error("GST rate should be 0, 5, 12, 18 or 28");
  if (hsn && (hsn.length < 4 || hsn.length > 8)) throw new Error("HSN should be 4 to 8 digits");
  const stock = num(fd.get("stock"), true);
  return {
    name, sku, price, hsn, gstRate,
    description: str(fd.get("description")) ?? "",
    category: str(fd.get("category")),
    costPrice: num(fd.get("costPrice")),
    suggestedPrice: num(fd.get("suggestedPrice")),
    invoicePrice: num(fd.get("invoicePrice")),
    invoiceShipping: num(fd.get("invoiceShipping")),
    invoicePacking: num(fd.get("invoicePacking")),
    stock: stock == null ? 0 : Math.max(0, stock),
    moq: num(fd.get("moq"), true),
    weight: num(fd.get("weight")),
    length: num(fd.get("length")),
    width: num(fd.get("width")),
    height: num(fd.get("height")),
  };
}

async function uploads(fd: FormData) {
  const urls: string[] = [];
  for (const f of fd.getAll("images") as File[]) {
    if (f && typeof f === "object" && f.size > 0) {
      if (!f.type.startsWith("image/")) throw new Error("Images must be image files");
      if (f.size > 8 * 1024 * 1024) throw new Error("Each image should be under 8 MB");
      urls.push(await uploadImageToCloudinary(f));
    }
  }
  return urls;
}

// POST multipart → add a product
export async function POST(req: NextRequest) {
  if (!(await admin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const fd = await req.formData();
    const data = await readFields(fd);
    const ownerId = str(fd.get("ownerId"));
    const owner = ownerId ? await prisma.user.findFirst({ where: { id: ownerId, role: "SUPPLIER" }, select: { id: true } }) : null;
    if (!owner) throw new Error("Pick the account the product belongs to");
    if (await prisma.product.findUnique({ where: { sku: data.sku }, select: { id: true } })) throw new Error("That SKU is already used by another product");
    const images = await uploads(fd);
    const product = await prisma.product.create({ data: { ...data, supplierId: owner.id, images, status: "APPROVED" }, select: { id: true } });
    await prisma.platformConfig.upsert({
      where: { key: HOUSE_KEY }, update: { value: owner.id }, create: { key: HOUSE_KEY, value: owner.id, label: "Account that admin-added products belong to" },
    });
    return NextResponse.json({ ok: true, id: product.id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't add the product" }, { status: 400 });
  }
}

// PATCH multipart → edit a product. Fields: same as POST + id, keepImages (JSON array of existing image URLs to keep)
export async function PATCH(req: NextRequest) {
  if (!(await admin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const fd = await req.formData();
    const id = str(fd.get("id"));
    const current = id ? await prisma.product.findUnique({ where: { id }, select: { id: true, images: true } }) : null;
    if (!current) throw new Error("Product not found");
    const data = await readFields(fd);
    const clash = await prisma.product.findUnique({ where: { sku: data.sku }, select: { id: true } });
    if (clash && clash.id !== current.id) throw new Error("That SKU is already used by another product");
    let keep: string[] = current.images;
    const raw = fd.get("keepImages");
    if (raw != null) {
      const parsed = JSON.parse(String(raw));
      if (!Array.isArray(parsed)) throw new Error("Invalid image list");
      keep = current.images.filter(u => parsed.includes(u)); // only images the product already has
    }
    const images = [...keep, ...(await uploads(fd))];
    await prisma.product.update({ where: { id: current.id }, data: { ...data, images } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't save the product" }, { status: 400 });
  }
}
