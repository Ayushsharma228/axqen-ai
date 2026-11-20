import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getResend, FROM_EMAIL, ADMIN_EMAIL } from "@/lib/resend";

export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const body = await req.json();
  const { step } = body;

  try {
    if (step === "service") {
      const { service } = body; // "DROPSHIPPING" | "MARKETPLACE"
      if (!["DROPSHIPPING", "MARKETPLACE"].includes(service)) {
        return NextResponse.json({ error: "Invalid service" }, { status: 400 });
      }
      await prisma.user.update({ where: { id: userId }, data: { plan: service } });
      return NextResponse.json({ success: true });
    }

    if (step === "plan") {
      const { planTier } = body;
      if (!planTier) return NextResponse.json({ error: "Plan tier required" }, { status: 400 });
      await prisma.user.update({ where: { id: userId }, data: { planTier } });
      return NextResponse.json({ success: true });
    }

    if (step === "payment") {
      const { paymentReference } = body;
      if (!paymentReference?.trim()) {
        return NextResponse.json({ error: "Payment reference / UTR is required" }, { status: 400 });
      }
      await prisma.user.update({
        where: { id: userId },
        data: { paymentReference: paymentReference.trim() },
      });
      return NextResponse.json({ success: true });
    }

    if (step === "invoice") {
      const { name, businessName, businessAddress, pincode, gstNumber, phone } = body;
      await prisma.user.update({
        where: { id: userId },
        data: { name, businessName, businessAddress, pincode, gstNumber, phone },
      });
      return NextResponse.json({ success: true });
    }

    if (step === "kyc") {
      // Only the last 4 digits are kept; the full number and document images are never stored.
      const digits = String(body.aadhaarNumber ?? "").replace(/\D/g, "");
      if (digits.length !== 12) {
        return NextResponse.json({ error: "Enter valid 12-digit Aadhaar number" }, { status: 400 });
      }
      await prisma.user.update({
        where: { id: userId },
        data: { aadhaarNumber: `XXXX XXXX ${digits.slice(-4)}`, kycStatus: "SUBMITTED" },
      });
      return NextResponse.json({ success: true });
    }

    if (step === "agreement") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true, plan: true, planTier: true, paymentReference: true },
      });
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

      await prisma.user.update({
        where: { id: userId },
        data: {
          agreementAccepted: true,
          agreementAcceptedAt: new Date(),
          onboardingDone: true,
        },
      });

      // Send confirmation emails
      try {
        const serviceLabel = user.plan === "MARKETPLACE" ? "Marketplace" : "Dropshipping";
        const html = `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#0D1F13;">Welcome to AXQEN, ${user.name}!</h2>
            <p>Your onboarding is complete. Here's a summary:</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Service</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${serviceLabel}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Plan Tier</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${user.planTier ?? "—"}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Payment Reference</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${user.paymentReference ?? "—"}</td></tr>
            </table>
            <p style="margin-top:20px;">Our team will verify your payment and activate your account within <strong>24–48 hours</strong>.</p>
            <p style="color:#666;font-size:13px;">If you have any questions, reply to this email or contact us at connect@vrinandyaventures.in</p>
            <p style="margin-top:24px;color:#0D1F13;font-weight:600;">Team Axiqen</p>
          </div>
        `;

        await getResend().emails.send({
          from: FROM_EMAIL,
          to: [user.email, ADMIN_EMAIL],
          subject: `[Vrinandya] New Seller Onboarding — ${user.name} (${serviceLabel} · ${user.planTier})`,
          html,
        });
      } catch (emailErr) {
        console.error("Resend error:", emailErr); // non-fatal
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown step" }, { status: 400 });
  } catch (err) {
    console.error("Onboarding save error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
