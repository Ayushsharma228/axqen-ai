"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Send, Bell, CheckCheck, Info, IndianRupee, Package, AlertCircle, Megaphone, Users, User } from "lucide-react";

interface Seller { id: string; name: string | null; email: string; brandName: string | null }
interface InboxItem { id: string; type: string; title: string; message: string; isRead: boolean; data: Record<string, unknown> | null; createdAt: string }
interface Sent { title: string; message: string; category: string; createdAt: string; recipients: number; read: number; seller: string | null }

const CATEGORIES = [
  { value: "General", icon: Info, color: "#4361EE", bg: "#E8EDFF" },
  { value: "Payment Reminder", icon: IndianRupee, color: "#B45309", bg: "#FEF3C7" },
  { value: "Stock Update", icon: Package, color: "#7E22CE", bg: "#F3E8FF" },
  { value: "Order Alert", icon: AlertCircle, color: "#B91C1C", bg: "#FEE2E2" },
  { value: "Announcement", icon: Megaphone, color: "#047857", bg: "#DCFCE7" },
];
const cat = (v: string) => CATEGORIES.find(c => c.value === v) ?? CATEGORIES[0];
const when = (s: string) => new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Where an admin notification should take you, based on what it is about. */
function linkFor(n: InboxItem): string | null {
  const d = n.data ?? {};
  if (typeof d.ticketId === "string") return `/admin/support?ticket=${d.ticketId}`;
  if (typeof d.productId === "string") return "/admin/products";
  const t = `${n.title} ${n.message}`.toLowerCase();
  if (t.includes("kyc")) return "/admin/kyc";
  if (t.includes("listing")) return "/admin/listings";
  if (t.includes("recharge")) return "/admin/ad-spend";
  if (t.includes("ticket") || t.includes("support")) return "/admin/support";
  if (t.includes("signup") || t.includes("seller")) return "/admin/sellers";
  return null;
}

export default function AdminNotificationsPage() {
  const [tab, setTab] = useState<"inbox" | "send">("inbox");
  const [inbox, setInbox] = useState<InboxItem[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [sent, setSent] = useState<Sent[] | null>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [target, setTarget] = useState<"all" | "one">("all");
  const [sellerId, setSellerId] = useState("");
  const [category, setCategory] = useState("General");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadInbox = useCallback(() => fetch("/api/admin/notifications?view=inbox").then(r => r.json()).then(d => { setInbox(d.inbox ?? []); setUnread(d.unreadCount ?? 0); }), []);
  const loadSent = useCallback(() => fetch("/api/admin/notifications?view=sent").then(r => r.json()).then(d => setSent(d.sent ?? [])), []);
  useEffect(() => {
    loadInbox(); loadSent();
    fetch("/api/admin/sellers").then(r => r.json()).then(d => setSellers(d.sellers ?? []));
  }, [loadInbox, loadSent]);

  async function markRead(body: { ids?: string[]; all?: boolean }) {
    await fetch("/api/admin/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    loadInbox();
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !message.trim()) { setMsg({ ok: false, text: "Add a title and a message" }); return; }
    if (target === "one" && !sellerId) { setMsg({ ok: false, text: "Pick the seller" }); return; }
    if (target === "all" && !confirm(`Send "${title.trim()}" to all ${sellers.length} sellers?`)) return;
    setSending(true); setMsg(null);
    const res = await fetch("/api/admin/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target, sellerId, category, title, message }) });
    const d = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? "Couldn't send" }); return; }
    setMsg({ ok: true, text: `Sent to ${d.sent} seller${d.sent === 1 ? "" : "s"}. They'll see it under the bell on their dashboard.` });
    setTitle(""); setMessage(""); loadSent();
  }

  const input = "w-full px-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE]";
  const label = "block text-[11.5px] font-semibold text-[#374151] mb-1";
  const c = cat(category);

  return (
    <div className="px-4 py-5 md:p-8 space-y-5" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div>
        <h1 className="text-[22px] font-black text-[#0C1220]">Notifications</h1>
        <p className="text-[12.5px] text-[#6B7280] mt-1">Alerts for your team, and messages you send to sellers&apos; dashboards.</p>
      </div>

      <div className="flex items-center gap-1 bg-white rounded-xl border border-[#E8EDF6] p-1.5 w-fit">
        <button onClick={() => setTab("inbox")} className={`px-3 py-1.5 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5 ${tab === "inbox" ? "bg-[#E8EDFF] text-[#4361EE]" : "text-[#6B7280] hover:bg-[#F3F6FF]"}`}>
          Inbox {unread > 0 && <span className="text-[10.5px] px-1.5 rounded-full bg-[#FEE2E2] text-[#B91C1C] tabular-nums">{unread}</span>}
        </button>
        <button onClick={() => setTab("send")} className={`px-3 py-1.5 rounded-lg text-[12.5px] font-semibold ${tab === "send" ? "bg-[#E8EDFF] text-[#4361EE]" : "text-[#6B7280] hover:bg-[#F3F6FF]"}`}>Send to sellers</button>
      </div>

      {tab === "inbox" ? (
        <section className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#F3F4F6]">
            <p className="text-[14px] font-bold text-[#0C1220]">Team inbox</p>
            {unread > 0 && <button onClick={() => markRead({ all: true })} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#4361EE]"><CheckCheck className="w-4 h-4" /> Mark all read</button>}
          </div>
          {!inbox ? <p className="py-16 text-center text-[13px] text-[#9CA3AF] flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
            : inbox.length === 0 ? <div className="py-16 flex flex-col items-center gap-2 text-[13px] text-[#9CA3AF]"><Bell className="w-8 h-8 text-[#D9E0F2]" /> No notifications yet.</div>
            : (
            <div className="divide-y divide-[#F3F4F6]">
              {inbox.map(n => {
                const href = linkFor(n);
                const body = (
                  <>
                    <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${n.isRead ? "bg-transparent" : "bg-[#4361EE]"}`} />
                    <span className="flex-1 min-w-0">
                      <span className={`block text-[13px] ${n.isRead ? "text-[#374151]" : "font-bold text-[#0C1220]"}`}>{n.title}</span>
                      <span className="block text-[12.5px] text-[#6B7280] mt-0.5">{n.message}</span>
                      <span className="block text-[11px] text-[#9CA3AF] mt-1">{when(n.createdAt)}{href && <span className="text-[#4361EE] font-semibold"> · Open</span>}</span>
                    </span>
                  </>
                );
                return href ? (
                  <a key={n.id} href={href} onClick={() => { if (!n.isRead) markRead({ ids: [n.id] }); }} className={`flex items-start gap-3 px-5 py-3.5 ${n.isRead ? "hover:bg-[#FAFBFF]" : "bg-[#F8FAFF] hover:bg-[#F1F4FF]"}`}>{body}</a>
                ) : (
                  <button key={n.id} onClick={() => { if (!n.isRead) markRead({ ids: [n.id] }); }} className={`w-full text-left flex items-start gap-3 px-5 py-3.5 ${n.isRead ? "hover:bg-[#FAFBFF]" : "bg-[#F8FAFF] hover:bg-[#F1F4FF]"}`}>{body}</button>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-5 items-start">
          <form onSubmit={send} className="bg-white rounded-xl border border-[#E8EDF6] p-5 space-y-4">
            <p className="text-[14px] font-bold text-[#0C1220]">New message</p>
            {msg && <p className="text-[12.5px] rounded-lg px-3 py-2" style={{ background: msg.ok ? "#ECFDF5" : "#FEF2F2", color: msg.ok ? "#047857" : "#B91C1C" }}>{msg.text}</p>}
            <div>
              <p className={label}>Send to</p>
              <div className="grid grid-cols-2 gap-2">
                {([["all", `All sellers (${sellers.length})`, Users], ["one", "One seller", User]] as const).map(([k, l, Icon]) => (
                  <button type="button" key={k} onClick={() => setTarget(k)} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-[13px] font-semibold ${target === k ? "border-[#4361EE] bg-[#EEF2FF] text-[#4361EE]" : "border-[#E8EDF6] text-[#374151]"}`}>
                    <Icon className="w-4 h-4" /> {l}
                  </button>
                ))}
              </div>
            </div>
            {target === "one" && (
              <div><label htmlFor="nt-seller" className={label}>Seller</label>
                <select id="nt-seller" value={sellerId} onChange={e => setSellerId(e.target.value)} className={input}>
                  <option value="">Pick a seller</option>{sellers.map(s => <option key={s.id} value={s.id}>{s.brandName || s.name || s.email}</option>)}
                </select>
              </div>
            )}
            <div>
              <p className={label}>Type</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(k => {
                  const Icon = k.icon, on = category === k.value;
                  return (
                    <button type="button" key={k.value} onClick={() => setCategory(k.value)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border"
                      style={on ? { background: k.bg, color: k.color, borderColor: k.color } : { borderColor: "#E8EDF6", color: "#6B7280" }}>
                      <Icon className="w-3.5 h-3.5" /> {k.value}
                    </button>
                  );
                })}
              </div>
            </div>
            <div><label htmlFor="nt-title" className={label}>Title</label><input id="nt-title" maxLength={80} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Plan payment due on 25 Nov" className={input} /></div>
            <div><label htmlFor="nt-msg" className={label}>Message</label><textarea id="nt-msg" rows={4} maxLength={500} value={message} onChange={e => setMessage(e.target.value)} className={`${input} resize-none`} /><p className="text-[11px] text-[#9CA3AF] text-right">{message.length}/500</p></div>
            {(title || message) && (
              <div className="rounded-lg border border-[#E8EDF6] p-3 flex items-start gap-3 bg-[#FAFBFF]">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: c.bg, color: c.color }}><c.icon className="w-4 h-4" /></span>
                <span className="min-w-0"><span className="block text-[13px] font-bold text-[#0C1220]">{title || "Title"}</span><span className="block text-[12.5px] text-[#6B7280]">{message || "Message"}</span><span className="block text-[11px] text-[#9CA3AF] mt-1">Preview · how sellers see it</span></span>
              </div>
            )}
            <button type="submit" disabled={sending} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold text-white bg-[#4361EE] disabled:opacity-60">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
            </button>
          </form>

          <section className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
            <p className="px-5 py-3 border-b border-[#F3F4F6] text-[14px] font-bold text-[#0C1220]">Sent</p>
            {!sent ? <p className="py-16 text-center text-[13px] text-[#9CA3AF] flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
              : sent.length === 0 ? <p className="py-16 text-center text-[13px] text-[#9CA3AF]">Nothing sent yet.</p>
              : (
              <div className="divide-y divide-[#F3F4F6] max-h-[640px] overflow-y-auto">
                {sent.map((s, i) => {
                  const k = cat(s.category);
                  const pct = s.recipients ? Math.round((s.read / s.recipients) * 100) : 0;
                  return (
                    <div key={i} className="px-5 py-3.5 flex items-start gap-3">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: k.bg, color: k.color }}><k.icon className="w-4 h-4" /></span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[#0C1220]">{s.title}</p>
                        <p className="text-[12.5px] text-[#6B7280] line-clamp-2">{s.message}</p>
                        <p className="text-[11px] text-[#9CA3AF] mt-1">{when(s.createdAt)} · {s.seller ?? `${s.recipients} sellers`}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[13px] font-bold tabular-nums text-[#0C1220]">{pct}%</p>
                        <p className="text-[10.5px] text-[#9CA3AF]">read · {s.read}/{s.recipients}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
