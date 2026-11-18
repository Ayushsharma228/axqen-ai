import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { getInvoiceSettings, saveInvoiceSettings, type InvoiceSettings } from "@/lib/invoices";

async function admin(req: NextRequest) {
  const s = await getRouteSession(req);
  return s?.user.role === "ADMIN" ? s : null;
}

export async function GET(req: NextRequest) {
  if (!(await admin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ settings: await getInvoiceSettings() });
}

export async function PUT(req: NextRequest) {
  if (!(await admin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as { settings?: InvoiceSettings } | null;
  const s = body?.settings;
  if (!s?.company?.name || !s.company.gstin || !/^\d{2}$/.test(s.company.stateCode ?? "")) {
    return NextResponse.json({ error: "Company name, GSTIN and a 2-digit state code are required" }, { status: 400 });
  }
  if (!/^[A-Z0-9]{1,6}$/.test(s.series ?? "")) return NextResponse.json({ error: "Series should be 1 to 6 capital letters or digits, e.g. AXP" }, { status: 400 });
  const digits = Number(s.digits);
  if (!(digits >= 3 && digits <= 6)) return NextResponse.json({ error: "Number length should be 3 to 6 digits" }, { status: 400 });
  // GST allows at most 16 characters in an invoice number: SERIES/YY-YY/NNNNN
  if (s.series.length + 7 + digits > 16) return NextResponse.json({ error: "Invoice number would be longer than 16 characters. Shorten the series or the digits." }, { status: 400 });
  for (const line of [s.shipping, s.packing]) {
    if (!line?.sac || !(Number(line.rate) >= 0 && Number(line.rate) <= 28)) return NextResponse.json({ error: "Shipping and packing need a SAC code and a GST rate between 0 and 28" }, { status: 400 });
  }
  await saveInvoiceSettings({
    ...s,
    digits,
    shipping: { ...s.shipping, rate: Number(s.shipping.rate) },
    packing: { ...s.packing, rate: Number(s.packing.rate), amount: Math.max(0, Math.round((Number(s.packing.amount) || 0) * 100) / 100) },
    company: { ...s.company, addressLines: (s.company.addressLines ?? []).map(l => l.trim()).filter(Boolean) },
  });
  return NextResponse.json({ ok: true });
}
