import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncSellerAdSpend } from "@/app/api/seller/meta/sync/route";
import { reportError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sellers = await prisma.user.findMany({
    where: {
      metaAccessToken:  { not: null },
      metaAdAccountId:  { not: null },
      metaTokenExpiresAt: { gt: new Date() },
    },
    select: { id: true, metaAccessToken: true, metaAdAccountId: true },
  });

  const results: { sellerId: string; synced?: number; error?: string }[] = [];

  for (const seller of sellers) {
    try {
      const synced = await syncSellerAdSpend(seller.id, seller.metaAdAccountId!, seller.metaAccessToken!);
      results.push({ sellerId: seller.id, synced });
    } catch (err) {
      results.push({ sellerId: seller.id, error: err instanceof Error ? err.message : "Unknown error" });
      await reportError("cron sync-meta-ads", err, `seller ${seller.id}`);
    }
  }

  return NextResponse.json({ ok: true, processed: sellers.length, results });
}
