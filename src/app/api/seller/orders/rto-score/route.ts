import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { batchPredictRtoRisk } from "@/lib/rto-predictor";

export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { orderIds?: string[] };
  if (!Array.isArray(body.orderIds) || body.orderIds.length === 0)
    return NextResponse.json({ scores: {} });

  const ids = body.orderIds.slice(0, 200);
  const scores = await batchPredictRtoRisk(ids, session.user.id);
  return NextResponse.json({ scores });
}
