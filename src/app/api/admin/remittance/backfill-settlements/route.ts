import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { calculateSettlement } from "@/lib/settlement-service";

// One-time backfill: create Settlement records for orders that were remitted
// before the remittance route started creating them automatically.
export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Find all orders that have been remitted but have no Settlement record
  const remittedOrders = await prisma.order.findMany({
    where: {
      remittedAt:     { not: null },
      remittanceTxId: { not: null },
    },
    select: {
      id: true, sellerId: true, supplierId: true, source: true,
      totalAmount: true, productCost: true, shippingCharge: true,
      packingCharge: true, rtoCharge: true, remittanceTxId: true,
      externalOrderId: true,
    },
  });

  let created = 0, skipped = 0, errors = 0;

  for (const order of remittedOrders) {
    const existing = await prisma.settlement.findUnique({ where: { orderId: order.id } });
    if (existing) { skipped++; continue; }

    try {
      const breakdown = await calculateSettlement({
        totalAmount:    order.totalAmount,
        productCost:    order.productCost    ?? 0,
        shippingCharge: order.shippingCharge ?? 50,
        packingCharge:  order.packingCharge  ?? 20,
        rtoCharge:      order.rtoCharge      ?? 0,
        source:         order.source,
      });

      await prisma.settlement.create({
        data: {
          orderId:          order.id,
          sellerId:         order.sellerId,
          supplierId:       order.supplierId ?? undefined,
          marketplace:      order.source,
          sellingPrice:     breakdown.sellingPrice,
          productCost:      breakdown.productCost,
          shippingCharge:   breakdown.shippingCharge,
          packingCharge:    breakdown.packingCharge,
          platformFee:      breakdown.platformFee,
          gstOnFees:        breakdown.gstOnFees,
          codFee:           0,
          marketplaceFee:   0,
          adSpend:          0,
          rtoCharge:        breakdown.rtoCharge,
          otherDeductions:  0,
          grossProfit:      breakdown.grossProfit,
          netProfit:        breakdown.netProfit,
          netPayable:       breakdown.netPayable,
          platformEarnings: breakdown.platformEarnings,
          supplierPayable:  breakdown.supplierPayable,
          walletTxId:       order.remittanceTxId,
          status:           "SETTLED",
        },
      });
      created++;
    } catch (err) {
      console.error("[backfill] failed for order", order.id, err);
      errors++;
    }
  }

  return NextResponse.json({ ok: true, created, skipped, errors, total: remittedOrders.length });
}
