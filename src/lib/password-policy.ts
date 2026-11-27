// Password rules. Staff (admin, sales, supplier) accounts can see customer personal data, so they need
// stronger passwords than sellers (Shopify protected customer data requirement).

export const STAFF_ROLES = new Set(["ADMIN", "SALES", "SUPPLIER"]);
export const STAFF_PASSWORD_HINT = "At least 12 characters with upper and lower case letters, a number and a symbol";

/** Error message if a staff password is too weak, else null. */
export function staffPasswordError(p: unknown): string | null {
  const s = typeof p === "string" ? p : "";
  if (s.length < 12) return "Staff passwords need at least 12 characters";
  if (!/[a-z]/.test(s) || !/[A-Z]/.test(s)) return "Use both upper and lower case letters";
  if (!/\d/.test(s)) return "Add at least one number";
  if (!/[^A-Za-z0-9]/.test(s)) return "Add at least one symbol, like ! @ # or -";
  return null;
}

/** Seller passwords: at least 8 characters with letters and a number. */
export function sellerPasswordError(p: unknown): string | null {
  const s = typeof p === "string" ? p : "";
  if (s.length < 8 || !/[A-Za-z]/.test(s) || !/\d/.test(s)) return "Use at least 8 characters with letters and a number";
  return null;
}

/** The right rule for a role. */
export function passwordErrorFor(role: string | null | undefined, p: unknown): string | null {
  return STAFF_ROLES.has(String(role ?? "")) ? staffPasswordError(p) : sellerPasswordError(p);
}
