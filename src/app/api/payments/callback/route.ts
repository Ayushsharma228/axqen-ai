import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// Razorpay POSTs here after redirect-mode payment (success or failure)
export async function POST(req: NextRequest) {
  const base = new URL(req.url).origin;

  let razorpay_payment_id: string | null = null;
  let razorpay_order_id:   string | null = null;
  let razorpay_signature:  string | null = null;

  try {
    const form = await req.formData();
    razorpay_payment_id = form.get("razorpay_payment_id") as string;
    razorpay_order_id   = form.get("razorpay_order_id")   as string;
    razorpay_signature  = form.get("razorpay_signature")  as string;
  } catch {
    return NextResponse.redirect(`${base}/onboarding?payment=failed`);
  }

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return NextResponse.redirect(`${base}/onboarding?payment=failed`);
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.redirect(`${base}/login`);
  }

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expected !== razorpay_signature) {
    return NextResponse.redirect(`${base}/onboarding?payment=failed`);
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data:  { paymentConfirmed: true, paymentReference: razorpay_payment_id },
  });

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (admin) {
    await prisma.notification.create({
      data: {
        userId:  admin.id,
        type:    "GENERAL",
        title:   "New Plan Payment",
        message: `${session.user.name ?? session.user.email} completed payment. Ref: ${razorpay_payment_id}`,
        data:    { sellerId: session.user.id, paymentId: razorpay_payment_id },
      },
    }).catch(() => {});
  }

  return NextResponse.redirect(`${base}/welcome`);
}
