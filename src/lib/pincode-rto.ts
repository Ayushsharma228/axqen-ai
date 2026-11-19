import { prisma } from "@/lib/prisma";

/** A pincode only appears once it has this many delivered + RTO orders. */
export const PINCODE_MIN_ORDERS = 5;

export interface PincodeRow {
  pincode: string;
  city: string | null;
  state: string | null;
  orders: number;      // delivered + RTO
  delivered: number;
  rto: number;
  pct: number;         // RTO % of completed orders
  loss: number;        // same RTO loss formula as Profit & Analytics: product + return charge + packing
  costsMissing: number;
}

type Addr = { pincode?: string; zip?: string; city?: string; state?: string; province?: string };

/**
 * RTO stats per delivery pincode for ONE seller, over completed orders only
 * (DELIVERED or RTO). Read-only.
 */
export async function pincodeRto(sellerId: string, opts: { days: number | null; dataStartDate: Date | null }) {
  const since = opts.days ? new Date(Date.now() - opts.days * 86400000) : null;
  const from = since && opts.dataStartDate ? (since > opts.dataStartDate ? since : opts.dataStartDate) : since ?? opts.dataStartDate;

  const orders = await prisma.order.findMany({
    where: { sellerId, status: { in: ["DELIVERED", "RTO"] }, ...(from ? { createdAt: { gte: from } } : {}) },
    select: { status: true, customerAddress: true, productCost: true, rtoCharge: true, packingCharge: true },
    orderBy: { createdAt: "desc" },
    take: 25000,
  });

  const map = new Map<string, PincodeRow>();
  let delivered = 0, rto = 0, noPincode = 0;
  for (const o of orders) {
    const isRto = o.status === "RTO";
    if (isRto) rto++; else delivered++;
    const a = (o.customerAddress ?? {}) as Addr;
    const pin = String(a.pincode ?? a.zip ?? "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(pin)) { noPincode++; continue; }
    const row = map.get(pin) ?? {
      pincode: pin, city: a.city?.trim() || null, state: (a.state ?? a.province)?.trim() || null,
      orders: 0, delivered: 0, rto: 0, pct: 0, loss: 0, costsMissing: 0,
    };
    row.orders++;
    if (isRto) {
      row.rto++;
      row.loss += (o.productCost ?? 0) + (o.rtoCharge ?? 0) + (o.packingCharge ?? 0);
      if (o.productCost == null) row.costsMissing++;
    } else row.delivered++;
    map.set(pin, row);
  }

  const rows = [...map.values()].map(r => ({ ...r, pct: Math.round((r.rto / r.orders) * 100), loss: Math.round(r.loss) }));
  const eligible = rows.filter(r => r.orders >= PINCODE_MIN_ORDERS);

  return {
    minOrders: PINCODE_MIN_ORDERS,
    completed: delivered + rto,
    overallPct: delivered + rto ? Math.round((rto / (delivered + rto)) * 100) : null,
    pincodes: map.size,
    eligiblePincodes: eligible.length,
    noPincode,
    worst: eligible.filter(r => r.rto > 0).sort((a, b) => b.pct - a.pct || b.rto - a.rto).slice(0, 10),
    best: [...eligible].sort((a, b) => a.pct - b.pct || b.delivered - a.delivered).slice(0, 10),
  };
}
