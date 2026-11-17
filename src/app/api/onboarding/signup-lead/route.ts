import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getResend, FROM_EMAIL, ADMIN_EMAIL } from "@/lib/resend";
import { planAmountPaise } from "@/lib/plan-pricing";

const GOAL_LABELS: Record<string, string> = {
  NEW_BUSINESS:  "Starting a new business",
  SHOPIFY_STORE: "Has a Shopify store",
  AMAZON:        "Sells on Amazon",
  BRAND:         "Growing a brand",
};

// Called once signup finishes: puts the seller in the CRM as a lead and alerts admins so sales can call.
export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { goal } = (await req.json().catch(() => ({}))) as { goal?: string };
  const goalLabel = goal ? GOAL_LABELS[goal] ?? null : null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, phone: true, plan: true, planTier: true },
  });
  if (!user?.phone) return NextResponse.json({ ok: true, skipped: "no phone" });

  const service = user.plan === "MARKETPLACE" ? "Marketplace" : "Dropshipping";
  const tier = user.plan === "MARKETPLACE"
    ? "Amazon Management"
    : user.planTier ? user.planTier.charAt(0) + user.planTier.slice(1).toLowerCase() : "No plan";
  const price = `₹${(planAmountPaise(user.plan, user.planTier) / 100).toLocaleString("en-IN")}`;
  const planText = `${tier} · ${service} · ${price}`;

  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admins.length) return NextResponse.json({ ok: true, skipped: "no admin" });

  const notes = [`Signed up on website`, goalLabel && `Goal: ${goalLabel}`, `Plan: ${planText}`, `Seller ID: ${session.user.id}`]
    .filter(Boolean)
    .join(" | ");

  const data = {
    name:            user.name ?? "Seller",
    email:           user.email,
    source:          "WEBSITE_SIGNUP",
    notes,
    businessStage:   goalLabel,
    recommendedPlan: planText,
  };

  const existing = await prisma.lead.findFirst({ where: { phone: user.phone } });
  if (existing) {
    await prisma.lead.update({ where: { id: existing.id }, data });
  } else {
    await prisma.lead.create({ data: { ...data, phone: user.phone, stage: "LEAD", createdById: admins[0].id } });
  }

  const message = `${data.name} (${user.phone}) signed up${goalLabel ? ` · ${goalLabel}` : ""} · ${planText}. Call to collect payment.`;
  await prisma.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      type: "GENERAL" as const,
      title: "New seller signup",
      message,
      data: { sellerId: session.user.id, phone: user.phone, email: user.email, goal: goalLabel, plan: planText },
    })),
  }).catch((err) => console.error("[signup-lead] notification failed:", err));

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: [ADMIN_EMAIL],
      subject: `New signup: ${data.name} · ${planText}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px">
        <h2 style="margin:0 0 12px;color:#0B1220">New seller signup</h2>
        <p style="margin:0 0 16px;color:#55607A">Call to collect payment and activate the account.</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px">
          <tr><td style="padding:6px 0;color:#55607A">Name</td><td style="padding:6px 0;font-weight:600">${escapeHtml(data.name)}</td></tr>
          <tr><td style="padding:6px 0;color:#55607A">Phone</td><td style="padding:6px 0;font-weight:600">${escapeHtml(user.phone)}</td></tr>
          <tr><td style="padding:6px 0;color:#55607A">Email</td><td style="padding:6px 0;font-weight:600">${escapeHtml(user.email ?? "")}</td></tr>
          ${goalLabel ? `<tr><td style="padding:6px 0;color:#55607A">Goal</td><td style="padding:6px 0;font-weight:600">${goalLabel}</td></tr>` : ""}
          <tr><td style="padding:6px 0;color:#55607A">Plan</td><td style="padding:6px 0;font-weight:600">${escapeHtml(planText)}</td></tr>
        </table>
      </div>`,
    });
  } catch (err) {
    console.error("[signup-lead] admin email failed:", err);
  }

  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
