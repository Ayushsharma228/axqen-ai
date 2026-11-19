import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// READ-ONLY activation board: every seller's onboarding steps worked out live from their real data.
const STEPS = ["agreement", "business", "bank", "kyc", "shopify", "listingRequested", "listingLive", "firstOrder", "firstDelivery"] as const;
type Step = (typeof STEPS)[number];

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sellers = await prisma.user.findMany({
    where: { role: "SELLER" },
    select: {
      id: true, name: true, email: true, phone: true, brandName: true, businessName: true, businessAddress: true,
      bankAccount: true, bankHolder: true, bankIfsc: true, kycStatus: true, agreementAccepted: true,
      accountStatus: true, plan: true, createdAt: true, shopifyStore: { select: { createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const ids = sellers.map(s => s.id);

  const [requests, listed, mpLive, firstOrder, lastOrder, firstDelivered] = await Promise.all([
    prisma.listingRequest.groupBy({ by: ["sellerId"], where: { sellerId: { in: ids } }, _min: { createdAt: true } }),
    prisma.listingRequest.groupBy({ by: ["sellerId"], where: { sellerId: { in: ids }, status: "LISTED" }, _min: { updatedAt: true } }),
    prisma.marketplaceListing.findMany({ where: { status: "LIVE", listingRequest: { sellerId: { in: ids } } }, select: { listingRequest: { select: { sellerId: true } } } }),
    prisma.order.groupBy({ by: ["sellerId"], where: { sellerId: { in: ids } }, _min: { createdAt: true } }),
    prisma.order.groupBy({ by: ["sellerId"], where: { sellerId: { in: ids } }, _max: { createdAt: true } }),
    prisma.order.groupBy({ by: ["sellerId"], where: { sellerId: { in: ids }, status: "DELIVERED" }, _min: { createdAt: true } }),
  ]);
  const map = <T extends { sellerId: string }>(rows: T[]) => new Map(rows.map(r => [r.sellerId, r]));
  const reqM = map(requests), listM = map(listed), firstM = map(firstOrder), lastM = map(lastOrder), delM = map(firstDelivered);
  const mpSet = new Set(mpLive.map(m => m.listingRequest?.sellerId).filter(Boolean));
  const now = Date.now();

  const rows = sellers.map(s => {
    const done: Record<Step, boolean> = {
      agreement: s.agreementAccepted,
      business: !!(s.businessName && s.businessAddress),
      bank: !!(s.bankAccount && s.bankHolder && s.bankIfsc),
      kyc: s.kycStatus === "APPROVED",
      shopify: !!s.shopifyStore,
      listingRequested: reqM.has(s.id),
      listingLive: listM.has(s.id) || mpSet.has(s.id),
      firstOrder: firstM.has(s.id),
      firstDelivery: delM.has(s.id),
    };
    const next = STEPS.find(k => !done[k]) ?? null;
    // Most recent sign of progress we can date
    const dates = [s.createdAt, s.shopifyStore?.createdAt, reqM.get(s.id)?._min.createdAt, listM.get(s.id)?._min.updatedAt, lastM.get(s.id)?._max.createdAt]
      .filter(Boolean).map(d => (d as Date).getTime());
    const lastProgress = Math.max(...dates);
    const idleDays = Math.floor((now - lastProgress) / 86400000);
    return {
      id: s.id, name: s.name, email: s.email, phone: s.phone, brand: s.brandName || s.businessName || null,
      status: s.accountStatus, plan: s.plan, kyc: s.kycStatus, joined: s.createdAt.toISOString(),
      done, stepsDone: STEPS.filter(k => done[k]).length, next,
      activated: done.firstDelivery,
      stuck: !done.firstDelivery && idleDays >= 7 && s.accountStatus !== "SUSPENDED",
      idleDays,
      lastOrder: lastM.get(s.id)?._max.createdAt?.toISOString() ?? null,
    };
  });

  const funnel = STEPS.map(k => ({ step: k, count: rows.filter(r => r.done[k]).length }));
  return NextResponse.json({
    sellers: rows,
    funnel,
    summary: {
      total: rows.length,
      activated: rows.filter(r => r.activated).length,
      inProgress: rows.filter(r => !r.activated && r.status !== "SUSPENDED").length,
      stuck: rows.filter(r => r.stuck).length,
    },
  });
}
