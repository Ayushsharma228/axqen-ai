"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, RefreshCw, Truck, Pencil, Printer, AlertTriangle, ChevronRight, MapPin } from "lucide-react";
import { OrderDrawer } from "@/components/admin/order-drawer";
import { EnterAwbModal, ShipdaakModal, type ShipOrder } from "@/components/admin/order-ship-modals";

type Stage = "READY_TO_SHIP" | "READY_FOR_PICKUP" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "RTO";
interface Row {
  id: string; externalOrderId: string; status: string; stage: Stage; awbNumber: string | null; courier: string | null; viaShipdaak: boolean;
  paymentMode: string; totalAmount: number; customerName: string | null; city: string | null; state: string | null; pincode: string | null;
  seller: string; createdAt: string; lastScan: { status: string; location: string; time: string } | null; idleDays: number; stuck: boolean;
}
interface Perf { total: number; delivered: number; rto: number; deliveredPct: number | null; rtoPct: number | null }
interface Data {
  rows: Row[]; deliveredToday: Row[]; stuckDays: number;
  couriers: (Perf & { courier: string; inTransit: number; avgDays: number | null })[];
  states: (Perf & { state: string })[];
  counts: Record<string, number>;
}
type Tab = "READY_TO_SHIP" | "READY_FOR_PICKUP" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "STUCK" | "DELIVERED_TODAY";

const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: "READY_TO_SHIP", label: "Ready to ship", hint: "Confirmed, no AWB yet" },
  { key: "READY_FOR_PICKUP", label: "Awaiting pickup", hint: "AWB booked, courier hasn't picked up" },
  { key: "IN_TRANSIT", label: "In transit", hint: "Picked up, moving" },
  { key: "OUT_FOR_DELIVERY", label: "Out for delivery", hint: "With the delivery agent today" },
  { key: "STUCK", label: "Stuck", hint: "No courier update for 3+ days" },
  { key: "DELIVERED_TODAY", label: "Delivered today", hint: "" },
];
const ago = (iso: string) => {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  return h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
};
const tone = (p: number | null, bad = false) => (p == null ? "#9CA3AF" : bad ? (p >= 30 ? "#B91C1C" : p >= 20 ? "#B45309" : "#374151") : p >= 80 ? "#047857" : p >= 65 ? "#B45309" : "#B91C1C");

export default function ShipmentsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>("READY_TO_SHIP");
  const [q, setQ] = useState("");
  const [sellers, setSellers] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [sellerId, setSellerId] = useState("");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [shipOrder, setShipOrder] = useState<ShipOrder | null>(null);
  const [awbOrder, setAwbOrder] = useState<ShipOrder | null>(null);
  const [lastRun, setLastRun] = useState<{ at: string; checked: number; updated: number; booked?: number; manual?: number; notShipdaak?: number; errors?: string[] } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/shipments${sellerId ? `?sellerId=${sellerId}` : ""}`).then(r => r.json())
      .then(d => { if (d.rows) { setData(d); setError(false); } else setError(true); })
      .catch(() => setError(true)).finally(() => setLoading(false));
  }, [sellerId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch("/api/admin/sellers").then(r => r.json()).then(d => setSellers(d.sellers ?? [])).catch(() => {}); }, []);
  const loadRun = useCallback(() => fetch("/api/admin/shipdaak/tracking").then(r => r.json()).then(d => setLastRun(d.lastRun ?? null)).catch(() => {}), []);
  useEffect(() => { loadRun(); }, [loadRun]);
  async function syncNow() {
    setSyncing(true); setSyncMsg(null);
    const res = await fetch("/api/admin/shipdaak/tracking", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setSyncing(false);
    if (!res.ok || d.configured === false) { setSyncMsg({ ok: false, text: d.error ?? "Shipdaak isn't set up in Vercel (SHIPDAAK_EMAIL / SHIPDAAK_PASSWORD)." }); return; }
    setSyncMsg({ ok: !(d.errors?.length), text: `Checked ${d.checked} shipments with Shipdaak, ${d.updated} updated.${d.notShipdaak ? ` ${d.notShipdaak} AWBs aren't Shipdaak shipments.` : ""}${d.errors?.length ? ` ${d.errors.length} failed, e.g. ${d.errors[0]}` : ""}` });
    loadRun(); load();
  }

  const list = useMemo(() => {
    if (!data) return [];
    const base = tab === "DELIVERED_TODAY" ? data.deliveredToday : tab === "STUCK" ? data.rows.filter(r => r.stuck) : data.rows.filter(r => r.stage === tab);
    const s = q.trim().toLowerCase();
    const out = !s ? base : base.filter(r => [r.externalOrderId, r.awbNumber, r.customerName, r.seller, r.city, r.pincode].some(v => v?.toLowerCase().includes(s)));
    return tab === "STUCK" ? [...out].sort((a, b) => b.idleDays - a.idleDays) : out;
  }, [data, tab, q]);

  async function printLabel(orderId: string) {
    const res = await fetch("/api/admin/shipdaak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "label", orderId }) });
    const d = await res.json();
    if (!res.ok || !d.labelUrl) { alert(d.error || "Label not available"); return; }
    window.open(d.labelUrl, "_blank", "noopener");
  }
  async function saveAwb(orderId: string, awb: string, courier: string) {
    const res = await fetch("/api/admin/orders/set-awb", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, awb, courier, status: "SHIPPED" }) });
    const d = await res.json();
    if (!res.ok) { alert(d.error || "Failed to save AWB"); return; }
    setAwbOrder(null); load();
  }
  async function setStatus(orderId: string, status: string) {
    const res = await fetch("/api/admin/orders/update-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, status }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Couldn't update the status"); }
    load();
  }
  const asShip = (r: Row): ShipOrder => ({ id: r.id, externalOrderId: r.externalOrderId, customerName: r.customerName, totalAmount: r.totalAmount, paymentMode: r.paymentMode, awbNumber: r.awbNumber });
  const drawerRow = data ? [...data.rows, ...data.deliveredToday].find(r => r.id === drawerId) ?? null : null;
  const hint = TABS.find(t => t.key === tab)?.hint;

  return (
    <div className="px-4 py-5 md:p-8 space-y-5" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-black text-[#0C1220]">Shipments</h1>
          <p className="text-[12.5px] text-[#6B7280] mt-1">Orders on the move, read from the latest courier scans. Stuck shipments and courier performance at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <select id="sh-seller" aria-label="Seller" value={sellerId} onChange={e => setSellerId(e.target.value)} className="px-2.5 py-2 text-[12.5px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] max-w-[200px]">
            <option value="">All sellers</option>
            {sellers.map(s => <option key={s.id} value={s.id}>{s.name || s.email}</option>)}
          </select>
          <button onClick={syncNow} disabled={syncing} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold text-white bg-[#4361EE] disabled:opacity-60">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Syncing with Shipdaak…" : "Sync tracking now"}
          </button>
        </div>
      </div>

      <p className="text-[12px] text-[#6B7280] -mt-2">
        {lastRun ? <>Last Shipdaak sync {new Date(lastRun.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}: {lastRun.checked} checked, {lastRun.updated} updated{lastRun.errors?.length ? <span className="text-[#B91C1C]"> · {lastRun.errors.length} errors, e.g. {lastRun.errors[0]}</span> : null}. Runs automatically every 2 hours.</> : "No Shipdaak sync recorded yet. It runs every 2 hours, or use Sync tracking now."}
      </p>
      {syncMsg && <div className="px-4 py-2.5 rounded-xl text-[13px]" style={{ background: syncMsg.ok ? "#ECFDF5" : "#FEF2F2", color: syncMsg.ok ? "#047857" : "#B91C1C" }}>{syncMsg.text}</div>}

      {error ? <p className="py-24 text-center text-[13px] text-[#B91C1C]">Couldn&apos;t load shipments. Refresh to try again.</p>
        : !data ? <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-[#9CA3AF]"><Loader2 className="w-5 h-5 animate-spin" /> Loading shipments…</div>
        : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {TABS.map(t => {
              const n = data.counts[t.key] ?? 0, on = tab === t.key, alert = t.key === "STUCK" && n > 0;
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`text-left bg-white rounded-xl border p-4 transition-colors ${on ? "border-[#4361EE] ring-2 ring-[#E8EDFF]" : alert ? "border-[#FECACA] hover:border-[#FCA5A5]" : "border-[#E8EDF6] hover:border-[#C7D2FE]"}`}>
                  <p className="text-[11.5px] font-semibold text-[#6B7280] flex items-center gap-1">{alert && <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" />}{t.label}</p>
                  <p className="text-[26px] font-black leading-tight tabular-nums mt-1" style={{ color: alert ? "#B91C1C" : t.key === "DELIVERED_TODAY" ? "#047857" : "#0C1220" }}>{n}</p>
                </button>
              );
            })}
          </div>

          <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
            <div className="flex items-center gap-2 flex-wrap px-4 py-3 bg-[#FAFBFF] border-b border-[#F3F4F6]">
              <p className="text-[13px] font-bold text-[#0C1220]">{TABS.find(t => t.key === tab)?.label}</p>
              {hint && <p className="text-[12px] text-[#9CA3AF]">· {tab === "STUCK" ? `No courier update for ${data.stuckDays}+ days` : hint}</p>}
              <div className="relative ml-auto w-full sm:w-[260px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
                <input id="sh-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Order, AWB, customer, city"
                  className="pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] w-full" />
              </div>
            </div>
            {list.length === 0 ? (
              <p className="py-16 text-center text-[13px] text-[#9CA3AF]">{tab === "STUCK" ? "Nothing stuck. Every shipment has a recent courier update." : "Nothing here right now."}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] text-[12.5px]">
                  <thead>
                    <tr className="bg-[#FAFBFF] text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                      <th className="px-4 py-2.5">Order</th><th className="px-3 py-2.5">Seller</th><th className="px-3 py-2.5">Customer</th>
                      <th className="px-3 py-2.5 text-right">Amount</th><th className="px-3 py-2.5">Courier / AWB</th><th className="px-3 py-2.5">Last courier update</th><th className="px-3 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {list.map(r => (
                      <tr key={r.id} onClick={() => setDrawerId(r.id)} className="cursor-pointer hover:bg-[#FAFBFF]">
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="block font-mono font-semibold text-[#0C1220]">{r.externalOrderId}</span>
                          <span className="block text-[11px] text-[#9CA3AF]">{new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                        </td>
                        <td className="px-3 py-2.5 text-[#374151] truncate max-w-[140px]">{r.seller}</td>
                        <td className="px-3 py-2.5">
                          <span className="block text-[#0C1220] truncate max-w-[170px]">{r.customerName ?? "—"}</span>
                          <span className="block text-[11px] text-[#9CA3AF] truncate max-w-[170px]">{[r.city, r.pincode].filter(Boolean).join(" · ")}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <span className="block font-semibold tabular-nums">₹{r.totalAmount.toLocaleString("en-IN")}</span>
                          {r.paymentMode !== "UNKNOWN" && <span className={`text-[10.5px] font-bold ${r.paymentMode === "COD" ? "text-[#B45309]" : "text-[#047857]"}`}>{r.paymentMode === "COD" ? "COD" : "Prepaid"}</span>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {r.awbNumber ? <><span className="block text-[#374151]">{r.courier ?? "—"}</span><span className="block text-[11px] font-mono text-[#6B7280]">{r.awbNumber}</span></> : <span className="text-[#C4C9D4]">No AWB</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          {r.lastScan ? (
                            <>
                              <span className="block text-[#0C1220] truncate max-w-[240px]">{r.lastScan.status}</span>
                              <span className={`block text-[11px] truncate max-w-[240px] ${r.stuck ? "text-[#B91C1C] font-semibold" : "text-[#9CA3AF]"}`}>
                                {r.lastScan.location && <><MapPin className="w-3 h-3 inline -mt-0.5" /> {r.lastScan.location} · </>}{ago(r.lastScan.time)}
                              </span>
                            </>
                          ) : r.awbNumber ? <span className={`text-[11.5px] ${r.stuck ? "text-[#B91C1C] font-semibold" : "text-[#9CA3AF]"}`}>No scans yet{r.stuck ? ` · ${r.idleDays}d` : ""}</span> : <span className="text-[#C4C9D4]">—</span>}
                        </td>
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {r.stage === "READY_TO_SHIP" && <>
                              <button onClick={() => setShipOrder(asShip(r))} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11.5px] font-bold text-white bg-[#4361EE]"><Truck className="w-3 h-3" /> Ship</button>
                              <button onClick={() => setAwbOrder(asShip(r))} aria-label="Enter AWB" title="Enter AWB" className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F6FF] hover:text-[#4361EE]"><Pencil className="w-3.5 h-3.5" /></button>
                            </>}
                            {r.awbNumber && r.viaShipdaak && <button onClick={() => printLabel(r.id)} aria-label="Print label" title="Print label" className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F6FF] hover:text-[#4361EE]"><Printer className="w-3.5 h-3.5" /></button>}
                            <ChevronRight className="w-4 h-4 text-[#C4C9D4]" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <section className="bg-white rounded-xl border border-[#E8EDF6] p-5">
              <h2 className="text-[15px] font-bold text-[#0C1220]">Courier performance</h2>
              <p className="text-[12px] text-[#9CA3AF] mt-0.5 mb-4">Orders from the last 30 days. Delivered and RTO % are of completed shipments; days are first scan to delivery.</p>
              {data.couriers.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-[12.5px]">
                    <thead><tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF] border-b border-[#F3F4F6]">
                      <th className="py-2 pr-3">Courier</th><th className="py-2 pr-3 text-right">Shipments</th><th className="py-2 pr-3 text-right">Delivered</th><th className="py-2 pr-3 text-right">RTO</th><th className="py-2 text-right">Avg days</th>
                    </tr></thead>
                    <tbody className="divide-y divide-[#F3F4F6]">
                      {data.couriers.map(c => (
                        <tr key={c.courier}>
                          <td className="py-2.5 pr-3 font-medium text-[#0C1220]">{c.courier}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">{c.total}{c.inTransit > 0 && <span className="text-[11px] text-[#9CA3AF]"> · {c.inTransit} moving</span>}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums font-semibold" style={{ color: tone(c.deliveredPct) }}>{c.deliveredPct != null ? `${c.deliveredPct}%` : "—"}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums font-semibold" style={{ color: tone(c.rtoPct, true) }}>{c.rtoPct != null ? `${c.rtoPct}%` : "—"}</td>
                          <td className="py-2.5 text-right tabular-nums">{c.avgDays ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="py-8 text-center text-[13px] text-[#9CA3AF]">No shipments in the last 30 days.</p>}
            </section>
            <section className="bg-white rounded-xl border border-[#E8EDF6] p-5">
              <h2 className="text-[15px] font-bold text-[#0C1220]">State performance</h2>
              <p className="text-[12px] text-[#9CA3AF] mt-0.5 mb-4">Last 30 days, states with 3+ completed shipments.</p>
              {data.states.length ? (
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full min-w-[420px] text-[12.5px]">
                    <thead><tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF] border-b border-[#F3F4F6]">
                      <th className="py-2 pr-3">State</th><th className="py-2 pr-3 text-right">Shipments</th><th className="py-2 pr-3 text-right">Delivered</th><th className="py-2 text-right">RTO</th>
                    </tr></thead>
                    <tbody className="divide-y divide-[#F3F4F6]">
                      {data.states.map(s => (
                        <tr key={s.state}>
                          <td className="py-2.5 pr-3 font-medium text-[#0C1220]">{s.state}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">{s.total}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums font-semibold" style={{ color: tone(s.deliveredPct) }}>{s.deliveredPct != null ? `${s.deliveredPct}%` : "—"}</td>
                          <td className="py-2.5 text-right tabular-nums font-semibold" style={{ color: tone(s.rtoPct, true) }}>{s.rtoPct != null ? `${s.rtoPct}%` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="py-8 text-center text-[13px] text-[#9CA3AF]">Not enough completed shipments yet.</p>}
            </section>
          </div>
        </>
      )}

      {drawerId && (
        <OrderDrawer orderId={drawerId} onClose={() => setDrawerId(null)}
          onShip={() => drawerRow && setShipOrder(asShip(drawerRow))}
          onAwb={() => drawerRow && setAwbOrder(asShip(drawerRow))}
          onLabel={() => printLabel(drawerId)}
          onStatus={s => setStatus(drawerId, s)} />
      )}
      {shipOrder && <ShipdaakModal order={shipOrder} onClose={() => setShipOrder(null)} onShipped={async () => { setShipOrder(null); load(); }} />}
      {awbOrder && <EnterAwbModal order={awbOrder} onClose={() => setAwbOrder(null)} onSaved={saveAwb} />}
    </div>
  );
}
