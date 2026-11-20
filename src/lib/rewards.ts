import { prisma } from "@/lib/prisma";

// Seller rewards: the admin sets a setup reward and delivered-order milestones; progress is read live
// from each seller's data. Rewards are handed out by the team and marked "given" here.
// Stored in PlatformConfig (no schema change): REWARD_CONFIG and REWARDS_GIVEN.

export interface Milestone { id: string; orders: number; reward: string; note?: string }
export interface RewardConfig {
  setup: { enabled: boolean; reward: string };
  milestones: Milestone[];
  /** Only delivered orders placed on or after this date count towards milestones (ISO date), or null for all time. */
  countFrom: string | null;
  /** Rewards can be claimed only while the seller's RTO % over the last `days` days is at or under `maxPct`. */
  rto: { enabled: boolean; maxPct: number; days: number };
}
export interface GivenRecord { at: string; by: string | null; note?: string }

const CONFIG_KEY = "REWARD_CONFIG";
const GIVEN_KEY = "REWARDS_GIVEN";
export const SETUP_ID = "setup";
const EMPTY: RewardConfig = { setup: { enabled: false, reward: "" }, milestones: [], countFrom: null, rto: { enabled: false, maxPct: 30, days: 90 } };

export async function getRewardConfig(): Promise<RewardConfig> {
  const r = await prisma.platformConfig.findUnique({ where: { key: CONFIG_KEY } });
  if (!r) return EMPTY;
  try {
    const c = JSON.parse(r.value) as RewardConfig;
    return {
      setup: { enabled: !!c.setup?.enabled, reward: c.setup?.reward ?? "" },
      milestones: [...(c.milestones ?? [])].sort((a, b) => a.orders - b.orders),
      countFrom: c.countFrom ?? null,
      rto: { enabled: !!c.rto?.enabled, maxPct: Number(c.rto?.maxPct ?? 30), days: Number(c.rto?.days ?? 90) },
    };
  } catch { return EMPTY; }
}

export async function saveRewardConfig(c: RewardConfig) {
  await prisma.platformConfig.upsert({
    where: { key: CONFIG_KEY },
    update: { value: JSON.stringify(c) },
    create: { key: CONFIG_KEY, value: JSON.stringify(c), label: "Seller rewards and milestones" },
  });
}

export async function getGiven(): Promise<Record<string, GivenRecord>> {
  const r = await prisma.platformConfig.findUnique({ where: { key: GIVEN_KEY } });
  try { return r ? JSON.parse(r.value) : {}; } catch { return {}; }
}

export async function setGiven(sellerId: string, milestoneId: string, given: boolean, by: string | null, note?: string) {
  const all = await getGiven();
  const k = `${sellerId}:${milestoneId}`;
  if (given) all[k] = { at: new Date().toISOString(), by, ...(note ? { note } : {}) };
  else delete all[k];
  await prisma.platformConfig.upsert({
    where: { key: GIVEN_KEY },
    update: { value: JSON.stringify(all) },
    create: { key: GIVEN_KEY, value: JSON.stringify(all), label: "Seller rewards handed out" },
  });
}

export type SetupStep = { key: string; label: string; done: boolean; href: string };

/** Setup steps, delivered orders (counted from the start date) and recent RTO % for many sellers at once. */
export async function sellerProgress(sellerIds: string[], config?: RewardConfig) {
  const cfg = config ?? await getRewardConfig();
  const from = cfg.countFrom ? new Date(cfg.countFrom) : null;
  const rtoSince = new Date(Date.now() - Math.max(1, cfg.rto.days) * 86400000);
  const [users, listed, firstOrder, delivered, marketplace, counted, recent] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: sellerIds } },
      select: { id: true, agreementAccepted: true, kycStatus: true, bankAccount: true, bankIfsc: true, bankHolder: true, shopifyStore: { select: { id: true } } },
    }),
    prisma.listingRequest.groupBy({ by: ["sellerId"], where: { sellerId: { in: sellerIds }, status: "LISTED" }, _count: { id: true } }),
    prisma.order.groupBy({ by: ["sellerId"], where: { sellerId: { in: sellerIds }, status: { not: "HIDDEN" } }, _count: { id: true } }),
    prisma.order.groupBy({ by: ["sellerId"], where: { sellerId: { in: sellerIds }, status: "DELIVERED" }, _count: { id: true } }),
    prisma.marketplaceAccount.findMany({ where: { sellerId: { in: sellerIds }, isActive: true }, select: { sellerId: true } }),
    from ? prisma.order.groupBy({ by: ["sellerId"], where: { sellerId: { in: sellerIds }, status: "DELIVERED", createdAt: { gte: from } }, _count: { id: true } }) : Promise.resolve(null),
    prisma.order.groupBy({ by: ["sellerId", "status"], where: { sellerId: { in: sellerIds }, status: { in: ["DELIVERED", "RTO"] }, createdAt: { gte: rtoSince } }, _count: { id: true } }),
  ]);
  const countedMap = counted ? new Map(counted.map(d => [d.sellerId, d._count.id])) : null;
  const mpSet = new Set(marketplace.map(m => m.sellerId));
  const listedSet = new Set(listed.map(l => l.sellerId));
  const orderSet = new Set(firstOrder.map(o => o.sellerId));
  const delMap = new Map(delivered.map(d => [d.sellerId, d._count.id]));
  const out = new Map<string, { steps: SetupStep[]; setupDone: boolean; delivered: number; deliveredAll: number; rtoPct: number | null; rtoOk: boolean }>();
  for (const u of users) {
    const del = delMap.get(u.id) ?? 0;
    const steps: SetupStep[] = [
      { key: "agreement", label: "Agreement", done: u.agreementAccepted, href: "/seller/profile" },
      { key: "kyc", label: "KYC approved", done: u.kycStatus === "APPROVED", href: "/seller/profile" },
      { key: "bank", label: "Bank details", done: !!(u.bankAccount && u.bankIfsc && u.bankHolder), href: "/seller/profile" },
      { key: "store", label: "Store connected", done: !!u.shopifyStore || mpSet.has(u.id), href: mpSet.has(u.id) ? "/seller/amazon" : "/seller/shopify" },
      { key: "listing", label: "First listing live", done: listedSet.has(u.id), href: "/seller/catalog" },
      { key: "order", label: "First order", done: orderSet.has(u.id), href: "/seller/orders" },
      { key: "delivery", label: "First delivery", done: del > 0, href: "/seller/orders" },
    ];
    const d = recent.find(r => r.sellerId === u.id && r.status === "DELIVERED")?._count.id ?? 0;
    const r = recent.find(x => x.sellerId === u.id && x.status === "RTO")?._count.id ?? 0;
    const rtoPct = d + r >= 5 ? Math.round((r / (d + r)) * 100) : null; // too few orders to judge → allowed
    out.set(u.id, {
      steps, setupDone: steps.every(s => s.done), deliveredAll: del,
      delivered: countedMap ? (countedMap.get(u.id) ?? 0) : del,
      rtoPct, rtoOk: !cfg.rto.enabled || rtoPct == null || rtoPct <= cfg.rto.maxPct,
    });
  }
  return out;
}

/** One seller's journey, for their dashboard. */
export async function sellerJourney(sellerId: string) {
  const config = await getRewardConfig();
  const [given, prog] = await Promise.all([getGiven(), sellerProgress([sellerId], config)]);
  const p = prog.get(sellerId) ?? { steps: [], setupDone: false, delivered: 0, deliveredAll: 0, rtoPct: null, rtoOk: true };
  const milestones = config.milestones.map(m => ({
    ...m, reached: p.delivered >= m.orders, given: !!given[`${sellerId}:${m.id}`], givenAt: given[`${sellerId}:${m.id}`]?.at ?? null,
  }));
  const next = milestones.find(m => !m.reached) ?? null;
  const prevOrders = [...milestones].reverse().find(m => m.reached)?.orders ?? 0;
  return {
    delivered: p.delivered,
    deliveredAll: p.deliveredAll,
    countFrom: config.countFrom,
    rto: { enabled: config.rto.enabled, maxPct: config.rto.maxPct, days: config.rto.days, pct: p.rtoPct, ok: p.rtoOk },
    setup: {
      enabled: config.setup.enabled, reward: config.setup.reward, steps: p.steps, done: p.setupDone,
      given: !!given[`${sellerId}:${SETUP_ID}`],
    },
    milestones,
    next: next ? { ...next, left: next.orders - p.delivered, progress: Math.min(1, (p.delivered - prevOrders) / Math.max(1, next.orders - prevOrders)) } : null,
  };
}
