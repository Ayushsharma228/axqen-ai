import { prisma } from "@/lib/prisma";

export type RtoRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";

export interface RtoScore {
  score: number;           // 0–100
  level: RtoRiskLevel;
  breakdown: {
    phone:    number;      // 0–30
    address:  number;      // 0–40
    pincode:  number;      // 0–20
    history:  number;      // 0–35
    velocity: number;      // 0–10
    payment:  number;      // 0–20
  };
  signals: string[];
  customerHistory: { delivered: number; rto: number; total: number } | null;
  pincodeStats:    { rtoRate: number; sampleSize: number } | null;
}

type AddressData = {
  address?:  string;   // full address line (legacy + fallback)
  houseNo?:  string;   // house / flat / plot number
  street?:   string;   // road / lane / colony / sector
  landmark?: string;   // near / opp / behind reference
  city?:     string;
  state?:    string;
  pincode?:  string;
  phone?:    string;
};

// Score thresholds  (LOW < 30 ≤ MEDIUM < 70 ≤ HIGH < 85 ≤ VERY_HIGH)
function scoreLevel(score: number): RtoRiskLevel {
  if (score >= 85) return "VERY_HIGH";
  if (score >= 70) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

// ── 1. Phone validation (0–30) ──────────────────────────────────────────────

const FAKE_PHONE_RE = [
  /^(\d)\1{9}$/,       // 9999999999, 0000000000 …
  /^1234567890$/,
  /^0987654321$/,
  /^12345678(9|90?)$/, // partial sequences
];

function scorePhone(phone: string | undefined): { score: number; signals: string[] } {
  if (!phone) return { score: 0, signals: [] };
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return { score: 20, signals: ["Phone number too short"] };
  const last10 = digits.slice(-10);
  if (FAKE_PHONE_RE.some(p => p.test(last10)))
    return { score: 30, signals: ["Suspicious phone — repeated/sequential digits"] };
  // Indian mobiles start with 6–9
  if (!/^[6-9]/.test(last10))
    return { score: 20, signals: ["Not a valid Indian mobile number"] };
  return { score: 0, signals: [] };
}

// ── 2. Address quality (0–35) ───────────────────────────────────────────────
// Checks 5 explicit components — uses structured fields first, falls back to
// parsing the raw `address` text for backward compatibility with old orders.

// House / flat / plot number — requires an explicit keyword or unambiguous format.
// Intentionally strict: bare numbers like "5" in "Sector 5" or "Phase 3" must NOT match.
const HOUSE_NO_RE =
  /\b(h\.?\s*no\.?|house\s*no\.?|flat\s*no?\.?|f\.?\s*no\.?|plot\s*no?\.?|door\s*no?\.?|d\.?\s*no\.?|apt\.?\s*no?\.?|apartment\s*no?\.?|room\s*no?\.?|villa\s*no?\.?|bungalow\s*no?\.?|\d{1,4}\s*[\/\-]\s*\d{1,4}|\d{1,4}[A-Za-z](?=[\s,]|$)|#\s*\d{1,4}|\bflat\b|\bapartment\b|\bbungalow\b)/i;

// Street / locality identifiers
const STREET_RE =
  /(gali|gully|lane|nagar|colony|society|sector|block|ward|mohalla|basti|phase|extension|enclave|layout|township|marg|road|street|chowk|bazaar|market)/i;

// Landmark / proximity identifiers
const LANDMARK_RE =
  /(near|opp(osite)?|behind|above|below|next\s*to|beside|in\s*front\s*of|adjacent|landmark)/i;

function scoreAddress(addr: AddressData): { score: number; signals: string[]; missingHouseNo: boolean } {
  let score = 0;
  const signals: string[] = [];
  const fullText = addr.address?.trim() ?? "";

  // ── Very short / blank address — catch-all before individual checks ─────────
  if (fullText.length < 8 && !addr.houseNo && !addr.street) {
    return {
      score: 35,
      signals: ["Incomplete address — very short or blank"],
      missingHouseNo: true,
    };
  }

  // ── Pincode ────────────────────────────────────────────────────────────────
  const pincode = addr.pincode?.trim() ?? "";
  if (!pincode || !/^\d{6}$/.test(pincode)) {
    score += 12;
    signals.push("Missing or invalid pincode");
  }

  // ── City ───────────────────────────────────────────────────────────────────
  const city = addr.city?.trim() ?? "";
  if (!city || city.length < 2) {
    score += 5;
    signals.push("Missing city");
  }

  // ── State ──────────────────────────────────────────────────────────────────
  if (!addr.state?.trim()) {
    score += 2;
    signals.push("Missing state");
  }

  // ── House number (hard signal — missing alone forces MEDIUM floor) ─────────
  // Weight raised: no house no + no street = 18+12 = 30 → MEDIUM on its own
  const hasHouseNo = addr.houseNo?.trim()
    ? addr.houseNo.trim().length > 0
    : HOUSE_NO_RE.test(fullText);
  if (!hasHouseNo) {
    score += 18;
    signals.push("Incomplete address — house / flat number missing");
  }

  // ── Street address ─────────────────────────────────────────────────────────
  const streetValue = addr.street?.trim() ?? "";
  const hasStreet = streetValue.length > 0
    ? true
    : fullText.length >= 10 && STREET_RE.test(fullText);
  if (!hasStreet) {
    score += 12;
    signals.push("Missing street / locality name");
  }

  // ── Landmark ───────────────────────────────────────────────────────────────
  const landmarkValue = addr.landmark?.trim() ?? "";
  const hasLandmark = landmarkValue.length > 0
    ? true
    : LANDMARK_RE.test(fullText);
  if (!hasLandmark) {
    score += 5;
    signals.push("No landmark or nearby reference");
  }

  return { score: Math.min(40, score), signals, missingHouseNo: !hasHouseNo };
}

// ── 3. Pin code RTO rate (0–20) ─────────────────────────────────────────────

function scorePincode(
  pincode: string | undefined,
  pincodeMap: Map<string, { delivered: number; rto: number }>,
): { score: number; signals: string[]; stats: { rtoRate: number; sampleSize: number } | null } {
  if (!pincode || !/^\d{6}$/.test(pincode.trim()))
    return { score: 0, signals: [], stats: null };

  const h = pincodeMap.get(pincode.trim());
  if (!h) return { score: 0, signals: [], stats: null };

  const total = h.delivered + h.rto;
  if (total < 3) return { score: 0, signals: [], stats: null }; // too little data

  const rate = h.rto / total;
  let score = 0;
  const signals: string[] = [];
  const pct = Math.round(rate * 100);

  if (rate >= 0.6) {
    score = 20;
    signals.push(`High-RTO area: ${pct}% failure rate in this pin code (${total} shipments)`);
  } else if (rate >= 0.4) {
    score = 12;
    signals.push(`Moderate-RTO area: ${pct}% failure rate in this pin code (${total} shipments)`);
  } else if (rate >= 0.25) {
    score = 6;
    signals.push(`Pin code RTO rate ${pct}% (${total} shipments)`);
  }

  return { score, signals, stats: { rtoRate: rate, sampleSize: total } };
}

// ── 4. Customer order history (0–35) ────────────────────────────────────────

function scoreHistory(
  phone: string | undefined,
  phoneMap: Map<string, { delivered: number; rto: number }>,
): { score: number; signals: string[]; history: { delivered: number; rto: number; total: number } | null } {
  if (!phone) return { score: 0, signals: [], history: null };
  const norm = phone.replace(/\D/g, "").slice(-10);
  if (norm.length < 8) return { score: 0, signals: [], history: null };

  const h = phoneMap.get(norm);
  if (!h) return { score: 0, signals: [], history: null };

  const total = h.delivered + h.rto;
  if (total === 0) return { score: 0, signals: [], history: null };

  const rate = h.rto / total;
  const pct  = Math.round(rate * 100);
  let score  = 0;
  const signals: string[] = [];

  if (rate >= 0.7) {
    score = 35;
    signals.push(`High-risk customer: ${h.rto}/${total} past orders returned (${pct}%)`);
  } else if (rate >= 0.4) {
    score = 22;
    signals.push(`Repeat returner: ${h.rto}/${total} past orders returned (${pct}%)`);
  } else if (rate >= 0.2) {
    score = 10;
    signals.push(`${h.rto}/${total} past orders returned (${pct}%)`);
  } else if (h.rto > 0) {
    score = 4;
    signals.push(`${h.rto} past RTO — mostly reliable (${total} orders)`);
  } else {
    signals.push(`Reliable customer — ${total} order${total > 1 ? "s" : ""}, 0 RTOs`);
  }

  return { score, signals, history: { delivered: h.delivered, rto: h.rto, total } };
}

// ── 5. Address velocity (0–10) ───────────────────────────────────────────────
// Multiple different orders from same phone in last 7 days → reseller / fraud risk

function scoreVelocity(
  phone: string | undefined,
  velocityMap: Map<string, number>,
): { score: number; signals: string[] } {
  if (!phone) return { score: 0, signals: [] };
  const norm  = phone.replace(/\D/g, "").slice(-10);
  const count = velocityMap.get(norm) ?? 0;
  if (count >= 4) return { score: 10, signals: [`${count} orders from same phone in last 7 days`] };
  if (count >= 2) return { score: 5,  signals: [`${count} orders from same phone this week`] };
  return { score: 0, signals: [] };
}

// ── Map builder (2 DB queries for the whole batch) ───────────────────────────

interface Maps {
  phoneMap:    Map<string, { delivered: number; rto: number }>;
  pincodeMap:  Map<string, { delivered: number; rto: number }>;
  velocityMap: Map<string, number>;
}

async function buildMaps(sellerId: string): Promise<Maps> {
  const sixMonthsAgo = new Date(Date.now() - 180 * 86400000);
  const sevenDaysAgo  = new Date(Date.now() -   7 * 86400000);

  const [terminal, recent] = await Promise.all([
    prisma.order.findMany({
      where:  { sellerId, status: { in: ["DELIVERED", "RTO"] }, createdAt: { gte: sixMonthsAgo } },
      select: { customerAddress: true, status: true },
      take:   10000,
    }),
    prisma.order.findMany({
      where:  { sellerId, createdAt: { gte: sevenDaysAgo } },
      select: { customerAddress: true },
      take:   5000,
    }),
  ]);

  const phoneMap   = new Map<string, { delivered: number; rto: number }>();
  const pincodeMap = new Map<string, { delivered: number; rto: number }>();

  for (const o of terminal) {
    const addr    = o.customerAddress as AddressData | null;
    const phone   = addr?.phone?.replace(/\D/g, "").slice(-10);
    const pincode = addr?.pincode?.trim();

    if (phone && phone.length >= 8) {
      const e = phoneMap.get(phone) ?? { delivered: 0, rto: 0 };
      if (o.status === "DELIVERED") e.delivered++; else e.rto++;
      phoneMap.set(phone, e);
    }
    if (pincode && /^\d{6}$/.test(pincode)) {
      const e = pincodeMap.get(pincode) ?? { delivered: 0, rto: 0 };
      if (o.status === "DELIVERED") e.delivered++; else e.rto++;
      pincodeMap.set(pincode, e);
    }
  }

  const velocityMap = new Map<string, number>();
  for (const o of recent) {
    const phone = (o.customerAddress as AddressData | null)?.phone?.replace(/\D/g, "").slice(-10);
    if (phone && phone.length >= 8)
      velocityMap.set(phone, (velocityMap.get(phone) ?? 0) + 1);
  }

  return { phoneMap, pincodeMap, velocityMap };
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function batchPredictRtoRisk(
  orderIds: string[],
  sellerId: string,
): Promise<Record<string, RtoScore>> {
  if (orderIds.length === 0) return {};

  const [orders, maps] = await Promise.all([
    prisma.order.findMany({
      where:  { id: { in: orderIds }, sellerId },
      select: { id: true, customerAddress: true, paymentMode: true },
    }),
    buildMaps(sellerId),
  ]);

  const result: Record<string, RtoScore> = {};

  for (const order of orders) {
    const addr = (order.customerAddress ?? {}) as AddressData;

    const phoneR    = scorePhone(addr.phone);
    const addrR     = scoreAddress(addr);
    const histR     = scoreHistory(addr.phone, maps.phoneMap);
    const pinR      = scorePincode(addr.pincode, maps.pincodeMap);
    const velR      = scoreVelocity(addr.phone, maps.velocityMap);
    const payScore  = order.paymentMode === "COD" ? 20 : 0;
    const paySignal = order.paymentMode === "COD" ? ["Cash on delivery (higher RTO risk)"] : [];

    const rawTotal  = phoneR.score + addrR.score + histR.score + pinR.score + velR.score + payScore;
    const total     = Math.min(100, rawTotal);

    // Hard rule: no house number → floor at MEDIUM (incomplete address)
    const baseLevel = scoreLevel(total);
    const level: RtoRiskLevel = addrR.missingHouseNo && baseLevel === "LOW" ? "MEDIUM" : baseLevel;

    result[order.id] = {
      score: total,
      level,
      breakdown: {
        phone:    phoneR.score,
        address:  addrR.score,
        pincode:  pinR.score,
        history:  histR.score,
        velocity: velR.score,
        payment:  payScore,
      },
      signals: [
        ...phoneR.signals,
        ...addrR.signals,
        ...pinR.signals,
        ...histR.signals,
        ...velR.signals,
        ...paySignal,
      ],
      customerHistory: histR.history,
      pincodeStats:    pinR.stats,
    };
  }

  return result;
}
