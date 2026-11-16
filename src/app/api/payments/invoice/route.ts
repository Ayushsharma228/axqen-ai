import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Razorpay from "razorpay";
import { planAmountPaise } from "@/lib/plan-pricing";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true, email: true, phone: true,
      businessName: true, businessAddress: true, pincode: true, gstNumber: true,
      planTier: true, plan: true, paymentReference: true,
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!user.paymentReference) return NextResponse.json({ error: "No payment on record" }, { status: 400 });

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ error: "Razorpay not configured" }, { status: 503 });
  }

  const razorpay = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  // Invoice what the seller actually paid, so sellers who paid before a price change keep correct invoices.
  let amount = planAmountPaise(user.plan, user.planTier);
  try {
    const payment = await razorpay.payments.fetch(user.paymentReference);
    const paid = Number(payment.amount);
    if (paid > 0) amount = paid;
  } catch (err) {
    console.error("Razorpay payment fetch failed, using plan price for invoice:", err);
  }

  try {
    const invoice = await (razorpay as any).invoices.create({
      type:        "invoice",
      description: `Axiqen ${user.planTier ?? "Starter"} Plan Setup Fee`,
      draft:       0,
      email_notify: 1,
      sms_notify:   0,
      date:        Math.floor(Date.now() / 1000),
      customer: {
        name:    user.businessName || user.name || "Seller",
        email:   user.email ?? "",
        contact: user.phone ?? "",
        billing_address: {
          line1:   user.businessAddress ?? "",
          zipcode: user.pincode ?? "000000",
          country: "in",
        },
        ...(user.gstNumber ? { gstin: user.gstNumber } : {}),
      },
      line_items: [
        {
          name:     `${user.planTier ?? "Starter"} Plan – ${user.plan === "MARKETPLACE" ? "Marketplace Management" : "Dropshipping"} Setup`,
          amount,
          quantity: 1,
          unit:     "service",
        },
      ],
      currency: "INR",
      notes: {
        payment_id: user.paymentReference,
        seller_id:  session.user.id,
      },
    });

    // Store invoice ID on user
    await prisma.user.update({
      where: { id: session.user.id },
      data:  { invoiceId: invoice.id } as any,
    }).catch(() => {}); // non-blocking — invoiceId may not exist in schema yet

    return NextResponse.json({ ok: true, invoiceId: invoice.id, invoiceUrl: invoice.short_url });
  } catch (err: any) {
    console.error("Razorpay invoice error:", err);
    // Non-fatal — log and continue
    return NextResponse.json({ ok: false, error: err?.error?.description ?? err?.message }, { status: 500 });
  }
}
