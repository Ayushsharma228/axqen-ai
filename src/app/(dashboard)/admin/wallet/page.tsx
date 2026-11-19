"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Search, Plus, ArrowDownLeft, ArrowUpRight, Copy, Check, Wallet } from "lucide-react";

interface Seller { id: string; name: string | null; email: string; balance: number }
interface Tx { id: string; type: "CREDIT" | "DEBIT"; amount: number; note: string | null; orderId: string | null; remittanceDate: string | null; bankTxId: string | null; createdAt: string }

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function WalletManagementPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loadingSellers, setLoadingSellers] = useState(true);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Seller | null>(null);
  const [txns, setTxns] = useState<Tx[]>([]);
  const [balance, setBalance] = useState(0);
  const [loadingTx, setLoadingTx] = useState(false);
  const [form, setForm] = useState({ type: "CREDIT", amount: "", note: "", orderId: "", remittanceDate: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const loadSellers = () => fetch("/api/admin/wallet").then(r => r.json()).then(d => setSellers(d.sellers ?? [])).finally(() => setLoadingSellers(false));
  useEffect(() => { loadSellers(); }, []);

  async function open(s: Seller) {
    setSel(s); setMsg(null); setLoadingTx(true);
    const d = await fetch(`/api/admin/wallet/${s.id}`).then(r => r.json()).catch(() => ({}));
    setTxns(d.transactions ?? []); setBalance(d.balance ?? 0); setLoadingTx(false);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!sel) return;
    const amount = Number(form.amount);
    if (!(amount > 0)) { setMsg({ ok: false, text: "Enter an amount above zero" }); return; }
    if (!form.note.trim()) { setMsg({ ok: false, text: "Add a note so the seller knows what this is" }); return; }
    setSaving(true); setMsg(null);
    const res = await fetch("/api/admin/wallet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sellerId: sel.id, ...form, note: form.note.trim() }) });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? "Couldn't save" }); return; }
    setMsg({ ok: true, text: `${form.type === "CREDIT" ? "Credit" : "Debit"} of ${inr(amount)} added.` });
    setForm({ type: "CREDIT", amount: "", note: "", orderId: "", remittanceDate: "" });
    await open(sel); loadSellers();
  }

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return sellers.filter(x => !s || (x.name ?? "").toLowerCase().includes(s) || x.email.toLowerCase().includes(s)).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  }, [sellers, q]);
  const input = "w-full px-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE]";
  const label = "block text-[11.5px] font-semibold text-[#374151] mb-1";

  return (
    <div className="px-4 py-5 md:p-8 space-y-5" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div>
        <h1 className="text-[22px] font-black text-[#0C1220]">Wallet Management</h1>
        <p className="text-[12.5px] text-[#6B7280] mt-1">Each seller&apos;s wallet ledger: remittances, RTO deductions and manual adjustments. Payouts themselves are made from Seller Remittance.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">
        <section className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
          <div className="p-3 border-b border-[#F3F4F6]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
              <input id="wl-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search sellers" className="pl-8 pr-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] w-full" />
            </div>
          </div>
          <div className="max-h-[640px] overflow-y-auto divide-y divide-[#F3F4F6]">
            {loadingSellers ? <p className="py-10 text-center text-[13px] text-[#9CA3AF] flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
              : list.length === 0 ? <p className="py-10 text-center text-[13px] text-[#9CA3AF]">No sellers.</p>
              : list.map(s => (
                <button key={s.id} onClick={() => open(s)} className={`w-full text-left px-4 py-3 flex items-center gap-3 ${sel?.id === s.id ? "bg-[#EEF2FF]" : "hover:bg-[#FAFBFF]"}`}>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-[13px] font-semibold truncate ${sel?.id === s.id ? "text-[#4361EE]" : "text-[#0C1220]"}`}>{s.name ?? s.email}</span>
                    <span className="block text-[11px] text-[#9CA3AF] truncate">{s.email}</span>
                  </span>
                  <span className={`text-[12.5px] font-bold tabular-nums ${s.balance < 0 ? "text-[#B91C1C]" : s.balance > 0 ? "text-[#047857]" : "text-[#9CA3AF]"}`}>{inr(s.balance)}</span>
                </button>
              ))}
          </div>
        </section>

        {!sel ? (
          <section className="bg-white rounded-xl border border-[#E8EDF6] py-24 flex flex-col items-center gap-2 text-[13px] text-[#9CA3AF]">
            <Wallet className="w-8 h-8 text-[#D9E0F2]" /> Pick a seller to see their wallet.
          </section>
        ) : (
          <div className="space-y-5">
            <section className="bg-white rounded-xl border border-[#E8EDF6] p-5 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <Link href={`/admin/sellers/${sel.id}`} className="text-[16px] font-bold text-[#0C1220] hover:text-[#4361EE]">{sel.name ?? sel.email}</Link>
                <p className="text-[12px] text-[#9CA3AF]">{sel.email}</p>
              </div>
              <div className="text-right">
                <p className="text-[11.5px] font-semibold text-[#6B7280]">Wallet balance</p>
                <p className={`text-[26px] font-black tabular-nums ${balance < 0 ? "text-[#B91C1C]" : "text-[#0C1220]"}`}>{inr(balance)}</p>
              </div>
            </section>

            <form onSubmit={add} className="bg-white rounded-xl border border-[#E8EDF6] p-5 space-y-3">
              <p className="text-[14px] font-bold text-[#0C1220]">Add a manual entry</p>
              {msg && <p className="text-[12.5px] rounded-lg px-3 py-2" style={{ background: msg.ok ? "#ECFDF5" : "#FEF2F2", color: msg.ok ? "#047857" : "#B91C1C" }}>{msg.text}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div><label htmlFor="wl-type" className={label}>Type</label>
                  <select id="wl-type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={input}><option value="CREDIT">Credit (add)</option><option value="DEBIT">Debit (deduct)</option></select>
                </div>
                <div><label htmlFor="wl-amt" className={label}>Amount ₹</label><input id="wl-amt" inputMode="decimal" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={input} /></div>
                <div><label htmlFor="wl-order" className={label}>Order ID (optional)</label><input id="wl-order" value={form.orderId} onChange={e => setForm(f => ({ ...f, orderId: e.target.value }))} className={input} /></div>
                <div><label htmlFor="wl-date" className={label}>Date (optional)</label><input id="wl-date" type="date" value={form.remittanceDate} onChange={e => setForm(f => ({ ...f, remittanceDate: e.target.value }))} className={input} /></div>
                <div className="sm:col-span-4"><label htmlFor="wl-note" className={label}>Note (the seller sees this) *</label><input id="wl-note" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="e.g. Refund for damaged item, order #1234" className={input} /></div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold text-white bg-[#4361EE] disabled:opacity-60">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add {form.type === "CREDIT" ? "credit" : "debit"}
                </button>
                <p className="text-[11.5px] text-[#9CA3AF]">To correct a mistake, add an opposite entry. Wrong remittances are reset from Seller Remittance.</p>
              </div>
            </form>

            <section className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
              <p className="px-5 pt-4 pb-2 text-[14px] font-bold text-[#0C1220]">Ledger</p>
              {loadingTx ? <p className="py-10 text-center text-[13px] text-[#9CA3AF] flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
                : txns.length === 0 ? <p className="py-10 text-center text-[13px] text-[#9CA3AF]">No transactions yet.</p>
                : (
                <div className="divide-y divide-[#F3F4F6]">
                  {txns.map(t => (
                    <div key={t.id} className="flex items-center gap-3 px-5 py-3 text-[12.5px] flex-wrap">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${t.type === "CREDIT" ? "bg-[#DCFCE7] text-[#047857]" : "bg-[#FEE2E2] text-[#B91C1C]"}`}>
                        {t.type === "CREDIT" ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </span>
                      <div className="flex-1 min-w-[200px]">
                        <p className="text-[#0C1220] font-medium">{t.note || (t.type === "CREDIT" ? "Credit" : "Debit")}</p>
                        <p className="text-[11px] text-[#9CA3AF]">
                          {fmt(t.remittanceDate ?? t.createdAt)}
                          {t.type === "CREDIT" && t.amount > 0 && (t.bankTxId ? <span className="text-[#047857] font-semibold"> · Paid · <span className="font-mono">{t.bankTxId}</span></span> : t.remittanceDate ? <span className="text-[#4361EE] font-semibold"> · Scheduled</span> : null)}
                          {t.orderId && <> · order {t.orderId}</>}
                        </p>
                      </div>
                      <button onClick={() => { navigator.clipboard.writeText(t.id).catch(() => {}); setCopied(t.id); setTimeout(() => setCopied(c => (c === t.id ? null : c)), 1500); }}
                        aria-label="Copy entry ID" title="Copy entry ID" className="p-1.5 rounded-lg text-[#9CA3AF] hover:bg-[#F3F6FF] hover:text-[#4361EE]">
                        {copied === t.id ? <Check className="w-3.5 h-3.5 text-[#059669]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <span className={`w-[120px] text-right font-bold tabular-nums ${t.type === "CREDIT" ? "text-[#047857]" : "text-[#B91C1C]"}`}>{t.type === "CREDIT" ? "+" : "−"} {inr(t.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
