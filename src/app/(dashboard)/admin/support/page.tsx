"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Search, Send, Lock, Phone, Mail, ExternalLink, ArrowLeft, CheckCircle2, Clock, MessageSquare } from "lucide-react";
import { MessageBody, useAttachments } from "@/components/support/ticket-ui";
import { previewText, parseMessage } from "@/lib/ticket-content";

type Status = "OPEN" | "IN_PROGRESS" | "WAITING_ON_SELLER" | "RESOLVED" | "CLOSED";
type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
interface Ticket {
  id: string; ticketNumber: number; subject: string; category: string; priority: Priority; status: Status; relatedOrderId: string | null;
  createdAt: string; updatedAt: string;
  seller: { id: string; name: string | null; email: string; brandName: string | null };
  assignedTo: { id: string; name: string | null } | null;
  messages: { createdAt: string; message: string; author: { role: string } }[];
  _count: { messages: number };
}
interface Detail {
  id: string; ticketNumber: number; subject: string; category: string; priority: Priority; status: Status; relatedOrderId: string | null; createdAt: string;
  seller: { id: string; name: string | null; email: string; phone: string | null; brandName: string | null };
  assignedTo: { id: string; name: string | null } | null;
  messages: { id: string; message: string; isInternal: boolean; createdAt: string; author: { id: string; name: string | null; role: string } }[];
}
type View = "needsReply" | "IN_PROGRESS" | "WAITING_ON_SELLER" | "RESOLVED" | "CLOSED" | "all";

const STATUS: Record<Status, [string, string, string]> = {
  OPEN: ["Open", "#FEF3C7", "#B45309"], IN_PROGRESS: ["In progress", "#E0EAFF", "#3538CD"], WAITING_ON_SELLER: ["Waiting on seller", "#F3E8FF", "#7E22CE"],
  RESOLVED: ["Resolved", "#DCFCE7", "#047857"], CLOSED: ["Closed", "#F3F4F6", "#6B7280"],
};
const PRIORITY: Record<Priority, [string, string]> = { URGENT: ["Urgent", "#B91C1C"], HIGH: ["High", "#B45309"], NORMAL: ["Normal", "#6B7280"], LOW: ["Low", "#9CA3AF"] };
const CATEGORY: Record<string, string> = { ORDER_ISSUE: "Order", PAYMENT: "Payment", PRODUCT: "Product", ACCOUNT: "Account", TECHNICAL: "Technical", OTHER: "Other" };
const ago = (s: string) => { const m = Math.floor((Date.now() - new Date(s).getTime()) / 60000); return m < 1 ? "now" : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`; };
const when = (s: string) => new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const needsReply = (t: Ticket) => (t.status === "OPEN" || t.status === "IN_PROGRESS") && (t.messages[0]?.author.role ?? "SELLER") === "SELLER" && !parseMessage(t.messages[0]?.message ?? "").rating;

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("needsReply");
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [team, setTeam] = useState<{ id: string; name: string | null; email: string }[]>([]);

  const load = useCallback(() => {
    fetch("/api/admin/support").then(r => r.json()).then(d => setTickets(d.tickets ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    load();
    fetch("/api/admin/users?role=ADMIN").then(r => r.json()).then(d => setTeam(d.users ?? [])).catch(() => {});
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("ticket");
    if (id) setOpenId(id);
  }, []);

  const counts = useMemo(() => ({
    needsReply: tickets.filter(needsReply).length,
    IN_PROGRESS: tickets.filter(t => t.status === "IN_PROGRESS" || t.status === "OPEN").length,
    WAITING_ON_SELLER: tickets.filter(t => t.status === "WAITING_ON_SELLER").length,
    RESOLVED: tickets.filter(t => t.status === "RESOLVED").length,
    CLOSED: tickets.filter(t => t.status === "CLOSED").length,
    all: tickets.length,
  }), [tickets]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return tickets
      .filter(t => view === "all" || (view === "needsReply" ? needsReply(t) : view === "IN_PROGRESS" ? t.status === "IN_PROGRESS" || t.status === "OPEN" : t.status === view))
      .filter(t => !priority || t.priority === priority)
      .filter(t => !s || [t.subject, t.seller.name, t.seller.brandName, t.seller.email, String(t.ticketNumber)].some(v => v?.toLowerCase().includes(s)))
      .sort((a, b) => view === "needsReply"
        ? (["URGENT", "HIGH", "NORMAL", "LOW"].indexOf(a.priority) - ["URGENT", "HIGH", "NORMAL", "LOW"].indexOf(b.priority)) || (a.messages[0]?.createdAt ?? a.createdAt).localeCompare(b.messages[0]?.createdAt ?? b.createdAt)
        : b.updatedAt.localeCompare(a.updatedAt));
  }, [tickets, view, q, priority]);

  const VIEWS: { key: View; label: string }[] = [
    { key: "needsReply", label: "Needs reply" }, { key: "IN_PROGRESS", label: "Open" }, { key: "WAITING_ON_SELLER", label: "Waiting on seller" },
    { key: "RESOLVED", label: "Resolved" }, { key: "CLOSED", label: "Closed" }, { key: "all", label: "All" },
  ];

  return (
    <div className="px-4 py-5 md:p-8 space-y-4" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div>
        <h1 className="text-[22px] font-black text-[#0C1220]">Support</h1>
        <p className="text-[12.5px] text-[#6B7280] mt-1">Seller tickets. &quot;Needs reply&quot; shows tickets where the seller spoke last, most urgent and oldest first.</p>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto bg-white rounded-xl border border-[#E8EDF6] p-1.5">
        {VIEWS.map(v => {
          const n = counts[v.key], on = view === v.key;
          return (
            <button key={v.key} onClick={() => setView(v.key)} className={`px-3 py-1.5 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5 whitespace-nowrap ${on ? "bg-[#E8EDFF] text-[#4361EE]" : "text-[#6B7280] hover:bg-[#F3F6FF]"}`}>
              {v.label}
              <span className={`text-[10.5px] px-1.5 rounded-full tabular-nums ${v.key === "needsReply" && n ? "bg-[#FEE2E2] text-[#B91C1C]" : on ? "bg-white text-[#4361EE]" : "bg-[#F3F4F6] text-[#6B7280]"}`}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 items-start">
        <section className={`bg-white rounded-xl border border-[#E8EDF6] overflow-hidden ${openId ? "hidden lg:block" : ""}`}>
          <div className="p-3 border-b border-[#F3F4F6] flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
              <input id="sp-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Subject, seller or #number" className="pl-8 pr-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] w-full" />
            </div>
            <select id="sp-priority" aria-label="Priority" value={priority} onChange={e => setPriority(e.target.value)} className="px-2 py-2 text-[12.5px] rounded-lg border border-[#E8EDF6] bg-white outline-none">
              <option value="">Any priority</option>{(Object.keys(PRIORITY) as Priority[]).map(p => <option key={p} value={p}>{PRIORITY[p][0]}</option>)}
            </select>
          </div>
          <div className="max-h-[calc(100vh-260px)] overflow-y-auto divide-y divide-[#F3F4F6]">
            {loading ? <p className="py-16 text-center text-[13px] text-[#9CA3AF] flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
              : list.length === 0 ? <p className="py-16 text-center text-[13px] text-[#9CA3AF]">{view === "needsReply" ? "Nothing waiting on you. All caught up." : "No tickets here."}</p>
              : list.map(t => {
                const last = t.messages[0];
                const waiting = needsReply(t);
                return (
                  <button key={t.id} onClick={() => setOpenId(t.id)} className={`w-full text-left px-4 py-3 ${openId === t.id ? "bg-[#EEF2FF]" : "hover:bg-[#FAFBFF]"}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-[#9CA3AF]">#{t.ticketNumber}</span>
                      <span className="text-[10.5px] font-bold" style={{ color: PRIORITY[t.priority][1] }}>{t.priority !== "NORMAL" ? PRIORITY[t.priority][0] : ""}</span>
                      <span className={`ml-auto text-[11px] tabular-nums ${waiting ? "text-[#B91C1C] font-semibold" : "text-[#9CA3AF]"}`}>{ago(last?.createdAt ?? t.updatedAt)}</span>
                    </div>
                    <p className={`text-[13px] truncate ${waiting ? "font-bold text-[#0C1220]" : "font-medium text-[#374151]"}`}>{t.subject}</p>
                    <p className="text-[11.5px] text-[#6B7280] truncate">{t.seller.brandName || t.seller.name || t.seller.email} · {CATEGORY[t.category] ?? t.category}</p>
                    {last && <p className="text-[11.5px] text-[#9CA3AF] truncate mt-0.5">{last.author.role === "SELLER" ? "" : "You: "}{previewText(last.message)}</p>}
                  </button>
                );
              })}
          </div>
        </section>

        {openId ? <TicketPane id={openId} team={team} onBack={() => setOpenId(null)} onChanged={load} />
          : <section className="hidden lg:flex bg-white rounded-xl border border-[#E8EDF6] py-32 flex-col items-center gap-2 text-[13px] text-[#9CA3AF]"><MessageSquare className="w-8 h-8 text-[#D9E0F2]" /> Pick a ticket to read and reply.</section>}
      </div>
    </div>
  );
}

function TicketPane({ id, team, onBack, onChanged }: { id: string; team: { id: string; name: string | null; email: string }[]; onBack: () => void; onChanged: () => void }) {
  const [t, setT] = useState<Detail | null>(null);
  const [err, setErr] = useState("");
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const shots = useAttachments();
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    fetch(`/api/admin/support/${id}`).then(r => r.json()).then(d => (d.ticket ? setT(d.ticket) : setErr(d.error ?? "Couldn't load the ticket")));
  }, [id]);
  useEffect(() => { setT(null); setErr(""); setReply(""); setInternal(false); load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [t?.messages.length]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch(`/api/admin/support/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { setErr("Couldn't update the ticket"); return; }
    load(); onChanged();
  }
  async function send(thenStatus?: Status) {
    if (!reply.trim() && !shots.urls.length) return;
    setSending(true); setErr("");
    const res = await fetch(`/api/admin/support/${id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: reply.trim(), isInternal: internal, attachments: shots.urls }) });
    const d = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) { setErr(d.error ?? "Couldn't send"); return; }
    setReply(""); shots.reset();
    if (thenStatus) await patch({ status: thenStatus }); else { load(); onChanged(); }
  }

  if (err && !t) return <section className="bg-white rounded-xl border border-[#E8EDF6] p-10 text-center text-[13px] text-[#B91C1C]">{err}</section>;
  if (!t) return <section className="bg-white rounded-xl border border-[#E8EDF6] py-32 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#4361EE]" /></section>;
  const st = STATUS[t.status];
  const phone = t.seller.phone?.replace(/\D/g, "").slice(-10);
  const closed = t.status === "RESOLVED" || t.status === "CLOSED";

  return (
    <section className="bg-white rounded-xl border border-[#E8EDF6] flex flex-col max-h-[calc(100vh-200px)] min-h-[520px]">
      <div className="px-5 py-4 border-b border-[#F3F4F6] space-y-3">
        <div className="flex items-start gap-3">
          <button onClick={onBack} aria-label="Back to tickets" className="lg:hidden p-1.5 rounded-lg hover:bg-[#F3F4F6]"><ArrowLeft className="w-4 h-4" /></button>
          <div className="flex-1 min-w-0">
            <p className="text-[11.5px] text-[#9CA3AF]">#{t.ticketNumber} · {CATEGORY[t.category] ?? t.category} · opened {when(t.createdAt)}</p>
            <p className="text-[16px] font-bold text-[#0C1220]">{t.subject}</p>
            <p className="text-[12.5px] text-[#6B7280] mt-0.5 flex items-center gap-3 flex-wrap">
              <Link href={`/admin/sellers/${t.seller.id}`} className="font-semibold text-[#4361EE]">{t.seller.brandName || t.seller.name || t.seller.email}</Link>
              {phone && <a href={`tel:${phone}`} className="inline-flex items-center gap-1 hover:text-[#4361EE]"><Phone className="w-3 h-3" /> {phone}</a>}
              <a href={`mailto:${t.seller.email}`} className="inline-flex items-center gap-1 hover:text-[#4361EE]"><Mail className="w-3 h-3" /> Email</a>
              {t.relatedOrderId && <Link href={`/admin/orders?search=${encodeURIComponent(t.relatedOrderId)}`} className="inline-flex items-center gap-1 hover:text-[#4361EE]">Order {t.relatedOrderId} <ExternalLink className="w-3 h-3" /></Link>}
            </p>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap" style={{ background: st[1], color: st[2] }}>{st[0]}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-[12px]">
          <label className="flex items-center gap-1.5 text-[#6B7280]">Status
            <select id="tk-status" value={t.status} disabled={busy} onChange={e => patch({ status: e.target.value })} className="px-2 py-1 rounded-lg border border-[#E8EDF6] bg-white outline-none text-[#0C1220]">
              {(Object.keys(STATUS) as Status[]).map(s => <option key={s} value={s}>{STATUS[s][0]}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-[#6B7280]">Priority
            <select id="tk-priority" value={t.priority} disabled={busy} onChange={e => patch({ priority: e.target.value })} className="px-2 py-1 rounded-lg border border-[#E8EDF6] bg-white outline-none text-[#0C1220]">
              {(Object.keys(PRIORITY) as Priority[]).map(p => <option key={p} value={p}>{PRIORITY[p][0]}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-[#6B7280]">Assigned to
            <select id="tk-assign" value={t.assignedTo?.id ?? ""} disabled={busy} onChange={e => patch({ assignedToId: e.target.value })} className="px-2 py-1 rounded-lg border border-[#E8EDF6] bg-white outline-none text-[#0C1220] max-w-[160px]">
              <option value="">Nobody</option>{team.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
            </select>
          </label>
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9CA3AF]" />}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-[#FAFBFF]">
        {t.messages.map(m => {
          const mine = m.author.role !== "SELLER";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] ${m.isInternal ? "bg-[#FFFBEB] border border-dashed border-[#FCD34D] text-[#78350F]" : mine ? "bg-[#4361EE] text-white" : "bg-white border border-[#E8EDF6] text-[#0C1220]"}`}>
                <MessageBody raw={m.message} onDark={mine && !m.isInternal} />
                <p className={`text-[10.5px] mt-1 flex items-center gap-1 ${m.isInternal ? "text-[#B45309]" : mine ? "text-white/70" : "text-[#9CA3AF]"}`}>
                  {m.isInternal && <Lock className="w-3 h-3" />}{m.isInternal ? "Internal note · " : ""}{m.author.name ?? (mine ? "AXQEN team" : "Seller")} · {when(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        {t.messages.length === 0 && <p className="text-center text-[12.5px] text-[#9CA3AF] py-10">No messages yet.</p>}
        <div ref={endRef} />
      </div>

      <div className="border-t border-[#F3F4F6] p-4 space-y-2">
        {err && <p className="text-[12px] text-[#B91C1C]">{err}</p>}
        {closed && !internal && <p className="text-[11.5px] text-[#6B7280] flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" /> This ticket is {t.status === "RESOLVED" ? "resolved" : "closed"}. Replying keeps it this way; change the status above to reopen it.</p>}
        <textarea id="tk-reply" rows={3} value={reply} onChange={e => setReply(e.target.value)} placeholder={internal ? "Internal note, only your team sees this" : "Reply to the seller"}
          onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); }}
          className={`w-full px-3 py-2 text-[13px] rounded-lg border outline-none resize-none ${internal ? "border-[#FCD34D] bg-[#FFFBEB] focus:border-[#F59E0B]" : "border-[#E8EDF6] focus:border-[#4361EE]"}`} />
        {shots.picker("tk-shots")}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-[12px] text-[#374151] cursor-pointer">
            <input id="tk-internal" type="checkbox" checked={internal} onChange={e => setInternal(e.target.checked)} className="accent-[#F59E0B]" /> <Lock className="w-3 h-3" /> Internal note
          </label>
          <span className="text-[11px] text-[#9CA3AF] hidden sm:inline">Ctrl + Enter to send</span>
          <div className="ml-auto flex items-center gap-2">
            {!internal && (
              <>
                <button onClick={() => send("WAITING_ON_SELLER")} disabled={sending || shots.uploading || (!reply.trim() && !shots.urls.length)} className="flex items-center gap-1 px-3 py-2 rounded-lg text-[12.5px] font-semibold border border-[#E8EDF6] text-[#374151] disabled:opacity-40"><Clock className="w-3.5 h-3.5" /> Send, wait for seller</button>
                <button onClick={() => send("RESOLVED")} disabled={sending || shots.uploading || (!reply.trim() && !shots.urls.length)} className="flex items-center gap-1 px-3 py-2 rounded-lg text-[12.5px] font-semibold border border-[#BBF7D0] text-[#047857] disabled:opacity-40"><CheckCircle2 className="w-3.5 h-3.5" /> Send and resolve</button>
              </>
            )}
            <button onClick={() => send()} disabled={sending || shots.uploading || (!reply.trim() && !shots.urls.length)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12.5px] font-bold text-white disabled:opacity-40 ${internal ? "bg-[#D97706]" : "bg-[#4361EE]"}`}>
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} {internal ? "Add note" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
