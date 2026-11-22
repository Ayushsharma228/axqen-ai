import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { RTO_RECEIVED, RTO_OVERDUE_DAYS } from "@/lib/rto";
import { payableOf } from "@/lib/plan-billing";

// Small read-only counts for the admin sidebar badges.
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const day = 86400000;

  const [kyc, calling, ndr, rto, listings, invoices, support, duePeriods] = await Promise.all([
    // KYC submitted, waiting for review
    prisma.user.count({ where: { role: "SELLER", kycStatus: "SUBMITTED" } }),
    // New orders the team is still confirming
    prisma.order.count({ where: { status: "NEW" } }),
    // Failed deliveries with no action yet (same as the NDR page's Pending tab)
    prisma.order.count({ where: { ndrStatus: { not: null }, ndrActionTaken: null } }),
    // Returns not marked received 15+ days after going RTO (last 60 days only, so old history doesn't pile up)
    prisma.order.count({
      where: {
        status: "RTO",
        updatedAt: { lt: new Date(now.getTime() - RTO_OVERDUE_DAYS * day), gte: new Date(now.getTime() - 60 * day) },
        timeline: { none: { eventType: RTO_RECEIVED } },
      },
    }),
    prisma.listingRequest.count({ where: { status: "PENDING" } }),
    prisma.invoice.count({ where: { status: "HELD" } }),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    // Plan periods past their due date
    prisma.planPeriod.findMany({ where: { dueDate: { lt: now } }, select: { id: true, sellerId: true, amountDue: true, discount: true } }),
  ]);

  // Sellers whose overdue periods still have money pending
  let plan = 0;
  if (duePeriods.length) {
    const paid = await prisma.planPayment.groupBy({
      by: ["periodId"], where: { periodId: { in: duePeriods.map(p => p.id) } }, _sum: { amount: true },
    });
    const paidBy = new Map(paid.map(p => [p.periodId, p._sum.amount ?? 0]));
    plan = new Set(duePeriods.filter(p => payableOf(p) - (paidBy.get(p.id) ?? 0) > 0.5).map(p => p.sellerId)).size;
  }

  return NextResponse.json({ kyc, plan, calling, ndr, rto, listings, invoices, support });
}
