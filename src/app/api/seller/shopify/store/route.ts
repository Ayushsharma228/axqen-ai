import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getRouteSession(req);
    if (!session || session.user.role !== "SELLER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const store = await prisma.shopifyStore.findUnique({
      where: { sellerId: session.user.id },
      select: { id: true, storeName: true, storeUrl: true, createdAt: true, lastSyncAt: true, lastSyncError: true },
    });

    return NextResponse.json({ store });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await prisma.shopifyStore.deleteMany({ where: { sellerId: session.user.id } });
  return NextResponse.json({ success: true });
}
