// Single source for setup-plan prices (₹, before GST). Signup UI, Razorpay order creation and invoices all read this.
export type Service = "DROPSHIPPING" | "MARKETPLACE";
export type Tier = "STARTER" | "GROWTH" | "SCALE";

export const PLAN_PRICES_INR: Record<Service, Record<Tier, number>> = {
  DROPSHIPPING: { STARTER: 9999, GROWTH: 19999, SCALE: 39999 },
  MARKETPLACE:  { STARTER: 5000, GROWTH: 10000, SCALE: 20000 },
};

/** Amount in paise for Razorpay. Unknown service/tier falls back to Dropshipping Starter. */
export function planAmountPaise(service?: string | null, tier?: string | null): number {
  const s = (service ?? "DROPSHIPPING").toUpperCase() as Service;
  const t = (tier ?? "STARTER").toUpperCase() as Tier;
  const inr = PLAN_PRICES_INR[s]?.[t] ?? PLAN_PRICES_INR.DROPSHIPPING.STARTER;
  return inr * 100;
}
