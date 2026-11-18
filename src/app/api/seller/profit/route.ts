import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { computeProfit } from "@/lib/profit";

// Profit & Analytics. GET ?days=30|90|180|365 (omit = all time). Rules live in src/lib/profit.ts.
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const days = Number(req.nextUrl.searchParams.get("days") ?? "") || null;
  return NextResponse.json(await computeProfit(session.user.id, days));
}
