import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role, Plan, AccountStatus } from "@prisma/client";

// ── Login lockout: 10 wrong passwords for one email locks it for 15 minutes (PlatformConfig, no schema change) ──
const MAX_FAILURES = 10;
const LOCK_MINUTES = 15;
export const LOCKED_MESSAGE = `Too many wrong attempts. Try again in ${LOCK_MINUTES} minutes or reset your password.`;
const failKey = (email: string) => `LOGIN_FAIL:${email}`;
type FailState = { count: number; first: number; lockedUntil?: number };

async function readFailures(email: string): Promise<FailState | null> {
  const row = await prisma.platformConfig.findUnique({ where: { key: failKey(email) }, select: { value: true } }).catch(() => null);
  if (!row) return null;
  try { return JSON.parse(row.value) as FailState; } catch { return null; }
}

export async function isLoginLocked(email: string) {
  const s = await readFailures(email);
  return !!s?.lockedUntil && s.lockedUntil > Date.now();
}

export async function recordLoginFailure(email: string) {
  const now = Date.now();
  const prev = await readFailures(email);
  // Count failures within a rolling 15-minute window.
  const fresh = !prev || now - prev.first > LOCK_MINUTES * 60_000 || (prev.lockedUntil && prev.lockedUntil <= now);
  const next: FailState = fresh ? { count: 1, first: now } : { ...prev!, count: prev!.count + 1 };
  if (next.count >= MAX_FAILURES) next.lockedUntil = now + LOCK_MINUTES * 60_000;
  const value = JSON.stringify(next);
  await prisma.platformConfig.upsert({ where: { key: failKey(email) }, create: { key: failKey(email), value, label: "Failed login attempts" }, update: { value } }).catch(() => null);
}

export async function clearLoginFailures(email: string) {
  await prisma.platformConfig.deleteMany({ where: { key: failKey(email) } }).catch(() => null);
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    newUser: "/signup",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password required");
        }

        const email = credentials.email.trim().toLowerCase();
        if (await isLoginLocked(email)) {
          throw new Error(LOCKED_MESSAGE);
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        // Same message whether the email exists or not, so nobody can find out who has an account.
        const isPasswordValid = user ? await bcrypt.compare(credentials.password, user.password) : false;
        if (!user || !isPasswordValid) {
          await recordLoginFailure(email);
          throw new Error("Invalid email or password");
        }
        await clearLoginFailures(email);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          plan: user.plan,
          accountStatus: user.accountStatus,
          onboardingDone: user.onboardingDone,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role as Role;
        token.plan = user.plan as Plan | null;
        token.id = user.id;
        token.accountStatus = user.accountStatus;
        token.onboardingDone = user.onboardingDone;
      }
      if (trigger === "update") {
        if (session?.plan) token.plan = session.plan;
        if (session?.accountStatus) token.accountStatus = session.accountStatus;
        if (session?.onboardingDone !== undefined) token.onboardingDone = session.onboardingDone;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.plan = token.plan as Plan | null;
        session.user.accountStatus = token.accountStatus as AccountStatus;
        session.user.onboardingDone = token.onboardingDone as boolean;
      }
      return session;
    },
  },
};
