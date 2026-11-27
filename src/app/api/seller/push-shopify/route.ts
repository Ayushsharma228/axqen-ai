import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getShopifyAccessToken, shopifyGraphql } from "@/lib/shopify";

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

    // Create the product with the GraphQL Admin API (productSet). One "Variant" option when the
    // catalogue product has variants, else Shopify's default single variant.
    const token = await getShopifyAccessToken(shopifyStore.id);
    const shop = shopifyStore.storeUrl;
    const basePrice = product.suggestedPrice ?? product.price;
    let locationId: string | null = null;
    try {
      const loc = await shopifyGraphql<{ locations: { nodes: { id: string }[] } }>(shop, token, `{ locations(first: 1) { nodes { id } } }`);
      locationId = loc.locations.nodes[0]?.id ?? null;
    } catch { /* stock is optional */ }
    const stock = (qty: number) => (locationId ? { inventoryQuantities: [{ locationId, name: "available", quantity: Math.max(0, qty) }] } : {});

    const hasVariants = product.variants.length > 0;
    const optionName = hasVariants ? "Variant" : "Title";
    const productSet = {
      title: product.name,
      descriptionHtml: product.description ?? "",
      vendor: "Axiqen",
      productType: product.category ?? "",
      productOptions: [{ name: optionName, values: hasVariants ? product.variants.map(v => ({ name: v.name })) : [{ name: "Default Title" }] }],
      variants: hasVariants
        ? product.variants.map(v => ({
            optionValues: [{ optionName, name: v.name }],
            price: v.price > 0 ? v.price : basePrice,
            inventoryItem: { sku: v.sku ?? product.sku ?? undefined, tracked: true },
            ...stock(v.stock),
          }))
        : [{
            optionValues: [{ optionName, name: "Default Title" }],
            price: basePrice,
            inventoryItem: { sku: product.sku ?? undefined, tracked: true },
            ...stock(product.stock),
          }],
      files: product.images.filter(src => /^https:\/\//.test(src)).map(src => ({ originalSource: src, contentType: "IMAGE" })),
    };

    let shopifyProductId = "";
    let pushError = "";
    try {
      const d = await shopifyGraphql<{ productSet: { product: { id: string; legacyResourceId: string } | null; userErrors: { message: string }[] } }>(shop, token,
        `mutation($input: ProductSetInput!) { productSet(synchronous: true, input: $input) { product { id legacyResourceId } userErrors { message } } }`,
        { input: productSet });
      if (d.productSet.userErrors.length) pushError = d.productSet.userErrors.map(e => e.message).join("; ");
      shopifyProductId = d.productSet.product?.legacyResourceId ?? "";
    } catch (err) {
      pushError = err instanceof Error ? err.message : "Shopify error";
    }

    if (pushError || !shopifyProductId) {
      console.error("Shopify error:", pushError);
      // Record the failed attempt
      await prisma.listingRequest.create({
        data: { sellerId: session.user.id, productId, platform: "SHOPIFY", status: "FAILED" },
      }).catch(() => {});
      return NextResponse.json({ error: "Failed to push to Shopify. Check that your store is connected and has API access." }, { status: 500 });
    }

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
