// Daily "Ask AXQEN" question allowance per seller, counted in PlatformConfig (no schema change).
import { prisma } from "@/lib/prisma";

export const ASK_DAILY_LIMIT = 10;

const todayIst = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const keyFor = (sellerId: string) => `AI_ASK:${sellerId}:${todayIst()}`;

export async function askUsedToday(sellerId: string) {
  const row = await prisma.platformConfig.findUnique({ where: { key: keyFor(sellerId) }, select: { value: true } });
  return Number(row?.value ?? 0) || 0;
}

export async function recordAsk(sellerId: string) {
  const key = keyFor(sellerId);
  const used = await askUsedToday(sellerId);
  await prisma.platformConfig.upsert({
    where: { key },
    create: { key, value: "1", label: "AI Ask daily count" },
    update: { value: String(used + 1) },
  });
  return used + 1;
}
