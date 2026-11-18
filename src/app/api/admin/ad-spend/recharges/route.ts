import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Ad wallet top-ups a seller paid to AXQEN (offline). The seller's Ad Spend page shows balance = recharges − spend.
async function admin(req: NextRequest) {
  const s = await getRouteSession(req);
  return s?.user.role === "ADMIN" ? s : null;
}

export async function GET(req: NextRequest) {
  if (!(await admin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sellerId = req.nextUrl.searchParams.get("sellerId") || undefined;
  const recharges = await prisma.metaRecharge.findMany({
    where: sellerId ? { sellerId } : {},
    orderBy: { date: "desc" },
    take: 300,
    include: { seller: { select: { id: true, name: true, brandName: true, email: true } } },
  });
  return NextResponse.json({ recharges });
}

export async function POST(req: NextRequest) {
  const session = await admin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sellerId, date, amount, note } = await req.json() as { sellerId?: string; date?: string; amount?: string | number; note?: string };
  const value = Number(amount);
  if (!sellerId || !date || !isFinite(value) || value <= 0) {
    return NextResponse.json({ error: "Seller, date and a positive amount are required" }, { status: 400 });
  }
  const seller = await prisma.user.findFirst({ where: { id: sellerId, role: "SELLER" }, select: { id: true } });
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });

  const recharge = await prisma.metaRecharge.create({
    data: { sellerId, date: new Date(date), amount: value, note: (note?.trim() || `Recorded by ${session.user.name ?? "AXQEN team"}`).slice(0, 300) },
    include: { seller: { select: { id: true, name: true, brandName: true, email: true } } },
  });
  await prisma.notification.create({
    data: {
      userId: sellerId, type: "ORDER_UPDATE",
      title: "Ad wallet recharged",
      message: `₹${Math.round(value).toLocaleString("en-IN")} was added to your ad wallet.`,
      data: { rechargeId: recharge.id },
    },
  }).catch(() => {});
  return NextResponse.json({ recharge });
}

export async function DELETE(req: NextRequest) {
  if (!(await admin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json() as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const r = await prisma.metaRecharge.findUnique({ where: { id }, select: { razorpayPaymentId: true } });
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (r.razorpayPaymentId) return NextResponse.json({ error: "Online payments can't be deleted here" }, { status: 400 });
  await prisma.metaRecharge.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
