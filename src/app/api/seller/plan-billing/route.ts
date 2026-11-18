import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { getBilling } from "@/lib/plan-billing";

// The signed-in seller's plan dues, payments and payout holds (read-only).
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getBilling(session.user.id));
}
