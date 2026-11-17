import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhook } from "@/lib/shopify";

export async function POST(req: NextRequest) {
  const body  = await req.text();
  const hmac  = req.headers.get("x-shopify-hmac-sha256");
  const topic = req.headers.get("x-shopify-topic");
  const shop  = req.headers.get("x-shopify-shop-domain");

  if (!(await verifyWebhook(body, hmac, shop))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (topic === "app/uninstalled" && shop) {
    await prisma.shopifyStore.deleteMany({ where: { storeUrl: shop } });
  }

  // GDPR webhooks — acknowledge immediately.
  // customers/data_request, customers/redact, shop/redact
  // Customer data in orders is retained per our privacy policy.
  // Implement data export/deletion here if storing additional PII.

  return NextResponse.json({ ok: true });
}
