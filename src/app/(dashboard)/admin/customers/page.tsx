"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Loader2, Search, Phone, MessageCircle, ChevronDown, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { STATUS_TONE } from "@/components/admin/order-drawer";

interface Row {
  key: string; name: string; phone: string | null; city: string | null; state: string | null; pincode: string | null;
  orders: number; delivered: number; rto: number; cancelled: number; open: number; cod: number; spend: number; rtoPct: number | null;
  sellers: string[]; first: string; last: string;
}
interface Data { rows: Row[]; total: number; page: number; pages: number; summary: { customers: number; repeat: number; highRto: number; multiSeller: number }; highRtoMin: number }
interface CustOrder { id: string; externalOrderId: string; status: string; totalAmount: number; paymentMode: string; createdAt: string; seller: string; items: string }
type Filter = "all" | "repeat" | "highRto";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const fmt = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });

export default function AdminCustomersPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState("recent");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [sellers, setSellers] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [page, setPage] = useState(1);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [custOrders, setCustOrders] = useState<Record<string, CustOrder[]>>({});

  useEffect(() => { fetch("/api/admin/sellers").then(r => r.json()).then(d => setSellers(d.sellers ?? [])).catch(() => {}); }, []);
  useEffect(() => { setPage(1); }, [filter, sort, search, sellerId]);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ filter, sort, page: String(page), ...(search ? { search } : {}), ...(sellerId ? { sellerId } : {}) });
    fetch(`/api/admin/customers/board?${p}`).then(r => r.json()).then(d => { if (d.rows) setData(d); }).finally(() => setLoading(false));
  }, [filter, sort, page, search, sellerId]);
  useEffect(() => { load(); }, [load]);

  function toggle(r: Row) {
    if (openKey === r.key) { setOpenKey(null); return; }
    setOpenKey(r.key);
    if (!custOrders[r.key]) {
      const p = new URLSearchParams({ key: r.key, ...(sellerId ? { sellerId } : {}) });
      fetch(`/api/admin/customers/board?${p}`).then(x => x.json()).then(d => setCustOrders(c => ({ ...c, [r.key]: d.orders ?? [] })));
    }
  }

  const tiles: { key: Filter; label: string; value: number; tone: string; hint: string }[] = data ? [
    { key: "all", label: "Customers", value: data.summary.customers, tone: "#0C1220", hint: "Unique by phone number" },
    { key: "repeat", label: "Repeat buyers", value: data.summary.repeat, tone: "#047857", hint: "2+ orders" },
    { key: "highRto", label: "High-RTO customers", value: data.summary.highRto, tone: "#B91C1C", hint: `${data.highRtoMin}+ returns. Watch these on COD` },
  ] : [];
  const ctl = "px-2.5 py-2 text-[12.5px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] text-[#374151]";

  return (
    <div className="px-4 py-5 md:p-8 space-y-5" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div>
        <h1 className="text-[22px] font-black text-[#0C1220]">Customers</h1>
        <p className="text-[12.5px] text-[#6B7280] mt-1">End customers across all sellers, grouped by phone number. Click a customer to see their orders.</p>
      </div>

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {tiles.map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              className={`text-left bg-white rounded-xl border p-4 transition-colors ${filter === t.key ? "border-[#4361EE] ring-2 ring-[#E8EDFF]" : "border-[#E8EDF6] hover:border-[#C7D2FE]"}`}>
              <p className="text-[11.5px] font-semibold text-[#6B7280]">{t.label}</p>
              <p className="text-[26px] font-black leading-tight tabular-nums mt-1" style={{ color: t.tone }}>{t.value.toLocaleString("en-IN")}</p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">{t.hint}</p>
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
        <div className="flex items-center gap-2 flex-wrap px-4 py-3 bg-[#FAFBFF] border-b border-[#F3F4F6]">
          <form className="relative flex-1 min-w-[200px] md:max-w-[300px]" onSubmit={e => { e.preventDefault(); setSearch(searchInput.trim()); }}>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
            <input id="cust-search" value={searchInput} onChange={e => { setSearchInput(e.target.value); if (!e.target.value) setSearch(""); }} placeholder="Name, phone, city or pincode"
              className="pl-8 pr-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] w-full" />
          </form>
          <select id="cust-seller" aria-label="Seller" value={sellerId} onChange={e => setSellerId(e.target.value)} className={`${ctl} max-w-[200px]`}>
            <option value="">All sellers</option>
            {sellers.map(s => <option key={s.id} value={s.id}>{s.name || s.email}</option>)}
          </select>
          <select id="cust-sort" aria-label="Sort" value={sort} onChange={e => setSort(e.target.value)} className={ctl}>
            <option value="recent">Latest order first</option><option value="orders">Most orders</option><option value="rto">Most returns</option><option value="spend">Highest delivered value</option>
          </select>
          {data && <span className="text-[12px] text-[#9CA3AF] ml-auto">{data.total.toLocaleString("en-IN")} customers</span>}
        </div>

        {loading && !data ? (
          <div className="py-20 flex items-center justify-center gap-2 text-[13px] text-[#9CA3AF]"><Loader2 className="w-4 h-4 animate-spin" /> Loading customers…</div>
        ) : !data || data.rows.length === 0 ? (
          <p className="py-20 text-center text-[13px] text-[#9CA3AF]">No customers match.</p>
        ) : (
          <div className={`overflow-x-auto ${loading ? "opacity-60" : ""}`}>
            <table className="w-full min-w-[1000px] text-[12.5px]">
              <thead>
                <tr className="bg-[#FAFBFF] text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                  <th className="px-4 py-2.5">Customer</th><th className="px-3 py-2.5">Location</th><th className="px-3 py-2.5">Seller</th>
                  <th className="px-3 py-2.5 text-right">Orders</th><th className="px-3 py-2.5 text-right">Delivered</th><th className="px-3 py-2.5 text-right">RTO</th>
                  <th className="px-3 py-2.5 text-right">Delivered value</th><th className="px-3 py-2.5">Last order</th><th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {data.rows.map(r => {
                  const risky = r.rto >= data.highRtoMin;
                  const open = openKey === r.key;
                  return (
                    <Fragment key={r.key}>
                      <tr onClick={() => toggle(r)} className={`cursor-pointer ${open ? "bg-[#F5F7FF]" : "hover:bg-[#FAFBFF]"}`}>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-1.5 font-semibold text-[#0C1220]">{r.name}{risky && <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" aria-label="High RTO" />}</span>
                          <span className="block text-[11px] text-[#9CA3AF] font-mono">{r.phone ?? "No phone"}</span>
                        </td>
                        <td className="px-3 py-2.5 text-[#4B5563]">{[r.city, r.state].filter(Boolean).join(", ") || "—"}{r.pincode && <span className="block text-[11px] text-[#9CA3AF]">{r.pincode}</span>}</td>
                        <td className="px-3 py-2.5 text-[#374151] max-w-[160px]">
                          <span className="block truncate">{r.sellers[0]}</span>
                          {r.sellers.length > 1 && <span className="text-[11px] font-semibold text-[#4361EE]">+{r.sellers.length - 1} more seller{r.sellers.length > 2 ? "s" : ""}</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[#0C1220]">{r.orders}{r.open > 0 && <span className="block text-[10.5px] font-normal text-[#9CA3AF]">{r.open} open</span>}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[#047857]">{r.delivered}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          <span className="font-semibold" style={{ color: risky ? "#B91C1C" : r.rto ? "#B45309" : "#9CA3AF" }}>{r.rto}</span>
                          {r.rtoPct != null && r.rto > 0 && <span className="block text-[10.5px] text-[#9CA3AF]">{r.rtoPct}%</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.spend ? inr(r.spend) : "—"}</td>
                        <td className="px-3 py-2.5 text-[#6B7280] whitespace-nowrap">{fmt(r.last)}{r.orders > 1 && <span className="block text-[10.5px] text-[#9CA3AF]">since {fmt(r.first)}</span>}</td>
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {r.phone && <>
                              <a href={`tel:${r.phone}`} aria-label={`Call ${r.name}`} className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F6FF] hover:text-[#4361EE]"><Phone className="w-3.5 h-3.5" /></a>
                              <a href={`https://wa.me/91${r.phone}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${r.name}`} className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F6FF] hover:text-[#059669]"><MessageCircle className="w-3.5 h-3.5" /></a>
                            </>}
                            <button onClick={() => toggle(r)} aria-label={open ? "Hide orders" : "Show orders"} className="p-1.5 rounded-lg text-[#9CA3AF] hover:bg-[#F3F6FF]"><ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} /></button>
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-[#F9FAFF]">
                          <td colSpan={9} className="px-4 py-3">
                            {!custOrders[r.key] ? <p className="text-[12.5px] text-[#9CA3AF] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading orders…</p> : (
                              <div className="rounded-lg border border-[#E8EDF6] bg-white divide-y divide-[#F3F4F6]">
                                {custOrders[r.key].map(o => {
                                  const st = STATUS_TONE[o.status] ?? { bg: "#F3F4F6", fg: "#374151", label: o.status };
                                  return (
                                    <div key={o.id} className="flex items-center gap-3 px-3 py-2 text-[12.5px] flex-wrap">
                                      <span className="font-mono font-semibold text-[#0C1220] w-[120px]">{o.externalOrderId}</span>
                                      <span className="text-[#6B7280] w-[80px]">{fmt(o.createdAt)}</span>
                                      <span className="text-[#374151] w-[140px] truncate">{o.seller}</span>
                                      <span className="flex-1 min-w-[160px] text-[#4B5563] truncate">{o.items || "—"}</span>
                                      <span className="tabular-nums w-[90px] text-right">{inr(o.totalAmount)}{o.paymentMode === "COD" && <span className="text-[10.5px] text-[#B45309] font-bold ml-1">COD</span>}</span>
                                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && data.pages > 1 && (
          <div className="px-4 py-3 flex items-center justify-between border-t border-[#F3F4F6]">
            <span className="text-[12px] text-[#9CA3AF]">Page {data.page} of {data.pages}</span>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Previous page" className="p-1.5 rounded-lg border border-[#E8EDF6] disabled:opacity-30 hover:bg-[#F3F6FF]"><ChevronLeft className="w-4 h-4" /></button>
              <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} aria-label="Next page" className="p-1.5 rounded-lg border border-[#E8EDF6] disabled:opacity-30 hover:bg-[#F3F6FF]"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
