import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhook } from "@/lib/shopify";

// App-level Shopify webhooks: app/uninstalled and the three mandatory privacy (compliance) topics.
// Every request must carry a valid HMAC; anything else gets 401, as Shopify's review checks.
const PRIVACY_TOPICS: Record<string, string> = {
  "customers/data_request": "Customer data request",
  "customers/redact": "Customer data deletion request",
  "shop/redact": "Store data deletion request",
};

export async function POST(req: NextRequest) {
  const body  = await req.text();
  const hmac  = req.headers.get("x-shopify-hmac-sha256");
  const topic = req.headers.get("x-shopify-topic") ?? "";
  const shop  = req.headers.get("x-shopify-shop-domain");

  if (!(await verifyWebhook(body, hmac, shop))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (topic === "app/uninstalled" && shop) {
    await prisma.shopifyStore.deleteMany({ where: { storeUrl: shop } });
    await prisma.platformConfig.deleteMany({ where: { key: `SHOPIFY_PENDING:${shop}` } });
  }

  if (PRIVACY_TOPICS[topic]) {
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(body); } catch { /* keep empty */ }

    // shop/redact arrives 48 hours after uninstall: remove anything left for that store connection.
    if (topic === "shop/redact" && shop) {
      await prisma.shopifyStore.deleteMany({ where: { storeUrl: shop } });
      await prisma.platformConfig.deleteMany({ where: { key: `SHOPIFY_PENDING:${shop}` } });
    }

    // Every request is recorded for the team, who must complete customer requests within 30 days.
    // Orders and tax records needed by law are kept, as the privacy policy says.
    const customer = payload.customer as { id?: number; email?: string } | undefined;
    const orders = (payload.orders_requested ?? payload.orders_to_redact) as number[] | undefined;
    await prisma.auditLog.create({
      data: {
        actorRole: "SHOPIFY", method: "POST", path: `/api/shopify/webhooks · ${topic}`, area: "Shopify privacy",
        details: { topic, shop, customerId: customer?.id ?? null, customerEmail: customer?.email ?? null, orders: orders ?? [] },
      },
    }).catch(() => null);
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    await Promise.all(admins.map(a => prisma.notification.create({
      data: {
        userId: a.id, type: "ORDER_UPDATE",
        title: `Shopify: ${PRIVACY_TOPICS[topic]}`,
        message: `${shop ?? "A store"}${customer?.email ? ` · ${customer.email}` : ""}. Handle within 30 days. Details in Admin → System → Audit log (area "Shopify privacy").`,
        data: { kind: "SHOPIFY_PRIVACY", topic, shop },
      },
    }).catch(() => null)));
  }

  return NextResponse.json({ ok: true });
}
