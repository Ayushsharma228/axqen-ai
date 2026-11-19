import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { pincodeRto, type AreaLevel } from "@/lib/pincode-rto";

// READ-ONLY. RTO by pincode/city/state across all sellers, for the admin dashboard. GET ?days&level
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const days = Number(req.nextUrl.searchParams.get("days") ?? "") || null;
  const lv = req.nextUrl.searchParams.get("level");
  const level: AreaLevel = lv === "city" || lv === "state" ? lv : "pincode";
  return NextResponse.json(await pincodeRto(null, { days: days && days > 0 && days <= 730 ? days : null, dataStartDate: null, level }));
}
