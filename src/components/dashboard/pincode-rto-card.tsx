"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import type { PincodeRow, AreaLevel } from "@/lib/pincode-rto";

interface Data {
  minOrders: number; completed: number; overallPct: number | null;
  pincodes: number; eligiblePincodes: number; noPincode: number;
  worst: PincodeRow[]; best: PincodeRow[];
}

const RANGES: { label: string; days: number | null }[] = [
  { label: "30 days", days: 30 }, { label: "90 days", days: 90 }, { label: "All time", days: null },
];
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function pctTone(p: number) {
  if (p >= 50) return { bg: "#FEE2E2", fg: "#B91C1C" };
  if (p >= 30) return { bg: "#FEF3C7", fg: "#B45309" };
  return { bg: "#DCFCE7", fg: "#047857" };
}

export function PincodeRtoCard({ endpoint = "/api/seller/pincode-rto" }: { endpoint?: string } = {}) {
  const [days, setDays] = useState<number | null>(90);
  const [tab, setTab] = useState<"worst" | "best">("worst");
  const [level, setLevel] = useState<AreaLevel>("pincode");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${endpoint}?level=${level}${days ? `&days=${days}` : ""}`)
      .then(r => r.json()).then(d => setData(d.worst ? d : null)).catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days, level, endpoint]);

  const rows = data ? (tab === "worst" ? data.worst : data.best) : [];
  const anyMissing = tab === "worst" && rows.some(r => r.costsMissing > 0);
  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-lg text-[12px] font-semibold transition-colors ${active ? "bg-[#E8EDFF] text-[#4361EE]" : "text-[#6B7280] hover:bg-[#F3F6FF]"}`;

  return (
    <section className="bg-white rounded-xl border border-[#E8EDF6] p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-[15px] font-bold text-[#0C1220] flex items-center gap-2"><MapPin className="w-4 h-4 text-[#4361EE]" /> RTO by area</h2>
          <p className="text-[12px] text-[#9CA3AF] mt-0.5">
            From your delivered and returned orders
            {data?.overallPct != null && <> · your overall RTO is <b className="text-[#374151]">{data.overallPct}%</b></>}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {RANGES.map(r => <button key={r.label} onClick={() => setDays(r.days)} className={chip(days === r.days)}>{r.label}</button>)}
        </div>
      </div>

      <div className="flex items-center gap-1 mb-3">
        <button onClick={() => setTab("worst")} className={chip(tab === "worst")}>Highest RTO</button>
        <button onClick={() => setTab("best")} className={chip(tab === "best")}>Best delivery</button>
        <span className="w-px h-4 bg-[#E6EBF7] mx-2" />
        {(["pincode", "city", "state"] as const).map(l => (
          <button key={l} onClick={() => setLevel(l)} className={chip(level === l)}>{l[0].toUpperCase() + l.slice(1)}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-[#9CA3AF]"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : !data ? (
        <p className="py-10 text-center text-[13px] text-[#9CA3AF]">Couldn&apos;t load pincode stats right now.</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-[#9CA3AF] max-w-[52ch] mx-auto">
          {tab === "worst" && data.eligiblePincodes > 0
            ? "No returns from any pincode in this period. Nice."
            : `Not enough data yet. A ${level} shows up here once it has ${data.minOrders} delivered or returned orders.${level === "pincode" ? " Try City or State." : level === "city" ? " Try State." : ""}`}
        </p>
      ) : (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full min-w-[560px] text-[12.5px]">
            <thead>
              <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF] border-b border-[#F3F4F6]">
                {level === "pincode" && <th className="py-2 pr-3">Pincode</th>}
                <th className="py-2 pr-3">{level === "pincode" ? "Area" : level === "city" ? "City" : "State"}</th>
                <th className="py-2 pr-3 text-right">Orders</th>
                <th className="py-2 pr-3 text-right">Delivered</th>
                <th className="py-2 pr-3 text-right">RTO</th>
                <th className="py-2 pr-3 text-right">RTO %</th>
                {tab === "worst" && <th className="py-2 text-right">RTO loss</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {rows.map(r => {
                const t = pctTone(r.pct);
                return (
                  <tr key={`${r.pincode}|${r.city}|${r.state}`}>
                    {level === "pincode" && <td className="py-2.5 pr-3 font-mono font-semibold text-[#0C1220]">{r.pincode}</td>}
                    <td className={`py-2.5 pr-3 truncate max-w-[200px] ${level === "pincode" ? "text-[#4B5563]" : "font-semibold text-[#0C1220]"}`}>{[r.city, r.state].filter(Boolean).join(", ") || "—"}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-[#374151]">{r.orders}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-[#047857]">{r.delivered}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-[#DC2626]">{r.rto}</td>
                    <td className="py-2.5 pr-3 text-right">
                      <span className="inline-block min-w-[44px] text-center px-1.5 py-0.5 rounded-md text-[11.5px] font-bold tabular-nums" style={{ background: t.bg, color: t.fg }}>{r.pct}%</span>
                    </td>
                    {tab === "worst" && (
                      <td className="py-2.5 text-right tabular-nums text-[#374151]">{r.loss > 0 ? inr(r.loss) : "—"}{r.costsMissing > 0 && <span className="text-[#B45309]">*</span>}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && rows.length > 0 && (
        <p className="text-[11px] text-[#9CA3AF] mt-3">
          Only {level === "city" ? "cities" : level === "state" ? "states" : "pincodes"} with {data.minOrders}+ delivered or returned orders are ranked.
          {tab === "worst" && " RTO loss = product cost + return charge + packing, same as Profit & Analytics."}
          {anyMissing && " * Some returned orders have no product cost recorded, so the real loss is higher."}
        </p>
      )}
    </section>
  );
}
