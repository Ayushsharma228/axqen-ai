import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { buildActions, buildFacts, teamActivity } from "@/lib/seller-insights";
import { ASK_DAILY_LIMIT, askUsedToday } from "@/lib/ai-ask-quota";

// AI Intelligence: this week's actions (data-backed), what AXQEN did, and today's Ask allowance.
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sellerId = session.user.id;

  const [facts, activity, used] = await Promise.all([buildFacts(sellerId), teamActivity(sellerId, 30), askUsedToday(sellerId)]);
  const s = facts.summary;
  return NextResponse.json({
    actions: buildActions(facts),
    snapshot: {
      periodDays: facts.periodDays,
      netProfit: s.netProfit, revenue: s.revenue, delivered: s.delivered, rto: s.rto,
      rtoPct: s.rtoPct ?? null, margin: s.margin ?? null, costsMissing: s.costsMissing,
    },
    activity,
    ask: { used, limit: ASK_DAILY_LIMIT, remaining: Math.max(0, ASK_DAILY_LIMIT - used) },
  });
}
