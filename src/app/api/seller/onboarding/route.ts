import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { emailOnboardingComplete } from "@/lib/email";
import { dispatchEvent } from "@/lib/automation/engine";
import { ensureSellerActivation, updateActivation } from "@/lib/activation/engine";

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true, email: true, phone: true, brandName: true,
      businessName: true, businessAddress: true, city: true, state: true, pincode: true,
      gstNumber: true, bankName: true, bankHolder: true,
      bankAccount: true, bankIfsc: true, aadhaarNumber: true,
      agreementAccepted: true, kycStatus: true, onboardingDone: true,
      plan: true, planTier: true, paymentConfirmed: true, phoneVerified: true,
    },
  });

  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { step } = body;

  const triggerActivationUpdate = () => {
    setImmediate(async () => {
      try {
        await ensureSellerActivation(session.user.id);
        await updateActivation(session.user.id);
      } catch {}
    });
  };

  // ── Personal Info ──────────────────────────────────────────────────────────
  if (step === "personal") {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        businessAddress: body.address     || null,
        city:            body.city        || null,
        state:           body.state       || null,
        pincode:         body.pincode     || null,
        phone:           body.phone       || null,
      },
    });
    return NextResponse.json({ ok: true });
  }

  // ── Business Details ───────────────────────────────────────────────────────
  if (step === "business") {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        businessName: body.businessName || null,
        brandName:    body.brandName    || null,
        gstNumber:    body.gstNumber    || null,
      },
    });
    triggerActivationUpdate();
    return NextResponse.json({ ok: true });
  }

  // ── Verification (Agreement + Aadhaar) ────────────────────────────────────
  if (step === "verification") {
    // Only the last 4 digits are kept (privacy policy section 4); the full number is never stored.
    const aadhaarDigits = String(body.aadhaarNumber ?? "").replace(/\D/g, "");
    if (aadhaarDigits.length !== 12)
      return NextResponse.json({ error: "Enter your 12-digit Aadhaar number" }, { status: 400 });
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        agreementAccepted:   true,
        agreementAcceptedAt: new Date(),
        aadhaarNumber:       `XXXX XXXX ${aadhaarDigits.slice(-4)}`,
        kycStatus:           "SUBMITTED",
      },
    });
    triggerActivationUpdate();
    return NextResponse.json({ ok: true });
  }

  // ── Complete (called after payment is verified) ────────────────────────────
  if (step === "complete") {
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data:  { onboardingDone: true },
      select: { name: true, email: true, plan: true, planTier: true },
    });

    emailOnboardingComplete({
      to:   updated.email,
      name: updated.name ?? "Seller",
    }).catch(() => {});

    const admins = await prisma.user.findMany({
      where:  { role: "ADMIN" },
      select: { id: true },
    });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId:  a.id,
          type:    "GENERAL",
          title:   "New Seller Onboarded",
          message: `${updated.name ?? "A new seller"} completed onboarding & payment. Plan: ${updated.planTier ?? updated.plan ?? "—"}`,
          data:    { sellerId: session.user.id, sellerEmail: updated.email },
        })),
      });
    }

    dispatchEvent({ type: "SELLER_ONBOARDED", entityId: session.user.id, entityType: "SELLER",
                    payload: { sellerId: session.user.id } });
    triggerActivationUpdate();
    return NextResponse.json({ ok: true });
  }

  // ── Legacy steps (kept for backward compat) ───────────────────────────────

  if (step === "agreement") {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { agreementAccepted: true, agreementAcceptedAt: new Date() },
    });
    triggerActivationUpdate();
    return NextResponse.json({ ok: true });
  }

  if (step === "bank") {
    if (!body.bankAccount || !body.bankIfsc || !body.bankHolder)
      return NextResponse.json({ error: "Account number, IFSC, and holder name are required" }, { status: 400 });
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        bankName:    body.bankName    || null,
        bankHolder:  body.bankHolder,
        bankAccount: body.bankAccount,
        bankIfsc:    body.bankIfsc.toUpperCase(),
      },
    });
    triggerActivationUpdate();
    return NextResponse.json({ ok: true });
  }

  if (step === "kyc") {
    if (!body.aadhaarNumber)
      return NextResponse.json({ error: "Aadhaar number is required" }, { status: 400 });
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        aadhaarNumber: body.aadhaarNumber,
        aadhaarDocUrl: body.aadhaarDocUrl || null,
        kycStatus:     "SUBMITTED",
        onboardingDone: true,
      },
      select: { name: true, email: true, plan: true, planTier: true },
    });

    emailOnboardingComplete({ to: updated.email, name: updated.name ?? "Seller" }).catch(() => {});

    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id, type: "GENERAL", title: "New Seller Onboarded",
          message: `${updated.name ?? "A new seller"} completed onboarding. Plan: ${updated.planTier ?? updated.plan ?? "—"}`,
          data: { sellerId: session.user.id, sellerEmail: updated.email },
        })),
      });
    }

    dispatchEvent({ type: "SELLER_ONBOARDED", entityId: session.user.id, entityType: "SELLER",
                    payload: { sellerId: session.user.id } });
    triggerActivationUpdate();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown step" }, { status: 400 });
}
