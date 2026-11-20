import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyResetToken } from "@/lib/password-reset";

// GET ?token=… → is the link still valid (for the page to show the form or an "expired" message)
// POST { token, password } → set the new password. The link stops working afterwards.
export async function GET(req: NextRequest) {
  const user = await verifyResetToken(req.nextUrl.searchParams.get("token") ?? "");
  return NextResponse.json({ valid: !!user, email: user ? user.email.replace(/^(.{2}).*(@.*)$/, "$1•••$2") : null });
}

export async function POST(req: NextRequest) {
  const { token, password } = await req.json().catch(() => ({})) as { token?: string; password?: string };
  const user = await verifyResetToken(String(token ?? ""));
  if (!user) return NextResponse.json({ error: "This link has expired or was already used. Ask for a new one." }, { status: 400 });
  const p = String(password ?? "");
  if (p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p)) return NextResponse.json({ error: "Use at least 8 characters with letters and a number" }, { status: 400 });
  await prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(p, 12) } });
  return NextResponse.json({ ok: true });
}
