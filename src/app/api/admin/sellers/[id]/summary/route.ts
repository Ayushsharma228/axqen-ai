import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { computeProfit } from "@/lib/profit";
import { getBilling } from "@/lib/plan-billing";
import { payoutSummary } from "@/lib/seller-payouts";

// READ-ONLY 360° view of one seller for Admin → Sellers → [seller]. GET ?days=30|90 (omit for all time)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getRouteSession(req);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const days = Number(req.nextUrl.searchParams.get("days") ?? "") || null;

  const seller = await prisma.user.findFirst({
    where: { id, role: "SELLER" },
    select: {
      id: true, name: true, email: true, phone: true, username: true, brandName: true, businessName: true,
      businessAddress: true, city: true, state: true, pincode: true, gstNumber: true,
      plan: true, planTier: true, accountStatus: true, kycStatus: true, aadhaarNumber: true, aadhaarDocUrl: true,
      onboardingDone: true, agreementAccepted: true, agreementAcceptedAt: true,
      paymentReference: true, paymentConfirmed: true, dataStartDate: true,
      bankName: true, bankHolder: true, bankAccount: true, bankIfsc: true, createdAt: true,
      shopifyStore: { select: { storeName: true, storeUrl: true, createdAt: true } },
    },
  });
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });

  const [profit, billing, payouts, recentOrders, activation, invoiceCount] = await Promise.all([
    computeProfit(id, days),
    getBilling(id),
    payoutSummary(id),
    prisma.order.findMany({
      where: { sellerId: id, status: { not: "HIDDEN" } },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { id: true, externalOrderId: true, status: true, totalAmount: true, createdAt: true, source: true, courier: true, awbNumber: true, paymentMode: true, customerName: true },
    }),
    prisma.sellerActivation.findUnique({ where: { sellerId: id } }),
    prisma.invoice.groupBy({ by: ["status"], where: { sellerId: id }, _count: { id: true } }),
  ]);

  return NextResponse.json({
    seller: {
      ...seller,
      aadhaarNumber: seller.aadhaarNumber ? `XXXX XXXX ${seller.aadhaarNumber.replace(/\D/g, "").slice(-4)}` : null,
      bankAccount: seller.bankAccount ? `••••${seller.bankAccount.slice(-4)}` : null,
    },
    profit: { summary: profit.summary, byMonth: profit.byMonth, byProduct: profit.byProduct.slice(0, 8) },
    billing,
    payouts: { pipeline: payouts.pipeline, recent: payouts.payouts.slice(0, 8), since: payouts.since },
    recentOrders,
    activation,
    invoices: Object.fromEntries(invoiceCount.map(g => [g.status, g._count.id])),
  });
}
