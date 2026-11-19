import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { pincodeRto, type AreaLevel } from "@/lib/pincode-rto";

// READ-ONLY. RTO by pincode/city/state for one seller, for the admin seller page. GET ?days&level
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getRouteSession(req);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const days = Number(req.nextUrl.searchParams.get("days") ?? "") || null;
  const lv = req.nextUrl.searchParams.get("level");
  const level: AreaLevel = lv === "city" || lv === "state" ? lv : "pincode";
  const seller = await prisma.user.findFirst({ where: { id, role: "SELLER" }, select: { dataStartDate: true } });
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });
  return NextResponse.json(await pincodeRto(id, { days: days && days > 0 && days <= 730 ? days : null, dataStartDate: seller.dataStartDate, level }));
}
