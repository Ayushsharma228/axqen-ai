import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const DEFAULTS: Record<string, { value: string; label: string; description: string; unit: string; type?: "number" | "string" }> = {
  COMMISSION_RATE:          { value: "5",              label: "Commission Rate",            description: "Platform commission charged on every order (% of selling price)", unit: "%" },
  GST_ON_FEES_RATE:         { value: "18",             label: "GST on Fees",                description: "GST applied on platform commission", unit: "%" },
  DEFAULT_SHIPPING_CHARGE:  { value: "50",             label: "Default Shipping Charge",    description: "Shipping charge deducted when order has no explicit value", unit: "₹" },
  DEFAULT_PACKING_CHARGE:   { value: "20",             label: "Default Platform Charge",    description: "Platform charge auto-filled on remittance when order has no explicit value", unit: "₹" },
  REMITTANCE_DAYS:          { value: "7",              label: "Remittance Days",            description: "Days after delivery before seller wallet credit is remitted", unit: "days" },
  ARYA_OUTREACH_TEMPLATE:   { value: "hello_world",   label: "Arya Outreach Template",     description: "Meta-approved WhatsApp template name for first outbound message", unit: "", type: "string" },
  ARYA_FOLLOWUP_TEMPLATE:   { value: "hello_world",   label: "Arya Follow-up Template",    description: "Meta-approved WhatsApp template name for automated follow-ups", unit: "", type: "string" },
  ARYA_TEMPLATE_LANG:       { value: "en_US",         label: "Template Language Code",     description: "Language code for WhatsApp templates (e.g. en_US, hi, en_IN)", unit: "", type: "string" },
  // AiSensy integration
  HILLTECK_API_KEY:          { value: "",                              label: "AiSensy Campaign API Key",   description: "Campaign API Key from AiSensy → Manage → API Key", unit: "", type: "string" },
  HILLTECK_BASE_URL:         { value: "https://backend.aisensy.com",  label: "AiSensy Base URL",           description: "AiSensy API base URL (leave as default)", unit: "", type: "string" },
  HILLTECK_ENABLED:          { value: "false",                        label: "AiSensy Auto-Verify",        description: "Automatically send WhatsApp to all new COD orders via AiSensy", unit: "", type: "string" },
  HILLTECK_WEBHOOK_SECRET:   { value: "",                             label: "AiSensy Webhook Secret",     description: "Optional signing secret for AiSensy webhook verification", unit: "", type: "string" },
  HILLTECK_CAMPAIGN_COD:     { value: "",                             label: "COD Campaign Name",          description: "API Campaign name in AiSensy for COD order verification (e.g. COD_VERIFICATION)", unit: "", type: "string" },
  HILLTECK_CAMPAIGN_SHIPPED: { value: "",                             label: "Shipped Campaign Name",      description: "API Campaign name in AiSensy for shipping notifications (e.g. ORDER_SHIPPED)", unit: "", type: "string" },
};

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.platformConfig.findMany();
  const map  = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const configs = Object.entries(DEFAULTS).map(([key, meta]) => ({
    key,
    value:       map[key] ?? meta.value,
    label:       meta.label,
    description: meta.description,
    unit:        meta.unit,
    type:        meta.type ?? "number",
    isDefault:   !(key in map),
  }));

  return NextResponse.json({ configs });
}

export async function PATCH(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key, value } = await req.json();
  if (!key || value === undefined || value === "")
    return NextResponse.json({ error: "key and value required" }, { status: 400 });
  if (!(key in DEFAULTS))
    return NextResponse.json({ error: "Unknown config key" }, { status: 400 });

  const isString = DEFAULTS[key].type === "string";
  let storedValue: string;
  if (isString) {
    if (!value.trim()) return NextResponse.json({ error: "Value cannot be empty" }, { status: 400 });
    storedValue = value.trim();
  } else {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0)
      return NextResponse.json({ error: "Value must be a non-negative number" }, { status: 400 });
    storedValue = String(num);
  }

  await prisma.platformConfig.upsert({
    where:  { key },
    create: { key, value: storedValue, label: DEFAULTS[key].label },
    update: { value: storedValue },
  });

  return NextResponse.json({ success: true, key, value: storedValue });
}
