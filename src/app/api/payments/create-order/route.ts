import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Razorpay from "razorpay";
import { planAmountPaise, canUseTestPlan, TEST_TIER } from "@/lib/plan-pricing";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { planTier: true, plan: true, paymentConfirmed: true, name: true, email: true, phone: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.paymentConfirmed) return NextResponse.json({ error: "Payment already completed" }, { status: 400 });

  if ((user.planTier ?? "").toUpperCase() === TEST_TIER && !canUseTestPlan(user.email)) {
    return NextResponse.json({ error: "This plan is not available for your account." }, { status: 403 });
  }
  const amount = planAmountPaise(user.plan, user.planTier);

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ error: "Razorpay keys not configured on server" }, { status: 503 });
  }

  try {
    const razorpay = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt:  `axiqen_${session.user.id.slice(-8)}_${Date.now()}`,
      notes: { sellerId: session.user.id, planTier: user.planTier ?? "Launch" },
    });

    return NextResponse.json({
      orderId:   order.id,
      amount:    order.amount,
      currency:  order.currency,
      key:       process.env.RAZORPAY_KEY_ID,
      tierLabel: user.planTier ?? "Launch",
      name:      user.name  ?? "Axiqen Seller",
      email:     user.email ?? "",
      phone:     user.phone ?? "",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("Razorpay create-order error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
