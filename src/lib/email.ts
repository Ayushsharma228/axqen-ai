import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = "AXQEN <noreply@vrinandyaventures.in>";

function isConfigured(): boolean {
  const key = process.env.RESEND_API_KEY ?? "";
  return key.length > 0 && !key.startsWith("re_your");
}

// ── HTML helpers ─────────────────────────────────────────────────────────────

function base(body: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06)">
<tr><td style="background:#0D1F13;padding:24px 32px;text-align:center">
  <span style="display:inline-block;background:#4361EE;color:#fff;font-weight:bold;font-size:18px;padding:8px 20px;border-radius:8px">AXQEN</span>
</td></tr>
<tr><td style="padding:32px">${body}</td></tr>
<tr><td style="padding:20px 32px;background:#f8f8f8;border-top:1px solid #eee;text-align:center">
  <p style="margin:0;font-size:12px;color:#9ca3af">AXQEN &nbsp;·&nbsp; connect@vrinandyaventures.in &nbsp;·&nbsp; +91 7060401016</p>
  <p style="margin:4px 0 0;font-size:11px;color:#d1d5db">CIN: U63112UP2025PTC239392 &nbsp;·&nbsp; GST: 09AALCV7054P1ZD</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

const h2 = (t: string) => `<h2 style="margin:0 0 8px;font-size:20px;color:#111827">${t}</h2>`;
const p  = (t: string) => `<p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.65">${t}</p>`;
const hr = () => `<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">`;
const badge = (label: string, bg: string) =>
  `<span style="display:inline-block;background:${bg};color:#fff;font-size:11px;font-weight:bold;padding:4px 14px;border-radius:20px;letter-spacing:0.4px;margin-bottom:16px">${label}</span>`;

function kv(rows: [string, string][]): string {
  return `<table style="width:100%;border-collapse:collapse;margin-bottom:16px">${rows
    .map(([k, v]) => `<tr>
      <td style="padding:6px 0;font-size:13px;color:#6b7280;width:150px">${k}</td>
      <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:600">${v}</td>
    </tr>`)
    .join("")}</table>`;
}

const DASH = "https://axqen.app";
const link = (label: string, href: string) =>
  `<a href="${DASH}${href}" style="color:#00C67A;font-weight:600">${label}</a>`;

// ── Send helper ───────────────────────────────────────────────────────────────

async function send(to: string, subject: string, html: string): Promise<void> {
  if (!isConfigured()) return;
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error("[email] send failed:", err);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function emailOrderShipped(opts: {
  to: string; name: string; externalOrderId: string; awb?: string | null; courier?: string | null;
}): Promise<void> {
  await send(
    opts.to,
    `Order Shipped — #${opts.externalOrderId}`,
    base(`
      ${h2("Your order has been shipped!")}
      ${p(`Hi ${opts.name}, the order is on its way to the customer.`)}
      ${badge("SHIPPED", "#3B82F6")}
      ${kv([
        ["Order ID",   `#${opts.externalOrderId}`],
        ...(opts.awb     ? [["AWB Number", opts.awb] as [string,string]]     : []),
        ...(opts.courier ? [["Courier",    opts.courier] as [string,string]] : []),
      ])}
      ${hr()}
      ${p(`Track delivery in your ${link("Seller Dashboard", "/seller/deliveries")}.`)}
    `),
  );
}

export async function emailOrderDelivered(opts: {
  to: string; name: string; externalOrderId: string; amount: number;
}): Promise<void> {
  await send(
    opts.to,
    `Order Delivered — #${opts.externalOrderId}`,
    base(`
      ${h2("Order delivered successfully!")}
      ${p(`Hi ${opts.name}, order #${opts.externalOrderId} has been marked as delivered.`)}
      ${badge("DELIVERED", "#00C67A")}
      ${kv([
        ["Order ID",    `#${opts.externalOrderId}`],
        ["Order Value", `₹${opts.amount.toFixed(2)}`],
      ])}
      ${hr()}
      ${p("Your settlement will be processed within the next remittance cycle.")}
      ${p(`View details in ${link("Finance → Settlements", "/seller/settlements")}.`)}
    `),
  );
}

export async function emailOrderRto(opts: {
  to: string; name: string; externalOrderId: string;
}): Promise<void> {
  await send(
    opts.to,
    `RTO Alert — Order #${opts.externalOrderId} Returned`,
    base(`
      ${h2("Order returned to origin (RTO)")}
      ${p(`Hi ${opts.name}, order #${opts.externalOrderId} has been returned.`)}
      ${badge("RTO", "#F59E0B")}
      ${hr()}
      ${p("Any settlement credit for this order has been automatically reversed. Check your wallet for the updated balance.")}
      ${p(`View full details in your ${link("Orders Dashboard", "/seller/orders")}.`)}
    `),
  );
}

export async function emailOrderCancelled(opts: {
  to: string; name: string; externalOrderId: string;
}): Promise<void> {
  await send(
    opts.to,
    `Order Cancelled — #${opts.externalOrderId}`,
    base(`
      ${h2("Order has been cancelled")}
      ${p(`Hi ${opts.name}, order #${opts.externalOrderId} has been cancelled.`)}
      ${badge("CANCELLED", "#EF4444")}
      ${hr()}
      ${p(`View your orders in the ${link("Seller Dashboard", "/seller/orders")}.`)}
    `),
  );
}

export async function emailSettlementProcessed(opts: {
  to: string; name: string; externalOrderId: string; netPayable: number; status: string;
}): Promise<void> {
  await send(
    opts.to,
    `Settlement Processed — ₹${opts.netPayable.toFixed(2)} Payable`,
    base(`
      ${h2("Settlement processed")}
      ${p(`Hi ${opts.name}, your settlement for order #${opts.externalOrderId} has been processed.`)}
      ${badge(opts.status, "#00C67A")}
      ${kv([
        ["Order ID",    `#${opts.externalOrderId}`],
        ["Net Payable", `₹${opts.netPayable.toFixed(2)}`],
        ["Status",      opts.status],
      ])}
      ${hr()}
      ${p(`View your full statement in ${link("Finance → Settlements", "/seller/settlements")}.`)}
    `),
  );
}

export async function emailKycApproved(opts: { to: string; name: string }): Promise<void> {
  await send(
    opts.to,
    "KYC Approved — Your account is verified",
    base(`
      ${h2("KYC Approved!")}
      ${p(`Hi ${opts.name}, your identity documents have been reviewed and approved by the Vrinandya team.`)}
      ${badge("VERIFIED", "#00C67A")}
      ${hr()}
      ${p("Your account is now fully verified. You are eligible for full payouts and all platform features.")}
      ${p(`Visit your ${link("Seller Dashboard", "/seller")} to get started.`)}
    `),
  );
}

export async function emailKycRejected(opts: { to: string; name: string; reason: string }): Promise<void> {
  await send(
    opts.to,
    "Action Required — KYC Resubmission Needed",
    base(`
      ${h2("KYC resubmission required")}
      ${p(`Hi ${opts.name}, your KYC submission could not be approved.`)}
      ${badge("REJECTED", "#EF4444")}
      ${hr()}
      ${p(`<strong>Reason:</strong> ${opts.reason}`)}
      ${hr()}
      ${p(`Please resubmit your KYC documents from your ${link("Profile page", "/seller/profile")} or contact us at <a href="mailto:connect@vrinandyaventures.in" style="color:#00C67A">connect@vrinandyaventures.in</a>.`)}
    `),
  );
}

export async function emailOnboardingComplete(opts: { to: string; name: string }): Promise<void> {
  await send(
    opts.to,
    "Welcome to AXQEN!",
    base(`
      ${h2(`Welcome, ${opts.name}!`)}
      ${p("You have successfully completed onboarding with AXQEN Private Limited.")}
      ${hr()}
      ${p("Our team is reviewing your details and will activate your account within <strong>24–48 hours</strong>.")}
      ${kv([
        ["Agreement", "Signed ✓"],
        ["KYC",       "Submitted ✓"],
        ["Account",   "Pending review"],
      ])}
      ${hr()}
      ${p("Questions? Reach us at <a href='mailto:connect@vrinandyaventures.in' style='color:#00C67A'>connect@vrinandyaventures.in</a> or call +91 7060401016.")}
    `),
  );
}

export async function emailNdrAlert(opts: {
  to: string; name: string; externalOrderId: string;
  ndrReason: string; ndrAttempts: number; awbNumber?: string | null;
}): Promise<void> {
  const isHighAttempts = opts.ndrAttempts >= 3;
  await send(
    opts.to,
    `Action Required: Delivery Failed — Order #${opts.externalOrderId}`,
    base(`
      ${h2("Delivery attempt failed")}
      ${p(`Hi ${opts.name}, a delivery attempt for order <strong>#${opts.externalOrderId}</strong> has failed.`)}
      ${badge("NDR", "#EF4444")}
      ${kv([
        ["Order ID",    `#${opts.externalOrderId}`],
        ...(opts.awbNumber ? [["AWB", opts.awbNumber] as [string,string]] : []),
        ["Reason",      opts.ndrReason],
        ["Attempts",    String(opts.ndrAttempts)],
      ])}
      ${hr()}
      ${isHighAttempts
        ? p(`<strong style="color:#EF4444">⚠️ This order has had ${opts.ndrAttempts} failed attempts.</strong> Please decide immediately whether to re-attempt or initiate RTO.`)
        : p("Please log in and choose to re-attempt delivery with updated address, or initiate a return (RTO).")
      }
      ${p(`Take action now in your ${link("NDR Dashboard", "/seller/ndr")}.`)}
    `),
  );
}

export async function emailNdrActionedByAdmin(opts: {
  to: string; name: string; externalOrderId: string; action: string;
}): Promise<void> {
  const isRto = opts.action === "RTO";
  await send(
    opts.to,
    `NDR Update — Order #${opts.externalOrderId} ${isRto ? "marked for RTO" : "re-attempt scheduled"}`,
    base(`
      ${h2(`NDR actioned by platform`)}
      ${p(`Hi ${opts.name}, the platform has taken action on the failed delivery for order <strong>#${opts.externalOrderId}</strong>.`)}
      ${badge(isRto ? "RTO" : "RE-ATTEMPT", isRto ? "#F59E0B" : "#3B82F6")}
      ${kv([
        ["Order ID", `#${opts.externalOrderId}`],
        ["Action",   isRto ? "Return to Origin (RTO)" : "Re-attempt Delivery"],
      ])}
      ${hr()}
      ${isRto
        ? p("The order is being returned to origin. Any settlement will be adjusted accordingly.")
        : p("A re-attempt has been scheduled with the courier. You will be notified when delivered.")
      }
      ${p(`View full order in your ${link("Orders Dashboard", "/seller/orders")}.`)}
    `),
  );
}

export async function emailDigest(opts: {
  to: string; name: string; period: string;
  totalOrders: number; delivered: number; rto: number;
  revenue: number; balance: number; unreadNotifs: number;
}): Promise<void> {
  const rtoRate = opts.totalOrders > 0 ? Math.round((opts.rto / opts.totalOrders) * 100) : 0;
  const deliveryRate = opts.totalOrders > 0 ? Math.round((opts.delivered / opts.totalOrders) * 100) : 0;
  await send(
    opts.to,
    `Your ${opts.period} Summary — AXQEN`,
    base(`
      ${h2(`${opts.period} Business Summary`)}
      ${p(`Hi ${opts.name}, here's how your business performed ${opts.period === "Daily" ? "yesterday" : "this week"}.`)}
      ${badge(opts.period.toUpperCase(), "#4361EE")}
      ${kv([
        ["Orders Received",  String(opts.totalOrders)],
        ["Delivered",        `${opts.delivered} (${deliveryRate}%)`],
        ["RTO / Return",     `${opts.rto} (${rtoRate}%)`],
        ["Revenue",          `₹${opts.revenue.toFixed(2)}`],
        ["Wallet Balance",   `₹${opts.balance.toFixed(2)}`],
        ["Unread Alerts",    String(opts.unreadNotifs)],
      ])}
      ${hr()}
      ${opts.rto > 0 && rtoRate > 20
        ? `<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:12px 16px;margin-bottom:16px">
            <p style="margin:0;font-size:13px;color:#B91C1C;font-weight:600">⚠ High RTO rate (${rtoRate}%) — review your top-RTO products.</p>
           </div>`
        : ""
      }
      ${p(`Visit your ${link("Seller Dashboard", "/seller")} to take action.`)}
    `),
  );
}
