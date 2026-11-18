// AXP tax invoices — Vrinandya Ventures Pvt. Ltd. bills the seller for each delivered order:
// product (its HSN + GST rate), shipping and packing, all priced GST-inclusive per unit in the catalogue.
// The taxable value and tax are worked backwards; CGST+SGST inside Uttar Pradesh (09), IGST elsewhere.
import { prisma } from "@/lib/prisma";
import { COURIER_SCAN } from "@/lib/courier-scans";
import { r2, type InvoiceSettings, type InvoiceLine, type InvoiceBuyer } from "@/lib/invoice-format";
export { amountInWords, r2 } from "@/lib/invoice-format";
export type { InvoiceSettings, InvoiceLine, InvoiceBuyer } from "@/lib/invoice-format";

// ── Settings (PlatformConfig key INVOICE_SETTINGS, editable in Admin → Invoices → Settings) ──────────
export const DEFAULT_SETTINGS: InvoiceSettings = {
  company: {
    name: "Vrinandya Ventures Pvt. Ltd.",
    addressLines: ["4/210 Unt Gali", "Kacheri Ghat", "Agra"],
    gstin: "09AALCV7054P1ZD",
    stateName: "Uttar Pradesh",
    stateCode: "09",
    email: "connect@vrinandyaventures.in",
    cin: "U63112UP2025PTC239392",
  },
  bank: { holder: "Vrinandya Ventures Pvt. Ltd.", bankName: "YES BANK", account: "017520700000763", branchIfsc: "Dayalbagh & YESB0000175", swift: "" },
  declaration: "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",
  series: "AXP",
  digits: 5,
  shipping: { label: "Shipping Charges", sac: "996812", rate: 18 },
  packing: { label: "Packing Charges", sac: "998540", rate: 18 },
};

const SETTINGS_KEY = "INVOICE_SETTINGS";

export async function getInvoiceSettings(): Promise<InvoiceSettings> {
  const row = await prisma.platformConfig.findUnique({ where: { key: SETTINGS_KEY } }).catch(() => null);
  if (!row) return DEFAULT_SETTINGS;
  try {
    const saved = JSON.parse(row.value) as Partial<InvoiceSettings>;
    return {
      ...DEFAULT_SETTINGS, ...saved,
      company: { ...DEFAULT_SETTINGS.company, ...(saved.company ?? {}) },
      bank: { ...DEFAULT_SETTINGS.bank, ...(saved.bank ?? {}) },
      shipping: { ...DEFAULT_SETTINGS.shipping, ...(saved.shipping ?? {}) },
      packing: { ...DEFAULT_SETTINGS.packing, ...(saved.packing ?? {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveInvoiceSettings(s: InvoiceSettings) {
  await prisma.platformConfig.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: JSON.stringify(s), label: "Invoice settings" },
    update: { value: JSON.stringify(s) },
  });
}

// ── GST state codes ─────────────────────────────────────────────────────────────────────────────────
export const STATE_CODES: Record<string, string> = {
  "jammu and kashmir": "01", "himachal pradesh": "02", "punjab": "03", "chandigarh": "04", "uttarakhand": "05",
  "haryana": "06", "delhi": "07", "rajasthan": "08", "uttar pradesh": "09", "bihar": "10", "sikkim": "11",
  "arunachal pradesh": "12", "nagaland": "13", "manipur": "14", "mizoram": "15", "tripura": "16", "meghalaya": "17",
  "assam": "18", "west bengal": "19", "jharkhand": "20", "odisha": "21", "chhattisgarh": "22", "madhya pradesh": "23",
  "gujarat": "24", "dadra and nagar haveli and daman and diu": "26", "maharashtra": "27", "andhra pradesh": "37",
  "karnataka": "29", "goa": "30", "lakshadweep": "31", "kerala": "32", "tamil nadu": "33", "puducherry": "34",
  "andaman and nicobar islands": "35", "telangana": "36", "ladakh": "38",
};
const ALIASES: Record<string, string> = {
  "orissa": "odisha", "uttaranchal": "uttarakhand", "pondicherry": "puducherry", "new delhi": "delhi", "nct of delhi": "delhi",
  "j&k": "jammu and kashmir", "jammu & kashmir": "jammu and kashmir", "up": "uttar pradesh", "mp": "madhya pradesh",
  "tn": "tamil nadu", "wb": "west bengal", "a&n islands": "andaman and nicobar islands", "daman and diu": "dadra and nagar haveli and daman and diu",
  "dadra and nagar haveli": "dadra and nagar haveli and daman and diu",
};
const titleCase = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase()).replace(/\bAnd\b/g, "and");

/** State name + GST code. GSTIN's first two digits win when present. */
export function resolveState(stateName?: string | null, gstin?: string | null): { name: string; code: string } | null {
  if (gstin && /^\d{2}/.test(gstin)) {
    const code = gstin.slice(0, 2);
    const name = Object.entries(STATE_CODES).find(([, c]) => c === code)?.[0];
    if (name) return { name: titleCase(name), code };
  }
  if (!stateName) return null;
  let key = stateName.trim().toLowerCase().replace(/\s+/g, " ");
  key = ALIASES[key] ?? key;
  const code = STATE_CODES[key];
  return code ? { name: titleCase(key), code } : null;
}

// ── Financial year & numbering ──────────────────────────────────────────────────────────────────────
const ist = (d: Date) => new Date(d.getTime() + 5.5 * 3600000);
export function financialYear(d: Date) {
  const x = ist(d);
  const y = x.getUTCFullYear() % 100, m = x.getUTCMonth() + 1;
  const start = m >= 4 ? y : y - 1;
  return `${String(start).padStart(2, "0")}-${String((start + 1) % 100).padStart(2, "0")}`;
}

// ── Invoice content ─────────────────────────────────────────────────────────────────────────────────
/** Split a GST-inclusive amount into taxable value + tax. */
function splitInclusive(amount: number, rate: number) {
  const taxable = r2(amount / (1 + rate / 100));
  return { taxable, tax: r2(amount - taxable) };
}

/** Delivery date = time of the courier's "delivered" scan, else when the order turned Delivered. */
async function deliveryDate(orderId: string, fallback: Date) {
  const scans = await prisma.orderTimeline.findMany({
    where: { orderId, eventType: COURIER_SCAN },
    select: { metadata: true },
  });
  const times = scans
    .map(s => (s.metadata ?? {}) as { status?: string; message?: string; time?: string })
    .filter(m => m.time && /\bdelivered\b/i.test(`${m.status} ${m.message}`) && !/undelivered|not delivered|rto/i.test(`${m.status} ${m.message}`))
    .map(m => new Date(m.time!))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());
  return times[0] ?? fallback;
}

export type IssueResult =
  | { status: "ISSUED"; number: string }
  | { status: "HELD"; reason: string }
  | { status: "SKIPPED"; reason: string };

/** Issue (or re-check a held) invoice for one delivered order. Safe to call repeatedly. */
export async function issueInvoiceForOrder(orderId: string): Promise<IssueResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, status: true, sellerId: true, updatedAt: true, externalOrderId: true,
      productCost: true, shippingCharge: true, packingCharge: true,
      items: { select: { name: true, sku: true, quantity: true, productId: true } },
    },
  });
  if (!order) return { status: "SKIPPED", reason: "Order not found" };
  if (order.status !== "DELIVERED") return { status: "SKIPPED", reason: "Order is not delivered" };

  const existing = await prisma.invoice.findUnique({ where: { orderId }, select: { status: true, number: true, createdAt: true } });
  if (existing?.status === "ISSUED" || existing?.status === "CANCELLED") return { status: "SKIPPED", reason: `Invoice already ${existing.status.toLowerCase()}` };
  if (existing?.status === "EXEMPT") return { status: "SKIPPED", reason: "Delivered before invoicing started" };
  const firstSeen = existing?.createdAt ?? new Date();

  const settings = await getInvoiceSettings();
  const seller = await prisma.user.findUnique({
    where: { id: order.sellerId },
    select: { businessName: true, brandName: true, name: true, businessAddress: true, city: true, state: true, pincode: true, gstNumber: true },
  });

  const reasons: string[] = [];
  const state = resolveState(seller?.state, seller?.gstNumber);
  if (!seller?.businessAddress?.trim() || !state) reasons.push("Seller's billing address or state is missing in KYC");

  // Resolve each item to a catalogue product (by link, else by SKU)
  const skus = order.items.filter(i => !i.productId && i.sku).map(i => i.sku!) ;
  const bySku = skus.length
    ? new Map((await prisma.product.findMany({ where: { sku: { in: skus } }, select: { id: true, sku: true } })).map(p => [p.sku!, p.id]))
    : new Map<string, string>();
  const productIds = [...new Set(order.items.map(i => i.productId ?? (i.sku ? bySku.get(i.sku) : undefined)).filter(Boolean) as string[])];
  const products = new Map((await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, hsn: true, gstRate: true, invoicePrice: true, invoiceShipping: true, invoicePacking: true },
  })).map(p => [p.id, p]));

  const lines: InvoiceLine[] = [];
  let shippingTotal = 0, packingTotal = 0, productTotal = 0;
  for (const it of order.items) {
    const pid = it.productId ?? (it.sku ? bySku.get(it.sku) : undefined);
    const p = pid ? products.get(pid) : undefined;
    if (!p) { reasons.push(`"${it.name}" isn't linked to a catalogue product`); continue; }
    if (p.invoicePrice == null || p.gstRate == null || !p.hsn) { reasons.push(`Set invoice price, HSN and GST rate for "${p.name}"`); continue; }
    const qty = Math.max(1, it.quantity);
    const amount = r2(p.invoicePrice * qty);
    const { taxable, tax } = splitInclusive(amount, p.gstRate);
    lines.push({ kind: "PRODUCT", description: p.name, hsn: p.hsn, gstRate: p.gstRate, qty, unit: "Pcs", rate: r2(taxable / qty), taxable, tax, amount });
    productTotal += amount;
    shippingTotal += (p.invoiceShipping ?? 0) * qty;
    packingTotal += (p.invoicePacking ?? 0) * qty;
  }

  if (reasons.length) {
    const reason = [...new Set(reasons)].join("; ");
    await prisma.invoice.upsert({
      where: { orderId },
      create: { orderId, sellerId: order.sellerId, series: settings.series, fy: financialYear(new Date()), status: "HELD", heldReason: reason },
      update: { status: "HELD", heldReason: reason },
    });
    return { status: "HELD", reason };
  }

  shippingTotal = r2(shippingTotal); packingTotal = r2(packingTotal); productTotal = r2(productTotal);
  if (shippingTotal > 0) {
    const { taxable, tax } = splitInclusive(shippingTotal, settings.shipping.rate);
    lines.push({ kind: "SHIPPING", description: settings.shipping.label, hsn: settings.shipping.sac, gstRate: settings.shipping.rate, qty: 1, unit: "Nos", rate: taxable, taxable, tax, amount: shippingTotal });
  }
  if (packingTotal > 0) {
    const { taxable, tax } = splitInclusive(packingTotal, settings.packing.rate);
    lines.push({ kind: "PACKING", description: settings.packing.label, hsn: settings.packing.sac, gstRate: settings.packing.rate, qty: 1, unit: "Nos", rate: taxable, taxable, tax, amount: packingTotal });
  }

  const intra = state!.code === settings.company.stateCode;
  const taxableTotal = r2(lines.reduce((s, l) => s + l.taxable, 0));
  const taxTotal = r2(lines.reduce((s, l) => s + l.tax, 0));
  const cgst = intra ? r2(taxTotal / 2) : 0;
  const sgst = intra ? r2(taxTotal - cgst) : 0;
  const igst = intra ? 0 : taxTotal;
  const total = r2(taxableTotal + taxTotal);

  const buyer: InvoiceBuyer = {
    name: seller!.businessName?.trim() || seller!.brandName?.trim() || seller!.name || "Seller",
    addressLines: [seller!.businessAddress!.trim(), [seller!.city, seller!.pincode].filter(Boolean).join(" - ")].filter(Boolean),
    stateName: state!.name, stateCode: state!.code,
    gstin: seller!.gstNumber?.trim() || null,
  };

  // Payout costs follow the catalogue (only fills empty fields; typed amounts are kept)
  const fill: Record<string, number> = {};
  if (order.productCost == null) fill.productCost = productTotal;
  if (order.shippingCharge == null) fill.shippingCharge = shippingTotal;
  if (order.packingCharge == null) fill.packingCharge = packingTotal;

  const issueDate = await deliveryDate(order.id, firstSeen);
  const fy = financialYear(issueDate);

  // Next number in the series; unique (series, fy, seq) guards against two runs racing.
  for (let attempt = 0; attempt < 4; attempt++) {
    const last = await prisma.invoice.aggregate({ where: { series: settings.series, fy }, _max: { seq: true } });
    const seq = (last._max.seq ?? 0) + 1;
    const number = `${settings.series}/${fy}/${String(seq).padStart(settings.digits, "0")}`;
    try {
      await prisma.$transaction([
        prisma.invoice.upsert({
          where: { orderId },
          create: {
            orderId, sellerId: order.sellerId, series: settings.series, fy, seq, number, status: "ISSUED", issueDate,
            buyer: buyer as never, lines: lines as never, placeOfSupply: `${state!.name} (${state!.code})`,
            taxableTotal, cgst, sgst, igst, total,
          },
          update: {
            series: settings.series, fy, seq, number, status: "ISSUED", heldReason: null, issueDate,
            buyer: buyer as never, lines: lines as never, placeOfSupply: `${state!.name} (${state!.code})`,
            taxableTotal, cgst, sgst, igst, total,
          },
        }),
        ...(Object.keys(fill).length ? [prisma.order.update({ where: { id: order.id }, data: fill })] : []),
      ]);
      return { status: "ISSUED", number };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (!/Unique constraint|P2002/i.test(msg)) throw err;
    }
  }
  return { status: "HELD", reason: "Could not reserve an invoice number, will retry" };
}

const BASELINE_KEY = "INVOICE_BASELINE_AT";

/**
 * Issue invoices for newly delivered orders (cron + admin "Run now").
 * First run: every order already delivered is marked EXEMPT (delivered before invoicing started) and never invoiced.
 */
export async function runInvoiceIssuing(limit = 200) {
  const settings = await getInvoiceSettings();
  const baseline = await prisma.platformConfig.findUnique({ where: { key: BASELINE_KEY } });

  if (!baseline) {
    const delivered = await prisma.order.findMany({ where: { status: "DELIVERED" }, select: { id: true, sellerId: true } });
    for (let i = 0; i < delivered.length; i += 500) {
      await prisma.invoice.createMany({
        data: delivered.slice(i, i + 500).map(o => ({
          orderId: o.id, sellerId: o.sellerId, series: settings.series, fy: financialYear(new Date()), status: "EXEMPT",
          heldReason: "Delivered before AXQEN invoicing started",
        })),
        skipDuplicates: true,
      });
    }
    await prisma.platformConfig.create({ data: { key: BASELINE_KEY, value: new Date().toISOString(), label: "Invoicing start (baseline)" } });
    return { baseline: true, exempted: delivered.length, checked: 0, issued: 0, held: 0, skipped: 0 };
  }

  const since = new Date(new Date(baseline.value).getTime() - 7 * 86400000);
  const candidates = await prisma.order.findMany({
    where: { status: "DELIVERED", updatedAt: { gte: since } },
    select: { id: true },
    orderBy: { updatedAt: "asc" },
    take: 3000,
  });
  const rows = await prisma.invoice.findMany({ where: { orderId: { in: candidates.map(c => c.id) } }, select: { orderId: true, status: true } });
  const state = new Map(rows.map(r => [r.orderId, r.status]));
  const todo = candidates.filter(c => !state.has(c.id) || state.get(c.id) === "HELD").slice(0, limit);

  const out = { baseline: false, exempted: 0, checked: todo.length, issued: 0, held: 0, skipped: 0 };
  for (const c of todo) {
    try {
      const r = await issueInvoiceForOrder(c.id);
      if (r.status === "ISSUED") out.issued++; else if (r.status === "HELD") out.held++; else out.skipped++;
    } catch (err) {
      console.error("[invoices] issue failed", c.id, err);
      out.skipped++;
    }
  }
  return out;
}
