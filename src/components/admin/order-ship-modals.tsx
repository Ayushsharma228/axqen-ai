"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Truck } from "lucide-react";

/** The order fields the ship / AWB pop-ups need. */
export interface ShipOrder {
  id: string; externalOrderId: string; customerName: string | null; totalAmount: number; paymentMode?: string; awbNumber: string | null;
}

// ── Enter AWB Modal ──────────────────────────────────────────────────────────

const COURIERS = ["Delhivery", "BlueDart", "DTDC", "Ekart", "Xpressbees", "Shadowfax", "Ecom Express", "Amazon Logistics", "Other"] as const;

export function EnterAwbModal({ order, onClose, onSaved }: {
  order: ShipOrder;
  onClose: () => void;
  onSaved: (orderId: string, awb: string, courier: string) => Promise<void>;
}) {
  const [awb, setAwb]       = useState(order.awbNumber ?? "");
  const [courier, setCourier] = useState("Delhivery");
  const [custom, setCustom]   = useState("");
  const [saving, setSaving]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const awbTrimmed = awb.trim();
    if (!awbTrimmed) return;
    setSaving(true);
    await onSaved(order.id, awbTrimmed, courier === "Other" ? custom.trim() : courier);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">Enter AWB</h2>
            <p className="text-xs text-gray-400 mt-0.5">Order #{order.externalOrderId} · {order.customerName ?? "—"}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Courier Partner</label>
            <select value={courier} onChange={(e) => setCourier(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400">
              {COURIERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {courier === "Other" && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Courier Name</label>
              <input value={custom} onChange={(e) => setCustom(e.target.value)} required
                placeholder="e.g. Shiprocket"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">AWB / Tracking Number</label>
            <input value={awb} onChange={(e) => setAwb(e.target.value)} required
              placeholder="Enter AWB number"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving || !awb.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
              style={{ background: "#4338CA" }}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save AWB"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Ship via Shipdaak Modal ──────────────────────────────────────────────────

const WH_PREF_KEY = "axqen.shipdaak.warehouse";

export function ShipdaakModal({ order, onClose, onShipped }: {
  order: ShipOrder;
  onClose: () => void;
  onShipped: () => Promise<void>;
}) {
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [warehouses, setWarehouses] = useState<{ id: number; name: string; city?: string; zip?: string }[]>([]);
  const [couriers, setCouriers]     = useState<{ id: number; name: string }[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [courierId, setCourierId]   = useState("");
  const [weight, setWeight]   = useState("0.5");
  const [length, setLength]   = useState("23");
  const [breadth, setBreadth] = useState("13");
  const [height, setHeight]   = useState("4");
  const [shipping, setShipping] = useState(false);

  useEffect(() => {
    fetch("/api/admin/shipdaak").then((r) => r.json()).then((d) => {
      if (!d.configured) setError("Shipdaak isn't set up yet. Add SHIPDAAK_EMAIL and SHIPDAAK_PASSWORD in Vercel.");
      else if (d.error) setError(d.error);
      setWarehouses(d.warehouses ?? []);
      setCouriers(d.couriers ?? []);
      let saved = "";
      try { saved = localStorage.getItem(WH_PREF_KEY) ?? ""; } catch {}
      const first = (d.warehouses ?? [])[0]?.id;
      const valid = (d.warehouses ?? []).some((w: { id: number }) => String(w.id) === saved);
      setWarehouseId(valid ? saved : first ? String(first) : "");
    }).catch(() => setError("Couldn't reach Shipdaak")).finally(() => setLoading(false));
  }, []);

  async function ship(e: React.FormEvent) {
    e.preventDefault();
    setShipping(true);
    setError("");
    try { localStorage.setItem(WH_PREF_KEY, warehouseId); } catch {}
    const res = await fetch("/api/admin/shipdaak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ship", orderId: order.id, warehouseId, courierId: courierId || undefined, weightKg: weight, length, breadth, height }),
    });
    const d = await res.json();
    setShipping(false);
    if (!res.ok) { setError(d.error || "Shipment failed"); return; }
    if (d.labelUrl) window.open(d.labelUrl, "_blank", "noopener");
    await onShipped();
  }

  const input = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">Ship via Shipdaak</h2>
            <p className="text-xs text-gray-400 mt-0.5">Order #{order.externalOrderId} · {order.customerName ?? "—"} · ₹{order.totalAmount.toLocaleString("en-IN")}{order.paymentMode ? ` · ${order.paymentMode}` : ""}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
        ) : (
          <form onSubmit={ship} className="p-6 space-y-4">
            {error && <div className="px-3 py-2.5 rounded-lg text-sm bg-red-50 text-red-600 border border-red-100">{error}</div>}

            <div>
              <label htmlFor="sd-wh" className="block text-xs font-semibold text-gray-500 mb-1.5">Pickup warehouse</label>
              <select id="sd-wh" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required className={input}>
                {warehouses.length === 0 && <option value="">No warehouses in Shipdaak</option>}
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}{w.city ? ` · ${w.city}` : ""}{w.zip ? ` ${w.zip}` : ""}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="sd-courier" className="block text-xs font-semibold text-gray-500 mb-1.5">Courier</label>
              <select id="sd-courier" value={courierId} onChange={(e) => setCourierId(e.target.value)} className={input}>
                <option value="">Auto (Shipdaak autoship rules)</option>
                {couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {([["Weight (kg)", weight, setWeight, "0.1"], ["L (cm)", length, setLength, "1"], ["B (cm)", breadth, setBreadth, "1"], ["H (cm)", height, setHeight, "1"]] as const).map(([label, val, set, step]) => (
                <div key={label}>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">{label}</label>
                  <input type="number" min={step} step={step} value={val} onChange={(e) => set(e.target.value)} className={input} />
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={shipping || !warehouseId}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
                style={{ background: "#155EEF" }}>
                {shipping ? <><Loader2 className="w-4 h-4 animate-spin" /> Booking…</> : <><Truck className="w-4 h-4" /> Ship &amp; print label</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

