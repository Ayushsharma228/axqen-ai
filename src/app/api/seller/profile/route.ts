import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PLAN_PRICES_INR } from "@/lib/plan-pricing";
import { emailBankDetailsChanged } from "@/lib/email";

const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sellerId = session.user.id;

  const [user, amazon] = await Promise.all([
    prisma.user.findUnique({
      where: { id: sellerId },
      select: {
        name: true, email: true, phone: true, phoneVerified: true, brandName: true, gstNumber: true,
        bankHolder: true, bankAccount: true, bankIfsc: true, bankName: true,
        metaAdAccountId: true, metaTokenExpiresAt: true,
        plan: true, planTier: true, paymentConfirmed: true, accountStatus: true, kycStatus: true, createdAt: true,
        shopifyStore: { select: { storeUrl: true, storeName: true, lastSyncError: true } },
      },
    }),
    prisma.marketplaceAccount.findUnique({ where: { sellerId_platform: { sellerId, platform: "AMAZON" } }, select: { isActive: true } }).catch(() => null),
  ]);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tier = (user.planTier ?? "STARTER").toUpperCase();
  const price = user.plan ? PLAN_PRICES_INR[user.plan]?.[tier as keyof (typeof PLAN_PRICES_INR)["DROPSHIPPING"]] ?? null : null;

  // Existing fields kept as they were; new ones added alongside.
  return NextResponse.json({
    ...user,
    planInfo: { plan: user.plan, tier: user.planTier, price, paymentConfirmed: user.paymentConfirmed, accountStatus: user.accountStatus, memberSince: user.createdAt },
    connections: {
      shopify: user.shopifyStore ? { name: user.shopifyStore.storeName, url: user.shopifyStore.storeUrl, problem: !!user.shopifyStore.lastSyncError } : null,
      amazon: !!amazon?.isActive,
      meta: !!(user.metaAdAccountId && user.metaTokenExpiresAt && user.metaTokenExpiresAt > new Date()),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sellerId = session.user.id;

  const body = await req.json();
  const { type } = body;

  if (type === "personal") {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Name can't be empty" }, { status: 400 });
    const digits = String(body.phone ?? "").replace(/\D/g, "").slice(-10);
    if (body.phone && digits.length !== 10) return NextResponse.json({ error: "Enter a 10-digit mobile number" }, { status: 400 });
    await prisma.user.update({ where: { id: sellerId }, data: { name, phone: digits ? `+91${digits}` : null } });
    return NextResponse.json({ success: true });
  }

  if (type === "business") {
    const gst = String(body.gst ?? "").trim().toUpperCase();
    if (gst && !GSTIN.test(gst)) return NextResponse.json({ error: "That GST number doesn't look right. It should be 15 characters, e.g. 09ABCDE1234F1Z5." }, { status: 400 });
    await prisma.user.update({ where: { id: sellerId }, data: { brandName: String(body.brandName ?? "").trim() || null, gstNumber: gst || null } });
    return NextResponse.json({ success: true });
  }

  if (type === "bank") {
    // Payouts go to this account: confirm the password, validate, then tell the seller and the admins.
    const user = await prisma.user.findUnique({ where: { id: sellerId }, select: { password: true, email: true, name: true, brandName: true, bankAccount: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (!body.currentPassword || !(await bcrypt.compare(String(body.currentPassword), user.password))) {
      return NextResponse.json({ error: "Your password is incorrect" }, { status: 400 });
    }
    const holder = String(body.accountHolder ?? "").trim();
    const account = String(body.accountNumber ?? "").replace(/\s/g, "");
    const confirm = String(body.confirmAccountNumber ?? "").replace(/\s/g, "");
    const ifsc = String(body.ifsc ?? "").trim().toUpperCase();
    const bankName = String(body.bankName ?? "").trim();
    if (!holder) return NextResponse.json({ error: "Enter the account holder's name" }, { status: 400 });
    if (!/^\d{9,18}$/.test(account)) return NextResponse.json({ error: "Account number should be 9 to 18 digits" }, { status: 400 });
    if (account !== confirm) return NextResponse.json({ error: "The two account numbers don't match" }, { status: 400 });
    if (!IFSC.test(ifsc)) return NextResponse.json({ error: "IFSC should look like HDFC0001234 (11 characters, 5th is zero)" }, { status: 400 });

    await prisma.user.update({ where: { id: sellerId }, data: { bankHolder: holder, bankAccount: account, bankIfsc: ifsc, bankName: bankName || null } });

    const changed = user.bankAccount !== account;
    const when = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    await Promise.all([
      ...admins.map(a => prisma.notification.create({
        data: {
          userId: a.id, type: "ORDER_UPDATE",
          title: changed ? "Seller changed payout bank account" : "Seller updated bank details",
          message: `${user.brandName || user.name || "A seller"} set payouts to ${holder}, ••••${account.slice(-4)}, ${ifsc}. Check before the next payout.`,
          data: { sellerId, kind: "BANK_CHANGED" },
        },
      }).catch(() => null)),
      user.email ? emailBankDetailsChanged({ to: user.email, name: user.name ?? "there", holder, accountTail: account.slice(-4), ifsc, when }).catch(() => null) : null,
    ]);
    return NextResponse.json({ success: true });
  }

  if (type === "password") {
    const user = await prisma.user.findUnique({ where: { id: sellerId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const valid = await bcrypt.compare(body.current, user.password);
    if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    if (body.newPass !== body.confirm) return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
    if (String(body.newPass ?? "").length < 8) return NextResponse.json({ error: "Use at least 8 characters" }, { status: 400 });
    const hashed = await bcrypt.hash(body.newPass, 10);
    await prisma.user.update({ where: { id: sellerId }, data: { password: hashed } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
