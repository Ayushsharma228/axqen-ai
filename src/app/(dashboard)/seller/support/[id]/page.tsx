"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Send, CheckCircle2, Lock, AlertCircle, Clock, ThumbsUp, ThumbsDown } from "lucide-react";
import { MessageBody, useAttachments } from "@/components/support/ticket-ui";
import { parseMessage } from "@/lib/ticket-content";

interface Author { id: string; name: string | null; role: string }
interface Message { id: string; message: string; isInternal: boolean; createdAt: string; author: Author }
interface TicketDetail {
  id: string; ticketNumber: number; subject: string; category: string; priority: string; status: string;
  relatedOrderId: string | null; createdAt: string; updatedAt: string; resolvedAt: string | null; closedAt: string | null;
  assignedTo: { id: string; name: string | null } | null;
  messages: Message[];
}

const SUPPORT_HOURS = "Monday to Saturday, 11 AM – 8 PM";
const REPLY_TIME = "within 30 working minutes";
const BLUE = "#1D5CFF";

const STATUS: Record<string, [string, string, string]> = {
  OPEN: ["Open", "#E6EEFF", BLUE], IN_PROGRESS: ["In progress", "#FFF7ED", "#C2410C"], WAITING_ON_SELLER: ["Waiting for you", "#FEF3C7", "#B45309"],
  RESOLVED: ["Resolved", "#DCFCE7", "#047857"], CLOSED: ["Closed", "#F3F4F6", "#6B7280"],
};
const CAT_LABEL: Record<string, string> = { ORDER_ISSUE: "Order", PAYMENT: "Payment", PRODUCT: "Product", ACCOUNT: "Account", TECHNICAL: "Technical", OTHER: "General" };
const when = (s: string) => new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function SellerTicketPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [err, setErr] = useState("");
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [comment, setComment] = useState("");
  const [rateBusy, setRateBusy] = useState(false);
  const shots = useAttachments();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/seller/support/${id}`).then(r => r.json()).then(d => setTicket(d.ticket ?? null)).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [ticket?.messages.length]);

  async function sendReply() {
    if (!reply.trim() && !shots.urls.length) return;
    setSending(true); setErr("");
    const res = await fetch(`/api/seller/support/${id}/messages`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: reply.trim(), attachments: shots.urls }),
    });
    const d = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) { setErr(d.error ?? "Couldn't send. Try again."); return; }
    setTicket(t => t ? { ...t, status: "OPEN", messages: [...t.messages, d.message] } : t);
    setReply(""); shots.reset();
  }

  async function closeTicket() {
    if (!confirm("Close this ticket? Only close it if your issue is sorted.")) return;
    setClosing(true);
    await fetch(`/api/seller/support/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "close" }) });
    setTicket(t => t ? { ...t, status: "CLOSED" } : t);
    setClosing(false);
  }

  async function rate() {
    if (!rating) return;
    setRateBusy(true); setErr("");
    const res = await fetch(`/api/seller/support/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rate", rating, comment }) });
    const d = await res.json().catch(() => ({}));
    setRateBusy(false);
    if (!res.ok) { setErr(d.error ?? "Couldn't save your rating"); return; }
    setTicket(t => t ? { ...t, messages: [...t.messages, d.message] } : t);
  }

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-7 h-7 animate-spin" style={{ color: BLUE }} /></div>;
  if (!ticket) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-[13px] text-[#6B7280]">
      <AlertCircle className="w-9 h-9 text-[#D3DEF7]" /> This ticket wasn&apos;t found.
      <Link href="/seller/support" className="font-semibold" style={{ color: BLUE }}>Back to Help & Support</Link>
    </div>
  );

  const st = STATUS[ticket.status] ?? STATUS.OPEN;
  const isClosed = ticket.status === "CLOSED" || ticket.status === "RESOLVED";
  const rated = ticket.messages.some(m => parseMessage(m.message).rating);

  return (
    <div className="px-4 py-5 md:px-8 md:py-7 space-y-5" style={{ background: "#EEF1F6", minHeight: "100vh" }}>
      <Link href="/seller/support" className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: BLUE }}><ArrowLeft className="w-4 h-4" /> Help & Support</Link>

      <div className="bg-white rounded-[20px] p-5 md:p-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-mono text-[#9AA3B5]">#{ticket.ticketNumber}</span>
          <span className="text-[11.5px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: st[1], color: st[2] }}>{st[0]}</span>
          <span className="text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full bg-[#F3F4F6] text-[#6B7280]">{CAT_LABEL[ticket.category] ?? ticket.category}</span>
          {ticket.relatedOrderId && <span className="text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full bg-[#EEF3FF]" style={{ color: BLUE }}>Order {ticket.relatedOrderId}</span>}
        </div>
        <h1 className="text-[22px] font-bold text-[#0F1623] mt-2">{ticket.subject}</h1>
        <p className="text-[12.5px] text-[#6B7488] mt-1">Opened {when(ticket.createdAt)}{ticket.assignedTo ? ` · handled by ${ticket.assignedTo.name ?? "AXQEN support"}` : ""}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-5 items-start">
        <div className="space-y-4">
          <div className="bg-white rounded-[20px] p-5 md:p-6 space-y-4">
            {ticket.messages.map(m => {
              const team = m.author.role === "ADMIN";
              const isRating = !!parseMessage(m.message).rating;
              return (
                <div key={m.id} className={`flex gap-3 ${team ? "" : "flex-row-reverse"}`}>
                  <span className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[12px] font-bold text-white" style={{ background: team ? "#0F1623" : BLUE }}>
                    {team ? "A" : (m.author.name?.[0]?.toUpperCase() ?? "Y")}
                  </span>
                  <div className={`max-w-[82%] ${team ? "" : "text-right"}`}>
                    <p className="text-[11.5px] text-[#9AA3B5] mb-1">{team ? "AXQEN support" : "You"} · {when(m.createdAt)}</p>
                    <div className={`inline-block text-left rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed ${isRating ? "bg-[#F7F8FB] text-[#0F1623]" : team ? "bg-[#F3F5F9] text-[#0F1623] rounded-tl-md" : "text-white rounded-tr-md"}`}
                      style={!team && !isRating ? { background: BLUE } : undefined}>
                      <MessageBody raw={m.message} onDark={!team && !isRating} />
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {err && <p className="text-[12.5px] text-[#B91C1C] bg-[#FEF2F2] rounded-xl px-4 py-2.5">{err}</p>}

          {isClosed ? (
            <div className="bg-white rounded-[20px] p-5 md:p-6 space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 mt-0.5" style={{ color: ticket.status === "RESOLVED" ? "#047857" : "#6B7280" }} />
                <div>
                  <p className="text-[14px] font-semibold text-[#0F1623]">This ticket is {ticket.status === "RESOLVED" ? "resolved" : "closed"}</p>
                  <p className="text-[12.5px] text-[#6B7488]">Still need help? <Link href="/seller/support" className="font-semibold" style={{ color: BLUE }}>Raise a new ticket</Link>.</p>
                </div>
              </div>
              {!rated && (
                <div className="rounded-2xl bg-[#F7F8FB] p-4 space-y-3">
                  <p className="text-[14px] font-semibold text-[#0F1623]">Was your issue solved?</p>
                  <div className="flex gap-2">
                    {([["up", "Yes, solved", ThumbsUp], ["down", "No, not really", ThumbsDown]] as const).map(([v, l, Icon]) => (
                      <button key={v} type="button" onClick={() => setRating(v)} aria-pressed={rating === v}
                        className="flex items-center gap-2 h-10 px-4 rounded-full text-[13px] font-semibold border transition-colors"
                        style={rating === v ? { background: v === "up" ? "#047857" : "#B91C1C", color: "#fff", borderColor: "transparent" } : { background: "#fff", color: "#374151", borderColor: "#E2E7F0" }}>
                        <Icon className="w-4 h-4" /> {l}
                      </button>
                    ))}
                  </div>
                  {rating && (
                    <>
                      <textarea id="rate-comment" rows={2} value={comment} onChange={e => setComment(e.target.value)} maxLength={500}
                        placeholder={rating === "up" ? "Anything we did well? (optional)" : "What could we have done better? (optional)"}
                        className="w-full px-3 py-2.5 text-[13px] rounded-xl border border-[#E2E7F0] bg-white outline-none focus:border-[#1D5CFF] resize-none" />
                      <button onClick={rate} disabled={rateBusy} className="flex items-center gap-1.5 h-10 px-4 rounded-full text-[13px] font-bold text-white disabled:opacity-60" style={{ background: BLUE }}>
                        {rateBusy && <Loader2 className="w-4 h-4 animate-spin" />} Send rating
                      </button>
                    </>
                  )}
                </div>
              )}
              {rated && <p className="text-[12.5px] text-[#047857]">Thanks for rating. It helps us improve.</p>}
            </div>
          ) : (
            <div className="bg-white rounded-[20px] p-5 md:p-6 space-y-3">
              <label htmlFor="reply" className="text-[13px] font-semibold text-[#0F1623]">Reply</label>
              <textarea id="reply" rows={4} value={reply} onChange={e => setReply(e.target.value)} placeholder="Type your reply…"
                onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendReply(); }}
                className="w-full px-3.5 py-3 text-[13.5px] rounded-xl border border-[#E2E7F0] outline-none focus:border-[#1D5CFF] resize-none" />
              {shots.picker("reply-shots")}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11.5px] text-[#9AA3B5]">Ctrl + Enter to send</span>
                <button onClick={sendReply} disabled={sending || shots.uploading || (!reply.trim() && !shots.urls.length)}
                  className="flex items-center gap-2 h-10 px-5 rounded-full text-[13px] font-bold text-white disabled:opacity-50" style={{ background: BLUE }}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send reply
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="bg-white rounded-[20px] p-5 space-y-2.5 text-[13px]">
            <p className="text-[14px] font-semibold text-[#0F1623] mb-1">Ticket details</p>
            {[
              ["Status", st[0]], ["Topic", CAT_LABEL[ticket.category] ?? ticket.category], ["Ticket", `#${ticket.ticketNumber}`],
              ...(ticket.relatedOrderId ? [["Order", ticket.relatedOrderId]] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3"><span className="text-[#6B7488]">{k}</span><span className="font-semibold text-[#0F1623] text-right">{v}</span></div>
            ))}
          </div>
          <div className="bg-white rounded-[20px] p-5 text-[13px]">
            <p className="text-[14px] font-semibold text-[#0F1623] flex items-center gap-1.5"><Clock className="w-4 h-4" style={{ color: BLUE }} /> When we reply</p>
            <p className="text-[#6B7488] mt-1.5">We reply <b className="text-[#0F1623]">{REPLY_TIME}</b>, {SUPPORT_HOURS}. You&apos;ll get a notification and an email.</p>
          </div>
          {!isClosed && (
            <button onClick={closeTicket} disabled={closing} className="w-full flex items-center justify-center gap-2 h-10 rounded-full text-[13px] font-semibold border border-[#E2E7F0] bg-white text-[#374151] disabled:opacity-50">
              {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} My issue is sorted, close ticket
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
