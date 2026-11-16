// Single source for setup-plan prices (₹, before GST). Signup UI, Razorpay order creation and invoices all read this.
export type Service = "DROPSHIPPING" | "MARKETPLACE";
export type Tier = "STARTER" | "GROWTH" | "SCALE";

export const PLAN_PRICES_INR: Record<Service, Record<Tier, number>> = {
  DROPSHIPPING: { STARTER: 9999, GROWTH: 19999, SCALE: 39999 },
  // Marketplace is a single Amazon Management plan (₹8,999 for 3 months); every tier maps to it so older selections still price correctly.
  MARKETPLACE:  { STARTER: 8999, GROWTH: 8999, SCALE: 8999 },
};

/** Amount in paise for Razorpay. Unknown service/tier falls back to Dropshipping Starter. */
export function planAmountPaise(service?: string | null, tier?: string | null): number {
  const s = (service ?? "DROPSHIPPING").toUpperCase() as Service;
  const t = (tier ?? "STARTER").toUpperCase() as Tier;
  const inr = PLAN_PRICES_INR[s]?.[t] ?? PLAN_PRICES_INR.DROPSHIPPING.STARTER;
  return inr * 100;
}
