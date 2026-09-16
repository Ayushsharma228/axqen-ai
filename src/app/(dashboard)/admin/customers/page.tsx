"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, UserCheck, ShoppingCart, TrendingUp,
  RefreshCw, Loader2,
} from "lucide-react";

interface CustomerRow {
  customerName: string;
  phone: string | null;
  totalOrders: number;
  deliveredOrders: number;
  rtoOrders: number;
  cancelledOrders: number;
  totalSpend: number;
  lastOrderAt: string;
  firstOrderAt: string;
  isRepeat: boolean;
  deliveryRate: number;
}

interface Summary {
  totalCustomers: number;
  repeatCustomers: number;
  totalOrders: number;
  totalDelivered: number;
}

export default function AdminCustomersPage() {
  const [customers, setCustomers]       = useState<CustomerRow[]>([]);
  const [summary, setSummary]           = useState<Summary>({ totalCustomers: 0, repeatCustomers: 0, totalOrders: 0, totalDelivered: 0 });
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [repeatOnly, setRepeatOnly]     = useState(false);
  const [page, setPage]                 = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [total, setTotal]               = useState(0);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search)     params.set("search", search);
    if (repeatOnly) params.set("repeat", "true");
    params.set("page", String(page));
    const res  = await fetch(`/api/admin/customers?${params}`);
    const data = await res.json();
    setCustomers(data.customers ?? []);
    setSummary(data.summary ?? { totalCustomers: 0, repeatCustomers: 0, totalOrders: 0, totalDelivered: 0 });
    setTotal(data.total ?? 0);
    setTotalPages(data.pages ?? 1);
    setLoading(false);
  }, [search, repeatOnly, page]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const deliveryRate = summary.totalOrders > 0
    ? Math.round(summary.totalDelivered / summary.totalOrders * 100) : 0;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page)" }}>

      {/* Header */}
      <div className="px-8 pt-8 pb-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>Customers</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Repeat buyers and delivery analytics from order history</p>
          </div>
          <button onClick={fetchCustomers}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--bg-muted)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Customers",   value: summary.totalCustomers,  sub: "unique buyers",          color: "#4361EE", bg: "rgba(67,97,238,0.12)",  icon: Users },
            { label: "Repeat Customers",  value: summary.repeatCustomers, sub: "ordered 2+ times",       color: "#8B5CF6", bg: "rgba(139,92,246,0.12)", icon: UserCheck },
            { label: "Total Orders",      value: summary.totalOrders,     sub: "all time",               color: "#D97706", bg: "rgba(217,119,6,0.12)",  icon: ShoppingCart },
            { label: "Packets Delivered", value: summary.totalDelivered,  sub: `${deliveryRate}% delivery rate`, color: "#16A34A", bg: "rgba(22,163,74,0.12)", icon: TrendingUp },
          ].map(({ label, value, sub, color, bg, icon: Icon }) => (
            <div key={label} className="rounded-2xl p-5"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: bg }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
              </div>
              <p className="text-3xl font-black leading-none mb-1" style={{ color: "var(--text-primary)" }}>
                {value.toLocaleString()}
              </p>
              <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{label}</p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="px-8 pb-8">
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>

          {/* Toolbar */}
          <div className="px-5 py-3.5 flex items-center gap-3 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search name or phone..."
              className="px-3 py-1.5 text-sm rounded-lg outline-none"
              style={{ background: "var(--bg-muted)", border: "1px solid var(--border)", color: "var(--text-primary)", width: "240px" }}
            />
            <button
              onClick={() => { setRepeatOnly(p => !p); setPage(1); }}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
              style={repeatOnly
                ? { background: "rgba(139,92,246,0.12)", color: "#8B5CF6", border: "1px solid rgba(139,92,246,0.3)" }
                : { background: "var(--bg-muted)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              Repeat only
            </button>
            <span className="ml-auto text-xs" style={{ color: "var(--text-400)" }}>
              {total.toLocaleString()} customers
            </span>
          </div>

          {loading ? (
            <div className="py-20 flex items-center justify-center gap-2 text-sm" style={{ color: "var(--text-400)" }}>
              <Loader2 className="w-4 h-4 animate-spin" /> Loading customers...
            </div>
          ) : customers.length === 0 ? (
            <div className="py-20 text-center text-sm" style={{ color: "var(--text-400)" }}>No customers found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-muted)" }}>
                    {["Customer", "Phone", "Total Orders", "Delivered", "RTO", "Delivery Rate", "Total Spend", "Last Order"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                        style={{ color: "var(--text-400)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {customers.map((c, i) => (
                    <tr key={i} className="hover:bg-gray-50/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: "var(--text-900)" }}>{c.customerName}</span>
                          {c.isRepeat && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: "rgba(139,92,246,0.12)", color: "#8B5CF6" }}>
                              REPEAT
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-500)" }}>
                        {c.phone || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold" style={{ color: "var(--text-900)" }}>
                        {c.totalOrders}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: "#16A34A" }}>
                        {c.deliveredOrders}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: c.rtoOrders > 0 ? "#F97316" : "var(--text-400)" }}>
                        {c.rtoOrders > 0 ? c.rtoOrders : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full overflow-hidden" style={{ background: "var(--bg-muted)" }}>
                            <div className="h-full rounded-full"
                              style={{ width: `${c.deliveryRate}%`, background: c.deliveryRate >= 70 ? "#16A34A" : c.deliveryRate >= 40 ? "#D97706" : "#EF4444" }} />
                          </div>
                          <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{c.deliveryRate}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: "var(--text-900)" }}>
                        ₹{c.totalSpend.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-400)" }}>
                        {new Date(c.lastOrderAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)" }}>
              <span className="text-xs" style={{ color: "var(--text-400)" }}>Page {page} of {totalPages}</span>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                  style={{ color: "var(--text-600)", border: "1px solid var(--border)" }}>
                  ← Prev
                </button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                  style={{ color: "var(--text-600)", border: "1px solid var(--border)" }}>
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
