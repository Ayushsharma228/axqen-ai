import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createResetToken, RESET_TTL_MINUTES } from "@/lib/password-reset";
import { emailPasswordReset } from "@/lib/email";

// POST { email } → emails a reset link if the account exists. Always answers the same way,
// so it can't be used to find out which emails have accounts.
const recent = new Map<string, number>(); // email → last request time (per server instance)

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({})) as { email?: string };
  const e = String(email ?? "").trim().toLowerCase();
  const ok = NextResponse.json({ ok: true });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });

  const last = recent.get(e) ?? 0;
  if (Date.now() - last < 60_000) return ok; // one email a minute per address
  recent.set(e, Date.now());

  const user = await prisma.user.findFirst({ where: { email: { equals: e, mode: "insensitive" } }, select: { id: true, email: true, name: true, password: true, accountStatus: true } });
  if (!user || user.accountStatus === "SUSPENDED") return ok;

  const origin = process.env.NEXTAUTH_URL?.replace(/\/$/, "") || req.nextUrl.origin;
  const link = `${origin}/reset-password?token=${encodeURIComponent(createResetToken(user))}`;
  await emailPasswordReset({ to: user.email, name: user.name ?? "there", link, minutes: RESET_TTL_MINUTES }).catch(() => {});
  return ok;
}
