"use client";

import { useState, useEffect } from "react";
import { Megaphone, Plus, Trash2, Loader2, IndianRupee, RefreshCw, ChevronDown, ChevronUp, Check } from "lucide-react";
import { AdRechargesPanel } from "@/components/admin/ad-recharges-panel";

interface Seller { id: string; name: string | null; email: string; brandName: string | null; }
interface Entry {
  id: string;
  sellerId: string;
  date: string;
  amount: number;
  note: string | null;
  seller: Seller;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

interface MetaCampaign { id: string; name: string; spend: number; }

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

export default function AdminAdSpendPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [sellerId, setSellerId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  // Meta sync state
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncFrom, setSyncFrom] = useState(yesterday());
  const [syncTo, setSyncTo]     = useState(yesterday());
  const [syncing, setSyncing]   = useState(false);
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [mappings, setMappings]   = useState<Record<string, string>>({});
  const [syncError, setSyncError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/ad-spend").then(r => r.json()),
      fetch("/api/admin/sellers").then(r => r.json()),
      fetch("/api/admin/meta/campaign-mappings").then(r => r.json()),
    ]).then(([ads, s, cm]) => {
      setEntries(ads.entries || []);
      const sellerList = (s.sellers || []).filter((x: Seller & { role?: string }) => x);
      setSellers(sellerList);
      if (sellerList.length > 0) setSellerId(sellerList[0].id);
      setMappings(cm.mappings || {});
      setLoading(false);
    });
  }, []);

  async function handleMetaSync() {
    setSyncing(true);
    setSyncError("");
    setCampaigns([]);
    setImportResult("");
    const res = await fetch(`/api/admin/meta/insights?from=${syncFrom}&to=${syncTo}`);
    const data = await res.json();
    if (!res.ok) { setSyncError(data.error || "Failed to fetch Meta data"); setSyncing(false); return; }
    setCampaigns(data.campaigns || []);
    setSyncing(false);
  }

  async function handleSaveMappings() {
    await fetch("/api/admin/meta/campaign-mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mappings }),
    });
  }

  async function handleImport() {
    setImporting(true);
    setImportResult("");
    const toImport = campaigns.filter(c => mappings[c.id] && c.spend > 0);
    if (toImport.length === 0) { setImportResult("No campaigns mapped to sellers."); setImporting(false); return; }

    await handleSaveMappings();

    let saved = 0;
    for (const c of toImport) {
      const res = await fetch("/api/admin/ad-spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerId: mappings[c.id],
          date: syncFrom === syncTo ? syncFrom : syncTo,
          amount: c.spend,
          note: `Meta: ${c.name} (${syncFrom} – ${syncTo})`,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setEntries(prev => [d.entry, ...prev]);
        saved++;
      }
    }
    setImportResult(`Imported ${saved} of ${toImport.length} campaigns.`);
    setImporting(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/admin/ad-spend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sellerId, date, amount, note }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed to save"); setSaving(false); return; }
    setEntries(prev => [data.entry, ...prev]);
    setAmount(""); setNote("");
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    await fetch("/api/admin/ad-spend", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setEntries(prev => prev.filter(e => e.id !== id));
    setDeleting(null);
  }

  const totalSpend = entries.reduce((s, e) => s + e.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
          <Megaphone className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Meta Ads Spend</h1>
          <p className="text-sm text-gray-500">Log ad spend per seller per date</p>
        </div>
        <div className="ml-auto bg-purple-50 border border-purple-100 rounded-xl px-4 py-2 text-right">
          <p className="text-xs text-purple-500 font-medium">Total Logged</p>
          <p className="text-lg font-bold text-purple-700">₹{fmt(totalSpend)}</p>
        </div>
      </div>

      {/* Sync from Meta panel */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <button
          onClick={() => setSyncOpen(p => !p)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-bold text-gray-700">Sync from Meta Ads</span>
            <span className="text-xs text-gray-400 ml-1">Auto-pull campaign spend from your Meta ad account</span>
          </div>
          {syncOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {syncOpen && (
          <div className="px-5 pb-5 border-t border-gray-100 space-y-4 pt-4">
            {/* Date range + fetch */}
            <div className="flex items-end gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">From</label>
                <input type="date" value={syncFrom} onChange={e => setSyncFrom(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">To</label>
                <input type="date" value={syncTo} onChange={e => setSyncTo(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <button
                onClick={handleMetaSync}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
                style={{ background: "#1877F2", color: "var(--text-primary)" }}
              >
                {syncing ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching...</> : <><RefreshCw className="w-4 h-4" /> Fetch Campaigns</>}
              </button>
            </div>

            {syncError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{syncError}</div>
            )}

            {/* Campaign → Seller mapping table */}
            {campaigns.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {campaigns.length} campaigns found — assign each to a seller
                </p>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 font-semibold uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-2.5 text-left">Campaign</th>
                        <th className="px-4 py-2.5 text-right">Spend</th>
                        <th className="px-4 py-2.5 text-left">Assign to Seller</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {campaigns.map(c => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-gray-700 font-medium max-w-xs truncate">{c.name}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-purple-700">₹{fmt(c.spend)}</td>
                          <td className="px-4 py-2.5">
                            <select
                              value={mappings[c.id] || ""}
                              onChange={e => setMappings(prev => ({ ...prev, [c.id]: e.target.value }))}
                              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                            >
                              <option value="">— Skip —</option>
                              {sellers.map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.brandName || s.name || s.email}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between">
                  {importResult && (
                    <span className="text-sm text-green-600 flex items-center gap-1">
                      <Check className="w-4 h-4" /> {importResult}
                    </span>
                  )}
                  <button
                    onClick={handleImport}
                    disabled={importing || campaigns.every(c => !mappings[c.id])}
                    className="ml-auto flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
                    style={{ background: "#16A34A", color: "var(--text-primary)" }}
                  >
                    {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</> : <><Check className="w-4 h-4" /> Import to Ledger</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add entry form */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Entry
        </h2>
        {error && (
          <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <form onSubmit={handleAdd} className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Seller</label>
            <select
              value={sellerId}
              onChange={e => setSellerId(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {sellers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.brandName || s.name || s.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Amount (₹)</label>
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-transparent">
              <span className="px-3 py-2 bg-gray-50 border-r border-gray-200">
                <IndianRupee className="w-4 h-4 text-gray-400" />
              </span>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
                required
                className="flex-1 px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Diwali campaign"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={saving || !sellerId || !amount}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
              style={{ background: "#7C3AED", color: "var(--text-primary)" }}
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Plus className="w-4 h-4" /> Add Entry</>}
            </button>
          </div>
        </form>
      </div>

      {/* Entries table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-700">{entries.length} Entries</h2>
        </div>
        {entries.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">No entries yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 font-semibold uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3 text-left">Date</th>
                <th className="px-5 py-3 text-left">Seller</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-left">Note</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-gray-700 font-medium">
                    {new Date(e.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-5 py-3 text-gray-700">
                    {e.seller.brandName || e.seller.name || e.seller.email}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-purple-700">
                    ₹{fmt(e.amount)}
                  </td>
                  <td className="px-5 py-3 text-gray-400">{e.note || "—"}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleDelete(e.id)}
                      disabled={deleting === e.id}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {deleting === e.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AdRechargesPanel sellers={sellers} />
    </div>
  );
}
