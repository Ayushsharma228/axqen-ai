/**
 * Cron: plan-renewals (daily, 02:00 IST — see vercel.json)
 * Opens the next 3-month period for Marketplace sellers whose current period has ended.
 */
import { NextRequest, NextResponse } from "next/server";
import { createDueRenewals } from "@/lib/plan-billing";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await createDueRenewals());
}
