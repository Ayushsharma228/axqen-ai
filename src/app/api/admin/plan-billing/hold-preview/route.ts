import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { holdAmountFor } from "@/lib/plan-billing";

// Before marking a payout paid: how much to transfer now and how much to hold for plan dues.
// GET ?sellerId=&amount=
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sellerId = req.nextUrl.searchParams.get("sellerId") ?? "";
  const amount = Number(req.nextUrl.searchParams.get("amount") ?? 0) || 0;
  if (!sellerId) return NextResponse.json({ error: "sellerId required" }, { status: 400 });
  const { hold, pending, alreadyHeld } = await holdAmountFor(sellerId, amount);
  return NextResponse.json({ hold, transfer: Math.max(0, Math.round((amount - hold) * 100) / 100), pending, alreadyHeld });
}
