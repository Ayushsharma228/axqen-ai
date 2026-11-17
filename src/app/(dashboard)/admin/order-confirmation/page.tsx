"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Pencil, X, Check } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import {
  ATTEMPT_OUTCOMES, FINAL_STATUSES, MAX_ATTEMPTS, type ConfirmationState,
} from "@/lib/order-confirmation";

interface Addr { address?: string; address1?: string; address2?: string; city?: string; state?: string; province?: string; pincode?: string; zip?: string; phone?: string }
interface Order {
  id: string;
  externalOrderId: string;
  status: string;
  paymentMode: string;
  totalAmount: number;
  customerName: string | null;
  customerEmail: string | null;
  customerAddress: Addr | null;
  createdAt: string;
  seller: { id: string; name: string | null; brandName: string | null };
  items: { name: string; quantity: number }[];
  confirmation: ConfirmationState;
}

type Tab = "TO_CALL" | "CONFIRMED" | "CANCELLED" | "ALL";
const RANGES = [{ d: 1, l: "Today" }, { d: 3, l: "3 days" }, { d: 7, l: "7 days" }, { d: 30, l: "30 days" }];

const toISO = (d: Date) => d.toISOString().split("T")[0];
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

function tabOf(o: Order): Tab {
  const f = o.confirmation.final?.value;
  if (f === "ORDER_PLACE" || f === "ORDER_DISPATCH") return "CONFIRMED";
  if (f === "CANCELLED" || o.status === "CANCELLED") return "CANCELLED";
  return "TO_CALL";
}
const addrLine = (a: Addr | null) =>
  [a?.address || [a?.address1, a?.address2].filter(Boolean).join(", ")].filter(Boolean).join("");

function ColorSelect({ value, options, onChange, disabled, placeholder }: {
  value: string | null;
  options: readonly { key: string; label: string; bg: string; fg: string }[];
  onChange: (v: string | null) => void;
  disabled?: boolean;
  placeholder: string;
}) {
  const m = options.find(o => o.key === value);
  return (
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={e => onChange(e.target.value || null)}
      className="w-full text-[11.5px] font-semibold rounded-full px-2.5 py-1 border appearance-none cursor-pointer disabled:cursor-wait disabled:opacity-60"
      style={m ? { background: m.bg, color: m.fg, borderColor: m.bg } : { background: "#F3F4F6", color: "#9CA3AF", borderColor: "#E5E7EB" }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.key} value={o.key} style={{ background: "white", color: "#111827" }}>{o.label}</option>)}
    </select>
  );
}

export default function AdminOrderConfirmationPage() {
  const [days, setDays] = useState(3);
  const [tab, setTab] = useState<Tab>("TO_CALL");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editAddr, setEditAddr] = useState<{ id: string; address: string; city: string; state: string; pincode: string; phone: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const from = toISO(new Date(Date.now() - (days - 1) * 86400000));
    const p = new URLSearchParams({ from, to: toISO(new Date()), ...(query ? { search: query } : {}) });
    fetch(`/api/admin/order-confirmation?${p}`)
      .then(r => r.json())
      .then(d => setOrders(d.orders ?? []))
      .finally(() => setLoading(false));
  }, [days, query]);
  useEffect(() => { load(); }, [load]);

  async function post(orderId: string, body: Record<string, unknown>, savingKey: string) {
    setSaving(savingKey);
    setError(null);
    try {
      const res = await fetch("/api/admin/order-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, ...body }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Couldn't save"); return null; }
      return d;
    } finally {
      setSaving(null);
    }
  }

  function patchLocal(id: string, fn: (o: Order) => Order) {
    setOrders(prev => prev.map(o => (o.id === id ? fn(o) : o)));
  }

  async function setAttempt(o: Order, n: number, outcome: string | null) {
    const ok = await post(o.id, { action: "attempt", attempt: n, outcome }, `${o.id}:a${n}`);
    if (!ok) return;
    patchLocal(o.id, x => {
      const attempts = [...x.confirmation.attempts];
      attempts[n - 1] = outcome ? { outcome: outcome as never, at: new Date().toISOString() } : null;
      return { ...x, confirmation: { ...x.confirmation, attempts } };
    });
  }

  async function setFinal(o: Order, value: string | null) {
    if (value === "CANCELLED") {
      const msg = o.confirmation.remark?.text
        ? `Cancel order ${o.externalOrderId}? The seller will be notified.`
        : `Cancel order ${o.externalOrderId} without a remark? The seller will only see the last call outcome as the reason.`;
      if (!confirm(msg)) return;
    }
    const ok = await post(o.id, { action: "final", value }, `${o.id}:f`);
    if (!ok) return;
    patchLocal(o.id, x => ({
      ...x,
      status: value === "CANCELLED" ? "CANCELLED" : (value === "ORDER_PLACE" || value === "ORDER_DISPATCH") && x.status === "NEW" ? "PROCESSING" : x.status,
      confirmation: { ...x.confirmation, final: value ? { value: value as never, at: new Date().toISOString() } : null },
    }));
  }

  async function saveRemark(o: Order, text: string) {
    if ((o.confirmation.remark?.text ?? "") === text.trim()) return;
    const ok = await post(o.id, { action: "remark", text }, `${o.id}:r`);
    if (!ok) return;
    patchLocal(o.id, x => ({
      ...x, confirmation: { ...x.confirmation, remark: text.trim() ? { text: text.trim(), at: new Date().toISOString() } : null },
    }));
  }

  async function saveAddress() {
    if (!editAddr) return;
    const { id, ...fields } = editAddr;
    const d = await post(id, { action: "address", ...fields }, `${id}:addr`);
    if (!d) return;
    patchLocal(id, x => ({
      ...x,
      customerAddress: d.customerAddress,
      confirmation: { ...x.confirmation, addressCorrectedAt: new Date().toISOString() },
    }));
    setEditAddr(null);
  }

  const counts = { TO_CALL: 0, CONFIRMED: 0, CANCELLED: 0, ALL: orders.length };
  for (const o of orders) counts[tabOf(o) as Exclude<Tab, "ALL">]++;
  const shown = tab === "ALL" ? orders : orders.filter(o => tabOf(o) === tab);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page)" }}>
      <PageHero
        title="Order Calling"
        subtitle="Confirm every new order by phone. Sellers see these calls, notes and cancel reasons on their COD Confirmation page."
        searchValue={search}
        searchPlaceholder="Order ID, customer name or email"
        onSearchChange={setSearch}
        onSearchSubmit={() => setQuery(search.trim())}
        filters={
          <div className="flex items-center gap-1 bg-white border border-[#E8EDF6] rounded-lg p-0.5">
            {RANGES.map(r => (
              <button key={r.d} onClick={() => setDays(r.d)}
                className="px-3 py-1.5 text-[12px] font-semibold rounded-md"
                style={{ background: days === r.d ? "#4361EE" : "transparent", color: days === r.d ? "white" : "#6B7280" }}>
                {r.l}
              </button>
            ))}
          </div>
        }
      />

      <div className="px-4 md:px-8 pb-10 space-y-4">
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-lg px-4 py-2.5 text-[13px] bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]">
            {error}
            <button onClick={() => setError(null)} aria-label="Dismiss"><X className="w-4 h-4" /></button>
          </div>
        )}

        <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
          <div className="flex items-center gap-1 px-3 pt-3 border-b border-[#F3F4F6] overflow-x-auto">
            {([["TO_CALL", "To call"], ["CONFIRMED", "Confirmed"], ["CANCELLED", "Cancelled"], ["ALL", "All"]] as [Tab, string][]).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)}
                className="px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap border-b-2 -mb-px"
                style={{ borderColor: tab === k ? "#4361EE" : "transparent", color: tab === k ? "#4361EE" : "#6B7280" }}>
                {l}
                <span className="ml-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: tab === k ? "#EEF2FF" : "#F3F4F6", color: tab === k ? "#4361EE" : "#9CA3AF" }}>
                  {counts[k]}
                </span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[#9CA3AF]">
              <Loader2 className="w-4 h-4 animate-spin text-[#4361EE]" /> Loading orders…
            </div>
          ) : shown.length === 0 ? (
            <p className="py-16 text-center text-[13px] text-[#9CA3AF]">No orders here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1280px] text-[12.5px]">
                <thead>
                  <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF] bg-[#FAFBFF] border-b border-[#F3F4F6]">
                    <th className="px-3 py-2.5 w-[150px]">Order</th>
                    <th className="px-3 py-2.5 w-[260px]">Customer &amp; address</th>
                    <th className="px-3 py-2.5 w-[170px]">Product</th>
                    <th className="px-3 py-2.5 w-[90px]">Amount</th>
                    {Array.from({ length: MAX_ATTEMPTS }, (_, i) => <th key={i} className="px-2 py-2.5 w-[140px]">Call {i + 1}</th>)}
                    <th className="px-2 py-2.5 w-[140px]">Final status</th>
                    <th className="px-3 py-2.5">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6] align-top">
                  {shown.map(o => {
                    const a = o.customerAddress;
                    const prepaid = o.paymentMode?.toUpperCase() === "PREPAID";
                    const finalVal = o.confirmation.final?.value ?? null;
                    const locked = o.status === "CANCELLED" && finalVal !== "CANCELLED";
                    return (
                      <tr key={o.id} className="hover:bg-[#FAFBFF]">
                        <td className="px-3 py-3">
                          <p className="font-bold text-[#0C1220]">{o.externalOrderId}</p>
                          <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                            {new Date(o.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                          </p>
                          <p className="text-[11px] text-[#6B7280] mt-0.5 truncate">{o.seller.brandName ?? o.seller.name ?? "Seller"}</p>
                          {o.status !== "NEW" && <p className="text-[10.5px] font-semibold text-[#9CA3AF] mt-0.5">{o.status}</p>}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-[#0C1220]">{o.customerName ?? "—"}</p>
                              {a?.phone && <a href={`tel:${a.phone}`} className="text-[#4361EE] font-semibold tabular-nums">{a.phone}</a>}
                              <p className="text-[11.5px] text-[#6B7280] mt-0.5 line-clamp-2">{addrLine(a)}</p>
                              <p className="text-[11.5px] text-[#6B7280]">
                                {[a?.city, a?.state ?? a?.province, a?.pincode ?? a?.zip].filter(Boolean).join(", ")}
                              </p>
                              {o.confirmation.addressCorrectedAt && <p className="text-[10.5px] font-semibold text-[#059669] mt-0.5">Address corrected</p>}
                            </div>
                            <button
                              onClick={() => setEditAddr({
                                id: o.id, address: addrLine(a), city: a?.city ?? "", state: a?.state ?? a?.province ?? "",
                                pincode: a?.pincode ?? a?.zip ?? "", phone: a?.phone ?? "",
                              })}
                              aria-label="Edit address"
                              className="p-1 rounded text-[#9CA3AF] hover:text-[#4361EE] hover:bg-[#EEF2FF] flex-shrink-0"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-[#374151]">
                          {o.items.map((i, k) => <p key={k} className="line-clamp-2">{i.name}{i.quantity > 1 ? ` ×${i.quantity}` : ""}</p>)}
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-semibold tabular-nums text-[#0C1220]">{inr(o.totalAmount)}</p>
                          <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: prepaid ? "#EEF2FF" : "#FFF7ED", color: prepaid ? "#4361EE" : "#C2410C" }}>
                            {prepaid ? "PREPAID" : (o.paymentMode || "COD")}
                          </span>
                        </td>
                        {Array.from({ length: MAX_ATTEMPTS }, (_, i) => {
                          const att = o.confirmation.attempts[i];
                          return (
                            <td key={i} className="px-2 py-3">
                              <ColorSelect
                                value={att?.outcome ?? null}
                                options={ATTEMPT_OUTCOMES}
                                placeholder="—"
                                disabled={saving === `${o.id}:a${i + 1}`}
                                onChange={v => setAttempt(o, i + 1, v)}
                              />
                              {att && (
                                <p className="text-[10px] text-[#9CA3AF] mt-1 pl-1">
                                  {new Date(att.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                                </p>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-2 py-3">
                          <ColorSelect
                            value={finalVal}
                            options={FINAL_STATUSES}
                            placeholder="Set final"
                            disabled={locked || saving === `${o.id}:f`}
                            onChange={v => setFinal(o, v)}
                          />
                          {locked && <p className="text-[10px] text-[#9CA3AF] mt-1 pl-1">Cancelled elsewhere</p>}
                        </td>
                        <td className="px-3 py-3">
                          <RemarkInput
                            key={`${o.id}:${o.confirmation.remark?.at ?? ""}`}
                            initial={o.confirmation.remark?.text ?? ""}
                            saving={saving === `${o.id}:r`}
                            onSave={t => saveRemark(o, t)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-[11.5px] text-[#9CA3AF]">
          Final status “Order placed” or “Order dispatched” sends a NEW order to processing. “Cancelled” cancels the order and notifies the seller — the remark is shown to the seller as the reason.
          {" "}Legend: {ATTEMPT_OUTCOMES.length} call outcomes · {FINAL_STATUSES.map(f => f.label).join(" / ")}.
        </p>
      </div>

      {/* Address editor */}
      {editAddr && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setEditAddr(null)}>
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-[#0C1220]">Correct address</h3>
              <button onClick={() => setEditAddr(null)} aria-label="Close"><X className="w-4 h-4 text-[#6B7280]" /></button>
            </div>
            {([
              ["address", "Address"], ["city", "City"], ["state", "State"], ["pincode", "Pincode"], ["phone", "Phone"],
            ] as const).map(([k, l]) => (
              <label key={k} className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{l}</span>
                {k === "address" ? (
                  <textarea id={`addr-${k}`} rows={2} value={editAddr[k]} onChange={e => setEditAddr({ ...editAddr, [k]: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#E8EDF6] px-3 py-2 text-[13px] focus:outline-none focus:border-[#4361EE]" />
                ) : (
                  <input id={`addr-${k}`} value={editAddr[k]} onChange={e => setEditAddr({ ...editAddr, [k]: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#E8EDF6] px-3 py-2 text-[13px] focus:outline-none focus:border-[#4361EE]" />
                )}
              </label>
            ))}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditAddr(null)} className="px-4 py-2 rounded-lg text-[13px] font-semibold text-[#6B7280] hover:bg-[#F3F4F6]">Cancel</button>
              <button onClick={saveAddress} disabled={saving === `${editAddr.id}:addr`}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-[#4361EE] text-white disabled:opacity-60 flex items-center gap-1.5">
                {saving === `${editAddr.id}:addr` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save address
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RemarkInput({ initial, saving, onSave }: { initial: string; saving: boolean; onSave: (t: string) => void }) {
  const [v, setV] = useState(initial);
  return (
    <div className="relative">
      <textarea
        value={v}
        rows={2}
        placeholder="Reason / note for the seller"
        onChange={e => setV(e.target.value)}
        onBlur={() => onSave(v)}
        className="w-full min-w-[200px] rounded-lg border border-[#E8EDF6] px-2.5 py-1.5 text-[12px] resize-y focus:outline-none focus:border-[#4361EE]"
      />
      {saving && <Loader2 className="w-3 h-3 animate-spin text-[#4361EE] absolute right-2 top-2" />}
    </div>
  );
}
