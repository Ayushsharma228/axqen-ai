"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Loader2, RefreshCw, AlertOctagon, AlertTriangle, CheckCircle2, Info, ArrowRight, Send, Sparkles,
  PhoneCall, PackageCheck, Truck, MapPin, RotateCcw, Landmark, ClipboardCheck, XCircle,
} from "lucide-react";

type Severity = "critical" | "warning" | "good" | "info";
interface Action { id: string; severity: Severity; title: string; detail: string; href: string; cta: string }
interface Snapshot { periodDays: number; netProfit: number; revenue: number; delivered: number; rto: number; rtoPct: number | null; margin: number | null; costsMissing: number }
interface Activity {
  days: number; confirmationCalls: number; ordersConfirmed: number; ordersCancelledOnCall: number; ordersShipped: number;
  courierScansTracked: number; ndrActions: number; returnsChecked: number; payoutsSent: number; payoutsAmount: number;
}
interface Insights { actions: Action[]; snapshot: Snapshot; activity: Activity; ask: { used: number; limit: number; remaining: number } }
interface Msg { role: "user" | "assistant"; content: string; error?: boolean }

const SEV: Record<Severity, { icon: React.ElementType; color: string; bg: string; border: string; label: string }> = {
  critical: { icon: AlertOctagon,  color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", label: "Fix now" },
  warning:  { icon: AlertTriangle, color: "#B45309", bg: "#FFFBEB", border: "#FDE68A", label: "Watch" },
  info:     { icon: Info,          color: "#4361EE", bg: "#EEF2FF", border: "#C7D2FE", label: "Good to know" },
  good:     { icon: CheckCircle2,  color: "#047857", bg: "#ECFDF5", border: "#BBF7D0", label: "Working well" },
};

const SUGGESTIONS = [
  "Which product should I stop advertising?",
  "Why is my profit low this month?",
  "Which state returns the most orders?",
  "Is my ad spend paying off?",
];

const inr = (n: number) => (n < 0 ? "−₹" : "₹") + Math.abs(Math.round(n)).toLocaleString("en-IN");

export default function IntelligencePage() {
  const [tab, setTab] = useState<"actions" | "ask" | "activity">("actions");
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/seller/intelligence/insights").then(r => r.json())
      .then(d => { if (d.actions) { setData(d); setRemaining(d.ask?.remaining ?? null); } })
      .catch(() => {}).finally(() => setLoading(false));
  }, [key]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, asking]);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || asking || remaining === 0) return;
    const history = messages.filter(m => !m.error).slice(-6).map(({ role, content }) => ({ role, content }));
    setMessages(m => [...m, { role: "user", content: question }]);
    setInput("");
    setAsking(true);
    try {
      const res = await fetch("/api/seller/intelligence/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      const d = await res.json().catch(() => ({}));
      if (typeof d.remaining === "number") setRemaining(d.remaining);
      setMessages(m => [...m, res.ok ? { role: "assistant", content: d.answer } : { role: "assistant", content: (d.error ?? "Couldn't answer right now.") + (d.detail ? `

Details: ${d.detail}` : ""), error: true }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Network problem. Please try again.", error: true }]);
    } finally {
      setAsking(false);
    }
  }

  const s = data?.snapshot;
  const a = data?.activity;

  return (
    <div className="px-3 py-4 md:p-8 space-y-5" style={{ background: "#F7F8FC", minHeight: "100vh" }}>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Insights</p>
          <h1 className="text-[22px] font-black text-[#0C1220] mt-0.5">AI Intelligence</h1>
          <p className="text-[12.5px] text-[#6B7280] mt-1 max-w-[70ch]">What to do next, worked out from your own orders, returns, ads and profit. Every number links to the page it comes from.</p>
        </div>
        <button onClick={() => setKey(k => k + 1)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-white border border-[#E8EDF6] text-[#6B7280] hover:text-[#0C1220]">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit bg-[#E8EBFF]">
        {([["actions", "This week's actions"], ["ask", "Ask AXQEN"], ["activity", "What AXQEN did for you"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="px-4 py-2 rounded-lg text-[13px] font-semibold"
            style={{ background: tab === k ? "white" : "transparent", color: tab === k ? "#4361EE" : "#6B7280", boxShadow: tab === k ? "0 1px 4px rgba(67,97,238,0.15)" : "none" }}>
            {l}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-[#9CA3AF]"><Loader2 className="w-5 h-5 animate-spin text-[#4361EE]" /> Reading your numbers…</div>
      ) : !data ? (
        <p className="py-24 text-center text-[13px] text-[#9CA3AF]">Couldn&apos;t load insights. Try Refresh.</p>
      ) : tab === "actions" ? (
        <>
          {s && (
            <p className="text-[12.5px] text-[#6B7280]">
              Last {s.periodDays} days: <b className="text-[#0C1220]">{s.costsMissing ? "≈ " : ""}{inr(s.netProfit)}</b> net profit on {inr(s.revenue)} delivered revenue
              {s.margin != null && <> ({s.margin}% margin)</>}, {s.delivered} delivered and {s.rto} returned{s.rtoPct != null && <> ({s.rtoPct}% RTO)</>}.
            </p>
          )}
          {data.actions.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E8EDF6] py-16 text-center px-4">
              <Sparkles className="w-9 h-9 mx-auto text-[#C7D2FE]" />
              <p className="text-[13.5px] font-semibold text-[#374151] mt-2">Nothing needs your attention right now</p>
              <p className="text-[12px] text-[#9CA3AF] mt-1">Suggestions appear here once there are enough delivered and returned orders to judge.</p>
            </div>
          ) : (
            <ol className="space-y-3">
              {data.actions.map(act => {
                const cfg = SEV[act.severity];
                const Icon = cfg.icon;
                return (
                  <li key={act.id} className="bg-white rounded-xl border flex items-start gap-4 px-4 py-4 flex-wrap" style={{ borderColor: cfg.border }}>
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: cfg.bg }}>
                      <Icon className="w-4.5 h-4.5" style={{ color: cfg.color }} />
                    </span>
                    <div className="flex-1 min-w-[220px]">
                      <p className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: cfg.color }}>{cfg.label}</p>
                      <p className="text-[14.5px] font-bold text-[#0C1220] mt-0.5 leading-snug">{act.title}</p>
                      <p className="text-[12.5px] text-[#6B7280] mt-1">{act.detail}</p>
                    </div>
                    <Link href={act.href} className="flex items-center gap-1 px-3 py-2 rounded-lg text-[12.5px] font-semibold bg-[#F5F7FB] text-[#374151] hover:bg-[#EEF2FF] hover:text-[#4361EE] whitespace-nowrap self-center">
                      {act.cta} <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="text-[11.5px] text-[#9CA3AF]">Built from the same numbers as Profit &amp; Analytics, Ad Spend, RTO and Customers. Want to dig into one? Ask AXQEN.</p>
        </>
      ) : tab === "ask" ? (
        <div className="bg-white rounded-xl border border-[#E8EDF6] flex flex-col" style={{ minHeight: 480 }}>
          <div className="px-5 py-3.5 border-b border-[#F3F4F6] flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[14px] font-bold text-[#0C1220]">Ask AXQEN about your business</p>
              <p className="text-[11.5px] text-[#9CA3AF]">Answers come only from your last {s?.periodDays ?? 90} days of data. Hindi, Hinglish or English.</p>
            </div>
            {remaining !== null && (
              <span className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full" style={{ background: remaining > 0 ? "#EEF2FF" : "#FEF2F2", color: remaining > 0 ? "#4361EE" : "#DC2626" }}>
                {remaining} of {data.ask.limit} questions left today
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ maxHeight: 520 }}>
            {messages.length === 0 && (
              <div className="py-6">
                <p className="text-[12.5px] text-[#6B7280] mb-3">Try one of these:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map(q => (
                    <button key={q} onClick={() => ask(q)} disabled={asking || remaining === 0}
                      className="px-3 py-2 rounded-lg text-[12.5px] font-medium bg-[#F5F7FB] text-[#374151] hover:bg-[#EEF2FF] hover:text-[#4361EE] disabled:opacity-50">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap"
                  style={m.role === "user"
                    ? { background: "#4361EE", color: "white" }
                    : m.error ? { background: "#FEF2F2", color: "#B91C1C" } : { background: "#F5F7FB", color: "#0C1220" }}>
                  {m.content}
                </div>
              </div>
            ))}
            {asking && (
              <div className="flex justify-start">
                <div className="rounded-xl px-3.5 py-2.5 text-[13px] bg-[#F5F7FB] text-[#9CA3AF] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Looking at your numbers…</div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={e => { e.preventDefault(); ask(input); }} className="border-t border-[#F3F4F6] p-3 flex items-center gap-2">
            <input id="ask-input" value={input} onChange={e => setInput(e.target.value)} maxLength={500}
              disabled={remaining === 0}
              placeholder={remaining === 0 ? "You've used today's questions. Ask again tomorrow." : "Ask about orders, profit, products, returns or ads"}
              className="flex-1 px-3.5 py-2.5 text-[13.5px] rounded-lg border border-[#E8EDF6] outline-none focus:border-[#4361EE] disabled:bg-[#F9FAFB]" />
            <button type="submit" disabled={!input.trim() || asking || remaining === 0} aria-label="Send"
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white bg-[#4361EE] disabled:opacity-40">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      ) : a && (
        <>
          <p className="text-[12.5px] text-[#6B7280]">Work done on your orders in the last {a.days} days, counted from AXQEN&apos;s records.</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: PhoneCall,      color: "#4361EE", value: a.confirmationCalls,    label: "Confirmation calls made" },
              { icon: ClipboardCheck, color: "#047857", value: a.ordersConfirmed,      label: "Orders confirmed on call" },
              { icon: XCircle,        color: "#6B7280", value: a.ordersCancelledOnCall, label: "Fake or unwanted orders stopped" },
              { icon: Truck,          color: "#7C3AED", value: a.ordersShipped,        label: "Orders shipped" },
              { icon: MapPin,         color: "#0369A1", value: a.courierScansTracked,  label: "Courier updates tracked" },
              { icon: AlertTriangle,  color: "#B45309", value: a.ndrActions,           label: "Failed deliveries handled" },
              { icon: RotateCcw,      color: "#DC2626", value: a.returnsChecked,       label: "Returns received and checked" },
              { icon: Landmark,       color: "#047857", value: a.payoutsSent,          label: a.payoutsSent ? `Payouts sent · ${inr(a.payoutsAmount)}` : "Payouts sent" },
            ].map(t => (
              <div key={t.label} className="bg-white rounded-xl border border-[#E8EDF6] px-4 py-4">
                <t.icon className="w-5 h-5" style={{ color: t.color }} />
                <p className="text-[26px] font-black leading-none tabular-nums text-[#0C1220] mt-3">{t.value.toLocaleString("en-IN")}</p>
                <p className="text-[12px] text-[#6B7280] mt-1.5">{t.label}</p>
              </div>
            ))}
          </div>
          <p className="text-[11.5px] text-[#9CA3AF] flex items-center gap-1.5"><PackageCheck className="w-3.5 h-3.5" /> Every number is a real count. Calls and returns appear as your team records them in AXQEN.</p>
        </>
      )}
    </div>
  );
}
