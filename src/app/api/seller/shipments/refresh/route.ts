import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { runShipdaakTracking } from "@/lib/shipdaak-sync";

export const maxDuration = 120;

// Seller "Refresh tracking" for Shipdaak shipments (Delhivery-direct ones use /api/seller/deliveries/refresh-tracking).
export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const r = await runShipdaakTracking({ sellerId: session.user.id, limit: 60 });
  return NextResponse.json({ updated: r.updated, checked: r.checked });
}
