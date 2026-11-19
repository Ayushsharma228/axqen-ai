import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { pincodeRto, type AreaLevel } from "@/lib/pincode-rto";

// Signed-in seller's own RTO stats per delivery pincode. GET ?days=30|90 (omit for all time)&level=pincode|city|state
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const days = Number(req.nextUrl.searchParams.get("days") ?? "") || null;
  const lv = req.nextUrl.searchParams.get("level");
  const level: AreaLevel = lv === "city" || lv === "state" ? lv : "pincode";
  const seller = await prisma.user.findUnique({ where: { id: session.user.id }, select: { dataStartDate: true } });
  const data = await pincodeRto(session.user.id, { days: days && days > 0 && days <= 730 ? days : null, dataStartDate: seller?.dataStartDate ?? null, level });
  return NextResponse.json(data);
}
