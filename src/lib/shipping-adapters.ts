const CARRIER_TRACKING: [RegExp, (awb: string) => string][] = [
  [/delhivery/i,              (awb) => `https://www.delhivery.com/track/package/${awb}`],
  [/ekart/i,                  (awb) => `https://ekartlogistics.com/shipmenttrack/${awb}`],
  [/blue\s*dart/i,            (awb) => `https://www.bluedart.com/tracking?trackFor=0&TrackingNumber=${awb}`],
  [/dtdc/i,                   (awb) => `https://www.dtdc.in/tracking/tracking_results.asp?Ttype=consignee&strCnno=${awb}`],
  [/xpressbees/i,             (awb) => `https://www.xpressbees.com/shipment/tracking?awbNo=${awb}`],
  [/shadowfax/i,              (awb) => `https://tracker.shadowfax.in/?wbn=${awb}`],
  [/shiprocket/i,             (awb) => `https://shiprocket.co/tracking/${awb}`],
  [/ecom\s*express/i,         (awb) => `https://ecomexpress.in/tracking/?awb_field=${awb}`],
  [/smartr/i,                 (awb) => `https://smartr.in/tracking/${awb}`],
  [/amazon/i,                 (awb) => `https://track.amazon.in/tracking/${awb}`],
  [/fedex/i,                  (awb) => `https://www.fedex.com/fedextrack/?trknbr=${awb}`],
  [/dhl/i,                    (awb) => `https://www.dhl.com/in-en/home/tracking.html?tracking-id=${awb}`],
  [/pickrr/i,                 (awb) => `https://pickrr.com/track/#${awb}`],
  [/ekart|e-?kart/i,         (awb) => `https://ekartlogistics.com/shipmenttrack/${awb}`],
];

export function getCarrierTrackingUrl(courier: string, awb: string): string {
  for (const [pattern, buildUrl] of CARRIER_TRACKING) {
    if (pattern.test(courier)) return buildUrl(awb);
  }
  return "";
}

export interface ShipmentInput {
  externalOrderId: string;
  customerName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  totalAmount: number;
  productDesc: string;
  weight?: number;
  length?: number;
  breadth?: number;
  height?: number;
  shipmentMode?: "Surface" | "Express";
}

export interface ShipmentResult {
  awb: string;
  courier: string;
  trackingUrl?: string;
}

// ── Shiprocket ────────────────────────────────────────────────────────────────
export async function shiprocketCreateShipment(
  email: string,
  password: string,
  input: ShipmentInput
): Promise<ShipmentResult> {
  // 1. Authenticate
  const loginRes = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginData = await loginRes.json();
  if (!loginData.token) throw new Error(`Shiprocket auth failed: ${loginData.message ?? "no token"}`);
  const token = loginData.token as string;

  // 2. Create order
  const orderRes = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      order_id: input.externalOrderId,
      order_date: new Date().toISOString().split("T")[0],
      billing_customer_name: input.customerName,
      billing_last_name: "",
      billing_address: input.address,
      billing_city: input.city,
      billing_state: input.state,
      billing_country: "India",
      billing_pincode: input.pincode,
      billing_phone: input.phone,
      shipping_is_billing: true,
      order_items: [{
        name: input.productDesc,
        sku: input.externalOrderId,
        units: 1,
        selling_price: input.totalAmount,
      }],
      payment_method: "COD",
      sub_total: input.totalAmount,
      length:  input.length  ?? 10,
      breadth: input.breadth ?? 10,
      height:  input.height  ?? 5,
      weight:  input.weight  ?? 0.5,
      is_surface: input.shipmentMode !== "Express",
    }),
  });
  const orderData = await orderRes.json();
  if (!orderData.shipment_id) {
    throw new Error(`Shiprocket order failed: ${orderData.message ?? JSON.stringify(orderData)}`);
  }

  // 3. Assign AWB
  const awbRes = await fetch("https://apiv2.shiprocket.in/v1/external/courier/assign/awb", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ shipment_id: orderData.shipment_id }),
  });
  const awbData = await awbRes.json();
  const awb = awbData?.response?.data?.awb_code as string | undefined;
  if (!awb) throw new Error(`Shiprocket AWB failed: ${awbData?.response?.data?.remark ?? "no AWB returned"}`);

  return {
    awb,
    courier: (awbData?.response?.data?.courier_name as string) ?? "Shiprocket",
    trackingUrl: `https://shiprocket.co/tracking/${awb}`,
  };
}

// ── Delhivery: Tracking / Status Poll ────────────────────────────────────────

export interface DelhiveryTrackResult {
  awb: string;
  status: string;       // AXQEN OrderStatus
  statusCode: string;   // raw Delhivery code e.g. "DL"
  statusText: string;   // human-readable
  city: string;
}

const DELHIVERY_STATUS_CODE_MAP: Record<string, string> = {
  MNF: "PROCESSING",
  PU:  "SHIPPED",
  IT:  "IN_TRANSIT",
  OD:  "IN_TRANSIT",
  DL:  "DELIVERED",
  RTO: "RTO",
  RTD: "RTO",
};

export async function delhiveryTrackShipments(
  apiToken: string,
  awbs: string[],
  baseUrl?: string,
): Promise<DelhiveryTrackResult[]> {
  if (!awbs.length) return [];
  const host = baseUrl?.replace(/\/$/, "") || "https://track.delhivery.com";
  const params = new URLSearchParams({ waybill: awbs.join(","), token: apiToken });
  const res = await fetch(`${host}/api/v1/packages/json/?${params}`);
  if (!res.ok) throw new Error(`Delhivery tracking HTTP ${res.status}`);
  const data: Record<string, unknown> = await res.json();
  const shipments = (data.ShipmentData ?? []) as Record<string, unknown>[];

  return shipments.map((entry) => {
    const s = (entry.Shipment ?? {}) as Record<string, unknown>;
    const scans = (s.Scans ?? []) as Record<string, unknown>[];
    const latest = scans[scans.length - 1] ?? {};
    const scanDetail = (latest.ScanDetail ?? {}) as Record<string, unknown>;

    const rawCode = (
      (s.StatusCode ?? s.Status ?? scanDetail.ScanType ?? "") as string
    ).trim().toUpperCase();

    const rawText = (
      (s.Status ?? scanDetail.Scan ?? "") as string
    ).trim();

    const city = ((s.PickUpLocation ?? scanDetail.ScannedLocation ?? "") as string).trim();
    const awbNo = (s.Waybill ?? "") as string;
    const axqenStatus = DELHIVERY_STATUS_CODE_MAP[rawCode] ?? "";

    return { awb: awbNo, status: axqenStatus, statusCode: rawCode, statusText: rawText, city };
  });
}

// ── Custom REST API ───────────────────────────────────────────────────────────
export async function customCreateShipment(
  apiKey: string,
  baseUrl: string,
  input: ShipmentInput
): Promise<ShipmentResult> {
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Custom API HTTP ${res.status}`);
  const data = await res.json();
  const awb = data.awb ?? data.tracking_number ?? data.waybill ?? data.awb_code;
  if (!awb) throw new Error("Custom API did not return an AWB field");
  return {
    awb: String(awb),
    courier: data.courier ?? data.courier_name ?? "Custom",
    trackingUrl: data.tracking_url ?? data.trackingUrl,
  };
}
