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

  // Default: pending unremitted DELIVERED orders only (RTO auto-deducts when remittance is scheduled)
  const [orders, configRows] = await Promise.all([
    prisma.order.findMany({
      where: {
        sellerId,
        remittedAt: null,
        status: "DELIVERED",
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
    const productCost    = parseFloat(o.productCost)    || 0;
    const shippingCharge = parseFloat(o.shippingCharge) || 0;
    const packingCharge  = parseFloat(o.packingCharge)  || 0;
    const net = o.orderAmount - productCost - shippingCharge - packingCharge;
    totalRemittance += net;
  }

  // Auto-settle pending RTO orders as a DEBIT alongside this remittance
  const pendingRtoOrders = await prisma.order.findMany({
    where: { sellerId, remittedAt: null, status: "RTO" },
    select: { id: true, productCost: true, rtoCharge: true, packingCharge: true },
  });
  const totalRtoDeduction = pendingRtoOrders.reduce(
    (s, o) => s + (o.productCost ?? 0) + (o.rtoCharge ?? 0) + (o.packingCharge ?? 0),
    0
  );

  const txNote = note || `Remittance for ${includedOrders.length} order(s)`;

  const tx = await prisma.walletTransaction.create({
    data: {
      sellerId,
      type: "CREDIT",
      amount: Math.abs(totalRemittance),
      note: txNote,
      remittanceDate: remittanceDate ? new Date(remittanceDate) : null,
      bankTxId: bankTxId?.trim() || null,
    },
  });

  // Create DEBIT transaction for RTO deductions if any pending RTO orders exist
  let rtoTx = null;
  if (pendingRtoOrders.length > 0 && totalRtoDeduction > 0) {
    rtoTx = await prisma.walletTransaction.create({
      data: {
        sellerId,
        type: "DEBIT",
        amount: totalRtoDeduction,
        note: `RTO Deduction for ${pendingRtoOrders.length} order(s)`,
        remittanceDate: remittanceDate ? new Date(remittanceDate) : null,
        bankTxId: bankTxId?.trim() || null,
      },
    });
    await prisma.order.updateMany({
      where: { id: { in: pendingRtoOrders.map((o) => o.id) } },
      data: { remittedAt: now, remittanceTxId: rtoTx.id },
    });
  }

  for (const o of includedOrders) {
    const productCost    = parseFloat(o.productCost)    || 0;
    const shippingCharge = parseFloat(o.shippingCharge) || 0;
    const packingCharge  = parseFloat(o.packingCharge)  || 0;

    await prisma.order.update({
      where: { id: o.id },
      data: {
        productCost,
        shippingCharge,
        packingCharge,
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
            productCost,
            shippingCharge,
            packingCharge,
            rtoCharge:      0,
            source:         orderRecord.source,
          });
          await prisma.settlement.create({
            data: {
              orderId:          o.id,
              sellerId:         orderRecord.sellerId,
              supplierId:       orderRecord.supplierId ?? undefined,
              marketplace:      orderRecord.source,
              sellingPrice:     breakdown.sellingPrice,
              productCost:      breakdown.productCost,
              shippingCharge:   breakdown.shippingCharge,
              packingCharge:    breakdown.packingCharge,
              platformFee:      breakdown.platformFee,
              gstOnFees:        breakdown.gstOnFees,
              codFee:           0,
              marketplaceFee:   0,
              adSpend:          0,
              rtoCharge:        0,
              otherDeductions:  0,
              grossProfit:      breakdown.grossProfit,
              netProfit:        breakdown.netProfit,
              netPayable:       breakdown.netPayable,
              platformEarnings: breakdown.platformEarnings,
              supplierPayable:  breakdown.supplierPayable,
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

  return NextResponse.json({ success: true, transaction: tx, totalRemittance, rtoDeduction: totalRtoDeduction, rtoOrderCount: pendingRtoOrders.length });
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
