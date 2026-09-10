import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { calculateSettlement } from "@/lib/settlement-service";

// GET: unremitted orders OR history
export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sellerId = searchParams.get("sellerId");
  if (!sellerId) return NextResponse.json({ error: "sellerId required" }, { status: 400 });

  const mode = searchParams.get("mode");

  if (mode === "history") {
    const transactions = await prisma.walletTransaction.findMany({
      where: { sellerId },
      orderBy: { createdAt: "desc" },
    });

    const history = await Promise.all(
      transactions.map(async (tx) => {
        const orders = await prisma.order.findMany({
          where: { sellerId, remittanceTxId: tx.id },
          select: {
            id: true,
            externalOrderId: true,
            customerName: true,
            status: true,
            courier: true,
            totalAmount: true,
            productCost: true,
            shippingCharge: true,
            packingCharge: true,
            rtoCharge: true,
          },
        });
        return { transaction: tx, orders };
      })
    );

    return NextResponse.json({ history });
  }

  // Default: pending unremitted orders + platform config defaults
  const [orders, configRows] = await Promise.all([
    prisma.order.findMany({
      where: {
        sellerId,
        remittedAt: null,
        OR: [{ status: "DELIVERED" }, { status: "RTO" }],
      },
      include: { items: { select: { name: true, quantity: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.platformConfig.findMany({
      where: { key: { in: ["DEFAULT_PACKING_CHARGE", "DEFAULT_SHIPPING_CHARGE"] } },
    }),
  ]);

  const configMap = Object.fromEntries(configRows.map((r) => [r.key, parseFloat(r.value)]));
  const defaults = {
    platformCharge: configMap["DEFAULT_PACKING_CHARGE"]  ?? 20,
    shippingCharge: configMap["DEFAULT_SHIPPING_CHARGE"] ?? 50,
  };

  return NextResponse.json({ orders, defaults });
}

// POST: create remittance (upcoming — not yet paid)
export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sellerId, orders, remittanceDate, note, bankTxId } = await req.json();

  if (!sellerId || !orders?.length) {
    return NextResponse.json({ error: "sellerId and orders required" }, { status: 400 });
  }

  const includedOrders = orders.filter((o: { include: boolean }) => o.include);
  if (!includedOrders.length) {
    return NextResponse.json({ error: "No orders selected" }, { status: 400 });
  }

  let totalRemittance = 0;
  const now = new Date();

  for (const o of includedOrders) {
    const isRTO = o.isRTO as boolean;
    const productCost = parseFloat(o.productCost) || 0;
    const shippingCharge = parseFloat(o.shippingCharge) || 0;
    const packingCharge = parseFloat(o.packingCharge) || 0;
    const rtoCharge = parseFloat(o.rtoCharge) || 0;
    const net = isRTO
      ? -(productCost + rtoCharge + packingCharge)
      : o.orderAmount - productCost - shippingCharge - packingCharge;
    totalRemittance += net;
  }

  const txType = totalRemittance >= 0 ? "CREDIT" : "DEBIT";
  const txNote = txType === "DEBIT"
    ? `RTO Deduction for ${includedOrders.length} order(s)`
    : (note || `Remittance for ${includedOrders.length} order(s)`);

  const tx = await prisma.walletTransaction.create({
    data: {
      sellerId,
      type: txType,
      amount: Math.abs(totalRemittance),
      note: txNote,
      remittanceDate: remittanceDate ? new Date(remittanceDate) : null,
      bankTxId: bankTxId?.trim() || null,
    },
  });

  for (const o of includedOrders) {
    const productCost    = parseFloat(o.productCost)    || 0;
    const shippingCharge = parseFloat(o.shippingCharge) || 0;
    const packingCharge  = parseFloat(o.packingCharge)  || 0;
    const rtoCharge      = parseFloat(o.rtoCharge)      || 0;
    const isRTO          = o.isRTO as boolean;

    await prisma.order.update({
      where: { id: o.id },
      data: {
        productCost,
        shippingCharge,
        packingCharge,
        rtoCharge,
        remittedAt: now,
        remittanceTxId: tx.id,
      },
    });

    // Create a Settlement record so the seller's breakdown view is populated
    const existingSettlement = await prisma.settlement.findUnique({ where: { orderId: o.id } });
    if (!existingSettlement) {
      try {
        const orderRecord = await prisma.order.findUnique({
          where: { id: o.id },
          select: { totalAmount: true, productCost: true, shippingCharge: true, packingCharge: true, rtoCharge: true, source: true, supplierId: true, sellerId: true, externalOrderId: true },
        });
        if (orderRecord) {
          const breakdown = await calculateSettlement({
            totalAmount:    orderRecord.totalAmount,
            productCost:    isRTO ? 0 : productCost,
            shippingCharge: isRTO ? 0 : shippingCharge,
            packingCharge,
            rtoCharge:      isRTO ? rtoCharge : 0,
            source:         orderRecord.source,
          });
          await prisma.settlement.create({
            data: {
              orderId:          o.id,
              sellerId:         orderRecord.sellerId,
              supplierId:       orderRecord.supplierId ?? undefined,
              marketplace:      orderRecord.source,
              sellingPrice:     isRTO ? 0 : breakdown.sellingPrice,
              productCost:      isRTO ? 0 : breakdown.productCost,
              shippingCharge:   isRTO ? 0 : breakdown.shippingCharge,
              packingCharge:    breakdown.packingCharge,
              platformFee:      isRTO ? 0 : breakdown.platformFee,
              gstOnFees:        isRTO ? 0 : breakdown.gstOnFees,
              codFee:           0,
              marketplaceFee:   0,
              adSpend:          0,
              rtoCharge:        isRTO ? rtoCharge : 0,
              otherDeductions:  0,
              grossProfit:      isRTO ? -(productCost + rtoCharge + packingCharge) : breakdown.grossProfit,
              netProfit:        isRTO ? -(productCost + rtoCharge + packingCharge) : breakdown.netProfit,
              netPayable:       isRTO ? -(productCost + rtoCharge + packingCharge) : breakdown.netPayable,
              platformEarnings: isRTO ? 0 : breakdown.platformEarnings,
              supplierPayable:  isRTO ? 0 : breakdown.supplierPayable,
              walletTxId:       tx.id,
              status:           "SETTLED",
            },
          });
        }
      } catch (err) {
        console.error("[remittance] settlement create failed for order", o.id, err);
      }
    }
  }

  return NextResponse.json({ success: true, transaction: tx, totalRemittance });
}

// DELETE: reset a remittance — un-remits linked orders so admin can recalculate
export async function DELETE(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const txId = searchParams.get("txId");
  if (!txId) return NextResponse.json({ error: "txId required" }, { status: 400 });

  const tx = await prisma.walletTransaction.findUnique({ where: { id: txId } });
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  if (tx.bankTxId) return NextResponse.json({ error: "Cannot reset a paid remittance" }, { status: 400 });

  await prisma.order.updateMany({
    where: { remittanceTxId: txId },
    data: { remittedAt: null, remittanceTxId: null },
  });

  await prisma.walletTransaction.delete({ where: { id: txId } });

  return NextResponse.json({ success: true });
}

// PATCH: mark remittance as paid with bank transaction ID
export async function PATCH(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { txId, bankTxId } = await req.json();
  if (!txId || !bankTxId?.trim()) {
    return NextResponse.json({ error: "txId and bankTxId required" }, { status: 400 });
  }

  const tx = await prisma.walletTransaction.update({
    where: { id: txId },
    data: { bankTxId: bankTxId.trim() },
  });

  return NextResponse.json({ success: true, transaction: tx });
}
