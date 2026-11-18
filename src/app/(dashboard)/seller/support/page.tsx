"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  MessageCircle, Mail, Plus, X, Loader2, ChevronDown, ChevronRight, Search, AlertCircle, LifeBuoy,
  ShoppingCart, CreditCard, Package, User, Wrench, MessageSquare, Clock,
} from "lucide-react";
import { WA_LINK } from "@/components/landing/constants";

// Fill these in to show them on the page; left empty they stay hidden (never guessed).
const SUPPORT_HOURS = "";      // e.g. "Mon–Sat, 10 AM – 7 PM"
const REPLY_TIME = "";         // e.g. "within 4 working hours"
const SUPPORT_EMAIL = "connect@vrinandyaventures.in";

interface Ticket {
  id: string; ticketNumber: number; subject: string; category: string; priority: string; status: string;
  relatedOrderId: string | null; createdAt: string; updatedAt: string;
  messages: { createdAt: string }[];
}
interface OrderHit { id: string; externalOrderId: string; customerName: string | null; totalAmount: number; status: string }

const CATEGORIES: { value: string; label: string; icon: React.ElementType; priority: "NORMAL" | "HIGH"; needsOrder: boolean; hint: string }[] = [
  { value: "ORDER_ISSUE", label: "An order",            icon: ShoppingCart,  priority: "HIGH",   needsOrder: true,  hint: "Delivery, cancellation, NDR, return or a wrong item" },
  { value: "PAYMENT",     label: "Payout or payment",   icon: CreditCard,    priority: "HIGH",   needsOrder: false, hint: "Missing payout, deductions, plan payment" },
  { value: "PRODUCT",     label: "A product",           icon: Package,       priority: "NORMAL", needsOrder: false, hint: "Catalogue, listing, stock, pricing" },
  { value: "ACCOUNT",     label: "My account",          icon: User,          priority: "NORMAL", needsOrder: false, hint: "Login, profile, verification, plan" },
  { value: "TECHNICAL",   label: "Something isn't working", icon: Wrench,    priority: "NORMAL", needsOrder: false, hint: "Shopify sync, a page error, a button that does nothing" },
  { value: "OTHER",       label: "Something else",      icon: MessageSquare, priority: "NORMAL", needsOrder: false, hint: "Anything not listed above" },
];
const CAT_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]));

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  OPEN:              { label: "Open",               bg: "#EFF6FF", color: "#2563EB" },
  IN_PROGRESS:       { label: "Team is on it",      bg: "#FFF7ED", color: "#C2410C" },
  WAITING_ON_SELLER: { label: "Waiting for you",    bg: "#F5F3FF", color: "#7C3AED" },
  RESOLVED:          { label: "Resolved",           bg: "#ECFDF5", color: "#047857" },
  CLOSED:            { label: "Closed",             bg: "#F3F4F6", color: "#6B7280" },
};
const ACTIVE = ["OPEN", "IN_PROGRESS", "WAITING_ON_SELLER"];

const FAQS: { q: string; a: string; href: string; cta: string }[] = [
  { q: "When do I get paid?", a: "Each payout covers your delivered orders minus product cost, shipping and packing, and minus any returned (RTO) orders. Wallet & Payouts shows the next payout, its expected date, and a statement for every payout.", href: "/seller/wallet", cta: "Wallet & Payouts" },
  { q: "Who confirms my COD orders?", a: "The AXQEN team calls every customer before shipping, up to three times. COD Confirmation shows each call, the outcome and the team's note.", href: "/seller/order-confirmation", cta: "COD Confirmation" },
  { q: "Why was my order cancelled?", a: "Open COD Confirmation and look under Cancelled: every cancelled order shows the reason (for example, customer refused or number switched off) and the team's note.", href: "/seller/order-confirmation", cta: "See reasons" },
  { q: "A delivery failed. What happens now?", a: "That's an NDR. The AXQEN team calls the customer and asks the courier to try again or return the parcel. If nothing happens in 24 hours, you can escalate from the NDR page.", href: "/seller/ndr", cta: "NDR" },
  { q: "What does an RTO cost me?", a: "When a parcel comes back, its product cost, return shipping and packing are deducted from your next payout. The RTO page shows each return and where your returns come from.", href: "/seller/rto", cta: "RTO" },
  { q: "My Shopify orders aren't showing up", a: "New orders normally arrive within seconds. On the Shopify Store page, use Sync orders now. If it shows a connection problem, click Reconnect.", href: "/seller/shopify", cta: "Shopify Store" },
  { q: "How does the ad wallet work?", a: "You recharge your ad wallet and the AXQEN ads team runs your Meta ads from it. Ad Spend shows your balance, how many days it will last, and results per campaign.", href: "/seller/meta-ads", cta: "Ad Spend" },
  { q: "Why does my profit show “≈”?", a: "Some orders don't have their product cost entered yet, so profit is approximate until the AXQEN team reconciles them.", href: "/seller/analytics", cta: "Profit & Analytics" },
  { q: "How do I change my bank account?", a: "Go to Profile & Settings → Bank account. You'll need your password, and we email you every time it changes.", href: "/seller/profile", cta: "Profile & Settings" },
];

function timeAgo(s: string) {
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 1000);
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  if (d < 604800) return `${Math.floor(d / 86400)}d ago`;
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ACTIVE" | "DONE" | "ALL">("ACTIVE");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetch("/api/seller/support").then(r => r.json()).then(d => setTickets(d.tickets ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const active = tickets.filter(t => ACTIVE.includes(t.status));
  const waiting = tickets.filter(t => t.status === "WAITING_ON_SELLER").length;
  const shown = filter === "ALL" ? tickets : filter === "ACTIVE" ? active : tickets.filter(t => !ACTIVE.includes(t.status));

  return (
    <div className="px-3 py-4 md:p-8 space-y-5" style={{ background: "#F7F8FC", minHeight: "100vh" }}>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-black text-[#0C1220]">Help &amp; Support</h1>
          <p className="text-[12.5px] text-[#6B7280] mt-1">Quick answers, a direct line to the AXQEN team, and your support tickets.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-bold text-white bg-[#4361EE]">
          <Plus className="w-4 h-4" /> Raise a ticket
        </button>
      </div>

      {/* Contact row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <a href={`${WA_LINK}?text=${encodeURIComponent("Hi AXQEN team, I need help with ")}`} target="_blank" rel="noopener noreferrer"
          className="bg-white rounded-xl border border-[#E8EDF6] p-4 flex items-center gap-3 hover:border-[#BBF7D0]">
          <span className="w-10 h-10 rounded-xl bg-[#ECFDF5] flex items-center justify-center"><MessageCircle className="w-5 h-5 text-[#16A34A]" /></span>
          <div>
            <p className="text-[14px] font-bold text-[#0C1220]">WhatsApp us</p>
            <p className="text-[12px] text-[#6B7280]">Fastest for quick questions</p>
          </div>
        </a>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="bg-white rounded-xl border border-[#E8EDF6] p-4 flex items-center gap-3 hover:border-[#C7D2FE]">
          <span className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center"><Mail className="w-5 h-5 text-[#4361EE]" /></span>
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-[#0C1220]">Email</p>
            <p className="text-[12px] text-[#6B7280] truncate">{SUPPORT_EMAIL}</p>
          </div>
        </a>
        <button onClick={() => setShowForm(true)} className="bg-white rounded-xl border border-[#E8EDF6] p-4 flex items-center gap-3 text-left hover:border-[#C7D2FE]">
          <span className="w-10 h-10 rounded-xl bg-[#FFF7ED] flex items-center justify-center"><LifeBuoy className="w-5 h-5 text-[#EA580C]" /></span>
          <div>
            <p className="text-[14px] font-bold text-[#0C1220]">Raise a ticket</p>
            <p className="text-[12px] text-[#6B7280]">{REPLY_TIME ? `We reply ${REPLY_TIME}` : "Tracked until it's solved"}</p>
          </div>
        </button>
      </div>
      {SUPPORT_HOURS && (
        <p className="text-[12px] text-[#6B7280] flex items-center gap-1.5 -mt-2"><Clock className="w-3.5 h-3.5" /> Support hours: {SUPPORT_HOURS}</p>
      )}

      {waiting > 0 && (
        <button onClick={() => setFilter("ACTIVE")} className="w-full text-left flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] bg-[#F5F3FF] border border-[#DDD6FE] text-[#5B21B6]">
          <AlertCircle className="w-4 h-4" /> <b>{waiting}</b> ticket{waiting > 1 ? "s are" : " is"} waiting for your reply.
        </button>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-5 items-start">
        {/* Tickets */}
        <section className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 pt-3 border-b border-[#F3F4F6] flex-wrap">
            <div className="flex">
              {([["ACTIVE", `Open (${active.length})`], ["DONE", "Resolved"], ["ALL", "All"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setFilter(k)} className="px-3 py-2.5 text-[13px] font-semibold border-b-2 -mb-px"
                  style={{ borderColor: filter === k ? "#4361EE" : "transparent", color: filter === k ? "#4361EE" : "#6B7280" }}>{l}</button>
              ))}
            </div>
            <p className="text-[12px] text-[#9CA3AF] pb-2">Your tickets</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-[13px] text-[#9CA3AF]"><Loader2 className="w-4 h-4 animate-spin text-[#4361EE]" /> Loading tickets…</div>
          ) : shown.length === 0 ? (
            <div className="py-14 text-center px-4">
              <LifeBuoy className="w-9 h-9 mx-auto text-[#E8EDF6]" />
              <p className="text-[13px] font-semibold text-[#6B7280] mt-2">{filter === "ACTIVE" ? "No open tickets" : "No tickets here"}</p>
              <p className="text-[12px] text-[#9CA3AF] mt-1">Check the common questions, or raise a ticket and we&apos;ll track it until it&apos;s solved.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#F3F4F6]">
              {shown.map(t => {
                const st = STATUS[t.status] ?? STATUS.OPEN;
                return (
                  <li key={t.id}>
                    <Link href={`/seller/support/${t.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#FAFBFF]">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-semibold text-[#0C1220] truncate">{t.subject}</p>
                        <p className="text-[11.5px] text-[#9CA3AF] mt-0.5 truncate">
                          #{t.ticketNumber} · {CAT_LABEL[t.category] ?? t.category}{t.relatedOrderId ? ` · Order ${t.relatedOrderId}` : ""} · updated {timeAgo(t.messages[0]?.createdAt ?? t.updatedAt)}
                        </p>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      <ChevronRight className="w-4 h-4 text-[#C4C9D4]" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* FAQ */}
        <section className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
          <div className="px-4 py-3.5 border-b border-[#F3F4F6]">
            <h2 className="text-[14px] font-bold text-[#0C1220]">Common questions</h2>
          </div>
          <ul className="divide-y divide-[#F3F4F6]">
            {FAQS.map((f, i) => (
              <li key={f.q}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#FAFBFF]">
                  <span className="text-[13px] font-semibold text-[#0C1220]">{f.q}</span>
                  <ChevronDown className={`w-4 h-4 text-[#9CA3AF] flex-shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-3.5 -mt-1">
                    <p className="text-[12.5px] text-[#374151] leading-relaxed">{f.a}</p>
                    <Link href={f.href} className="inline-flex items-center gap-1 mt-2 text-[12.5px] font-semibold text-[#4361EE]">Open {f.cta} <ChevronRight className="w-3.5 h-3.5" /></Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {showForm && (
        <NewTicket
          onClose={() => setShowForm(false)}
          onCreated={t => { setTickets(prev => [t, ...prev]); setShowForm(false); setFilter("ACTIVE"); }}
        />
      )}
    </div>
  );
}

function NewTicket({ onClose, onCreated }: { onClose: () => void; onCreated: (t: Ticket) => void }) {
  const [category, setCategory] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [order, setOrder] = useState<OrderHit | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<OrderHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cat = CATEGORIES.find(c => c.value === category);

  useEffect(() => {
    if (!cat?.needsOrder || order) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setSearching(true);
      const p = new URLSearchParams({ limit: "6", ...(q.trim() ? { search: q.trim() } : {}) });
      fetch(`/api/seller/orders/list?${p}`).then(r => r.json()).then(d => setHits(d.orders ?? [])).catch(() => setHits([])).finally(() => setSearching(false));
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q, cat?.needsOrder, order]);

  async function submit() {
    if (!category) { setError("Pick what it's about"); return; }
    if (!subject.trim() || !description.trim()) { setError("Add a short title and describe the problem"); return; }
    setSaving(true); setError("");
    const priority = urgent ? "URGENT" : cat?.priority ?? "NORMAL";
    const res = await fetch("/api/seller/support", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, priority, subject: subject.trim(), description: description.trim(), relatedOrderId: order ? `#${order.externalOrderId}` : "" }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(d.error ?? "Couldn't create the ticket. Try again."); return; }
    onCreated({ ...d.ticket, messages: d.ticket.messages ?? [] });
  }

  const input = "w-full px-3 py-2.5 text-[13.5px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE]";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[#F3F4F6] flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-[15px] font-bold text-[#0C1220]">Raise a ticket</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-[#F3F4F6]"><X className="w-4 h-4 text-[#6B7280]" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-[12px] font-semibold text-[#374151] mb-2">What is it about?</p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(c => (
                <button key={c.value} type="button" onClick={() => { setCategory(c.value); setOrder(null); setQ(""); }}
                  className="flex items-start gap-2 p-2.5 rounded-lg border text-left"
                  style={category === c.value ? { borderColor: "#4361EE", background: "#EEF2FF" } : { borderColor: "#E8EDF6" }}>
                  <c.icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: category === c.value ? "#4361EE" : "#9CA3AF" }} />
                  <span>
                    <span className="block text-[12.5px] font-semibold text-[#0C1220]">{c.label}</span>
                    <span className="block text-[11px] text-[#9CA3AF] leading-snug">{c.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {cat?.needsOrder && (
            <div>
              <p className="text-[12px] font-semibold text-[#374151] mb-1.5">Which order?</p>
              {order ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-[#C7D2FE] bg-[#EEF2FF]">
                  <span className="text-[13px] text-[#0C1220]"><b>#{order.externalOrderId}</b> · {order.customerName ?? "Customer"} · ₹{Math.round(order.totalAmount).toLocaleString("en-IN")}</span>
                  <button type="button" onClick={() => setOrder(null)} className="text-[12px] font-semibold text-[#4361EE]">Change</button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
                    <input id="ticket-order" value={q} onChange={e => setQ(e.target.value)} placeholder="Order ID, customer name, phone or AWB" className={`${input} pl-8`} />
                  </div>
                  <ul className="mt-1.5 rounded-lg border border-[#F3F4F6] divide-y divide-[#F3F4F6] max-h-[200px] overflow-y-auto">
                    {searching ? (
                      <li className="px-3 py-2.5 text-[12px] text-[#9CA3AF] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…</li>
                    ) : hits.length === 0 ? (
                      <li className="px-3 py-2.5 text-[12px] text-[#9CA3AF]">No matching orders. You can still describe it below.</li>
                    ) : hits.map(h => (
                      <li key={h.id}>
                        <button type="button" onClick={() => { setOrder(h); if (!subject) setSubject(`Order #${h.externalOrderId}: `); }}
                          className="w-full text-left px-3 py-2 text-[12.5px] hover:bg-[#FAFBFF]">
                          <b className="text-[#0C1220]">#{h.externalOrderId}</b> <span className="text-[#6B7280]">· {h.customerName ?? "Customer"} · ₹{Math.round(h.totalAmount).toLocaleString("en-IN")}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          <div>
            <label htmlFor="ticket-subject" className="block text-[12px] font-semibold text-[#374151] mb-1.5">Short title</label>
            <input id="ticket-subject" value={subject} maxLength={120} onChange={e => setSubject(e.target.value)} placeholder="e.g. Payout for 18 Nov not received" className={input} />
          </div>
          <div>
            <label htmlFor="ticket-desc" className="block text-[12px] font-semibold text-[#374151] mb-1.5">What happened?</label>
            <textarea id="ticket-desc" rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell us what you expected, what happened instead, and anything you've already tried." className={`${input} resize-none`} />
          </div>
          <label className="flex items-start gap-2 text-[12.5px] text-[#374151] cursor-pointer">
            <input id="ticket-urgent" type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} className="mt-0.5 accent-[#DC2626]" />
            <span><b>This is stopping my business today</b><span className="block text-[11.5px] text-[#9CA3AF]">For example orders not coming in at all, or a payout that bounced. Please use it only for real emergencies.</span></span>
          </label>
          {error && <p className="text-[12.5px] text-[#DC2626]">{error}</p>}
          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={submit} disabled={saving} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-bold text-white bg-[#4361EE] disabled:opacity-60">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Send to AXQEN team
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg text-[13px] font-semibold text-[#6B7280] hover:bg-[#F3F4F6]">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
