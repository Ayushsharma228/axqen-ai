"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Wallet, Clock, CheckCircle2, ArrowUpRight, ArrowDownRight, Copy, CopyCheck, Download,
  ChevronDown, ChevronUp, Loader2, Truck, CalendarClock, Landmark, RotateCcw, ChevronRight, Info,
} from "lucide-react";
import { SettlementsPanel } from "@/components/wallet/settlements-panel";

// ── Types ──────────────────────────────────────────────────────────────────
interface Payout {
  id: string; status: "PAID" | "SCHEDULED"; date: string; bankRef: string | null; note: string | null;
  orders: number; gross: number | null; productCost: number | null; shipping: number | null; packing: number | null;
  credit: number; rtoOrders: number; rtoDeduction: number; net: number;
  held: number; released: number;
}
interface Overview {
  pipeline: {
    awaiting: { count: number; amount: number; costsKnown: boolean };
    rtoPending: { count: number; amount: number };
    scheduled: { count: number; amount: number; nextDate: string | null };
    paid: { count: number; amount: number; lastDate: string | null };
    onHold?: { amount: number };
  };
  payouts: Payout[];
  bank: { holder: string | null; account: string | null; ifsc: string | null };
}
interface StatementOrder {
  id: string; externalOrderId: string; customerName: string | null; paymentMode: string; createdAt: string;
  totalAmount: number; productCost: number | null; shippingCharge: number | null; packingCharge: number | null; rtoCharge: number | null;
}
interface StatementPayout {
  id: string; status: "PAID" | "SCHEDULED"; date: string; bankRef: string | null; note: string | null;
  credit: number; rtoDeduction: number; net: number; held: number;
  released: { amount: number; at: string | null; ref: string | null } | null;
}
interface Statement { payout: StatementPayout; orders: StatementOrder[]; rtoOrders: StatementOrder[] }
interface Transaction { id: string; type: string; amount: number; note: string | null; remittanceDate: string | null; bankTxId: string | null; createdAt: string }

const inr = (n: number) => (n < 0 ? "−₹" : "₹") + Math.abs(Math.round(n)).toLocaleString("en-IN");
const fmtD = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const n0 = (v: number | null | undefined) => v ?? 0;

type Tab = "payouts" | "orders" | "transactions" | "amazon";

export default function SellerWalletPage() {
  const [tab, setTab] = useState<Tab>("payouts");
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [statements, setStatements] = useState<Record<string, Statement>>({});
  const [txns, setTxns] = useState<Transaction[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/seller/payouts").then(r => r.json()).then(d => setData(d)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab !== "transactions" || txns) return;
    fetch("/api/seller/wallet").then(r => r.json()).then(d => setTxns(d.transactions ?? [])).catch(() => setTxns([]));
  }, [tab, txns]);

  const toggle = useCallback((id: string) => {
    setOpen(o => (o === id ? null : id));
    if (!statements[id]) {
      fetch(`/api/seller/payouts/${id}`).then(r => r.json()).then(d => { if (d.payout) setStatements(s => ({ ...s, [id]: d })); }).catch(() => {});
    }
  }, [statements]);

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  function downloadStatement(st: Statement) {
    const rows: (string | number)[][] = [
      ["Payout", st.payout.status === "PAID" ? "Paid" : "Scheduled", fmtD(st.payout.date), st.payout.bankRef ?? ""],
      [],
      ["Order", "Customer", "Payment", "Order value", "Product cost (supplier)", "Shipping (courier)", "Packing", "Net to you"],
      ...st.orders.map(o => [o.externalOrderId, o.customerName ?? "", o.paymentMode, o.totalAmount, n0(o.productCost), n0(o.shippingCharge), n0(o.packingCharge),
        o.totalAmount - n0(o.productCost) - n0(o.shippingCharge) - n0(o.packingCharge)]),
      ...(st.rtoOrders.length ? [[], ["Returned (RTO) order", "Customer", "", "", "Product cost", "Return shipping", "Packing", "Deducted"],
        ...st.rtoOrders.map(o => [o.externalOrderId, o.customerName ?? "", "", "", n0(o.productCost), n0(o.rtoCharge), n0(o.packingCharge),
          -(n0(o.productCost) + n0(o.rtoCharge) + n0(o.packingCharge))])] : []),
      [],
      ["Remittance", st.payout.credit], ["RTO deduction", -st.payout.rtoDeduction], ["Net payout", st.payout.net],
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `axqen-payout-${st.payout.date.slice(0, 10)}.csv`;
    a.click();
  }

  const p = data?.pipeline;
  const negative = (p?.scheduled.amount ?? 0) < 0;

  const tabs: { key: Tab; label: string; soon?: boolean }[] = [
    { key: "payouts", label: "Payouts" },
    { key: "orders", label: "Order breakdown" },
    { key: "transactions", label: "Transactions" },
    { key: "amazon", label: "Amazon payouts", soon: true },
  ];

  return (
    <div className="px-3 py-4 md:p-8 space-y-5" style={{ background: "#F7F8FC", minHeight: "100vh" }}>
      <div>
        <h1 className="text-[22px] font-black text-[#0C1220]">Wallet &amp; Payouts</h1>
        <p className="text-[12.5px] text-[#6B7280] mt-1">Where your money is right now, when it reaches your bank, and exactly what was deducted from each payout and for whom.</p>
      </div>

      {/* Money pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch gap-2">
        {[
          {
            icon: Truck, color: "#B45309", label: "Delivered, awaiting payout",
            value: p ? inr(p.awaiting.amount) : "…",
            sub: p ? `${p.awaiting.count} order${p.awaiting.count === 1 ? "" : "s"} · ${p.awaiting.costsKnown ? "estimate" : "estimate, costs not final"}` : "",
          },
          null,
          {
            icon: CalendarClock, color: "#4361EE", label: "Next payout",
            value: p ? inr(p.scheduled.amount) : "…",
            sub: p ? (p.scheduled.nextDate
              ? (new Date(p.scheduled.nextDate).getTime() < Date.now() - 86400000 ? `Overdue since ${fmtD(p.scheduled.nextDate)}` : `Expected ${fmtD(p.scheduled.nextDate)}`)
              : p.scheduled.count ? "Date to be confirmed" : "Nothing scheduled yet") : "",
          },
          null,
          {
            icon: Landmark, color: "#047857", label: "Paid to your bank",
            value: p ? inr(p.paid.amount) : "…",
            sub: p ? (p.paid.lastDate ? `Last payout ${fmtD(p.paid.lastDate)}` : "No payouts yet") : "",
          },
        ].map((c, i) => c ? (
          <div key={c.label} className="bg-white rounded-xl border border-[#E8EDF6] px-4 py-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{c.label}</p>
              <c.icon className="w-4 h-4" style={{ color: c.color }} />
            </div>
            <p className="text-[24px] font-black leading-none tabular-nums" style={{ color: c.label === "Next payout" && negative ? "#DC2626" : "#0C1220" }}>{loading ? "…" : c.value}</p>
            <p className="text-[11.5px] mt-1.5" style={{ color: c.sub.startsWith("Overdue") ? "#B45309" : "#9CA3AF", fontWeight: c.sub.startsWith("Overdue") ? 600 : 400 }}>{c.sub}</p>
          </div>
        ) : (
          <div key={i} className="hidden md:flex items-center justify-center text-[#C4C9D4]"><ChevronRight className="w-5 h-5" /></div>
        ))}
      </div>

      {p?.onHold && p.onHold.amount > 0 && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-[12.5px] bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B]">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#DC2626]" />
          <span>
            <b>{inr(p.onHold.amount)} of your payouts is on hold</b> because your plan payment is pending. Pay your plan due and the held amount is released in a payout.{" "}
            <Link href="/seller/documents" className="font-semibold underline">See plan payments</Link>
          </span>
        </div>
      )}
      {p && ((p.rtoPending.count > 0 && p.rtoPending.amount > 0) || negative) && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-[12.5px] bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E]">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#D97706]" />
          <span>
            {p.rtoPending.count > 0 && p.rtoPending.amount > 0 && <>{p.rtoPending.count} returned (RTO) order{p.rtoPending.count === 1 ? "" : "s"} worth about <b>{inr(p.rtoPending.amount)}</b> (product cost, return shipping and packing) will be deducted in your next payout. </>}
            {negative && <>Your next payout is negative: returns cost more than this cycle&apos;s deliveries. The difference is adjusted from your following payouts.</>}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
        <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden min-w-0">
          {/* Tabs */}
          <div className="flex items-center border-b border-[#F3F4F6] overflow-x-auto px-2" style={{ scrollbarWidth: "none" }}>
            {tabs.map(t => (
              <button key={t.key} disabled={t.soon} onClick={() => setTab(t.key)}
                title={t.soon ? "Coming soon: Amazon payouts, fees and tax withheld, once the Amazon app is approved" : undefined}
                className="px-3 md:px-4 py-3 text-[13px] font-semibold whitespace-nowrap flex-shrink-0 border-b-2 -mb-px disabled:cursor-default"
                style={{ borderColor: tab === t.key ? "#4361EE" : "transparent", color: t.soon ? "#C4C9D4" : tab === t.key ? "#4361EE" : "#6B7280" }}>
                {t.label}
                {t.soon && <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#F3F4F6] text-[#6B7280] align-middle">SOON</span>}
              </button>
            ))}
          </div>

          {/* Payouts */}
          {tab === "payouts" && (
            loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[#9CA3AF]"><Loader2 className="w-5 h-5 animate-spin text-[#4361EE]" /> Loading payouts…</div>
            ) : !data?.payouts.length ? (
              <div className="py-16 text-center px-4">
                <Wallet className="w-10 h-10 mx-auto text-[#E8EDF6]" />
                <p className="text-[13px] font-semibold text-[#6B7280] mt-2">No payouts yet</p>
                <p className="text-[12px] text-[#9CA3AF] mt-1">Delivered orders are added to a payout once their costs are confirmed.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#F3F4F6]">
                {data.payouts.map(po => {
                  const isOpen = open === po.id;
                  const st = statements[po.id];
                  return (
                    <li key={po.id}>
                      <button onClick={() => toggle(po.id)} className="w-full text-left px-4 md:px-5 py-3.5 flex items-center gap-4 hover:bg-[#FAFBFF]">
                        <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: po.status === "PAID" ? "#ECFDF5" : "#EEF2FF" }}>
                          {po.status === "PAID" ? <CheckCircle2 className="w-4 h-4 text-[#047857]" /> : <Clock className="w-4 h-4 text-[#4361EE]" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13.5px] font-semibold text-[#0C1220]">
                            {po.status === "PAID" ? "Paid" : "Scheduled"} · {fmtD(po.date)}
                          </p>
                          <p className="text-[11.5px] text-[#9CA3AF] mt-0.5 truncate">
                            {po.orders ? `${po.orders} delivered order${po.orders === 1 ? "" : "s"}` : po.note ?? "Remittance"}
                            {po.rtoOrders ? ` · ${po.rtoOrders} RTO deducted` : ""}
                            {po.bankRef ? ` · Ref ${po.bankRef}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[15px] font-black tabular-nums" style={{ color: po.net < 0 ? "#DC2626" : "#0C1220" }}>{inr(po.net)}</p>
                          {po.rtoDeduction > 0 && <p className="text-[11px] text-[#9CA3AF] tabular-nums">{inr(po.credit)} − {inr(po.rtoDeduction)}</p>}
                          {po.held > 0 && <p className="text-[11px] font-semibold text-[#DC2626] tabular-nums">{inr(po.held)} on hold</p>}
                          {po.released > 0 && <p className="text-[11px] font-semibold text-[#047857] tabular-nums">{inr(po.released)} released later</p>}
                        </div>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-[#9CA3AF]" /> : <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />}
                      </button>

                      {isOpen && (
                        <div className="px-4 md:px-5 pb-5 pt-1 bg-[#FAFBFF] border-t border-[#F3F4F6]">
                          {!st ? (
                            <div className="flex items-center gap-2 py-6 text-[12.5px] text-[#9CA3AF]"><Loader2 className="w-4 h-4 animate-spin" /> Loading statement…</div>
                          ) : (
                            <StatementView st={st} onDownload={() => downloadStatement(st)} copied={copied === po.id} onCopy={() => st.payout.bankRef && copy(st.payout.bankRef, po.id)} />
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )
          )}

          {/* Order breakdown (former My Settlements page) */}
          {tab === "orders" && <div className="p-4 md:p-5"><SettlementsPanel embedded /></div>}

          {/* Transactions ledger */}
          {tab === "transactions" && (
            !txns ? (
              <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[#9CA3AF]"><Loader2 className="w-5 h-5 animate-spin text-[#4361EE]" /> Loading transactions…</div>
            ) : txns.length === 0 ? (
              <p className="py-16 text-center text-[13px] text-[#9CA3AF]">No transactions yet</p>
            ) : (
              <ul className="divide-y divide-[#F3F4F6]">
                {txns.filter(t => t.amount > 0).map(t => {
                  const credit = t.type === "CREDIT";
                  return (
                    <li key={t.id} className="px-4 md:px-5 py-3 flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: credit ? "#ECFDF5" : "#FEF2F2" }}>
                        {credit ? <ArrowDownRight className="w-4 h-4 text-[#047857]" /> : <ArrowUpRight className="w-4 h-4 text-[#DC2626]" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#0C1220] truncate">{t.note || (credit ? "Remittance" : "Deduction")}</p>
                        <p className="text-[11.5px] text-[#9CA3AF]">
                          {fmtD(t.remittanceDate ?? t.createdAt)}{t.bankTxId ? ` · Paid · Ref ${t.bankTxId}` : credit ? " · Scheduled" : ""}
                        </p>
                      </div>
                      <p className="text-[13.5px] font-bold tabular-nums" style={{ color: credit ? "#047857" : "#DC2626" }}>{credit ? "+" : "−"}{inr(t.amount).replace("−", "")}</p>
                    </li>
                  );
                })}
              </ul>
            )
          )}
        </div>

        {/* Side: bank + Amazon */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#E8EDF6] p-4 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">Payout account</p>
            {data?.bank.account ? (
              <div>
                <p className="text-[14px] font-semibold text-[#0C1220]">{data.bank.holder ?? "—"}</p>
                <p className="text-[12.5px] font-mono text-[#6B7280] mt-0.5">{data.bank.account} · {data.bank.ifsc ?? "—"}</p>
              </div>
            ) : (
              <p className="text-[12.5px] text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2">
                No bank account added yet. <Link href="/seller/profile" className="font-semibold underline">Add it in Profile</Link> so we can send your payouts.
              </p>
            )}
            <p className="text-[12px] text-[#6B7280] leading-relaxed">
              Each payout covers orders delivered since the last one, minus product cost, shipping and packing, and minus any returned (RTO) orders. Open a payout to see every order in it.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-dashed border-[#E8EDF6] p-4">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold text-[#9CA3AF]">Amazon payouts</p>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#F3F4F6] text-[#6B7280]">SOON</span>
            </div>
            <p className="text-[12px] text-[#9CA3AF] mt-1.5">
              Amazon pays you directly. Soon you&apos;ll see each Amazon payout here, with every Amazon fee, refund and tax withheld, order by order.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatementView({ st, onDownload, copied, onCopy }: { st: Statement; onDownload: () => void; copied: boolean; onCopy: () => void }) {
  const [showOrders, setShowOrders] = useState(false);
  const sum = (k: keyof StatementOrder, list = st.orders) => list.reduce((s, o) => s + (Number(o[k]) || 0), 0);
  const gross = sum("totalAmount"), product = sum("productCost"), ship = sum("shippingCharge"), pack = sum("packingCharge");
  const rtoProduct = sum("productCost", st.rtoOrders), rtoShip = sum("rtoCharge", st.rtoOrders), rtoPack = sum("packingCharge", st.rtoOrders);
  const linked = st.orders.length > 0;

  const lines: { label: string; amount: number; to: string; strong?: boolean }[] = linked ? [
    { label: `Order value collected (${st.orders.length} delivered)`, amount: gross, to: "" },
    { label: "Product cost", amount: -product, to: "Supplier" },
    { label: "Shipping", amount: -ship, to: "Courier" },
    { label: "Packing", amount: -pack, to: "Fulfilment" },
  ] : [{ label: st.payout.note || "Remittance", amount: st.payout.credit, to: "" }];
  if (st.payout.rtoDeduction > 0) {
    if (st.rtoOrders.length) {
      lines.push({ label: `Returned orders: product cost (${st.rtoOrders.length} RTO)`, amount: -rtoProduct, to: "Supplier" });
      lines.push({ label: "Returned orders: return shipping", amount: -rtoShip, to: "Courier" });
      if (rtoPack) lines.push({ label: "Returned orders: packing", amount: -rtoPack, to: "Fulfilment" });
    } else {
      lines.push({ label: "RTO deduction", amount: -st.payout.rtoDeduction, to: "Supplier & courier" });
    }
  }
  if (st.payout.held > 0) lines.push({ label: "Held for pending plan due", amount: -st.payout.held, to: "On hold" });
  if (st.payout.released) lines.push({ label: "Held for plan due (released later)", amount: -st.payout.released.amount, to: "Released" });
  const heldTotal = st.payout.held + (st.payout.released?.amount ?? 0);
  lines.push({ label: st.payout.status === "PAID" ? "Paid to you" : "To be paid to you", amount: st.payout.net - heldTotal, to: "You", strong: true });

  return (
    <div className="space-y-4 pt-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[12.5px] text-[#6B7280]">
          {st.payout.status === "PAID" ? "Sent" : "Expected"} {fmtD(st.payout.date)}
          {st.payout.bankRef && (
            <> · Bank ref <span className="font-mono text-[#0C1220]">{st.payout.bankRef}</span>
              <button onClick={onCopy} className="ml-1 align-middle" aria-label="Copy bank reference">
                {copied ? <CopyCheck className="w-3.5 h-3.5 inline text-[#047857]" /> : <Copy className="w-3.5 h-3.5 inline text-[#9CA3AF]" />}
              </button></>
          )}
        </p>
        <button onClick={onDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-white border border-[#E8EDF6] text-[#374151] hover:text-[#0C1220]">
          <Download className="w-3.5 h-3.5" /> Download statement
        </button>
      </div>

      <div className="bg-white rounded-lg border border-[#E8EDF6] overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-[#FAFBFF] text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">
              <th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Goes to</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {lines.map((l, i) => (
              <tr key={i} className={l.strong ? "bg-[#F0FDF4]" : ""}>
                <td className={`px-3 py-2 ${l.strong ? "font-bold text-[#0C1220]" : "text-[#374151]"}`}>{l.label}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${l.strong ? "font-black" : "font-semibold"}`} style={{ color: l.amount < 0 ? "#DC2626" : "#0C1220" }}>{inr(l.amount)}</td>
                <td className={`px-3 py-2 ${l.strong ? "font-bold text-[#047857]" : "text-[#6B7280]"}`}>{l.to}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {st.payout.released && (
        <p className="text-[12px] text-[#047857] bg-[#ECFDF5] rounded-lg px-3 py-2">
          {inr(st.payout.released.amount)} that was held was sent to your bank{st.payout.released.at ? ` on ${fmtD(st.payout.released.at)}` : ""}{st.payout.released.ref ? ` (ref ${st.payout.released.ref})` : ""}.
        </p>
      )}
      {(st.orders.length > 0 || st.rtoOrders.length > 0) && (
        <div>
          <button onClick={() => setShowOrders(v => !v)} className="flex items-center gap-1 text-[12.5px] font-semibold text-[#4361EE]">
            {showOrders ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showOrders ? "Hide" : "Show"} the {st.orders.length + st.rtoOrders.length} orders in this payout
          </button>
          {showOrders && (
            <div className="mt-2 overflow-x-auto bg-white rounded-lg border border-[#E8EDF6]">
              <table className="w-full min-w-[620px] text-[12px]">
                <thead>
                  <tr className="bg-[#FAFBFF] text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                    <th className="px-3 py-2">Order</th><th className="px-3 py-2 text-right">Value</th><th className="px-3 py-2 text-right">Product</th>
                    <th className="px-3 py-2 text-right">Shipping</th><th className="px-3 py-2 text-right">Packing</th><th className="px-3 py-2 text-right">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {st.orders.map(o => {
                    const net = o.totalAmount - n0(o.productCost) - n0(o.shippingCharge) - n0(o.packingCharge);
                    return (
                      <tr key={o.id}>
                        <td className="px-3 py-2"><Link href={`/seller/orders/${o.id}`} className="font-semibold text-[#4361EE] hover:underline">#{o.externalOrderId}</Link> <span className="text-[#9CA3AF]">{o.paymentMode === "PREPAID" ? "Prepaid" : "COD"}</span></td>
                        <td className="px-3 py-2 text-right tabular-nums">{inr(o.totalAmount)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-[#DC2626]">{inr(-n0(o.productCost))}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-[#DC2626]">{inr(-n0(o.shippingCharge))}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-[#DC2626]">{inr(-n0(o.packingCharge))}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold">{inr(net)}</td>
                      </tr>
                    );
                  })}
                  {st.rtoOrders.map(o => {
                    const ded = n0(o.productCost) + n0(o.rtoCharge) + n0(o.packingCharge);
                    return (
                      <tr key={o.id} className="bg-[#FFFBFB]">
                        <td className="px-3 py-2"><Link href={`/seller/orders/${o.id}`} className="font-semibold text-[#4361EE] hover:underline">#{o.externalOrderId}</Link> <span className="inline-flex items-center gap-0.5 text-[#B45309]"><RotateCcw className="w-3 h-3" /> RTO</span></td>
                        <td className="px-3 py-2 text-right tabular-nums text-[#9CA3AF]">—</td>
                        <td className="px-3 py-2 text-right tabular-nums text-[#DC2626]">{inr(-n0(o.productCost))}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-[#DC2626]">{inr(-n0(o.rtoCharge))}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-[#DC2626]">{inr(-n0(o.packingCharge))}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold text-[#DC2626]">{inr(-ded)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

