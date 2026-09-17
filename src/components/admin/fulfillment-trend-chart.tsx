"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

function toISODate(d: Date) { return d.toISOString().split("T")[0]; }

const PRESETS = [
  { label: "7D",  days: 7  },
  { label: "14D", days: 14 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

const SERIES = [
  { key: "shipped",   label: "Shipped",    color: "#4361EE" },
  { key: "delivered", label: "Delivered",  color: "#059669" },
  { key: "rto",       label: "RTO",        color: "#EF4444" },
  { key: "ndr",       label: "NDR",        color: "#D97706" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E8EDF6] rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-[#374151] mb-1.5">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        p.value > 0 && (
          <p key={i} className="font-medium" style={{ color: p.color }}>{p.name}: {p.value}</p>
        )
      ))}
    </div>
  );
}

export function FulfillmentTrendChart({ sellerId }: { sellerId?: string }) {
  const today = toISODate(new Date());
  const d30   = toISODate(new Date(Date.now() - 29 * 86400000));

  const [from,   setFrom]   = useState(d30);
  const [to,     setTo]     = useState(today);
  const [preset, setPreset] = useState(30);
  const [trend,  setTrend]  = useState<{ date: string; shipped: number; inTransit: number; delivered: number; rto: number; ndr: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (fromDate: string, toDate: string, sid?: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate)   params.set("to",   toDate);
    if (sid)      params.set("sellerId", sid);
    const data = await fetch(`/api/admin/analytics/fulfillment-trend?${params}`).then(r => r.json());
    setTrend(data.trend ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(d30, today, sellerId); }, [sellerId]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyPreset(days: number) {
    const newFrom = toISODate(new Date(Date.now() - (days - 1) * 86400000));
    setPreset(days); setFrom(newFrom); setTo(today);
    fetchData(newFrom, today, sellerId);
  }

  const chartData = trend.map(d => ({
    date:      new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    Shipped:   d.shipped,
    Delivered: d.delivered,
    RTO:       d.rto,
    NDR:       d.ndr,
  }));

  return (
    <div className="bg-white rounded-xl border border-[#E8EDF6] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <p className="text-[13px] font-bold text-[#0C1220]">Shipment Trend</p>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">{from} → {to}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#F3F4F6]">
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p.days)}
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
                style={preset === p.days
                  ? { background: "white", color: "#0C1220", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
                  : { color: "#9CA3AF" }}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 text-[12px] border border-[#E8EDF6] rounded-lg px-3 py-1.5 bg-white">
            <input type="date" value={from} max={to || today}
              onChange={e => { setFrom(e.target.value); setPreset(-1); }}
              className="text-[11px] outline-none text-[#374151]" style={{ width: "7.5rem" }} />
            <span className="text-[#D1D5DB] mx-1">→</span>
            <input type="date" value={to} min={from} max={today}
              onChange={e => { setTo(e.target.value); setPreset(-1); }}
              className="text-[11px] outline-none text-[#374151]" style={{ width: "7.5rem" }} />
          </div>
          <button onClick={() => fetchData(from, to, sellerId)} disabled={loading}
            className="p-1.5 rounded-lg border border-[#E8EDF6] hover:bg-[#FAFBFF] disabled:opacity-50 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 text-[#9CA3AF] ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3">
        {SERIES.map(s => (
          <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-52 flex items-center justify-center">
          <RefreshCw className="w-5 h-5 animate-spin text-[#9CA3AF]" />
        </div>
      ) : chartData.length === 0 ? (
        <div className="h-52 flex items-center justify-center text-[12px] text-[#9CA3AF]">
          No shipment data in this range
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
            <Bar dataKey="Shipped"   fill="#4361EE" radius={[4, 4, 0, 0]} maxBarSize={14} />
            <Bar dataKey="Delivered" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={14} />
            <Bar dataKey="RTO"       fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={14} />
            <Bar dataKey="NDR"       fill="#D97706" radius={[4, 4, 0, 0]} maxBarSize={14} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
