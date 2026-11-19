"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Search, Phone, MessageCircle, CheckCircle2, Circle, AlertTriangle } from "lucide-react";

type Step = "agreement" | "business" | "bank" | "kyc" | "shopify" | "listingRequested" | "listingLive" | "firstOrder" | "firstDelivery";
interface Row {
  id: string; name: string | null; email: string; phone: string | null; brand: string | null;
  status: string; plan: string | null; kyc: string; joined: string;
  done: Record<Step, boolean>; stepsDone: number; next: Step | null; activated: boolean; stuck: boolean; idleDays: number; lastOrder: string | null;
}
interface Data { sellers: Row[]; funnel: { step: Step; count: number }[]; summary: { total: number; activated: number; inProgress: number; stuck: number } }

const STEPS: { key: Step; short: string; next: string }[] = [
  { key: "agreement", short: "Agreement", next: "Accept the agreement" },
  { key: "business", short: "Business", next: "Fill business name and address" },
  { key: "bank", short: "Bank", next: "Add bank details" },
  { key: "kyc", short: "KYC", next: "Get KYC approved" },
  { key: "shopify", short: "Shopify", next: "Connect Shopify store" },
  { key: "listingRequested", short: "Listing req.", next: "Request product listings" },
  { key: "listingLive", short: "Listed", next: "Get first listing live" },
  { key: "firstOrder", short: "1st order", next: "Get the first order" },
  { key: "firstDelivery", short: "1st delivery", next: "First order delivered" },
];
type View = "stuck" | "progress" | "activated" | "all";
const fmt = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });

export default function SellerActivationPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [view, setView] = useState<View>("stuck");
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/admin/activation/board").then(r => r.json()).then(d => (d.sellers ? setData(d) : setError(true))).catch(() => setError(true));
  }, []);

  const list = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    return data.sellers
      .filter(r => view === "all" || (view === "stuck" ? r.stuck : view === "activated" ? r.activated : !r.activated && r.status !== "SUSPENDED"))
      .filter(r => !s || [r.name, r.email, r.phone, r.brand].some(v => v?.toLowerCase().includes(s)))
      .sort((a, b) => (view === "stuck" ? b.idleDays - a.idleDays : b.joined.localeCompare(a.joined)));
  }, [data, view, q]);

  const views: { key: View; label: string; n: number }[] = data ? [
    { key: "stuck", label: "Stuck 7+ days", n: data.summary.stuck },
    { key: "progress", label: "In progress", n: data.summary.inProgress },
    { key: "activated", label: "Activated", n: data.summary.activated },
    { key: "all", label: "All", n: data.summary.total },
  ] : [];

  return (
    <div className="px-4 py-5 md:p-8 space-y-5" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div>
        <h1 className="text-[22px] font-black text-[#0C1220]">Seller Activation</h1>
        <p className="text-[12.5px] text-[#6B7280] mt-1">Where each seller is between signup and their first delivered order. Steps are read live from their account, store, listings and orders.</p>
      </div>

      {error ? <p className="py-24 text-center text-[13px] text-[#B91C1C]">Couldn&apos;t load activation. Refresh to try again.</p>
        : !data ? <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-[#9CA3AF]"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
        : (
        <>
          {/* Funnel */}
          <section className="bg-white rounded-xl border border-[#E8EDF6] p-5">
            <h2 className="text-[15px] font-bold text-[#0C1220] mb-4">Funnel</h2>
            <div className="space-y-2">
              {data.funnel.map((f, i) => {
                const pct = data.summary.total ? Math.round((f.count / data.summary.total) * 100) : 0;
                return (
                  <div key={f.step} className="flex items-center gap-3 text-[12.5px]">
                    <span className="w-[110px] text-[#374151] font-medium">{STEPS[i].short}</span>
                    <div className="flex-1 h-5 rounded-md bg-[#F3F6FF] overflow-hidden">
                      <div className="h-full rounded-md" style={{ width: `${Math.max(pct, f.count ? 2 : 0)}%`, background: i === data.funnel.length - 1 ? "#059669" : "#4361EE" }} />
                    </div>
                    <span className="w-[80px] text-right tabular-nums text-[#374151]"><b>{f.count}</b> <span className="text-[#9CA3AF]">· {pct}%</span></span>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-white rounded-xl border border-[#E8EDF6] p-1.5 overflow-x-auto">
              {views.map(v => (
                <button key={v.key} onClick={() => setView(v.key)}
                  className={`px-3 py-1.5 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5 whitespace-nowrap ${view === v.key ? "bg-[#E8EDFF] text-[#4361EE]" : "text-[#6B7280] hover:bg-[#F3F6FF]"}`}>
                  {v.label}
                  <span className={`text-[10.5px] px-1.5 rounded-full tabular-nums ${v.key === "stuck" && v.n ? "bg-[#FEE2E2] text-[#B91C1C]" : "bg-[#F3F4F6] text-[#6B7280]"}`}>{v.n}</span>
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[200px] md:max-w-[280px] ml-auto">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
              <input id="act-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search sellers"
                className="pl-8 pr-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] w-full" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
            {list.length === 0 ? (
              <p className="py-16 text-center text-[13px] text-[#9CA3AF]">{view === "stuck" ? "No one is stuck. Nice." : "No sellers here."}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-[12.5px]">
                  <thead>
                    <tr className="bg-[#FAFBFF] text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                      <th className="px-4 py-2.5">Seller</th>
                      {STEPS.map(s => <th key={s.key} className="px-1.5 py-2.5 text-center whitespace-nowrap">{s.short}</th>)}
                      <th className="px-3 py-2.5">Next step</th>
                      <th className="px-3 py-2.5 text-right">Contact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {list.map(r => {
                      const phone = r.phone?.replace(/\D/g, "").slice(-10);
                      const next = STEPS.find(s => s.key === r.next);
                      return (
                        <tr key={r.id} className="hover:bg-[#FAFBFF]">
                          <td className="px-4 py-2.5">
                            <Link href={`/admin/sellers/${r.id}`} className="block group">
                              <span className="block font-semibold text-[#0C1220] group-hover:text-[#4361EE] truncate max-w-[220px]">{r.name ?? r.email}</span>
                              <span className="block text-[11px] text-[#9CA3AF] truncate max-w-[220px]">{[r.brand, `joined ${fmt(r.joined)}`].filter(Boolean).join(" · ")}</span>
                            </Link>
                          </td>
                          {STEPS.map(s => (
                            <td key={s.key} className="px-1.5 py-2.5 text-center">
                              {r.done[s.key]
                                ? <CheckCircle2 className="w-4 h-4 text-[#059669] inline" aria-label={`${s.short} done`} />
                                : r.next === s.key
                                  ? <Circle className="w-4 h-4 text-[#4361EE] inline fill-[#E8EDFF]" aria-label={`${s.short}: next`} />
                                  : <Circle className="w-4 h-4 text-[#D1D5DB] inline" aria-label={`${s.short} not done`} />}
                            </td>
                          ))}
                          <td className="px-3 py-2.5">
                            {r.activated ? <span className="text-[12px] font-semibold text-[#047857]">Activated</span> : (
                              <>
                                <span className="block text-[12.5px] text-[#0C1220]">{next?.next}</span>
                                {r.stuck
                                  ? <span className="text-[11px] font-semibold text-[#B91C1C] inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> No progress for {r.idleDays} days</span>
                                  : <span className="text-[11px] text-[#9CA3AF]">{r.stepsDone} of {STEPS.length} done</span>}
                              </>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              {phone ? <>
                                <a href={`tel:${phone}`} aria-label={`Call ${r.name ?? ""}`} className="p-2 rounded-lg text-[#6B7280] hover:bg-[#F3F6FF] hover:text-[#4361EE]"><Phone className="w-4 h-4" /></a>
                                <a href={`https://wa.me/91${phone}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${r.name ?? ""}`} className="p-2 rounded-lg text-[#6B7280] hover:bg-[#F3F6FF] hover:text-[#059669]"><MessageCircle className="w-4 h-4" /></a>
                              </> : <span className="text-[11px] text-[#C4C9D4]">No phone</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
