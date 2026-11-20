import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// Stateless password-reset links (no table needed). The token is signed with NEXTAUTH_SECRET and
// includes a fingerprint of the user's current password hash, so it stops working the moment the
// password changes (one use) and after TTL_MINUTES.
const TTL_MINUTES = 60;

function secret() {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is not set");
  return s;
}
const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sign = (payload: string, passwordHash: string) =>
  crypto.createHmac("sha256", secret()).update(`${payload}.${passwordHash}`).digest("base64url");

export function createResetToken(user: { id: string; password: string }) {
  const payload = b64(JSON.stringify({ uid: user.id, exp: Date.now() + TTL_MINUTES * 60_000 }));
  return `${payload}.${sign(payload, user.password)}`;
}

/** Returns the user the token belongs to, or null if it's invalid, expired or already used. */
export async function verifyResetToken(token: string) {
  const [payload, sig] = (token ?? "").split(".");
  if (!payload || !sig) return null;
  let data: { uid?: string; exp?: number };
  try { data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { return null; }
  if (!data.uid || !data.exp || data.exp < Date.now()) return null;
  const user = await prisma.user.findUnique({ where: { id: data.uid }, select: { id: true, email: true, name: true, password: true } });
  if (!user) return null;
  const expected = sign(payload, user.password);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return user;
}

export const RESET_TTL_MINUTES = TTL_MINUTES;
