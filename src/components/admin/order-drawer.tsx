"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Loader2, Phone, MapPin, Truck, Printer, Pencil, CheckCircle2, XCircle, ExternalLink, Package, MessageCircle, Clock } from "lucide-react";

interface Detail {
  id: string; externalOrderId: string; source: string; status: string; paymentMode: string; createdAt: string;
  customerName: string | null; customerEmail: string | null;
  customerAddress: Record<string, string | undefined> | null;
  totalAmount: number; productCost: number | null; shippingCharge: number | null; packingCharge: number | null; rtoCharge: number | null;
  awbNumber: string | null; courier: string | null; trackingUrl: string | null;
  ndrReason: string | null; ndrStatus: string | null; ndrActionTaken: string | null; ndrAttempts: number;
  confirmationStatus: string; remittedAt: string | null;
  seller: { id: string; name: string | null; email: string; brandName: string | null; phone: string | null };
  items: { id: string; name: string; quantity: number; price: number; sku?: string | null }[];
  timeline: { id: string; event: string; eventType: string | null; details: string | null; metadata: Record<string, unknown> | null; actorRole: string | null; createdAt: string }[];
}

export const STATUS_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  NEW: { bg: "#FEF3C7", fg: "#B45309", label: "New" },
  PROCESSING: { bg: "#EDE9FE", fg: "#6D28D9", label: "Processing" },
  SHIPPED: { bg: "#E0EAFF", fg: "#3538CD", label: "Shipped" },
  IN_TRANSIT: { bg: "#E0F2FE", fg: "#0369A1", label: "In transit" },
  DELIVERED: { bg: "#DCFCE7", fg: "#047857", label: "Delivered" },
  RTO: { bg: "#FEE2E2", fg: "#B91C1C", label: "RTO" },
  CANCELLED: { bg: "#F3F4F6", fg: "#6B7280", label: "Cancelled" },
};
const STATUSES = ["NEW", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "RTO", "CANCELLED"];
const inr = (n: number | null | undefined) => (n == null ? "—" : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);
const when = (s: string) => new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function OrderDrawer({ orderId, onClose, onShip, onAwb, onLabel, onStatus }: {
  orderId: string;
  onClose: () => void;
  onShip: () => void;
  onAwb: () => void;
  onLabel: () => void;
  onStatus: (status: string) => Promise<void>;
}) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"activity" | "scans">("activity");

  useEffect(() => {
    setD(null); setErr("");
    fetch(`/api/admin/orders/${orderId}`).then(r => r.json()).then(x => (x.order ? setD(x.order) : setErr(x.error ?? "Couldn't load order"))).catch(() => setErr("Couldn't load order"));
  }, [orderId]);

  async function setStatus(s: string) {
    if (!d || s === d.status) return;
    if (s === "CANCELLED" && !confirm(`Cancel order ${d.externalOrderId}?`)) return;
    setBusy(true);
    await onStatus(s);
    const x = await fetch(`/api/admin/orders/${orderId}`).then(r => r.json()).catch(() => null);
    if (x?.order) setD(x.order);
    setBusy(false);
  }

  const a = d?.customerAddress ?? {};
  const phone = (a.phone ?? "").replace(/\D/g, "").slice(-10);
  const scans = (d?.timeline ?? []).filter(t => t.eventType === "COURIER_SCAN").map(t => t.metadata as { status?: string; location?: string; message?: string; time?: string })
    .filter(s => s.time).sort((x, y) => String(y.time).localeCompare(String(x.time)));
  const activity = (d?.timeline ?? []).filter(t => t.eventType !== "COURIER_SCAN").slice().reverse();
  const open = d && !["CANCELLED", "DELIVERED", "RTO"].includes(d.status);
  const st = d ? STATUS_TONE[d.status] ?? { bg: "#F3F4F6", fg: "#374151", label: d.status } : null;
  const btn = "flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onClick={onClose}>
      <aside className="w-full max-w-xl bg-[#F7F8FC] h-full overflow-y-auto" onClick={e => e.stopPropagation()} aria-label="Order details">
        <div className="sticky top-0 bg-white border-b border-[#E8EDF6] px-5 py-4 flex items-start justify-between z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[16px] font-bold text-[#0C1220] font-mono">{d?.externalOrderId ?? "Order"}</p>
              {st && <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: st.bg, color: st.fg }}>{st.label}</span>}
            </div>
            {d && <p className="text-[12px] text-[#9CA3AF] mt-0.5">{when(d.createdAt)} · {d.source} · {d.paymentMode === "UNKNOWN" ? "Payment unknown" : d.paymentMode}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-[#F3F4F6]"><X className="w-4 h-4" /></button>
        </div>

        {err ? <p className="p-8 text-center text-[13px] text-[#B91C1C]">{err}</p> : !d ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#4361EE]" /></div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {open && !d.awbNumber && <button onClick={onShip} className={`${btn} bg-[#4361EE] text-white`}><Truck className="w-3.5 h-3.5" /> Ship with Shipdaak</button>}
              {open && !d.awbNumber && <button onClick={onAwb} className={`${btn} bg-white border border-[#E8EDF6] text-[#374151]`}><Pencil className="w-3.5 h-3.5" /> Enter AWB</button>}
              {d.awbNumber && d.courier?.startsWith("Shipdaak · ") && <button onClick={onLabel} className={`${btn} bg-white border border-[#E8EDF6] text-[#374151]`}><Printer className="w-3.5 h-3.5" /> Label</button>}
              {d.status === "NEW" && <button onClick={() => setStatus("PROCESSING")} disabled={busy} className={`${btn} bg-[#DCFCE7] text-[#047857]`}><CheckCircle2 className="w-3.5 h-3.5" /> Confirm</button>}
              {open && <button onClick={() => setStatus("CANCELLED")} disabled={busy} className={`${btn} bg-[#FEF2F2] text-[#B91C1C]`}><XCircle className="w-3.5 h-3.5" /> Cancel order</button>}
              <label className="ml-auto flex items-center gap-1.5 text-[12px] text-[#6B7280]">
                Status
                <select id="drawer-status" value={d.status} disabled={busy} onChange={e => setStatus(e.target.value)}
                  className="px-2 py-1.5 text-[12.5px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] text-[#0C1220]">
                  {STATUSES.map(s => <option key={s} value={s}>{STATUS_TONE[s].label}</option>)}
                </select>
              </label>
            </div>

            {/* Customer */}
            <section className="bg-white rounded-xl border border-[#E8EDF6] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF] mb-2">Customer</p>
              <p className="text-[14px] font-semibold text-[#0C1220]">{d.customerName ?? "—"}</p>
              <p className="text-[12.5px] text-[#4B5563] mt-1 flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[#9CA3AF]" />
                {[a.address1 ?? a.address, a.address2, a.city, a.state ?? a.province, a.pincode ?? a.zip].filter(Boolean).join(", ") || "No address"}
              </p>
              {phone && (
                <div className="flex items-center gap-3 mt-2 text-[12.5px]">
                  <a href={`tel:${phone}`} className="inline-flex items-center gap-1 font-semibold text-[#4361EE]"><Phone className="w-3.5 h-3.5" /> {phone}</a>
                  <a href={`https://wa.me/91${phone}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#059669]"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</a>
                </div>
              )}
            </section>

            {/* Items & money */}
            <section className="bg-white rounded-xl border border-[#E8EDF6] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF] mb-2">Items</p>
              <div className="divide-y divide-[#F3F4F6]">
                {d.items.map(i => (
                  <div key={i.id} className="flex items-center gap-2 py-2 text-[12.5px]">
                    <Package className="w-3.5 h-3.5 text-[#C4C9D4] flex-shrink-0" />
                    <span className="flex-1 text-[#0C1220]">{i.name}</span>
                    <span className="text-[#6B7280] tabular-nums">× {i.quantity}</span>
                    <span className="w-[80px] text-right tabular-nums text-[#374151]">{inr(i.price)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-[#E8EDF6] grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px] tabular-nums">
                <span className="text-[#6B7280]">Order total</span><span className="text-right font-bold text-[#0C1220]">{inr(d.totalAmount)}</span>
                <span className="text-[#6B7280]">Product cost</span><span className="text-right">{inr(d.productCost)}</span>
                <span className="text-[#6B7280]">Shipping</span><span className="text-right">{inr(d.shippingCharge)}</span>
                <span className="text-[#6B7280]">Packing</span><span className="text-right">{inr(d.packingCharge)}</span>
                {d.rtoCharge != null && <><span className="text-[#6B7280]">RTO charge</span><span className="text-right">{inr(d.rtoCharge)}</span></>}
                <span className="text-[#6B7280]">Remitted</span><span className="text-right">{d.remittedAt ? new Date(d.remittedAt).toLocaleDateString("en-IN") : "Not yet"}</span>
              </div>
            </section>

            {/* Shipping */}
            <section className="bg-white rounded-xl border border-[#E8EDF6] p-4 space-y-1.5 text-[12.5px]">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF] mb-1">Shipping</p>
              <p className="text-[#374151]">{d.courier?.replace("Shipdaak · ", "") ?? "No courier yet"}{d.awbNumber && <> · <span className="font-mono">{d.awbNumber}</span></>}
                {d.trackingUrl && <a href={d.trackingUrl} target="_blank" rel="noreferrer" className="ml-2 text-[#4361EE] inline-flex items-center gap-0.5">Track <ExternalLink className="w-3 h-3" /></a>}
              </p>
              {d.ndrStatus && (
                <p className="text-[#B45309]">NDR: {d.ndrReason ?? d.ndrStatus} · {d.ndrAttempts} attempt{d.ndrAttempts === 1 ? "" : "s"}{d.ndrActionTaken ? ` · action: ${d.ndrActionTaken}` : " · no action yet"}</p>
              )}
              <p className="text-[#6B7280]">Seller: <Link href={`/admin/sellers/${d.seller.id}`} className="text-[#4361EE] font-semibold">{d.seller.brandName || d.seller.name || d.seller.email}</Link></p>
            </section>

            {/* Activity / scans */}
            <section className="bg-white rounded-xl border border-[#E8EDF6] p-4">
              <div className="flex items-center gap-1 mb-3">
                {(["activity", "scans"] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)} className={`px-2.5 py-1 rounded-lg text-[12px] font-semibold ${tab === t ? "bg-[#E8EDFF] text-[#4361EE]" : "text-[#6B7280] hover:bg-[#F3F6FF]"}`}>
                    {t === "activity" ? `Activity (${activity.length})` : `Courier scans (${scans.length})`}
                  </button>
                ))}
              </div>
              {tab === "activity" ? (
                activity.length ? (
                  <ol className="relative ml-2 border-l border-[#E6EBF7] space-y-3">
                    {activity.map(t => (
                      <li key={t.id} className="ml-4">
                        <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-[#C7D2FE]" />
                        <p className="text-[12.5px] text-[#0C1220] font-medium">{t.event}</p>
                        {t.details && <p className="text-[12px] text-[#6B7280]">{t.details}</p>}
                        <p className="text-[11px] text-[#9CA3AF] flex items-center gap-1"><Clock className="w-3 h-3" /> {when(t.createdAt)}{t.actorRole ? ` · ${t.actorRole.toLowerCase()}` : ""}</p>
                      </li>
                    ))}
                  </ol>
                ) : <p className="text-[12.5px] text-[#9CA3AF]">No activity recorded yet.</p>
              ) : scans.length ? (
                <ol className="relative ml-2 border-l border-[#E6EBF7] space-y-3">
                  {scans.map((s, i) => (
                    <li key={i} className="ml-4">
                      <span className={`absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full ${i === 0 ? "bg-[#4361EE]" : "bg-[#D9E0F2]"}`} />
                      <p className="text-[12.5px] text-[#0C1220] font-medium">{s.status}</p>
                      <p className="text-[12px] text-[#6B7280]">{[s.location, s.message].filter(Boolean).join(" · ")}</p>
                      <p className="text-[11px] text-[#9CA3AF]">{when(String(s.time))}</p>
                    </li>
                  ))}
                </ol>
              ) : <p className="text-[12.5px] text-[#9CA3AF]">No courier scans yet.</p>}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
