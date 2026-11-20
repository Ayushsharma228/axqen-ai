import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { Role, Plan, AccountStatus } from "@prisma/client";
import { recordAdminRequest } from "@/lib/audit";

export async function getRouteSession(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return null;
  const session = {
    user: {
      id:              token.id as string,
      role:            token.role as Role,
      plan:            token.plan as Plan | null,
      email:           token.email as string | null,
      name:            token.name as string | null,
      accountStatus:   token.accountStatus as AccountStatus,
      onboardingDone:  token.onboardingDone as boolean,
    },
  };
  // Audit trail: every admin change request is logged (who, what, when). GETs are skipped inside.
  if (session.user.role === "ADMIN") await recordAdminRequest(req, { id: session.user.id, email: session.user.email, role: session.user.role });
  return session;
}
