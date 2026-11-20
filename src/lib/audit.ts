import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Admin audit trail. getRouteSession() calls recordAdminRequest() for every admin change request
// (POST/PATCH/PUT/DELETE), so all admin actions are logged without touching each route.

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const SECRET_KEY = /pass(word)?|token|secret|otp|apikey|api_key|accountnumber|account_number|cvv|pin$/i;
const MAX_DETAIL_CHARS = 4000;

// Readable names for the admin areas, by the first path segment after /api/admin/.
const AREAS: Record<string, string> = {
  activation: "Activation", "ad-spend": "Meta Ads", amazon: "Amazon", automation: "Automation", blog: "Blog",
  config: "Config", crm: "CRM", finance: "Finance", hillteck: "HillTeck", inventory: "Inventory",
  "invoice-pricing": "Invoice pricing", invoices: "Invoices", kyc: "KYC", "listing-os": "Listings", listings: "Listings",
  meta: "Meta Ads", ndr: "NDR", notifications: "Notifications", "order-confirmation": "Order confirmation", orders: "Orders",
  "plan-billing": "Plan billing", products: "Products", reconciliation: "Reconciliation", remittance: "Remittance",
  rewards: "Rewards", rto: "RTO", sellers: "Sellers", shipdaak: "Shipping", "supplier-payables": "Supplier payables",
  support: "Support", team: "Team", users: "Team", wallet: "Wallet", whatsapp: "WhatsApp", withdrawals: "Withdrawals",
  "ai-workforce": "AI workforce", "backfill-payment-mode": "Maintenance", delivery: "Shipping", system: "System",
};

export function areaFor(path: string) {
  const seg = path.replace(/^\/api\/admin\/?/, "").split(/[/?]/)[0];
  return AREAS[seg] ?? (seg ? seg.replace(/-/g, " ") : "Admin");
}

/** Removes secrets and trims long values so the log never holds passwords, tokens or full bank numbers. */
function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "…";
  if (Array.isArray(value)) return value.slice(0, 50).map(v => redact(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) ? "[hidden]" : redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "string" && value.length > 500) return value.slice(0, 500) + "…";
  return value;
}

const ID_AFTER = /\/(?:sellers|wallet|activation|kyc|plan-billing)\/([a-z0-9]{20,})/i;

export async function recordAdminRequest(req: NextRequest, actor: { id: string; email: string | null; role: string }) {
  if (!WRITE_METHODS.has(req.method)) return;
  const url = req.nextUrl;
  if (!url.pathname.startsWith("/api/admin")) return;

  let body: unknown = null;
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const text = await req.clone().text();
      body = text ? JSON.parse(text) : null;
    } else if (type.includes("multipart/form-data")) {
      body = { upload: true }; // file uploads: record that one happened, not the file
    }
  } catch { body = null; }

  const clean = redact(body) as Record<string, unknown> | null;
  const sellerId =
    (clean && typeof clean === "object" && typeof clean.sellerId === "string" ? clean.sellerId : null) ??
    url.pathname.match(ID_AFTER)?.[1] ?? url.searchParams.get("sellerId");

  let details: unknown = clean;
  const json = JSON.stringify(clean ?? null);
  if (json.length > MAX_DETAIL_CHARS) details = { truncated: true, preview: json.slice(0, MAX_DETAIL_CHARS) };

  await prisma.auditLog.create({
    data: {
      actorId: actor.id, actorEmail: actor.email, actorRole: actor.role,
      method: req.method, path: url.pathname + (url.search || ""), area: areaFor(url.pathname),
      sellerId: sellerId ?? null,
      details: details === null ? undefined : (details as object),
      ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
    },
  }).catch(err => console.error("[audit] could not record", err));
}
