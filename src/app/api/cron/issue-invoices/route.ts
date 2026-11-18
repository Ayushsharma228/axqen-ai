/**
 * Cron: issue-invoices (hourly, see vercel.json)
 * Issues an AXP tax invoice for every newly delivered order, dated its delivery date.
 */
import { NextRequest, NextResponse } from "next/server";
import { runInvoiceIssuing } from "@/lib/invoices";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runInvoiceIssuing(200));
}
