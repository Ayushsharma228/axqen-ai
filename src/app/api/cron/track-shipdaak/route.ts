/**
 * Cron: track-shipdaak (every 2 hours, see vercel.json)
 * Shipdaak has no tracking webhooks, so active Shipdaak shipments are polled:
 * every courier scan is saved, order status moves forward only, NDR fields are raised.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SHIPDAAK_COURIER_PREFIX, shipdaakConfigured } from "@/lib/shipdaak";
import { SHIPDAAK_SYNC_SELECT, syncShipdaakOrder } from "@/lib/shipdaak-sync";

const MAX_PER_RUN = 250;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!shipdaakConfigured()) return NextResponse.json({ skipped: "Shipdaak not configured" });

  const orders = await prisma.order.findMany({
    where: {
      awbNumber: { not: null },
      courier:   { startsWith: SHIPDAAK_COURIER_PREFIX },
      status:    { notIn: ["DELIVERED", "CANCELLED", "RTO", "HIDDEN"] as never[] },
    },
    select: SHIPDAAK_SYNC_SELECT,
    orderBy: { dispatchedAt: "asc" },
    take: MAX_PER_RUN,
  });

  let updated = 0;
  const errors: string[] = [];

  for (const o of orders) {
    try {
      if (await syncShipdaakOrder(o)) updated++;
    } catch (err) {
      errors.push(`${o.awbNumber}: ${err instanceof Error ? err.message : "track failed"}`);
    }
  }

  return NextResponse.json({ checked: orders.length, updated, errors: errors.slice(0, 20) });
}
