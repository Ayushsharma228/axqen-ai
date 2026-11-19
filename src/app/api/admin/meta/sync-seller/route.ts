import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { syncSellerAdSpend } from "@/app/api/seller/meta/sync/route";

export const maxDuration = 60;

// POST { sellerId } → pull the last 30 days of spend from that seller's connected Meta ad account now
// (the same sync the daily cron runs).
export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sellerId } = await req.json().catch(() => ({})) as { sellerId?: string };
  if (!sellerId) return NextResponse.json({ error: "sellerId required" }, { status: 400 });

  const seller = await prisma.user.findFirst({
    where: { id: sellerId, role: "SELLER" },
    select: { metaAccessToken: true, metaAdAccountId: true, metaTokenExpiresAt: true },
  });
  if (!seller?.metaAccessToken || !seller.metaAdAccountId) return NextResponse.json({ error: "This seller hasn't connected a Meta ad account" }, { status: 400 });
  if (seller.metaTokenExpiresAt && seller.metaTokenExpiresAt < new Date()) return NextResponse.json({ error: "The seller's Meta connection has expired. They need to reconnect from their Ad Spend page." }, { status: 400 });

  try {
    const synced = await syncSellerAdSpend(sellerId, seller.metaAdAccountId, seller.metaAccessToken);
    return NextResponse.json({ ok: true, synced });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ error: /session has expired|access token|OAuthException|Error validating/i.test(message) ? "Meta rejected the seller's token. They need to reconnect from their Ad Spend page." : message }, { status: 502 });
  }
}
