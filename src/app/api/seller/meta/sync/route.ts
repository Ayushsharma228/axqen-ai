import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Syncing 30 days of campaign spend can take a while on large accounts.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const seller = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { metaAccessToken: true, metaAdAccountId: true },
  });

  if (!seller?.metaAccessToken || !seller?.metaAdAccountId) {
    return NextResponse.json({ error: "Meta account not connected" }, { status: 400 });
  }

  try {
    const synced = await syncSellerAdSpend(session.user.id, seller.metaAdAccountId, seller.metaAccessToken);
    return NextResponse.json({ success: true, synced });
  } catch (err) {
    // Always answer with JSON so the page can show Meta's real reason (e.g. an expired token).
    const message = err instanceof Error ? err.message : "Meta sync failed";
    const expired = /session has expired|access token|OAuthException|Error validating/i.test(message);
    return NextResponse.json(
      { error: expired ? "Meta access has expired. Reconnect the ad account to resume syncing." : `Meta sync failed: ${message}` },
      { status: 502 },
    );
  }
}

export async function syncSellerAdSpend(sellerId: string, adAccountId: string, accessToken: string): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().split("T")[0];
  const untilStr = new Date().toISOString().split("T")[0];

  // Pull campaign-level daily spend so we can attribute per campaign
  const url = `https://graph.facebook.com/v19.0/${adAccountId}/insights?fields=campaign_id,campaign_name,spend,clicks,impressions,date_start&level=campaign&time_increment=1&time_range={"since":"${sinceStr}","until":"${untilStr}"}&access_token=${accessToken}`;

  // Follow Meta's paging so accounts with many campaigns are fully synced.
  type Row = { campaign_id: string; campaign_name: string; spend: string; clicks: string; impressions: string; date_start: string };
  const rows: Row[] = [];
  let next: string | null = url;
  for (let page = 0; next && page < 20; page++) {
    const res: Response = await fetch(next);
    const data = await res.json().catch(() => ({})) as { data?: Row[]; error?: { message?: string }; paging?: { next?: string } };
    if (!data.data || data.error) throw new Error(data.error?.message ?? `Meta API error (HTTP ${res.status})`);
    rows.push(...data.data);
    next = data.paging?.next ?? null;
  }

  const wanted = rows
    .map(r => ({
      date: new Date(r.date_start),
      campaignId: r.campaign_id,
      campaignName: r.campaign_name,
      amount: parseFloat(r.spend),
      clicks: parseInt(r.clicks ?? "0", 10),
      impressions: parseInt(r.impressions ?? "0", 10),
    }))
    .filter(r => r.amount > 0);
  if (!wanted.length) return 0;

  // One read for everything already stored in the window, then batched writes.
  const existing = await prisma.adSpend.findMany({
    where: { sellerId, date: { gte: new Date(sinceStr) }, campaignId: { in: [...new Set(wanted.map(w => w.campaignId))] } },
    select: { id: true, date: true, campaignId: true },
  });
  const byKey = new Map(existing.map(e => [`${e.campaignId}|${e.date.toISOString().slice(0, 10)}`, e.id]));
  const note = "Meta Ads (auto-synced)";

  const updates = wanted.filter(w => byKey.has(`${w.campaignId}|${w.date.toISOString().slice(0, 10)}`));
  const creates = wanted.filter(w => !byKey.has(`${w.campaignId}|${w.date.toISOString().slice(0, 10)}`));

  for (let i = 0; i < updates.length; i += 50) {
    await prisma.$transaction(updates.slice(i, i + 50).map(w => prisma.adSpend.update({
      where: { id: byKey.get(`${w.campaignId}|${w.date.toISOString().slice(0, 10)}`)! },
      data: { amount: w.amount, campaignName: w.campaignName, clicks: w.clicks, impressions: w.impressions, note },
    })));
  }
  if (creates.length) {
    await prisma.adSpend.createMany({
      data: creates.map(w => ({ sellerId, date: w.date, amount: w.amount, campaignId: w.campaignId, campaignName: w.campaignName, clicks: w.clicks, impressions: w.impressions, note })),
    });
  }

  const synced = wanted.length;
  return synced;
}
