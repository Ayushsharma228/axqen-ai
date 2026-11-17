import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encrypt";

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SUPPLIER")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const providers = await prisma.supplierShippingProvider.findMany({
    where: { supplierId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, provider: true, label: true, baseUrl: true, isActive: true, createdAt: true,
      apiKey: true }, // apiKey shown masked on client
  });

  // Decrypt then mask — show only last 4 chars of the plaintext
  const masked = providers.map((p) => {
    const plain = p.apiKey ? decrypt(p.apiKey) : null;
    return {
      ...p,
      apiKey: plain ? `${"*".repeat(Math.max(0, plain.length - 4))}${plain.slice(-4)}` : null,
    };
  });

  return NextResponse.json({ providers: masked });
}

export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SUPPLIER")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider, label, apiKey, apiSecret, baseUrl } = await req.json();
  if (!provider || !label) return NextResponse.json({ error: "provider and label are required" }, { status: 400 });
  if (provider === "CUSTOM" && !baseUrl) return NextResponse.json({ error: "baseUrl is required for custom providers" }, { status: 400 });

  const record = await prisma.supplierShippingProvider.create({
    data: {
      supplierId: session.user.id,
      provider,
      label,
      apiKey:    apiKey    ? encrypt(apiKey)    : null,
      apiSecret: apiSecret ? encrypt(apiSecret) : null,
      baseUrl:   baseUrl   || null,
    },
  });

  return NextResponse.json({ provider: { id: record.id, provider: record.provider, label: record.label, isActive: record.isActive } }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SUPPLIER")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.supplierShippingProvider.deleteMany({
    where: { id, supplierId: session.user.id },
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SUPPLIER")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, isActive } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.supplierShippingProvider.updateMany({
    where: { id, supplierId: session.user.id },
    data: { isActive },
  });

  return NextResponse.json({ success: true });
}
