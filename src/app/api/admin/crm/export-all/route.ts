import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// READ-ONLY full CRM export for admins. GET → every lead with every field (CSV).
// GET ?type=activity → the full call/note/activity history of every lead (CSV).
const esc = (v: unknown) => {
  if (v == null) return "";
  const s = v instanceof Date ? v.toISOString().replace("T", " ").slice(0, 16) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function csv<T>(cols: [string, (r: T) => unknown][], rows: T[]) {
  return "﻿" + [cols.map(c => c[0]).join(","), ...rows.map(r => cols.map(c => esc(c[1](r))).join(","))].join("\r\n");
}
const file = (body: string, name: string) => new NextResponse(body, {
  headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
});

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (req.nextUrl.searchParams.get("type") === "activity") {
    const acts = await prisma.leadActivity.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } }, lead: { select: { name: true, phone: true } } },
    });
    type A = (typeof acts)[number];
    return file(csv<A>([
      ["Date", a => a.createdAt], ["Lead name", a => a.lead.name], ["Lead phone", a => a.lead.phone],
      ["Type", a => a.type], ["Content", a => a.content], ["By", a => a.user?.name], ["Lead ID", a => a.leadId],
    ], acts), "axqen-crm-lead-activity");
  }

  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      assignedTo: { select: { name: true } },
      createdBy: { select: { name: true } },
      activities: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { activities: true } },
    },
  });
  type L = (typeof leads)[number];
  return file(csv<L>([
    ["Created", l => l.createdAt], ["Name", l => l.name], ["Phone", l => l.phone], ["Email", l => l.email], ["City", l => l.city],
    ["Source", l => l.source], ["Stage", l => l.stage], ["Pipeline stage", l => l.pipelineStage], ["Not interested", l => (l.isNI ? "Yes" : "")],
    ["Temperature", l => l.temperature], ["Lead score", l => l.leadScore], ["Investment", l => l.investment], ["Budget", l => l.budget],
    ["Business stage", l => l.businessStage], ["Timeline", l => l.timeline], ["Marketplace", l => l.marketplace], ["Biggest challenge", l => l.biggestChallenge],
    ["Campaign", l => l.campaign], ["Ad set", l => l.adSet], ["Recommended plan", l => l.recommendedPlan], ["Qualification summary", l => l.qualificationSummary],
    ["Follow-up date", l => l.followUpDate], ["Sales call booked", l => l.salesCallBookedAt], ["Sales call notes", l => l.salesCallNotes],
    ["Notes", l => l.notes], ["Assigned to", l => l.assignedTo?.name], ["Created by", l => l.createdBy?.name],
    ["Activities", l => l._count.activities],
    ["Last activity", l => (l.activities[0] ? `${l.activities[0].createdAt.toISOString().slice(0, 10)} ${l.activities[0].type}: ${l.activities[0].content ?? ""}` : "")],
    ["Updated", l => l.updatedAt], ["Lead ID", l => l.id],
  ], leads), "axqen-crm-leads");
}
