import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getGiven, getRewardConfig, saveRewardConfig, sellerProgress, setGiven, SETUP_ID, type Milestone } from "@/lib/rewards";

// GET  → reward settings + every seller's progress (setup steps, delivered orders, reached / given rewards)
// PUT  { setup: { enabled, reward }, milestones: [{ id?, orders, reward, note? }] } → save settings
// POST { sellerId, milestoneId, given: boolean, note? } → mark a reward handed out (or undo)
async function admin(req: NextRequest) {
  const s = await getRouteSession(req);
  return s?.user.role === "ADMIN" ? s : null;
}

export async function GET(req: NextRequest) {
  if (!(await admin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [config, given, sellers] = await Promise.all([
    getRewardConfig(), getGiven(),
    prisma.user.findMany({ where: { role: "SELLER", accountStatus: { not: "SUSPENDED" } }, select: { id: true, name: true, email: true, brandName: true, phone: true, createdAt: true } }),
  ]);
  const prog = await sellerProgress(sellers.map(s => s.id));
  const rows = sellers.map(s => {
    const p = prog.get(s.id) ?? { steps: [], setupDone: false, delivered: 0 };
    const reached = [
      ...(config.setup.enabled && p.setupDone ? [{ id: SETUP_ID, label: "Setup complete", reward: config.setup.reward }] : []),
      ...config.milestones.filter(m => p.delivered >= m.orders).map(m => ({ id: m.id, label: `${m.orders} delivered orders`, reward: m.reward })),
    ].map(r => ({ ...r, given: !!given[`${s.id}:${r.id}`], givenAt: given[`${s.id}:${r.id}`]?.at ?? null }));
    const next = config.milestones.find(m => p.delivered < m.orders) ?? null;
    return {
      id: s.id, name: s.brandName || s.name || s.email, email: s.email, phone: s.phone, joined: s.createdAt.toISOString(),
      delivered: p.delivered, setupDone: p.setupDone, stepsDone: p.steps.filter(x => x.done).length, stepsTotal: p.steps.length,
      reached, pending: reached.filter(r => !r.given).length,
      next: next ? { orders: next.orders, reward: next.reward, left: next.orders - p.delivered } : null,
    };
  }).sort((a, b) => b.pending - a.pending || b.delivered - a.delivered);
  return NextResponse.json({ config, sellers: rows });
}

export async function PUT(req: NextRequest) {
  if (!(await admin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null) as { setup?: { enabled?: boolean; reward?: string }; milestones?: Partial<Milestone>[] } | null;
  if (!b) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  const milestones: Milestone[] = [];
  const seen = new Set<number>();
  for (const m of b.milestones ?? []) {
    const orders = Math.round(Number(m.orders));
    const reward = String(m.reward ?? "").trim();
    if (!(orders > 0)) return NextResponse.json({ error: "Each milestone needs a delivered-order count above 0" }, { status: 400 });
    if (!reward) return NextResponse.json({ error: `Add the reward for ${orders} delivered orders` }, { status: 400 });
    if (seen.has(orders)) return NextResponse.json({ error: `Two milestones use ${orders} orders` }, { status: 400 });
    seen.add(orders);
    milestones.push({ id: m.id && /^[a-z0-9-]{4,40}$/i.test(m.id) ? m.id : `m${orders}-${Date.now().toString(36)}`, orders, reward: reward.slice(0, 120), ...(m.note?.trim() ? { note: m.note.trim().slice(0, 200) } : {}) });
  }
  const setupReward = String(b.setup?.reward ?? "").trim().slice(0, 120);
  if (b.setup?.enabled && !setupReward) return NextResponse.json({ error: "Add the setup reward, or switch it off" }, { status: 400 });
  await saveRewardConfig({ setup: { enabled: !!b.setup?.enabled, reward: setupReward }, milestones: milestones.sort((a, c) => a.orders - c.orders) });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const session = await admin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({})) as { sellerId?: string; milestoneId?: string; given?: boolean; note?: string };
  if (!b.sellerId || !b.milestoneId) return NextResponse.json({ error: "sellerId and milestoneId required" }, { status: 400 });
  await setGiven(b.sellerId, b.milestoneId, !!b.given, session.user.id, b.note?.trim() || undefined);
  if (b.given) {
    const config = await getRewardConfig();
    const label = b.milestoneId === SETUP_ID ? config.setup.reward : config.milestones.find(m => m.id === b.milestoneId)?.reward;
    if (label) {
      await prisma.notification.create({
        data: { userId: b.sellerId, type: "GENERAL", title: "Reward unlocked 🎉", message: `Your reward is on its way: ${label}.`, data: { category: "Announcement", reward: b.milestoneId } },
      }).catch(() => {});
    }
  }
  return NextResponse.json({ ok: true });
}
