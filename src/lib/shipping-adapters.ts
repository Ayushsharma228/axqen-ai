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

// ── Delhivery ─────────────────────────────────────────────────────────────────
export async function delhiveryCreateShipment(
  apiToken: string,
  input: ShipmentInput,
  pickupLocationName?: string,
): Promise<ShipmentResult> {
  const pickupName = pickupLocationName?.trim() || "";
  if (!pickupName) throw new Error("Delhivery: Pickup Location Name not set. Go to Profile → Shipping → edit your Delhivery provider and fill in the Pickup Location Name.");

  const returnAdd     = process.env.RETURN_ADDRESS ?? "";
  const returnCity    = process.env.RETURN_CITY    ?? "";
  const returnState   = process.env.RETURN_STATE   ?? "";
  const returnPincode = process.env.RETURN_PINCODE ?? "";
  const returnPhone   = process.env.RETURN_PHONE   ?? "";

  const shipment: Record<string, unknown> = {
    name:           input.customerName,
    add:            input.address,
    city:           input.city,
    state:          input.state,
    country:        "India",
    pin:            input.pincode,
    phone:          input.phone.replace(/\D/g, "").slice(-10),
    order:          input.externalOrderId,
    payment_mode:   "COD",
    products_desc:  input.productDesc,
    cod_amount:     String(input.totalAmount),
    order_date:     new Date().toISOString().replace("T", " ").split(".")[0],
    total_amount:   String(input.totalAmount),
    seller_inv:     input.externalOrderId,
    quantity:       "1",
    waybill:        "",
    shipment_width:  input.breadth ?? 13,
    shipment_height: input.height  ?? 4,
    weight:          input.weight  ?? 0.5,
    shipment_length: input.length  ?? 23,
    pickup_location: pickupName,
    // Only set shipment_type for Express — Surface is Delhivery's default
    ...(input.shipmentMode === "Express" ? { shipment_type: "Express" } : {}),
  };

  // Only include return address fields when we have valid data
  if (returnAdd && returnCity && returnPincode) {
    shipment.return_add     = returnAdd;
    shipment.return_city    = returnCity;
    shipment.return_state   = returnState;
    shipment.return_pin     = returnPincode;
    shipment.return_phone   = returnPhone;
    shipment.return_country = "India";
  }

  const payload = {
    shipments: [shipment],
    pickup_location: { name: pickupName },
  };

  const res = await fetch("https://track.delhivery.com/api/cmu/create.json", {
    method: "POST",
    headers: { Authorization: `Token ${apiToken}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: `format=json&data=${encodeURIComponent(JSON.stringify(payload))}`,
  });

  const rawText = await res.text();
  console.error("[Delhivery] mode=%s status=%d body=%s", input.shipmentMode, res.status, rawText.slice(0, 1000));
  if (!res.ok) throw new Error(`Delhivery HTTP ${res.status}: ${rawText.slice(0, 500)}`);

  let result: Record<string, unknown>;
  try { result = JSON.parse(rawText); }
  catch { throw new Error(`Delhivery bad response: ${rawText.slice(0, 500)}`); }

  const pkg = (result?.packages as Record<string, unknown>[])?.[0];
  if (!pkg?.waybill || pkg?.status === "Error") {
    const remark = (pkg?.remark ?? result?.rmk ?? result?.error ?? JSON.stringify(result).slice(0, 300)) as string;
    // "internal Error" = Express not enabled on this Delhivery account / pickup location
    if (typeof remark === "string" && remark.toLowerCase().includes("internal error")) {
      throw new Error(`Delhivery Express is not enabled for your pickup location or account. Log into one.delhivery.com and ensure your pickup point has Express (Air) service active, or contact Delhivery support.`);
    }
    throw new Error(`Delhivery: ${remark}`);
  }

  return {
    awb: pkg.waybill as string,
    courier: "Delhivery",
    trackingUrl: `https://www.delhivery.com/track/package/${pkg.waybill}`,
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
