import { prisma } from "@/lib/prisma";

// Shipdaak API (one AXQEN platform account). Docs: app.shipdaak.com/api-documentation
// Credentials: SHIPDAAK_EMAIL / SHIPDAAK_PASSWORD. Two hosts are used, as documented.
const API = "https://api.shipdaak.com/v1";
const APP = "https://app.shipdaak.com/api";

export function shipdaakConfigured() {
  return Boolean(process.env.SHIPDAAK_EMAIL && process.env.SHIPDAAK_PASSWORD);
}

// ── Auth ──────────────────────────────────────────────────────────────────────
let cachedToken: string | null = null;

async function login(): Promise<string> {
  if (!shipdaakConfigured()) throw new Error("Shipdaak is not configured (SHIPDAAK_EMAIL / SHIPDAAK_PASSWORD)");
  const res = await fetch(`${API}/auth/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body:    JSON.stringify({ email: process.env.SHIPDAAK_EMAIL, password: process.env.SHIPDAAK_PASSWORD }),
  });
  const d = (await res.json().catch(() => ({}))) as { access_token?: string; message?: string };
  if (!res.ok || !d.access_token) throw new Error(`Shipdaak login failed: ${d.message ?? `HTTP ${res.status}`}`);
  cachedToken = d.access_token;
  return cachedToken;
}

type Envelope<T> = { status?: boolean; message?: string; data?: T };

/** Authenticated request; logs in on first use and retries once if the token was rejected. */
async function call<T>(url: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<Envelope<T>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = cachedToken ?? (await login());
    const res = await fetch(url, {
      method:  init.method ?? "GET",
      headers: {
        Authorization:  `Bearer ${token}`,
        Accept:         "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    if (res.status === 401 && attempt === 0) { cachedToken = null; continue; }
    const d = (await res.json().catch(() => ({}))) as Envelope<T>;
    if (!res.ok || d.status === false) throw new Error(d.message || `Shipdaak HTTP ${res.status}`);
    return d;
  }
  throw new Error("Shipdaak authentication failed");
}

// ── Couriers & warehouses ─────────────────────────────────────────────────────
export async function getCouriers() {
  return (await call<{ id: number; name: string }[]>(`${API}/courier/get-courier`)).data ?? [];
}

type ShipdaakWarehouse = { id: number; name: string; zip?: string };

export async function listWarehouses() {
  return (await call<ShipdaakWarehouse[]>(`${APP}/warehouse/list`)).data ?? [];
}

/**
 * Returns the Shipdaak warehouse ID for an AXQEN supplier warehouse, creating it in Shipdaak on first use.
 * The mapping is kept in PlatformConfig (key SHIPDAAK_WH_<warehouseId>), so no schema change is needed.
 */
export async function ensureShipdaakWarehouse(warehouseId: string): Promise<number> {
  const key = `SHIPDAAK_WH_${warehouseId}`;
  const mapped = await prisma.platformConfig.findUnique({ where: { key } });
  if (mapped && Number(mapped.value) > 0) return Number(mapped.value);

  const w = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!w) throw new Error("Warehouse not found");

  // A unique name lets us find the warehouse again (the create response format isn't documented).
  const name = `AXQEN-${w.id.slice(-10)}`;
  const findByName = async () => (await listWarehouses()).find((x) => x.name === name)?.id;

  let shipdaakId = await findByName();
  if (!shipdaakId) {
    await call(`${API}/warehouse/create-warehouse`, {
      method: "POST",
      body: {
        pickup_location: {
          warehouse_name: name,
          contact_name:   w.contactName,
          address_line_1: w.addressLine1,
          address_line_2: w.addressLine2 ?? "",
          phone:          Number(digits10(w.phone)),
          pincode:        Number(w.pincode.replace(/\D/g, "")),
        },
        has_different_rto: false,
      },
    });
    shipdaakId = await findByName();
  }
  if (!shipdaakId) throw new Error("Warehouse was created in Shipdaak but could not be found. Check the Shipdaak dashboard.");

  await prisma.platformConfig.upsert({
    where:  { key },
    create: { key, value: String(shipdaakId), label: `Shipdaak warehouse for ${w.name}` },
    update: { value: String(shipdaakId) },
  });
  return shipdaakId;
}

// ── Shipments ─────────────────────────────────────────────────────────────────
export type ShipdaakShipmentInput = {
  orderNo: string;
  payType: "cod" | "prepaid";
  totalAmount: number;
  weightGrams: number;
  length: number; breadth: number; height: number;
  warehouseId: number;
  courierId?: number;
  consignee: { name: string; address1: string; city: string; state: string; pincode: string; phone: string };
  items: { name: string; quantity: number; price: number; sku?: string | null }[];
};

export type ShipdaakShipment = {
  order_id: number;
  shipment_id: number;
  awb_number: string;
  courier_name: string;
  status: string;
  label?: string;
  manifest?: string;
};

export async function createShipment(i: ShipdaakShipmentInput): Promise<ShipdaakShipment> {
  const d = await call<ShipdaakShipment>(`${API}/shipments/generate-shipment`, {
    method: "POST",
    body: {
      order_no:            i.orderNo,
      pay_type:            i.payType,
      weight:              Math.max(1, Math.round(i.weightGrams)),
      dimensions:          { length: i.length, breadth: i.breadth, height: i.height },
      total_amount:        i.totalAmount,
      ...(i.courierId ? { courier: i.courierId } : {}), // empty → Shipdaak autoship rule picks the courier
      pickup_warehouse:    i.warehouseId,
      rto_warehouse:       i.warehouseId,
      label_format:        "thermal",
      auto_pickup:         "yes",
      is_shipment_created: "yes",
      consignee: {
        name:     i.consignee.name,
        address1: i.consignee.address1,
        city:     i.consignee.city,
        state:    i.consignee.state,
        pincode:  i.consignee.pincode.replace(/\D/g, ""),
        phone:    digits10(i.consignee.phone),
      },
      order_items: i.items.map((it) => ({ name: it.name, quantity: it.quantity, price: it.price, ...(it.sku ? { sku: it.sku } : {}) })),
    },
  });
  if (!d.data?.awb_number) throw new Error(d.message || "Shipdaak did not return an AWB");
  return d.data;
}

export type ShipdaakTracking = {
  awbNumber: string;
  status: string;
  rtoStatus?: string;
  rtoAwb?: string;
  courierName?: string;
  deliveredDate?: string | null;
  rtoInitiateDate?: string | null;
  history?: { statusCode: string; location: string; eventTime: string; message: string }[];
};

/** Raw Shipdaak tracking reply (used by the admin tracking check). */
export async function trackShipmentRaw(awb: string) {
  return call<unknown>(`${API}/shipments/track-shipment/${encodeURIComponent(awb)}`);
}

type Loose = Record<string, unknown>;
const pickStr = (o: Loose, ...keys: string[]) => {
  for (const k of keys) { const v = o[k]; if (v != null && String(v).trim()) return String(v).trim(); }
  return "";
};
const isObj = (v: unknown): v is Loose => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Shipdaak's tracking reply isn't documented field by field, so read it leniently:
 * the shipment may sit at data, data[0] or one level deeper, and scans may be called
 * history / scans / tracking / track_history / activities with snake_case or camelCase fields.
 */
export function normalizeShipdaakTracking(raw: unknown, awb: string): ShipdaakTracking | null {
  let d: unknown = raw;
  if (Array.isArray(d)) d = d[0];
  if (!isObj(d)) return null;
  for (const k of ["shipment", "tracking", "tracking_data", "trackingData", "shipment_track", "data"]) {
    const inner = (d as Loose)[k];
    const cand = Array.isArray(inner) && isObj(inner[0]) && !("location" in (inner[0] as Loose)) ? inner[0] : inner;
    if (isObj(cand) && (pickStr(cand, "status", "current_status", "currentStatus", "shipment_status") || Array.isArray((cand as Loose).history))) { d = cand; break; }
  }
  const o = d as Loose;
  const listKey = ["history", "scans", "tracking", "track_history", "trackHistory", "scan_history", "activities", "shipment_track_activities", "tracking_history", "events"]
    .find(k => Array.isArray(o[k]));
  const list = (listKey ? (o[listKey] as unknown[]) : []).filter(isObj).map(h => ({
    statusCode: pickStr(h, "statusCode", "status_code", "status", "activity", "scan", "scan_type", "current_status"),
    location: pickStr(h, "location", "scan_location", "scanLocation", "city", "hub"),
    eventTime: pickStr(h, "eventTime", "event_time", "date", "datetime", "date_time", "scan_date_time", "scanDateTime", "time", "updated_at", "created_at"),
    message: pickStr(h, "message", "remarks", "remark", "instructions", "description", "activity", "status"),
  })).filter(h => h.eventTime);
  // Newest first, whatever order Shipdaak used
  list.sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime());
  const status = pickStr(o, "status", "current_status", "currentStatus", "shipment_status", "shipmentStatus", "status_name") || list[0]?.statusCode || "";
  if (!status && !list.length) return null;
  return {
    awbNumber: pickStr(o, "awbNumber", "awb_number", "awb") || awb,
    status,
    rtoStatus: pickStr(o, "rtoStatus", "rto_status") || undefined,
    rtoAwb: pickStr(o, "rtoAwb", "rto_awb", "rto_awb_number") || undefined,
    courierName: pickStr(o, "courierName", "courier_name", "courier") || undefined,
    deliveredDate: pickStr(o, "deliveredDate", "delivered_date") || null,
    rtoInitiateDate: pickStr(o, "rtoInitiateDate", "rto_initiate_date", "rto_initiated_date") || null,
    history: list,
  };
}

export async function trackShipment(awb: string) {
  const d = await trackShipmentRaw(awb);
  return normalizeShipdaakTracking(d.data ?? d, awb);
}

export async function cancelShipment(awb: string) {
  await call(`${API}/shipments/cancel-shipment`, { method: "POST", body: { awb_number: awb } });
}

export async function getLabel(awbs: string[], format: "thermal" | "standard" = "thermal") {
  return (await call<string>(`${API}/shipments/label-awb`, { method: "POST", body: { awb_nos: awbs, label_format: format } })).data ?? null;
}

export async function getManifest(awbs: string[]) {
  return (await call<string>(`${API}/shipments/manifest-awb`, { method: "POST", body: { awb_nos: awbs } })).data ?? null;
}

export type NdrAction =
  | { action: "re-attempt"; reAttemptDate: string; remarks?: string }
  | { action: "change address"; name: string; address1: string; address2?: string; remarks?: string }
  | { action: "change phone"; phone: string; remarks?: string };

/** Note: Shipdaak's documented success response for NDR actions also has status:false, so only HTTP errors and known error messages are treated as failures here. */
export async function ndrAction(awb: string, a: NdrAction) {
  const body: Record<string, string> = { awb_number: awb, action: a.action, remarks: a.remarks ?? "" };
  if (a.action === "re-attempt") body.re_attempt_date = a.reAttemptDate;
  if (a.action === "change address") {
    body.customer_details_name = a.name;
    body.customer_details_address_1 = a.address1;
    body.customer_details_address_2 = a.address2 ?? "";
  }
  if (a.action === "change phone") body.customer_contact_phone = digits10(a.phone);

  const token = cachedToken ?? (await login());
  const res = await fetch(`${APP}/ndr/action`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  const d = (await res.json().catch(() => ({}))) as Envelope<unknown>;
  const ok = res.ok && /success/i.test(d.message ?? "");
  if (!ok) throw new Error(d.message || `Shipdaak HTTP ${res.status}`);
  return d.message;
}

// ── Status mapping ────────────────────────────────────────────────────────────
// Shipdaak's full status list isn't documented; keyword matching mirrors the Delhivery mapper.
// Raw statuses are written to the order timeline so the mapping can be refined from real data.
export function mapShipdaakStatus(t: ShipdaakTracking): { status: "SHIPPED" | "IN_TRANSIT" | "DELIVERED" | "RTO" | "CANCELLED" | null; ndr: boolean } {
  const s = `${t.status ?? ""}`.toLowerCase().replace(/[_-]+/g, " ");
  const rto = `${t.rtoStatus ?? ""}`.trim();
  if (rto || t.rtoInitiateDate || /\brto\b|return to origin|returned/.test(s)) return { status: "RTO", ndr: false };
  if (/cancel/.test(s)) return { status: "CANCELLED", ndr: false };
  if (/\bdelivered\b/.test(s) && !/undelivered|not delivered/.test(s)) return { status: "DELIVERED", ndr: false };
  if (/undelivered|not delivered|ndr|delivery failed|failed attempt/.test(s)) return { status: "IN_TRANSIT", ndr: true };
  if (/transit|out for delivery|\bofd\b|reached|arrived|in scan|destination/.test(s)) return { status: "IN_TRANSIT", ndr: false };
  if (/picked up|pickup done|shipped|dispatched|manifested and picked/.test(s)) return { status: "SHIPPED", ndr: false };
  return { status: null, ndr: false }; // booked / pending pickup etc. — no change
}

export const SHIPDAAK_COURIER_PREFIX = "Shipdaak · ";

function digits10(phone: string) {
  return phone.replace(/\D/g, "").slice(-10);
}
