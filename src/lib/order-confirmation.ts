// Order confirmation calling — done by the AXQEN team, shown read-only to sellers.
// Every change is stored as an OrderTimeline row (no schema change); the latest row wins.

export const CONF_EVENT = {
  ATTEMPT: "CONFIRMATION_ATTEMPT",
  FINAL:   "CONFIRMATION_FINAL",
  REMARK:  "CONFIRMATION_REMARK",
  ADDRESS: "CONFIRMATION_ADDRESS",
} as const;
export const CONF_EVENT_TYPES = Object.values(CONF_EVENT);

export const MAX_ATTEMPTS = 3;

// Same options + colours as the team's calling sheet.
export const ATTEMPT_OUTCOMES = [
  { key: "ORDER_CONFIRM",    label: "Order Confirm",    bg: "#B5F23D", fg: "#1A2E05" },
  { key: "CANCEL_ORDER",     label: "Cancel order",     bg: "#EF4444", fg: "#FFFFFF" },
  { key: "CALL_PENDING",     label: "Call Pending",     bg: "#C9A0DC", fg: "#2E1240" },
  { key: "NUMBER_NOT_EXIST", label: "Number not exist", bg: "#3F3F46", fg: "#FFFFFF" },
  { key: "ORDER_DISPATCH",   label: "Order Dispatch",   bg: "#22E1E8", fg: "#05343A" },
  { key: "LANGUAGE_BARRIER", label: "Language Barrier", bg: "#B91C1C", fg: "#FFFFFF" },
  { key: "INCOMING_OFF",     label: "Incoming off",     bg: "#5B2A86", fg: "#FFFFFF" },
  { key: "CALL_BACK",        label: "Call back",        bg: "#473821", fg: "#FFFFFF" },
  { key: "WRONG_NUMBER",     label: "Wrong number",     bg: "#E5E7EB", fg: "#1F2937" },
  { key: "SWITCH_OFF",       label: "Switch Off",       bg: "#FCC2A2", fg: "#5A2410" },
  { key: "INVALID_NO",       label: "Invalid No",       bg: "#BFDDF8", fg: "#1E3A5F" },
] as const;
export type AttemptOutcome = typeof ATTEMPT_OUTCOMES[number]["key"];

export const FINAL_STATUSES = [
  { key: "ORDER_PLACE",    label: "Order placed",     bg: "#14773F", fg: "#FFFFFF" },
  { key: "ORDER_DISPATCH", label: "Order dispatched", bg: "#C7EBCB", fg: "#14532D" },
  { key: "PENDING",        label: "Pending",          bg: "#FBCACA", fg: "#7F1D1D" },
  { key: "CANCELLED",      label: "Cancelled",        bg: "#EF4444", fg: "#FFFFFF" },
] as const;
export type FinalStatus = typeof FINAL_STATUSES[number]["key"];

export const outcomeMeta = (k?: string | null) => ATTEMPT_OUTCOMES.find(o => o.key === k) ?? null;
export const finalMeta   = (k?: string | null) => FINAL_STATUSES.find(f => f.key === k) ?? null;

export interface ConfirmationState {
  attempts: ({ outcome: AttemptOutcome; at: string } | null)[];   // length MAX_ATTEMPTS
  final:   { value: FinalStatus; at: string } | null;
  remark:  { text: string; at: string } | null;
  addressCorrectedAt: string | null;
}

interface TimelineRow { orderId: string; eventType: string | null; metadata: unknown; createdAt: Date }

/** Fold timeline rows (any order, any type) into per-order confirmation state. */
export function foldConfirmation(rows: TimelineRow[]): Map<string, ConfirmationState> {
  const out = new Map<string, ConfirmationState>();
  const sorted = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const r of sorted) {
    let s = out.get(r.orderId);
    if (!s) {
      s = { attempts: Array(MAX_ATTEMPTS).fill(null), final: null, remark: null, addressCorrectedAt: null };
      out.set(r.orderId, s);
    }
    const m = (r.metadata ?? {}) as Record<string, unknown>;
    const at = r.createdAt.toISOString();
    if (r.eventType === CONF_EVENT.ATTEMPT) {
      const n = Number(m.attempt);
      if (n >= 1 && n <= MAX_ATTEMPTS) {
        s.attempts[n - 1] = m.outcome ? { outcome: m.outcome as AttemptOutcome, at } : null;
      }
    } else if (r.eventType === CONF_EVENT.FINAL) {
      s.final = m.value ? { value: m.value as FinalStatus, at } : null;
    } else if (r.eventType === CONF_EVENT.REMARK) {
      const text = String(m.text ?? "").trim();
      s.remark = text ? { text, at } : null;
    } else if (r.eventType === CONF_EVENT.ADDRESS) {
      s.addressCorrectedAt = at;
    }
  }
  return out;
}

export const emptyConfirmation = (): ConfirmationState => ({
  attempts: Array(MAX_ATTEMPTS).fill(null), final: null, remark: null, addressCorrectedAt: null,
});
