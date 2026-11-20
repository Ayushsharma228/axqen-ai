import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { emailErrorAlert } from "@/lib/email";

// Error alerts: every server error is grouped (same place + same message = one row with a count),
// shown in Admin → System → Errors, and emailed to the team at most once an hour per error.

const ALERT_EVERY_MS = 60 * 60_000;
const alertTo = () => process.env.ALERT_EMAIL || "connect@vrinandyaventures.in";

/** Removes ids, numbers and quoted values so repeats of the same problem group together. */
function normalise(message: string) {
  return message
    .replace(/[a-z0-9]{20,}/gi, "<id>")
    .replace(/\b\d+(\.\d+)?\b/g, "<n>")
    .replace(/(["'`]).*?\1/g, "<v>")
    .slice(0, 300);
}

export async function reportError(source: string, error: unknown, path?: string | null) {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const message = (err.message || err.name || "Unknown error").slice(0, 2000);
    const fingerprint = createHash("sha1").update(`${source}|${normalise(message)}`).digest("hex");
    const now = new Date();

    const row = await prisma.errorEvent.upsert({
      where: { fingerprint },
      create: { fingerprint, source, message, stack: err.stack?.slice(0, 4000) ?? null, path: path ?? null },
      update: { count: { increment: 1 }, lastSeenAt: now, message, path: path ?? undefined, resolvedAt: null },
    });

    const due = !row.lastAlertedAt || now.getTime() - row.lastAlertedAt.getTime() > ALERT_EVERY_MS;
    if (!due) return;
    // Claim the alert first so parallel failures send one email, not many.
    const claimed = await prisma.errorEvent.updateMany({
      where: { id: row.id, OR: [{ lastAlertedAt: null }, { lastAlertedAt: { lt: new Date(now.getTime() - ALERT_EVERY_MS) } }] },
      data: { lastAlertedAt: now },
    });
    if (claimed.count === 0) return;
    await emailErrorAlert({ to: alertTo(), source, message, path, count: row.count, firstSeen: row.firstSeenAt });
  } catch (e) {
    // Never let error reporting break the request that failed.
    console.error("[errors] could not report", e);
  }
}
