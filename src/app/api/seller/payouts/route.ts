import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { payoutSummary } from "@/lib/seller-payouts";

// Seller payout overview: money pipeline + one row per payout (remittance) with its breakdown.
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sellerId = session.user.id;

  return NextResponse.json(await payoutSummary(sellerId));
}
