"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, RefreshCw } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

function toISODate(d: Date) { return d.toISOString().split("T")[0]; }

const PRESETS = [
  { label: "7D",  days: 7 },
  { label: "14D", days: 14 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-600 mb-1.5">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <p key={i} className="font-medium" style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

export function AdminOrderTrendChart() {
  const today = toISODate(new Date());
  const d30   = toISODate(new Date(Date.now() - 29 * 86400000));

  const [from, setFrom]   = useState(d30);
  const [to, setTo]       = useState(today);
  const [preset, setPreset] = useState(30);
  const [trend, setTrend] = useState<{ date: string; total: number; delivered: number; rto: number; cancelled: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (fromDate: string, toDate: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate)   params.set("to",   toDate);
    const res  = await fetch(`/api/admin/analytics?${params}`);
    const data = await res.json();
    setTrend(data.orders?.trend ?? []);
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(d30, today); }, []);

  function applyPreset(days: number) {
    const newFrom = toISODate(new Date(Date.now() - (days - 1) * 86400000));
    const newTo   = today;
    setPreset(days);
    setFrom(newFrom);
    setTo(newTo);
    fetchData(newFrom, newTo);   // fetch immediately
  }

  const chartData = trend.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    Orders:    d.total,
    Delivered: d.delivered,
    RTO:       d.rto,
    Cancelled: d.cancelled,
  }));

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-900)" }}>Order Trend</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-400)" }}>
            {from && to ? `${from} → ${to}` : "All time"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Preset buttons */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {PRESETS.map((p) => (
              <button key={p.label} onClick={() => applyPreset(p.days)}
                className="px-2.5 py-1 text-xs font-semibold rounded-md transition-all"
                style={preset === p.days
                  ? { background: "white", color: "var(--text-900)", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }
                  : { color: "var(--text-400)" }}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom date range — change dates then click refresh to apply */}
          <div className="flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
            <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input type="date" value={from} max={to || today}
              onChange={(e) => { setFrom(e.target.value); setPreset(-1); }}
              className="text-xs outline-none text-gray-700" style={{ width: "7.5rem" }} />
            <span className="text-gray-300">→</span>
            <input type="date" value={to} min={from} max={today}
              onChange={(e) => { setTo(e.target.value); setPreset(-1); }}
              className="text-xs outline-none text-gray-700" style={{ width: "7.5rem" }} />
          </div>

          <button onClick={() => fetchData(from, to)} disabled={loading}
            title="Apply / Refresh"
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4">
        {[
          { label: "Orders",    color: "#3B82F6" },
          { label: "Delivered", color: "#00C67A" },
          { label: "RTO",       color: "#F59E0B" },
          { label: "Cancelled", color: "#EF4444" },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-400)" }}>
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-52 flex items-center justify-center text-sm" style={{ color: "var(--text-400)" }}>
          Loading...
        </div>
      ) : chartData.length === 0 ? (
        <div className="h-52 flex items-center justify-center text-sm" style={{ color: "var(--text-400)" }}>
          No order data in this range
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
            <Bar dataKey="Orders"    fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={16} />
            <Bar dataKey="Delivered" fill="#00C67A" radius={[4, 4, 0, 0]} maxBarSize={16} />
            <Bar dataKey="RTO"       fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={16} />
            <Bar dataKey="Cancelled" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={16} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
