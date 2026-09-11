import { prisma } from "@/lib/prisma";
import { walletService } from "@/lib/wallet-service";
import { ledgerService } from "@/lib/ledger-service";
import { dispatchEvent } from "@/lib/automation/engine";

// ── Config helpers ────────────────────────────────────────────────────────────

async function getConfig(key: string, fallback: number): Promise<number> {
  try {
    const cfg = await prisma.platformConfig.findUnique({ where: { key } });
    if (cfg) return parseFloat(cfg.value) || fallback;
  } catch { /* ignore */ }
  return fallback;
}

// ── Calculation ───────────────────────────────────────────────────────────────

export interface SettlementBreakdown {
  sellingPrice:    number;
  productCost:     number;
  shippingCharge:  number;
  packingCharge:   number;
  platformFee:     number;
  gstOnFees:       number;
  codFee:          number;
  marketplaceFee:  number;
  adSpend:         number;
  rtoCharge:       number;
  otherDeductions: number;
  grossProfit:     number;
  netProfit:       number;
  netPayable:      number;  // what seller receives
  platformEarnings:number;  // what AXQEN keeps
  supplierPayable: number;  // what supplier is owed
}

export async function calculateSettlement(
  order: {
    totalAmount:    number;
    productCost:    number | null;
    shippingCharge: number | null;
    packingCharge:  number | null;
    rtoCharge:      number | null;
    source:         string;
  }
): Promise<SettlementBreakdown> {
  // Flat platform fee per delivered order. Default ₹20.
  const platformFeeFlat = await getConfig("PLATFORM_FEE", 20);
  const defaultShipping = await getConfig("DEFAULT_SHIPPING_CHARGE", 50);
  const defaultPacking  = await getConfig("DEFAULT_PACKING_CHARGE", 0);
  const gstRate         = await getConfig("GST_ON_FEES_RATE", 18);

  const sellingPrice   = order.totalAmount;
  const productCost    = order.productCost    ?? 0;
  const shippingCharge = order.shippingCharge ?? defaultShipping;
  const packingCharge  = order.packingCharge  ?? defaultPacking;
  const rtoCharge      = order.rtoCharge      ?? 0;

  const platformFee    = platformFeeFlat;
  const gstOnFees      = parseFloat(((platformFee * gstRate) / 100).toFixed(2));
  const codFee         = 0;        // COD fee not tracked per-order yet
  const marketplaceFee = 0;        // Amazon/Flipkart: 0 for now (direct settlement)
  const adSpend        = 0;        // no per-order ad attribution yet
  const otherDeductions= 0;

  const grossProfit    = sellingPrice - productCost;
  const totalDeductions =
    productCost + shippingCharge + packingCharge + platformFee +
    gstOnFees + codFee + marketplaceFee + adSpend + rtoCharge + otherDeductions;

  const netPayable     = parseFloat((sellingPrice - totalDeductions).toFixed(2));
  const netProfit      = netPayable; // seller's net = platform's output to seller
  const platformEarnings = parseFloat((platformFee - gstOnFees).toFixed(2));
  const supplierPayable  = productCost;

  return {
    sellingPrice,
    productCost,
    shippingCharge,
    packingCharge,
    platformFee,
    gstOnFees,
    codFee,
    marketplaceFee,
    adSpend,
    rtoCharge,
    otherDeductions,
    grossProfit,
    netProfit,
    netPayable,
    platformEarnings,
    supplierPayable,
  };
}

// ── Generate settlement for a delivered order ─────────────────────────────────

export async function generateSettlement(orderId: string): Promise<{ settlementId: string } | null> {
  // Idempotency: skip if settlement already exists
  const existing = await prisma.settlement.findUnique({ where: { orderId } });
  if (existing) return { settlementId: existing.id };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) throw new Error(`Order ${orderId} not found`);

  // Stamp resolved charge defaults onto the order if not already set
  const needsStamp = order.packingCharge == null || order.shippingCharge == null;
  if (needsStamp) {
    const stampedPacking  = order.packingCharge  ?? await getConfig("DEFAULT_PACKING_CHARGE",  20);
    const stampedShipping = order.shippingCharge ?? await getConfig("DEFAULT_SHIPPING_CHARGE", 50);
    await prisma.order.update({
      where: { id: orderId },
      data: {
        ...(order.packingCharge  == null ? { packingCharge:  stampedPacking  } : {}),
        ...(order.shippingCharge == null ? { shippingCharge: stampedShipping } : {}),
      },
    });
    // Use stamped values for breakdown so everything is consistent
    order.packingCharge  = order.packingCharge  ?? stampedPacking;
    order.shippingCharge = order.shippingCharge ?? stampedShipping;
  }

  const breakdown = await calculateSettlement(order);

  // Remittance date: 7 days from now (configurable)
  const remittanceDays = await getConfig("REMITTANCE_DAYS", 7);
  const remittanceDate = new Date();
  remittanceDate.setDate(remittanceDate.getDate() + remittanceDays);

  // Create wallet transaction for seller (upcoming credit)
  const walletTx = await walletService.creditSeller({
    sellerId: order.sellerId,
    amount:   breakdown.netPayable > 0 ? breakdown.netPayable : 0,
    orderId,
    note:     `Settlement for Order ${order.externalOrderId}`,
    remittanceDate,
  });

  // Create the settlement record
  const settlement = await prisma.settlement.create({
    data: {
      orderId,
      sellerId:        order.sellerId,
      supplierId:      order.supplierId ?? undefined,
      marketplace:     order.source,
      sellingPrice:    breakdown.sellingPrice,
      productCost:     breakdown.productCost,
      shippingCharge:  breakdown.shippingCharge,
      packingCharge:   breakdown.packingCharge,
      platformFee:     breakdown.platformFee,
      gstOnFees:       breakdown.gstOnFees,
      codFee:          breakdown.codFee,
      marketplaceFee:  breakdown.marketplaceFee,
      adSpend:         breakdown.adSpend,
      rtoCharge:       breakdown.rtoCharge,
      otherDeductions: breakdown.otherDeductions,
      grossProfit:     breakdown.grossProfit,
      netProfit:       breakdown.netProfit,
      netPayable:      breakdown.netPayable,
      platformEarnings:breakdown.platformEarnings,
      supplierPayable: breakdown.supplierPayable,
      walletTxId:      walletTx?.id ?? null,
      status:          "PENDING",
    },
  });

  // Update walletTx with settlementId (if the field exists)
  if (walletTx) {
    await prisma.walletTransaction.update({
      where: { id: walletTx.id },
      data:  { settlementId: settlement.id },
    });
  }

  // Create immutable ledger entries
  await ledgerService.recordSettlement({
    orderId,
    settlementId: settlement.id,
    sellerId:     order.sellerId,
    supplierId:   order.supplierId ?? undefined,
    breakdown,
  });

  // Create SupplierPayment if order has a supplier
  if (order.supplierId && breakdown.supplierPayable > 0) {
    const existingPmt = await prisma.supplierPayment.findUnique({ where: { orderId } });
    if (!existingPmt) {
      await prisma.supplierPayment.create({
        data: {
          supplierId: order.supplierId,
          orderId,
          amount:  breakdown.supplierPayable,
          status:  "PENDING",
          dueDate: remittanceDate,
        },
      });
    }
  }

  // Update order timeline
  await prisma.orderTimeline.create({
    data: {
      orderId,
      actorRole: "PLATFORM",
      event:     "SETTLEMENT_GENERATED",
      details:   `Settlement generated. Seller earnings: ₹${breakdown.netPayable}. Platform fee: ₹${breakdown.platformFee}.`,
      metadata:  { settlementId: settlement.id },
    },
  });

  dispatchEvent({ type: "SETTLEMENT_GENERATED", entityId: settlement.id, entityType: "SETTLEMENT",
                  payload: { orderId, sellerId: order.sellerId, netPayable: breakdown.netPayable } });

  return { settlementId: settlement.id };
}
