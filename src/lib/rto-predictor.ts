import { prisma } from "@/lib/prisma";

export type RtoRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";

export interface RtoScore {
  score: number;           // 0–100, higher = more likely to RTO
  level: RtoRiskLevel;
  addressScore: number;    // 0–40
  historyScore: number;    // 0–40
  paymentScore: number;    // 0–20
  signals: string[];       // human-readable reasons
  customerHistory: { delivered: number; rto: number; total: number } | null;
}

type AddressData = {
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
};

function scoreLevel(score: number): RtoRiskLevel {
  if (score >= 70) return "VERY_HIGH";
  if (score >= 45) return "HIGH";
  if (score >= 20) return "MEDIUM";
  return "LOW";
}

function scoreAddress(addr: AddressData): { score: number; signals: string[] } {
  let score = 0;
  const signals: string[] = [];

  const pincode = addr.pincode?.trim() ?? "";
  if (!pincode || pincode.length < 6) {
    score += 20;
    signals.push("Missing or invalid pincode");
  }

  const city = addr.city?.trim() ?? "";
  if (!city || city.length < 2) {
    score += 10;
    signals.push("Missing city");
  }

  const address = addr.address?.trim() ?? "";
  if (address.length < 15) {
    score += 10;
    signals.push("Address too short / incomplete");
  }

  const state = addr.state?.trim() ?? "";
  if (!state || state.length < 2) {
    score += 5;
    signals.push("Missing state");
  }

  return { score: Math.min(40, score), signals };
}

function computeHistoryScore(
  phone: string | undefined,
  historyMap: Map<string, { delivered: number; rto: number }>,
): { score: number; signals: string[]; history: { delivered: number; rto: number; total: number } | null } {
  if (!phone) return { score: 0, signals: [], history: null };
  const normalized = phone.replace(/\D/g, "").slice(-10);
  if (normalized.length < 8) return { score: 0, signals: [], history: null };

  const h = historyMap.get(normalized);
  if (!h) return { score: 0, signals: [], history: null };

  const total = h.delivered + h.rto;
  if (total === 0) return { score: 0, signals: [], history: null };

  const rtoRate = h.rto / total;
  let score = 0;
  const signals: string[] = [];

  if (rtoRate >= 0.7) {
    score = 40;
    signals.push(`High-risk customer: ${h.rto}/${total} past orders returned`);
  } else if (rtoRate >= 0.4) {
    score = 25;
    signals.push(`Moderate risk: ${h.rto}/${total} past orders returned`);
  } else if (rtoRate >= 0.2) {
    score = 12;
    signals.push(`${h.rto}/${total} past orders returned`);
  } else if (h.rto > 0) {
    score = 5;
    signals.push(`${h.rto} past RTO — mostly reliable customer`);
  }

  return { score, signals, history: { delivered: h.delivered, rto: h.rto, total } };
}

// Builds customer order history map from terminal orders (single DB query for batch efficiency)
async function buildHistoryMap(sellerId: string): Promise<Map<string, { delivered: number; rto: number }>> {
  const sixMonthsAgo = new Date(Date.now() - 180 * 86400000);
  const terminalOrders = await prisma.order.findMany({
    where: {
      sellerId,
      status: { in: ["DELIVERED", "RTO"] },
      createdAt: { gte: sixMonthsAgo },
    },
    select: { customerAddress: true, status: true },
    take: 10000,
  });

  const map = new Map<string, { delivered: number; rto: number }>();
  for (const o of terminalOrders) {
    const addr = o.customerAddress as AddressData | null;
    const phone = addr?.phone?.replace(/\D/g, "").slice(-10);
    if (!phone || phone.length < 8) continue;
    const existing = map.get(phone) ?? { delivered: 0, rto: 0 };
    if (o.status === "DELIVERED") existing.delivered++;
    else existing.rto++;
    map.set(phone, existing);
  }
  return map;
}

// Batch score many orders at once — one DB round trip per call
export async function batchPredictRtoRisk(
  orderIds: string[],
  sellerId: string,
): Promise<Record<string, RtoScore>> {
  if (orderIds.length === 0) return {};

  const [orders, historyMap] = await Promise.all([
    prisma.order.findMany({
      where: { id: { in: orderIds }, sellerId },
      select: { id: true, customerAddress: true, paymentMode: true },
    }),
    buildHistoryMap(sellerId),
  ]);

  const result: Record<string, RtoScore> = {};
  for (const order of orders) {
    const addr = (order.customerAddress ?? {}) as AddressData;
    const addrResult = scoreAddress(addr);
    const hist = computeHistoryScore(addr.phone, historyMap);
    const payScore = order.paymentMode === "COD" ? 20 : 0;
    const paySignals = order.paymentMode === "COD" ? ["Cash on delivery (higher RTO risk)"] : [];
    const total = Math.min(100, addrResult.score + hist.score + payScore);

    result[order.id] = {
      score: total,
      level: scoreLevel(total),
      addressScore: addrResult.score,
      historyScore: hist.score,
      paymentScore: payScore,
      signals: [...addrResult.signals, ...hist.signals, ...paySignals],
      customerHistory: hist.history,
    };
  }

  return result;
}
