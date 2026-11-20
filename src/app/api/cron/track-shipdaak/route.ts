/**
 * Cron: track-shipdaak (every 2 hours, see vercel.json)
 * Shipdaak has no tracking webhooks, so active shipments are polled: every courier scan is saved,
 * order status moves forward only, NDR fields are raised. Orders whose AWB was typed in by hand are
 * checked too, and adopted as Shipdaak shipments when Shipdaak recognises the AWB.
 * Each run is recorded (PlatformConfig TRACK_SHIPDAAK_LAST_RUN) and shown in Admin → Shipments.
 */
import { NextRequest, NextResponse } from "next/server";
import { runShipdaakTracking } from "@/lib/shipdaak-sync";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runShipdaakTracking({ record: true });
  if (!result.configured) return NextResponse.json({ skipped: "Shipdaak not configured" });
  return NextResponse.json(result);
}
