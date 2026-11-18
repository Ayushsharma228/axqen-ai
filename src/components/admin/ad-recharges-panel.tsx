"use client";

import { useState, useEffect, useCallback } from "react";
import { Wallet, Loader2, Trash2, Plus } from "lucide-react";

interface Seller { id: string; name: string | null; brandName?: string | null; email: string }
interface Recharge {
  id: string; date: string; amount: number; note: string | null; razorpayPaymentId: string | null;
  seller: { id: string; name: string | null; brandName: string | null; email: string };
}

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

/** Admin: record the ad wallet top-ups sellers pay to AXQEN. */
export function AdRechargesPanel({ sellers }: { sellers: Seller[] }) {
  const [rows, setRows] = useState<Recharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellerId, setSellerId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/ad-spend/recharges").then(r => r.json()).then(d => setRows(d.recharges ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const res = await fetch("/api/admin/ad-spend/recharges", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sellerId, date, amount, note }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(d.error ?? "Couldn't save"); return; }
    setAmount(""); setNote("");
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this recharge? The seller's ad wallet balance will drop.")) return;
    const res = await fetch("/api/admin/ad-spend/recharges", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (res.ok) load();
    else setError((await res.json().catch(() => ({}))).error ?? "Couldn't delete");
  }

  const input = "px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Wallet className="w-4 h-4 text-blue-600" />
        <h2 className="text-sm font-bold text-gray-800">Ad wallet recharges</h2>
      </div>
      <p className="text-xs text-gray-500">Record every top-up a seller pays for ads. Their Ad Spend page shows balance = recharges − spend, and warns them when it runs low.</p>

      <form onSubmit={add} className="grid grid-cols-1 md:grid-cols-[1.4fr_0.9fr_0.8fr_1.4fr_auto] gap-2">
        <select id="recharge-seller" aria-label="Seller" required value={sellerId} onChange={e => setSellerId(e.target.value)} className={input}>
          <option value="">Select seller</option>
          {sellers.map(s => <option key={s.id} value={s.id}>{s.brandName || s.name || s.email}</option>)}
        </select>
        <input id="recharge-date" aria-label="Date" type="date" required value={date} onChange={e => setDate(e.target.value)} className={input} />
        <input id="recharge-amount" aria-label="Amount" inputMode="decimal" required placeholder="Amount ₹" value={amount} onChange={e => setAmount(e.target.value)} className={input} />
        <input id="recharge-note" aria-label="Note" placeholder="UPI / bank ref (optional)" value={note} onChange={e => setNote(e.target.value)} className={input} />
        <button type="submit" disabled={saving} className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
        </button>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-gray-400 py-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">No recharges recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Seller</th><th className="py-2 pr-3 text-right">Amount</th><th className="py-2 pr-3">Note</th><th className="py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">{new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="py-2 pr-3 text-gray-800">{r.seller.brandName || r.seller.name || r.seller.email}</td>
                  <td className="py-2 pr-3 text-right font-semibold text-green-700 tabular-nums">{inr(r.amount)}</td>
                  <td className="py-2 pr-3 text-gray-500 text-xs">{r.razorpayPaymentId ? "Online payment" : r.note ?? "—"}</td>
                  <td className="py-2 text-right">
                    {!r.razorpayPaymentId && (
                      <button onClick={() => remove(r.id)} aria-label="Delete recharge" className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
