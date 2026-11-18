"use client";

import { Fragment, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import {
  Search, Users, TrendingUp, ShoppingBag, RefreshCw,
  ChevronDown, ChevronUp, MapPin, Phone, Mail, AlertTriangle, Download,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface OrderItem { name: string; quantity: number; price: number; }
interface RawOrder {
  id: string;
  externalOrderId: string;
  status: string;
  customerName: string | null;
  customerEmail: string | null;
  customerAddress: { phone?: string; city?: string; state?: string; pincode?: string; address?: string } | null;
  totalAmount: number;
  createdAt: string;
  items: OrderItem[];
  customerOrderCount: number;
}

interface Customer {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  totalOrders: number;
  gmv: number;
  deliveredValue: number;
  delivered: number;
  rto: number;
  cancelled: number;
  firstOrder: string;
  lastOrder: string;
  products: { name: string; qty: number }[];
  orders: RawOrder[];
}

// ── Helpers ────────────────────────────────────────────────────────────────
// One person = one phone number (COD buyers often skip or change email). Email is the fallback.
function customerKey(email: string | null, addr: RawOrder["customerAddress"]): string | null {
  const digits = (addr?.phone ?? "").replace(/\D/g, "").slice(-10);
  if (digits.length === 10) return `phone:${digits}`;
  if (email) return `email:${email.toLowerCase()}`;
  return null;
}

// Risky = 2 or more orders that came back or were cancelled.
const isRisky = (c: { rto: number; cancelled: number }) => c.rto + c.cancelled >= 2;
// Delivery rate over completed shipments only (delivered + RTO), same rule as the dashboard.
const deliveryRate = (c: { delivered: number; rto: number }) =>
  c.delivered + c.rto > 0 ? Math.round((c.delivered / (c.delivered + c.rto)) * 100) : null;

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const num = (n: number) => Math.round(n).toLocaleString("en-IN");

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  NEW:        { label: "New",        color: "#4361EE", bg: "#EEF2FF" },
  PROCESSING: { label: "Processing", color: "#D97706", bg: "#FFF7ED" },
  SHIPPED:    { label: "Shipped",    color: "#7C3AED", bg: "#F5F3FF" },
  IN_TRANSIT: { label: "In Transit", color: "#0369A1", bg: "#E0F2FE" },
  DELIVERED:  { label: "Delivered",  color: "#059669", bg: "#ECFDF5" },
  RTO:        { label: "RTO",        color: "#EF4444", bg: "#FEF2F2" },
  CANCELLED:  { label: "Cancelled",  color: "#6B7280", bg: "#F3F4F6" },
};

const TOOLTIP_STYLE = {
  contentStyle: { fontSize: 12, border: "1px solid #E8EDF6", borderRadius: 8, boxShadow: "none" },
  cursor: { fill: "rgba(67,97,238,0.04)" },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtShort(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const [rawOrders, setRawOrders]   = useState<RawOrder[]>([]);
  const [loading,   setLoading]     = useState(true);
  const [search,    setSearch]      = useState("");
  const [sortBy,    setSortBy]      = useState<"value" | "orders" | "last" | "risk">("value");
  const [expanded,  setExpanded]    = useState<string | null>(null);
  const [tab,       setTab]         = useState<"all" | "repeat" | "single" | "risky">("all");

  // Date range: last 12 months
  const today   = new Date();
  const yearAgo = new Date(today); yearAgo.setFullYear(today.getFullYear() - 1);
  const from = yearAgo.toISOString().split("T")[0];
  const to   = today.toISOString().split("T")[0];

  async function load() {
    setLoading(true);
    const res  = await fetch(`/api/seller/orders?from=${from}&to=${to}`);
    const data = await res.json();
    setRawOrders(data.orders ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Build customer map ─────────────────────────────────────────────────
  const customers = useMemo<Customer[]>(() => {
    const map = new Map<string, Customer>();

    for (const o of rawOrders) {
      const k = customerKey(o.customerEmail, o.customerAddress);
      if (!k) continue;

      const addr = o.customerAddress;
      let c = map.get(k);
      if (!c) {
        c = {
          key: k, name: o.customerName || "Unknown",
          email: o.customerEmail, phone: addr?.phone || null,
          city: addr?.city || null, state: addr?.state || null,
          totalOrders: 0, gmv: 0, deliveredValue: 0, delivered: 0, rto: 0, cancelled: 0,
          firstOrder: o.createdAt, lastOrder: o.createdAt,
          products: [], orders: [],
        };
        map.set(k, c);
      }
      c.totalOrders++;
      c.gmv += o.totalAmount;
      if (o.status === "DELIVERED")  { c.delivered++; c.deliveredValue += o.totalAmount; }
      if (!c.phone && addr?.phone) c.phone = addr.phone;
      if (!c.email && o.customerEmail) c.email = o.customerEmail;
      if (o.status === "RTO")        c.rto++;
      if (o.status === "CANCELLED")  c.cancelled++;
      if (o.createdAt < c.firstOrder) c.firstOrder = o.createdAt;
      if (o.createdAt > c.lastOrder)  c.lastOrder  = o.createdAt;
      c.orders.push(o);

      // merge products
      for (const item of o.items) {
        const p = c.products.find(x => x.name === item.name);
        if (p) p.qty += item.quantity;
        else c.products.push({ name: item.name, qty: item.quantity });
      }
    }

    return Array.from(map.values());
  }, [rawOrders]);

  // ── Summary stats ─────────────────────────────────────────────────────
  const totalCustomers  = customers.length;
  const repeatCustomers = customers.filter(c => c.totalOrders > 1).length;
  const totalGmv        = customers.reduce((s, c) => s + c.gmv, 0);
  const totalDelivered  = customers.reduce((s, c) => s + c.deliveredValue, 0);
  const riskyCustomers  = customers.filter(isRisky).length;
  const avgOrderValue   = rawOrders.length > 0 ? totalGmv / rawOrders.length : 0;

  // ── State chart ────────────────────────────────────────────────────────
  const stateChart = useMemo(() => {
    const sm = new Map<string, number>();
    for (const o of rawOrders) {
      const state = o.customerAddress?.state;
      if (!state) continue;
      sm.set(state, (sm.get(state) ?? 0) + 1);
    }
    return Array.from(sm.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([state, orders]) => ({
        state: state.length > 12 ? state.slice(0, 12) + "…" : state,
        Orders: orders,
      }));
  }, [rawOrders]);

  // ── Filtered + sorted customers ────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = customers;
    if (tab === "repeat") list = list.filter(c => c.totalOrders > 1);
    if (tab === "single") list = list.filter(c => c.totalOrders === 1);
    if (tab === "risky")  list = list.filter(isRisky);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.state?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sortBy === "value")  return b.deliveredValue - a.deliveredValue;
      if (sortBy === "risk")   return (b.rto + b.cancelled) - (a.rto + a.cancelled);
      if (sortBy === "orders") return b.totalOrders - a.totalOrders;
      return b.lastOrder.localeCompare(a.lastOrder);
    });
  }, [customers, search, sortBy, tab]);

  function exportCsv() {
    const rows = [
      ["Name", "Phone", "Email", "City", "State", "Orders", "Delivered", "RTO", "Cancelled", "Delivery rate %", "Delivered value", "Total ordered", "First order", "Last order", "Risky"],
      ...filtered.map(c => [
        c.name, c.phone ?? "", c.email ?? "", c.city ?? "", c.state ?? "", c.totalOrders, c.delivered, c.rto, c.cancelled,
        deliveryRate(c) ?? "", Math.round(c.deliveredValue), Math.round(c.gmv), fmtDate(c.firstOrder), fmtDate(c.lastOrder), isRisky(c) ? "Yes" : "",
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `customers-${tab}.csv`;
    a.click();
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="px-3 py-4 md:p-8 space-y-5" style={{ background: "#F7F8FC", minHeight: "100vh" }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-black text-[#0C1220]">Customers</h1>
          <p className="text-[12px] text-[#9CA3AF] mt-0.5">Unique buyers (one phone number = one customer) · last 12 months</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-white border border-[#E8EDF6] text-[#6B7280] hover:text-[#0C1220] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={exportCsv} disabled={loading || filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-bold text-white bg-[#4361EE] disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Customers",        value: num(totalCustomers),  sub: `Avg order ${inr(avgOrderValue)}`, icon: Users, color: "#4361EE" },
          { label: "Repeat customers", value: num(repeatCustomers), sub: totalCustomers ? `${Math.round((repeatCustomers / totalCustomers) * 100)}% ordered 2+ times` : "Ordered 2+ times", icon: TrendingUp, color: "#059669" },
          { label: "Delivered value",  value: inr(totalDelivered),  sub: `${inr(totalGmv)} ordered in total`, icon: ShoppingBag, color: "#7C3AED" },
          { label: "Risky customers",  value: num(riskyCustomers),  sub: "2+ returned or cancelled orders", icon: AlertTriangle, color: riskyCustomers ? "#DC2626" : "#9CA3AF" },
        ].map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl border border-[#E8EDF6] px-4 py-3.5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide">{card.label}</p>
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: card.color }} />
              </div>
              <p className="text-[22px] font-black leading-none" style={{ color: card.color }}>{card.value}</p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* State bar chart */}
      {stateChart.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F3F4F6]">
            <h2 className="text-[15px] font-bold text-[#0C1220]">Orders by State</h2>
            <p className="text-[12px] text-[#9CA3AF] mt-0.5">Top 10 states by order volume</p>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stateChart} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="state" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="Orders" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {stateChart.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === 0 ? "#4361EE" : i === 1 ? "#6B82F5" : "#C7D2FE"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* State summary chips */}
            <div className="flex flex-wrap gap-2 mt-3">
              {stateChart.slice(0, 5).map((s, i) => (
                <span key={s.state}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{
                    background: i === 0 ? "#EEF2FF" : "#F3F4F6",
                    color: i === 0 ? "#4361EE" : "#6B7280",
                  }}>
                  <MapPin className="w-2.5 h-2.5" />
                  {s.state} · {s.Orders}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Customer table */}
      <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">

        {/* Table header: tabs + search + sort */}
        <div className="flex items-center border-b border-[#F3F4F6] gap-0 overflow-x-auto">
          {[
            { label: "All",     value: "all",    count: totalCustomers },
            { label: "Repeat",  value: "repeat", count: repeatCustomers },
            { label: "One-time",value: "single", count: totalCustomers - repeatCustomers },
            { label: "Risky",   value: "risky",  count: riskyCustomers },
          ].map(t => (
            <button
              key={t.value}
              onClick={() => setTab(t.value as typeof tab)}
              className="px-4 py-3 text-[13px] font-semibold whitespace-nowrap flex-shrink-0 border-b-2 transition-colors"
              style={{
                borderColor: tab === t.value ? "#4361EE" : "transparent",
                color: tab === t.value ? "#4361EE" : "#9CA3AF",
                background: tab === t.value ? "#FAFBFF" : "transparent",
              }}
            >
              {t.label}
              <span
                className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  background: tab === t.value ? "#4361EE" : "#EEF2FF",
                  color: tab === t.value ? "white" : "#4361EE",
                }}
              >{t.count}</span>
            </button>
          ))}

          <div className="ml-auto pr-4 flex items-center gap-2 flex-shrink-0">
            {/* Sort */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="text-[12px] rounded-lg border border-[#E8EDF6] bg-[#FAFBFF] text-[#6B7280] px-2 py-1.5 outline-none focus:border-[#4361EE]"
            >
              <option value="value">Sort: Delivered value</option>
              <option value="orders">Sort: Orders</option>
              <option value="last">Sort: Recent</option>
              <option value="risk">Sort: Most returns</option>
            </select>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="Name, phone, email or state"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-[#E8EDF6] bg-[#FAFBFF] text-[#0C1220] placeholder-[#9CA3AF] outline-none focus:border-[#4361EE] w-44 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-12 flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-[#4361EE]" />
            <p className="text-[13px] text-[#9CA3AF]">Loading customers…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <Users className="w-10 h-10 text-[#E8EDF6]" />
            <p className="text-[13px] font-medium text-[#9CA3AF]">No customers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F3F4F6]" style={{ background: "#FAFBFF" }}>
                  {["CUSTOMER", "LOCATION", "ORDERS", "DELIVERED VALUE", "DELIVERY RATE", "TOP PRODUCT", "LAST ORDER", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const isOpen       = expanded === c.key;
                  const delivRate    = deliveryRate(c);
                  const risky        = isRisky(c);
                  const topProduct   = [...c.products].sort((a, b) => b.qty - a.qty)[0];
                  const isRepeat     = c.totalOrders > 1;

                  return (
                    <Fragment key={c.key}>
                      <tr
                        className="hover:bg-[#FAFBFF] cursor-pointer transition-colors"
                        style={{
                          borderBottom: isOpen ? "none" : "1px solid #F9FAFB",
                          background: isOpen ? "rgba(67,97,238,0.02)" : undefined,
                        }}
                        onClick={() => setExpanded(prev => prev === c.key ? null : c.key)}
                      >
                        {/* Customer name */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black text-white flex-shrink-0"
                              style={{ background: "#4361EE" }}>
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-[13px] font-semibold text-[#0C1220]">{c.name}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                {isRepeat && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669]">
                                    Repeat ×{c.totalOrders}
                                  </span>
                                )}
                                {risky && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#FEF2F2] text-[#DC2626]" title="2 or more orders returned or cancelled">
                                    Risky
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Location */}
                        <td className="px-4 py-3.5">
                          <p className="text-[12px] font-medium text-[#374151]">{c.state || "—"}</p>
                          {c.city && <p className="text-[11px] text-[#9CA3AF]">{c.city}</p>}
                        </td>

                        {/* Orders */}
                        <td className="px-4 py-3.5">
                          <p className="text-[13px] font-bold text-[#0C1220]">{c.totalOrders}</p>
                          <p className="text-[11px] text-[#9CA3AF]">since {fmtShort(c.firstOrder)}</p>
                        </td>

                        {/* GMV */}
                        <td className="px-4 py-3.5">
                          <p className="text-[13px] font-bold" style={{ color: c.deliveredValue > 0 ? "#047857" : "#9CA3AF" }}>{c.deliveredValue > 0 ? inr(c.deliveredValue) : "—"}</p>
                          <p className="text-[11px] text-[#9CA3AF]">{inr(c.gmv)} ordered</p>
                        </td>

                        {/* Delivery rate */}
                        <td className="px-4 py-3.5">
                          <p className="text-[13px] font-bold"
                            style={{ color: delivRate === null ? "#9CA3AF" : delivRate >= 70 ? "#059669" : delivRate >= 50 ? "#D97706" : "#EF4444" }}>
                            {delivRate === null ? "—" : `${delivRate}%`}
                          </p>
                          <p className="text-[11px] text-[#9CA3AF]">{c.delivered} delivered · {c.rto} RTO{c.cancelled ? ` · ${c.cancelled} cancelled` : ""}</p>
                        </td>

                        {/* Top product */}
                        <td className="px-4 py-3.5 max-w-[140px]">
                          {topProduct ? (
                            <>
                              <p className="text-[12px] font-medium text-[#374151] truncate">{topProduct.name}</p>
                              <p className="text-[11px] text-[#9CA3AF]">{topProduct.qty} units</p>
                            </>
                          ) : <span className="text-[12px] text-[#9CA3AF]">—</span>}
                        </td>

                        {/* Last order */}
                        <td className="px-4 py-3.5">
                          <p className="text-[12px] text-[#6B7280]">{fmtShort(c.lastOrder)}</p>
                        </td>

                        {/* Expand */}
                        <td className="px-4 py-3.5">
                          {isOpen
                            ? <ChevronUp className="w-4 h-4 text-[#9CA3AF]" />
                            : <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />}
                        </td>
                      </tr>

                      {/* ── Expanded: purchase history ── */}
                      {isOpen && (
                        <tr style={{ borderBottom: "1px solid #F3F4F6", background: "rgba(67,97,238,0.015)" }}>
                          <td colSpan={8} className="px-5 pb-5 pt-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                              {/* Contact info */}
                              <div className="space-y-3">
                                <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide">Contact</p>
                                {c.phone && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="w-3.5 h-3.5 text-[#9CA3AF]" />
                                    <p className="text-[13px] font-medium text-[#0C1220]">{c.phone}</p>
                                  </div>
                                )}
                                {c.email && (
                                  <div className="flex items-center gap-2">
                                    <Mail className="w-3.5 h-3.5 text-[#9CA3AF]" />
                                    <p className="text-[12px] text-[#6B7280]">{c.email}</p>
                                  </div>
                                )}
                                {c.state && (
                                  <div className="flex items-center gap-2">
                                    <MapPin className="w-3.5 h-3.5 text-[#9CA3AF]" />
                                    <p className="text-[12px] text-[#6B7280]">{[c.city, c.state].filter(Boolean).join(", ")}</p>
                                  </div>
                                )}

                                {/* Product breakdown */}
                                <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide pt-2">Products Purchased</p>
                                <div className="space-y-1.5">
                                  {[...c.products].sort((a, b) => b.qty - a.qty).slice(0, 5).map(p => (
                                    <div key={p.name} className="flex items-center justify-between">
                                      <p className="text-[12px] text-[#374151] truncate max-w-[180px]">{p.name}</p>
                                      <span className="text-[11px] font-bold text-[#6B7280] ml-2">{p.qty} units</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Order history table */}
                              <div className="md:col-span-2 space-y-3">
                                <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide">
                                  Purchase History ({c.orders.length} orders · {inr(c.deliveredValue)} delivered of {inr(c.gmv)})
                                </p>
                                <div className="overflow-x-auto rounded-xl border border-[#F3F4F6]">
                                  <table className="w-full">
                                    <thead>
                                      <tr className="border-b border-[#F3F4F6] bg-[#FAFBFF]">
                                        {["Order #", "Date", "Product(s)", "Amount", "Status"].map(h => (
                                          <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide">
                                            {h}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#F9FAFB]">
                                      {[...c.orders]
                                        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                                        .map(o => {
                                          const cfg = STATUS_CFG[o.status] ?? STATUS_CFG.NEW;
                                          return (
                                            <tr key={o.id} className="hover:bg-[#FAFBFF]">
                                              <td className="px-3 py-2 text-[12px] font-bold">
                                                <Link href={`/seller/orders/${o.id}`} className="text-[#4361EE] hover:underline">#{o.externalOrderId}</Link>
                                              </td>
                                              <td className="px-3 py-2 text-[11px] text-[#9CA3AF]">
                                                {fmtDate(o.createdAt)}
                                              </td>
                                              <td className="px-3 py-2 max-w-[180px]">
                                                <p className="text-[11px] text-[#6B7280] truncate">
                                                  {o.items.map(i => `${i.name} ×${i.quantity}`).join(", ")}
                                                </p>
                                              </td>
                                              <td className="px-3 py-2 text-[12px] font-bold text-[#0C1220]">
                                                {inr(o.totalAmount)}
                                              </td>
                                              <td className="px-3 py-2">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                                  style={{ background: cfg.bg, color: cfg.color }}>
                                                  {cfg.label}
                                                </span>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
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

        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-[#F3F4F6]">
            <p className="text-[12px] text-[#9CA3AF]">
              {filtered.length} customer{filtered.length !== 1 ? "s" : ""} · {inr(filtered.reduce((s, c) => s + c.deliveredValue, 0))} delivered · {inr(filtered.reduce((s, c) => s + c.gmv, 0))} ordered
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
