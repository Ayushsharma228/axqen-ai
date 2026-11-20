import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") ?? "SUBMITTED";

  const sellers = await prisma.user.findMany({
    where:   { role: "SELLER", kycStatus: status as never },
    select:  {
      id: true, name: true, email: true, brandName: true, businessName: true,
      phone: true, gstNumber: true, aadhaarNumber: true, aadhaarDocUrl: true,
      kycStatus: true, onboardingDone: true, accountStatus: true, createdAt: true, plan: true, planTier: true, paymentConfirmed: true,
      businessAddress: true, pincode: true,
      bankName: true, bankHolder: true, bankIfsc: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const counts = await prisma.user.groupBy({
    by:    ["kycStatus"],
    where: { role: "SELLER" },
    _count: { id: true },
  });

  return NextResponse.json({ sellers, counts });
}
