"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Wallet, TrendingUp, TrendingDown, Clock, CheckCircle2,
  ArrowUpRight, ArrowDownRight, CalendarCheck,
  Copy, CopyCheck, Download,
} from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";

interface Transaction {
  id: string; type: string; amount: number; note: string | null;
  remittanceDate: string | null; bankTxId: string | null; createdAt: string;
}
interface BankDetails { bankHolder: string | null; bankAccount: string | null; bankIfsc: string | null; }
interface WalletData {
  balance: number; totalRemittance: number; totalDeductions: number;
  upcomingAmount: number; upcoming: Transaction[]; paid: Transaction[];
  transactions: Transaction[];
  bankDetails: BankDetails;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.abs(n));
}
function fmtD(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function maskAccount(acc: string | null) {
  if (!acc) return "—";
  return "••••" + acc.slice(-4);
}

const TABS = ["All", "Upcoming", "Paid", "Deductions"];

export default function SellerWalletPage() {
  const [data,     setData]     = useState<WalletData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState("All");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/seller/wallet").then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  function getNextMonday() {
    const d = new Date();
    const day = d.getDay(); // 0=Sun,1=Mon,...,6=Sat
    const daysUntilMonday = day === 0 ? 1 : 8 - day;
    d.setDate(d.getDate() + daysUntilMonday);
    return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  function copyRef(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function exportCSV() {
    const rows = (data?.transactions ?? []).map(t => [
      t.id, t.type, t.amount, t.note ?? "",
      t.remittanceDate ? fmtD(t.remittanceDate) : "",
      t.bankTxId ?? "",
      fmtD(t.createdAt),
    ]);
    const csv = [
      ["ID", "Type", "Amount", "Note", "Remittance Date", "Bank Ref No.", "Created"].join(","),
      ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = "wallet-transactions.csv";
    a.click();
  }

  const allTx      = data?.transactions ?? [];
  const upcoming   = data?.upcoming ?? [];
  const paid       = (data?.paid ?? []).filter(t => t.bankTxId !== null);
  const deductions = allTx.filter(t => t.type === "DEBIT");
  const displayed  = tab === "All" ? allTx : tab === "Upcoming" ? upcoming : tab === "Paid" ? paid : deductions;

  const available = data?.balance ?? 0;
  const bank      = data?.bankDetails;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page)" }}>
      <PageHero
        title="Wallet & Payouts"
        subtitle="Your earnings, payouts, and transaction history"
        cards={
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                label: "Total Remittance",
                value: loading ? "—" : `₹${fmt(data?.totalRemittance ?? 0)}`,
                sub: `${(data?.paid.length ?? 0) + (data?.upcoming.length ?? 0)} remittance entries`,
                icon: TrendingUp, color: "#00C67A", bg: "rgba(0,198,122,0.12)",
              },
              {
                label: "Total Deductions",
                value: loading ? "—" : `₹${fmt(data?.totalDeductions ?? 0)}`,
                sub: "RTO & adjustments",
                icon: TrendingDown, color: "#EF4444", bg: "rgba(239,68,68,0.1)",
              },
              {
                label: "Wallet Balance",
                value: loading ? "—" : `${available < 0 ? "−" : ""}₹${fmt(available)}`,
                sub: available < 0 ? "In deficit" : "Remittance minus deductions",
                icon: Wallet,
                color: available < 0 ? "#EF4444" : "#F59E0B",
                bg: available < 0 ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
              },
            ].map(({ label, value, sub, icon: Icon, color, bg }) => (
              <div key={label} className="rounded-2xl px-5 py-4"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</p>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                </div>
                <p className="text-xl font-bold leading-tight" style={{ color: "var(--text-primary)" }}>{value}</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{sub}</p>
              </div>
            ))}
          </div>
        }
      />

      <div className="px-4 md:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT — transaction log */}
          <div className="lg:col-span-2 space-y-5">

            {/* Transaction log */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3 flex items-center justify-between"
                style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-1">
                  {TABS.map(t => (
                    <button key={t} onClick={() => setTab(t)}
                      className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
                      style={tab === t
                        ? { background: "var(--bg-sidebar)", color: "var(--text-primary)" }
                        : { color: "var(--text-400)" }}>
                      {t}
                      {t === "Upcoming" && upcoming.length > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px]"
                          style={{ background: "#EDE9FE", color: "#7C3AED" }}>
                          {upcoming.length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <button onClick={exportCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: "var(--bg-muted)", color: "var(--text-400)", border: "1px solid var(--border)" }}>
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
              </div>

              {/* Deductions summary bar */}
              {tab === "Deductions" && deductions.length > 0 && (
                <div className="px-5 py-3 flex items-center gap-3"
                  style={{ background: "#FEF2F2", borderBottom: "1px solid #FECACA" }}>
                  <TrendingDown className="w-4 h-4 flex-shrink-0" style={{ color: "#DC2626" }} />
                  <div>
                    <span className="text-xs font-semibold" style={{ color: "#DC2626" }}>
                      Total deducted: ₹{fmt(deductions.reduce((s, t) => s + t.amount, 0))}
                    </span>
                    <span className="text-xs ml-2" style={{ color: "#EF4444" }}>
                      across {deductions.length} transaction{deductions.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="p-8 text-center text-sm" style={{ color: "var(--text-400)" }}>Loading…</div>
              ) : displayed.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-2">
                  <Wallet className="w-10 h-10" style={{ color: "var(--border)" }} />
                  <p className="text-sm" style={{ color: "var(--text-400)" }}>No transactions in this category</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {displayed.map(tx => {
                    const isCredit = tx.type === "CREDIT";
                    const isPaid   = tx.bankTxId !== null;
                    return (
                      <div key={tx.id} className="px-5 py-3.5 hover:bg-gray-50/50">
                        <div className="flex items-start gap-4">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: isCredit ? "#F0FDF4" : "#FEF2F2" }}>
                            {isCredit
                              ? <ArrowDownRight className="w-4 h-4" style={{ color: "#16A34A" }} />
                              : <ArrowUpRight className="w-4 h-4" style={{ color: "#EF4444" }} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium" style={{ color: "var(--text-900)" }}>
                              {tx.note || (isCredit ? "Remittance Credit" : "Deduction")}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: "var(--text-400)" }}>
                              {tx.remittanceDate
                                ? (isPaid ? "Paid: " : "Expected: ") + fmtD(tx.remittanceDate)
                                : fmtD(tx.createdAt)}
                            </p>
                            {/* Bank reference number — shown for paid credits */}
                            {isPaid && tx.bankTxId && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded"
                                  style={{ background: "var(--bg-muted)", color: "var(--text-500)", border: "1px solid var(--border)" }}>
                                  Ref: {tx.bankTxId}
                                </span>
                                <button onClick={() => copyRef(tx.bankTxId!, tx.id)}
                                  className="flex items-center gap-0.5 text-[10px]"
                                  style={{ color: copiedId === tx.id ? "#16A34A" : "var(--text-300)" }}>
                                  {copiedId === tx.id
                                    ? <><CopyCheck className="w-3 h-3" /> Copied</>
                                    : <><Copy className="w-3 h-3" /> Copy</>}
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold" style={{ color: isCredit ? "#16A34A" : "#EF4444" }}>
                              {isCredit ? "+" : "−"}₹{fmt(tx.amount)}
                            </p>
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                              {isPaid
                                ? <><CheckCircle2 className="w-3 h-3" style={{ color: "#16A34A" }} /><span className="text-xs" style={{ color: "#16A34A" }}>Paid</span></>
                                : tx.remittanceDate
                                  ? <><Clock className="w-3 h-3" style={{ color: "#7C3AED" }} /><span className="text-xs" style={{ color: "#7C3AED" }}>Upcoming</span></>
                                  : !isCredit
                                  ? <><TrendingDown className="w-3 h-3" style={{ color: "#EF4444" }} /><span className="text-xs" style={{ color: "#EF4444" }}>Deducted</span></>
                                  : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — auto-payout info */}
          <div className="space-y-5">

            {/* Auto-payout card */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-5 h-5" style={{ color: "#4361EE" }} />
                <h2 className="text-sm font-bold" style={{ color: "var(--text-900)" }}>Auto Payout</h2>
              </div>

              <div className="rounded-xl px-4 py-3 space-y-1"
                style={{ background: "rgba(67,97,238,0.06)", border: "1px solid rgba(67,97,238,0.2)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#4361EE" }}>
                  Next payout
                </p>
                <p className="text-sm font-bold" style={{ color: "var(--text-900)" }}>
                  {getNextMonday()}
                </p>
                <p className="text-xs" style={{ color: "var(--text-400)" }}>
                  Every Monday · Full wallet balance
                </p>
              </div>

              {/* Current balance */}
              <div className="rounded-xl px-4 py-3"
                style={available < 0
                  ? { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }
                  : { background: "rgba(0,198,122,0.08)", border: "1px solid rgba(0,198,122,0.2)" }}>
                <p className="text-xs" style={{ color: "var(--text-400)" }}>
                  {available < 0 ? "Wallet deficit" : "Balance to be paid out"}
                </p>
                <p className="text-2xl font-bold mt-0.5"
                  style={{ color: available < 0 ? "#EF4444" : "#00C67A" }}>
                  {loading ? "—" : `${available < 0 ? "-" : ""}₹${fmt(available)}`}
                </p>
              </div>

              {/* Bank account */}
              {bank?.bankAccount ? (
                <div className="rounded-xl px-4 py-3 space-y-1"
                  style={{ background: "var(--bg-muted)", border: "1px solid var(--border)" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-300)" }}>
                    Payout destination
                  </p>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-900)" }}>
                    {bank.bankHolder ?? "—"}
                  </p>
                  <p className="text-xs font-mono" style={{ color: "var(--text-400)" }}>
                    {maskAccount(bank.bankAccount)} · {bank.bankIfsc ?? "—"}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl px-4 py-3 flex items-start gap-2"
                  style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
                  <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#D97706" }} />
                  <p className="text-xs" style={{ color: "#92400E" }}>
                    No bank account set. Go to Profile → Bank Details to add your account so we can send your weekly payout.
                  </p>
                </div>
              )}

              <p className="text-xs leading-relaxed" style={{ color: "var(--text-400)" }}>
                Your entire wallet balance is automatically transferred to your bank account every Monday by end of day. No action required.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
