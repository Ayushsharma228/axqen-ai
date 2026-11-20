import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { maskAadhaar } from "@/lib/encrypt";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let seller, orderStats, recentOrders, settlementAgg, recentSettlements, walletTxns, withdrawals, shopifyStore;
  try {
  [seller, orderStats, recentOrders, settlementAgg, recentSettlements, walletTxns, withdrawals, shopifyStore] =
    await Promise.all([
      // Full seller profile
      prisma.user.findUnique({
        where: { id },
        select: {
          id: true, name: true, email: true, phone: true, username: true,
          brandName: true, businessName: true, businessAddress: true, pincode: true,
          gstNumber: true, plan: true, planTier: true, accountStatus: true,
          kycStatus: true, aadhaarNumber: true, aadhaarDocUrl: true,
          onboardingDone: true, agreementAccepted: true, agreementAcceptedAt: true,
          paymentReference: true, paymentConfirmed: true, dataStartDate: true,
          bankName: true, bankHolder: true, bankAccount: true, bankIfsc: true,
          createdAt: true,
        },
      }),

      // Order counts by status
      prisma.order.groupBy({
        by: ["status"],
        where: { sellerId: id },
        _count: { id: true },
        _sum:   { totalAmount: true },
      }),

      // 10 most recent orders
      prisma.order.findMany({
        where:   { sellerId: id },
        orderBy: { createdAt: "desc" },
        take:    10,
        select:  {
          id: true, externalOrderId: true, status: true,
          totalAmount: true, createdAt: true, source: true,
          courier: true, awbNumber: true,
        },
      }),

      // Settlement aggregate
      prisma.settlement.aggregate({
        where:  { sellerId: id },
        _sum:   { sellingPrice: true, netPayable: true, platformFee: true, rtoCharge: true },
        _count: { id: true },
      }),

      // 10 most recent settlements
      prisma.settlement.findMany({
        where:   { sellerId: id },
        orderBy: { createdAt: "desc" },
        take:    10,
        select:  { id: true, orderId: true, status: true, sellingPrice: true, netPayable: true, createdAt: true },
      }),

      // Wallet transactions
      prisma.walletTransaction.findMany({
        where:   { sellerId: id },
        orderBy: { createdAt: "desc" },
        take:    20,
      }),

      // Withdrawal requests
      prisma.withdrawalRequest.findMany({
        where:   { sellerId: id },
        orderBy: { createdAt: "desc" },
        take:    10,
      }),

      // Shopify store
      prisma.shopifyStore.findFirst({
        where:  { sellerId: id },
        select: { storeUrl: true, storeName: true },
      }),
    ]);
  } catch (err) {
    console.error("[seller-detail]", err);
    return NextResponse.json({ error: "Failed to load seller data" }, { status: 500 });
  }

  if (!seller)
    return NextResponse.json({ error: "Seller not found" }, { status: 404 });

  // Compute order summary
  const totalOrders    = orderStats.reduce((s, r) => s + r._count.id, 0);
  const totalRevenue   = orderStats.reduce((s, r) => s + (r._sum.totalAmount ?? 0), 0);
  const deliveredCount = orderStats.find(r => r.status === "DELIVERED")?._count.id ?? 0;
  const rtoCount       = orderStats.find(r => r.status === "RTO")?._count.id       ?? 0;
  const cancelledCount = orderStats.find(r => r.status === "CANCELLED")?._count.id ?? 0;

  // Wallet balance (paid = bankTxId set)
  const paidTxns  = walletTxns.filter(t => t.bankTxId !== null);
  const balance   = paidTxns.reduce((acc, t) => t.type === "CREDIT" ? acc + t.amount : acc - t.amount, 0);
  const upcoming  = walletTxns.filter(t => t.bankTxId === null && t.remittanceDate !== null);
  const upcomingAmount = upcoming.filter(t => t.type === "CREDIT").reduce((s, t) => s + t.amount, 0);

  return NextResponse.json({
    seller: { ...seller, aadhaarNumber: maskAadhaar(seller.aadhaarNumber) },
    orderSummary: { totalOrders, totalRevenue, deliveredCount, rtoCount, cancelledCount, orderStats },
    recentOrders,
    settlementSummary: {
      count:        settlementAgg._count.id,
      grossRevenue: settlementAgg._sum.sellingPrice  ?? 0,
      netPayable:   settlementAgg._sum.netPayable    ?? 0,
      platformFee:  settlementAgg._sum.platformFee   ?? 0,
    },
    recentSettlements,
    wallet: { balance, upcomingAmount, transactions: walletTxns },
    withdrawals,
    shopifyStore,
  });
}
