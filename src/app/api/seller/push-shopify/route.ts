import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getShopifyAccessToken, SHOPIFY_API_VERSION } from "@/lib/shopify";
import { decrypt } from "@/lib/encrypt";

export async function POST(req: NextRequest) {
  try {
    const session = await getRouteSession(req);
    if (!session || session.user.role !== "SELLER" || session.user.plan !== "DROPSHIPPING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productId } = await req.json();

    const [product, shopifyStore, alreadyPushed] = await Promise.all([
      prisma.product.findUnique({
        where:   { id: productId },
        include: { variants: true },
      }),
      prisma.shopifyStore.findUnique({ where: { sellerId: session.user.id } }),
      prisma.listingRequest.findFirst({
        where: { sellerId: session.user.id, productId, platform: "SHOPIFY", status: "LISTED" },
      }),
    ]);

    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    if (!shopifyStore) {
      return NextResponse.json({ error: "No Shopify store connected. Please connect your store first." }, { status: 400 });
    }
    if (alreadyPushed) {
      return NextResponse.json({ message: "Already pushed to Shopify", alreadyPushed: true });
    }

    // Build variants: use ProductVariant records if they exist, else fall back to single variant
    const sellPrice = (product.suggestedPrice ?? product.price).toString();
    const shopifyVariants = product.variants.length > 0
      ? product.variants.map((v) => ({
          option1: v.name,
          price:   (v.price > 0 ? v.price : product.suggestedPrice ?? product.price).toString(),
          sku:     v.sku ?? product.sku ?? undefined,
          inventory_quantity: v.stock,
        }))
      : [{ price: sellPrice, sku: product.sku ?? undefined, inventory_quantity: product.stock }];

    const shopifyOptions = product.variants.length > 0
      ? [{ name: "Variant", values: product.variants.map((v) => v.name) }]
      : undefined;

    const shopifyRes = await fetch(
      `https://${shopifyStore.storeUrl}/admin/api/${SHOPIFY_API_VERSION}/products.json`,
      {
        method:  "POST",
        headers: {
          "Content-Type":            "application/json",
          "X-Shopify-Access-Token":  await getShopifyAccessToken(shopifyStore.id),
        },
        body: JSON.stringify({
          product: {
            title:        product.name,
            body_html:    product.description ?? "",
            vendor:       "Axiqen",
            product_type: product.category ?? "",
            variants:     shopifyVariants,
            ...(shopifyOptions ? { options: shopifyOptions } : {}),
            images:       product.images.map((src) => ({ src })),
          },
        }),
      }
    );

    if (!shopifyRes.ok) {
      const err = await shopifyRes.json().catch(() => ({}));
      console.error("Shopify error:", err);
      // Record the failed attempt
      await prisma.listingRequest.create({
        data: { sellerId: session.user.id, productId, platform: "SHOPIFY", status: "FAILED" },
      }).catch(() => {});
      return NextResponse.json({ error: "Failed to push to Shopify. Check that your store is connected and has API access." }, { status: 500 });
    }

    const shopifyData = await shopifyRes.json() as { product?: { id: number } };
    const shopifyProductId = String(shopifyData.product?.id ?? "");

    // Record successful push
    await prisma.listingRequest.create({
      data: {
        sellerId:  session.user.id,
        productId,
        platform:  "SHOPIFY",
        status:    "LISTED",
        listedUrl: shopifyProductId
          ? `https://${shopifyStore.storeUrl}/admin/products/${shopifyProductId}`
          : undefined,
      },
    }).catch(() => {});

    return NextResponse.json({ message: "Product pushed to Shopify successfully" });
  } catch (error) {
    console.error("Push Shopify error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
