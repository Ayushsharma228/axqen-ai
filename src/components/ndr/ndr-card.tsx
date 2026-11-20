"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Phone, MapPin, Truck, Clock, RotateCcw, PackageX, CheckCircle2, Loader2, Siren, Copy, CopyCheck,
} from "lucide-react";

export interface NdrCardData {
  id: string; externalOrderId: string; status: string;
  tab: "ACTION_NEEDED" | "REATTEMPT" | "DELIVERED" | "RTO";
  paymentMode: string; totalAmount: number;
  customerName: string | null; phone: string | null; address: string | null;
  city: string | null; state: string | null; pincode: string | null;
  awb: string | null; courier: string; isShipdaak: boolean;
  reason: string | null; attemptsCount: number;
  openedAt: string | null; hoursOpen: number | null;
  attempts: { time: string; reason: string; location: string }[];
  actions: { time: string; action: string; reattemptDate: string | null; note: string | null; by: string; courierMessage: string | null }[];
  escalations: { time: string; note: string | null }[];
  canEscalate: boolean;
  seller?: { id: string; name: string | null; brandName: string | null } | null;
}

export const NDR_TAB_META: Record<NdrCardData["tab"], { label: string; color: string; bg: string }> = {
  ACTION_NEEDED: { label: "Action needed",       color: "#DC2626", bg: "#FEF2F2" },
  REATTEMPT:     { label: "Re-attempt requested", color: "#2563EB", bg: "#EFF6FF" },
  DELIVERED:     { label: "Delivered (saved)",    color: "#047857", bg: "#ECFDF5" },
  RTO:           { label: "Went RTO",             color: "#B45309", bg: "#FFFBEB" },
};

const fmt = (d: string) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
function openFor(h: number | null) {
  if (h == null) return "—";
  if (h < 1) return "< 1h";
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}
const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

export interface NdrActionPayload {
  orderId: string; action: "REATTEMPT" | "RTO"; reattemptDate?: string;
  name?: string; phone?: string; address?: string; city?: string; state?: string; pincode?: string; note?: string;
}

export function NdrCard({ n, mode, onAction, onEscalate }: {
  n: NdrCardData;
  mode: "admin" | "seller";
  onAction?: (p: NdrActionPayload) => Promise<string | null>;   // returns error text or null
  onEscalate?: (orderId: string, note: string) => Promise<string | null>;
}) {
  const meta = NDR_TAB_META[n.tab];
  const [open, setOpen] = useState(mode === "admin" && n.tab === "ACTION_NEEDED");
  const [action, setAction] = useState<"REATTEMPT" | "RTO">("REATTEMPT");
  const [date, setDate] = useState(tomorrow());
  const [phone, setPhone] = useState(n.phone ?? "");
  const [address, setAddress] = useState(n.address ?? "");
  const [city, setCity] = useState(n.city ?? "");
  const [state, setState] = useState(n.state ?? "");
  const [pincode, setPincode] = useState(n.pincode ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [escNote, setEscNote] = useState("");
  const [escOpen, setEscOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const urgent = n.tab === "ACTION_NEEDED" && (n.hoursOpen ?? 0) >= 24;
  const prepaid = n.paymentMode === "PREPAID";

  async function submit() {
    if (!onAction) return;
    setBusy(true); setMsg(null);
    const err = await onAction({
      orderId: n.id, action,
      ...(action === "REATTEMPT" ? { reattemptDate: date, phone, address, city, state, pincode } : {}),
      note,
    });
    setBusy(false);
    setMsg(err ? { ok: false, text: err } : { ok: true, text: action === "REATTEMPT" ? "Re-attempt sent to courier" : "Marked for RTO" });
  }

  async function escalate() {
    if (!onEscalate) return;
    setBusy(true); setMsg(null);
    const err = await onEscalate(n.id, escNote);
    setBusy(false);
    setEscOpen(false);
    setMsg(err ? { ok: false, text: err } : { ok: true, text: "Escalated. The AXQEN team has been notified." });
  }

  const input = "w-full px-3 py-2 text-[12.5px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE]";

  return (
    <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: urgent ? "#FECACA" : "#E8EDF6" }}>
      {/* Header */}
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full text-left px-4 py-3.5 flex items-start justify-between gap-3 flex-wrap hover:bg-[#FAFBFF]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-bold text-[#0C1220]">{n.externalOrderId.startsWith("#") ? n.externalOrderId : `#${n.externalOrderId}`}</span>
            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: prepaid ? "#EEF2FF" : "#FFF7ED", color: prepaid ? "#4361EE" : "#C2410C" }}>
              {prepaid ? "PREPAID" : "COD"} · ₹{Math.round(n.totalAmount).toLocaleString("en-IN")}
            </span>
            {n.escalations.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#FEF2F2] text-[#DC2626]">
                <Siren className="w-3 h-3" /> Escalated {fmt(n.escalations[0].time)}
              </span>
            )}
          </div>
          <p className="text-[12.5px] text-[#374151] mt-1">
            <span className="font-semibold">{n.reason || "Delivery attempt failed"}</span>
            <span className="text-[#9CA3AF]"> · attempt {n.attemptsCount || 1}</span>
          </p>
          <p className="text-[11.5px] text-[#9CA3AF] mt-0.5 truncate">
            {n.customerName ?? "Customer"}{n.city ? ` · ${n.city}` : ""}{n.state ? `, ${n.state}` : ""} · {n.courier}
            {mode === "admin" && n.seller ? ` · Seller: ${n.seller.brandName || n.seller.name}` : ""}
          </p>
        </div>
        {n.tab === "ACTION_NEEDED" && (
          <div className="text-right">
            <p className="text-[18px] font-black tabular-nums leading-none" style={{ color: urgent ? "#DC2626" : "#0C1220" }}>{openFor(n.hoursOpen)}</p>
            <p className="text-[10.5px] text-[#9CA3AF] mt-1">open, no action</p>
          </div>
        )}
      </button>

      {open && (
        <div className="border-t border-[#F3F4F6] px-4 py-4 grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left: details + history */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div className="flex items-start gap-2">
                <Phone className="w-3.5 h-3.5 text-[#9CA3AF] mt-0.5" />
                <div><p className="text-[10px] text-[#9CA3AF]">Phone</p>
                  {n.phone ? <a href={`tel:${n.phone}`} className="font-semibold text-[#4361EE]">{n.phone}</a> : <p className="font-semibold">—</p>}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Truck className="w-3.5 h-3.5 text-[#9CA3AF] mt-0.5" />
                <div><p className="text-[10px] text-[#9CA3AF]">AWB</p>
                  {n.awb ? (
                    <span className="flex items-center gap-1">
                      {mode === "seller"
                        ? <Link href={`/seller/tracking/${encodeURIComponent(n.awb)}`} className="font-mono font-semibold text-[#0C1220] hover:text-[#4361EE]">{n.awb}</Link>
                        : <span className="font-mono font-semibold text-[#0C1220]">{n.awb}</span>}
                      <button type="button" onClick={() => { navigator.clipboard.writeText(n.awb!); setCopied(true); setTimeout(() => setCopied(false), 1500); }} aria-label="Copy AWB">
                        {copied ? <CopyCheck className="w-3 h-3 text-[#059669]" /> : <Copy className="w-3 h-3 text-[#9CA3AF]" />}
                      </button>
                    </span>
                  ) : <p className="font-semibold">—</p>}
                </div>
              </div>
              <div className="flex items-start gap-2 col-span-2">
                <MapPin className="w-3.5 h-3.5 text-[#9CA3AF] mt-0.5" />
                <div><p className="text-[10px] text-[#9CA3AF]">Address</p>
                  <p className="font-medium text-[#374151]">{[n.address, n.city, n.state, n.pincode].filter(Boolean).join(", ") || "—"}</p>
                </div>
              </div>
            </div>

            {/* Timeline: failed attempts + actions + escalations, newest first */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF] mb-2">History</p>
              <ol className="space-y-2.5">
                {[
                  ...n.attempts.map(a => ({ t: a.time, kind: "attempt" as const, a })),
                  ...n.actions.map(a => ({ t: a.time, kind: "action" as const, a })),
                  ...n.escalations.map(e => ({ t: e.time, kind: "esc" as const, e })),
                ].sort((x, y) => y.t.localeCompare(x.t)).map((item, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-1 w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: item.kind === "attempt" ? "#DC2626" : item.kind === "action" ? "#2563EB" : "#F59E0B" }} />
                    <div className="text-[12px]">
                      {item.kind === "attempt" && (<>
                        <p className="font-semibold text-[#0C1220]">Delivery failed: {item.a.reason}</p>
                        <p className="text-[#9CA3AF]">{fmt(item.a.time)}{item.a.location ? ` · ${item.a.location}` : ""}</p>
                      </>)}
                      {item.kind === "action" && (<>
                        <p className="font-semibold text-[#0C1220]">
                          {item.a.action === "RTO" ? "Return to origin requested" : `Re-attempt requested${item.a.reattemptDate ? ` for ${new Date(item.a.reattemptDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}`}
                        </p>
                        <p className="text-[#9CA3AF]">{fmt(item.a.time)} · by {item.a.by}</p>
                        {item.a.note && <p className="text-[#374151] mt-0.5">Note: {item.a.note}</p>}
                        {mode === "admin" && item.a.courierMessage && <p className="text-[#6B7280] mt-0.5">Courier: {item.a.courierMessage}</p>}
                      </>)}
                      {item.kind === "esc" && (<>
                        <p className="font-semibold text-[#B45309]">Escalated by seller</p>
                        <p className="text-[#9CA3AF]">{fmt(item.e.time)}{item.e.note ? ` · ${item.e.note}` : ""}</p>
                      </>)}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Right: admin action form / seller status */}
          <div className="space-y-3">
            {mode === "admin" && n.tab !== "DELIVERED" && n.tab !== "RTO" ? (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                  {n.tab === "REATTEMPT" ? "Change the action" : "Take action"} · goes to {n.isShipdaak ? "Shipdaak" : n.courier}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {([["REATTEMPT", "Re-attempt", RotateCcw, "#2563EB"], ["RTO", "Return (RTO)", PackageX, "#B45309"]] as const).map(([k, l, Icon, c]) => (
                    <button key={k} type="button" onClick={() => setAction(k)}
                      className="flex items-center justify-center gap-1.5 py-2 rounded-lg border text-[12.5px] font-bold"
                      style={action === k ? { background: c, borderColor: c, color: "white" } : { background: "white", borderColor: "#E8EDF6", color: "#374151" }}>
                      <Icon className="w-3.5 h-3.5" /> {l}
                    </button>
                  ))}
                </div>
                {action === "REATTEMPT" ? (
                  <div className="space-y-2">
                    <label className="block">
                      <span className="text-[11px] font-semibold text-[#6B7280]">Re-attempt date</span>
                      <input id={`ndr-date-${n.id}`} type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={e => setDate(e.target.value)} className={input} />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold text-[#6B7280]">Phone (change if customer gave a new one)</span>
                      <input id={`ndr-phone-${n.id}`} value={phone} onChange={e => setPhone(e.target.value)} className={input} />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold text-[#6B7280]">Address (change only if corrected)</span>
                      <textarea id={`ndr-addr-${n.id}`} rows={2} value={address} onChange={e => setAddress(e.target.value)} className={input + " resize-none"} />
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <input id={`ndr-city-${n.id}`} aria-label="City" placeholder="City" value={city} onChange={e => setCity(e.target.value)} className={input} />
                      <input id={`ndr-state-${n.id}`} aria-label="State" placeholder="State" value={state} onChange={e => setState(e.target.value)} className={input} />
                      <input id={`ndr-pin-${n.id}`} aria-label="Pincode" placeholder="Pincode" value={pincode} onChange={e => setPincode(e.target.value)} className={input} />
                    </div>
                  </div>
                ) : (
                  <p className="text-[12px] text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2">
                    {n.isShipdaak
                      ? "Shipdaak has no RTO action. This records the decision; the courier returns the parcel after its final attempt."
                      : "The courier will send the parcel back to the warehouse."}
                  </p>
                )}
                <label className="block">
                  <span className="text-[11px] font-semibold text-[#6B7280]">Note (seller sees this)</span>
                  <textarea id={`ndr-note-${n.id}`} rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="What the customer said on the call" className={input + " resize-none"} />
                </label>
                <button type="button" onClick={submit} disabled={busy}
                  className="w-full py-2.5 rounded-lg text-[13px] font-bold text-white bg-[#4361EE] disabled:opacity-60 flex items-center justify-center gap-1.5">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {action === "REATTEMPT" ? "Send re-attempt" : "Confirm RTO"}
                </button>
              </>
            ) : mode === "seller" ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-[#F5F7FB] px-3 py-2.5 text-[12.5px] text-[#374151] flex gap-2">
                  <Clock className="w-4 h-4 text-[#9CA3AF] flex-shrink-0 mt-0.5" />
                  <span>
                    {n.tab === "ACTION_NEEDED" && "The AXQEN team will call the customer and decide: re-attempt or return."}
                    {n.tab === "REATTEMPT" && "The AXQEN team has asked the courier to try again."}
                    {n.tab === "DELIVERED" && "Saved: delivered after the failed attempt."}
                    {n.tab === "RTO" && "This parcel is going back to origin."}
                  </span>
                </div>
                {n.tab === "ACTION_NEEDED" && (
                  n.canEscalate ? (
                    escOpen ? (
                      <div className="space-y-2">
                        <textarea id={`esc-note-${n.id}`} rows={2} value={escNote} onChange={e => setEscNote(e.target.value)}
                          placeholder="Anything the team should know? (optional)" className={input + " resize-none"} />
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setEscOpen(false)} className="flex-1 py-2 rounded-lg text-[12.5px] font-semibold bg-[#F3F4F6] text-[#6B7280]">Cancel</button>
                          <button type="button" onClick={escalate} disabled={busy}
                            className="flex-1 py-2 rounded-lg text-[12.5px] font-bold text-white bg-[#DC2626] disabled:opacity-60 flex items-center justify-center gap-1.5">
                            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Siren className="w-3.5 h-3.5" />} Escalate
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setEscOpen(true)}
                        className="w-full py-2.5 rounded-lg text-[12.5px] font-bold flex items-center justify-center gap-1.5 bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
                        <Siren className="w-3.5 h-3.5" /> Escalate to AXQEN team
                      </button>
                    )
                  ) : (
                    <p className="text-[11.5px] text-[#9CA3AF] flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {n.escalations.length > 0 ? "Already escalated today." : "You can escalate if there's no action within 24 hours."}
                    </p>
                  )
                )}
              </div>
            ) : (
              <p className="text-[12.5px] text-[#6B7280]">No action needed: this NDR is closed.</p>
            )}
            {msg && (
              <p className="text-[12px] font-semibold px-3 py-2 rounded-lg"
                style={{ background: msg.ok ? "#ECFDF5" : "#FEF2F2", color: msg.ok ? "#047857" : "#B91C1C" }}>{msg.text}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
