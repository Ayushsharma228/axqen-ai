// Pure invoice helpers and types (safe to use in the browser — no database imports).

export interface InvoiceSettings {
  company: {
    name: string; addressLines: string[]; gstin: string; stateName: string; stateCode: string;
    email: string; cin: string;
  };
  bank: { holder: string; bankName: string; account: string; branchIfsc: string; swift: string };
  declaration: string;
  series: string;          // e.g. "AXP"
  digits: number;          // e.g. 5 → AXP/26-27/00001
  shipping: { label: string; sac: string; rate: number };
  packing: { label: string; sac: string; rate: number };
}

// ── Money helpers ───────────────────────────────────────────────────────────────────────────────────
export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function words99(n: number) { return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`; }
function words999(n: number) {
  const h = Math.floor(n / 100), rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", rest ? words99(rest) : ""].filter(Boolean).join(" ");
}
function intWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${intWords(crore)} Crore`);
  if (lakh) parts.push(`${words99(lakh)} Lakh`);
  if (thousand) parts.push(`${words99(thousand)} Thousand`);
  if (n) parts.push(words999(n));
  return parts.join(" ");
}
/** "INR Two Thousand Five Hundred Thirty Two and Ninety Eight paise Only" (Tally style). */
export function amountInWords(amount: number) {
  const a = r2(Math.abs(amount));
  const rupees = Math.floor(a);
  const paise = Math.round((a - rupees) * 100);
  return `INR ${intWords(rupees)}${paise ? ` and ${words99(paise)} paise` : ""} Only`;
}

export interface InvoiceLine {
  kind: "PRODUCT" | "SHIPPING" | "PACKING";
  description: string; hsn: string; gstRate: number;
  qty: number; unit: string; rate: number;       // rate = taxable value per unit
  taxable: number; tax: number; amount: number;  // amount = GST-inclusive
}
export interface InvoiceBuyer {
  name: string; addressLines: string[]; stateName: string; stateCode: string; gstin: string | null;
}
