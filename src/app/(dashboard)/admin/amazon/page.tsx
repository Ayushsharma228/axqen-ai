"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { RefreshCw, Link2, Link2Off, AlertCircle, CheckCircle, Loader2, Search } from "lucide-react";
import { MARKETPLACE_IDS } from "@/lib/amazon-sp";

interface Account {
  id:                  string;
  sellerId:            string;
  sellerName:          string | null;
  sellerEmail:         string;
  brandName:           string | null;
  amazonSellerId?:     string;
  marketplaceCountry?: string;
  connectedAt?:        string;
  lastSyncAt?:         string | null;
  isActive:            boolean;
  orderCount:          number;
}

function fmt(n: number) { return new Intl.NumberFormat("en-IN").format(n); }

export default function AdminAmazonPage() {
  const [accounts, setAccounts]             = useState<Account[]>([]);
  const [totalOrders, setTotalOrders]       = useState(0);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState("");
  const [syncing, setSyncing]               = useState<string | null>(null); // sellerId or "all"
  const [error, setError]                   = useState("");
  const [successMsg, setSuccessMsg]         = useState("");

  // Connect-on-behalf form
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [targetEmail, setTargetEmail]         = useState("");
  const [sellerIdInput, setSellerIdInput]     = useState("");
  const [mpCountry, setMpCountry]             = useState("IN");
  const [rtInput, setRtInput]                 = useState("");
  const [connecting, setConnecting]           = useState(false);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const res  = await fetch("/api/admin/amazon");
    const data = await res.json() as { accounts?: Account[]; totalAmazonOrders?: number };
    setAccounts(data.accounts ?? []);
    setTotalOrders(data.totalAmazonOrders ?? 0);
    setLoading(false);
  }

  async function handleSync(sellerId: string | "all") {
    setSyncing(sellerId); setError(""); setSuccessMsg("");
    const body = sellerId === "all"
      ? { all: true }
      : { sellerId };
    const res  = await fetch("/api/admin/amazon/sync", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    const data = await res.json() as { ok?: boolean; error?: string; created?: number; updated?: number; errors?: number; results?: { sellerId: string; created: number }[] };
    if (!res.ok) {
      setError(data.error ?? "Sync failed");
    } else if (data.results) {
      const total = data.results.reduce((s, r) => s + (r.created ?? 0), 0);
      setSuccessMsg(`Sync complete — ${total} new orders across ${data.results.length} sellers.`);
    } else {
      setSuccessMsg(`Sync complete — ${data.created} new, ${data.updated} updated.`);
    }
    setSyncing(null);
    await fetchData();
  }

  async function handleDisconnect(sellerId: string, sellerName: string | null) {
    if (!confirm(`Disconnect Amazon for ${sellerName ?? sellerId}? Orders already synced will remain.`)) return;
    await fetch(`/api/seller/amazon/disconnect?sellerId=${sellerId}`, { method: "DELETE" });
    await fetchData();
  }

  async function handleConnectForSeller(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccessMsg("");
    const user = await fetch(`/api/admin/users?search=${encodeURIComponent(targetEmail)}`).then((r) => r.json()).then((d) => d.users?.[0]);
    if (!user) { setError("Seller not found with that email"); return; }
    setConnecting(true);
    const res  = await fetch("/api/seller/amazon/connect", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ sellerId: sellerIdInput, marketplaceCountry: mpCountry, refreshToken: rtInput, targetSellerId: user.id }),
    });
    const data = await res.json() as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) { setError(data.error ?? "Failed"); setConnecting(false); return; }
    setSuccessMsg(`Connected Amazon for ${targetEmail}`);
    setShowConnectForm(false); setTargetEmail(""); setSellerIdInput(""); setRtInput("");
    setConnecting(false);
    await fetchData();
  }

  const filtered = accounts.filter((a) => {
    const q = search.toLowerCase();
    return !q
      || a.sellerName?.toLowerCase().includes(q)
      || a.sellerEmail.toLowerCase().includes(q)
      || a.brandName?.toLowerCase().includes(q)
      || a.amazonSellerId?.toLowerCase().includes(q);
  });

  const stale = (iso?: string | null) => !iso || Date.now() - new Date(iso).getTime() > 24 * 3600000;
  const input = "w-full px-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE]";
  const label = "block text-[11.5px] font-semibold text-[#374151] mb-1";
  const staleCount = accounts.filter(a => a.isActive && stale(a.lastSyncAt)).length;
  const tiles = [
    { label: "Connected sellers", value: accounts.length, tone: "#0C1220" },
    { label: "Active connections", value: accounts.filter(a => a.isActive).length, tone: "#047857" },
    { label: "Amazon orders", value: totalOrders, tone: "#0C1220" },
    { label: "Not synced in 24h", value: staleCount, tone: staleCount ? "#B45309" : "#0C1220" },
  ];

  return (
    <div className="px-4 py-5 md:p-8 space-y-5" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-black text-[#0C1220]">Amazon</h1>
          <p className="text-[12.5px] text-[#6B7280] mt-1">Sellers&apos; Amazon Seller Central connections. Orders sync automatically; sync here to pull them now.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowConnectForm(p => !p)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold border border-[#E8EDF6] bg-white text-[#374151] hover:border-[#C7D2FE]">
            <Link2 className="w-3.5 h-3.5" /> Connect for a seller
          </button>
          <button onClick={() => handleSync("all")} disabled={syncing !== null || accounts.length === 0} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold text-white bg-[#4361EE] disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing === "all" ? "animate-spin" : ""}`} /> {syncing === "all" ? "Syncing all…" : "Sync all"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map(t => (
          <div key={t.label} className="bg-white rounded-xl border border-[#E8EDF6] p-4">
            <p className="text-[11.5px] font-semibold text-[#6B7280]">{t.label}</p>
            <p className="text-[26px] font-black leading-tight tabular-nums mt-1" style={{ color: t.tone }}>{fmt(t.value)}</p>
          </div>
        ))}
      </div>

      {error && <div className="flex items-start gap-2 px-4 py-2.5 rounded-xl text-[13px] bg-[#FEF2F2] text-[#B91C1C]"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}</div>}
      {successMsg && <div className="flex items-start gap-2 px-4 py-2.5 rounded-xl text-[13px] bg-[#ECFDF5] text-[#047857]"><CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{successMsg}</div>}

      {showConnectForm && (
        <form onSubmit={handleConnectForSeller} className="bg-white rounded-xl border border-[#C7D2FE] p-5 space-y-3">
          <div>
            <p className="text-[14px] font-bold text-[#0C1220]">Connect Amazon for a seller</p>
            <p className="text-[12px] text-[#6B7280]">Use this when the seller authorised AXQEN in Seller Central and shared their Seller ID and refresh token with your team.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label htmlFor="az-email" className={label}>Seller&apos;s AXQEN email</label><input id="az-email" type="email" required value={targetEmail} onChange={e => setTargetEmail(e.target.value)} placeholder="seller@example.com" className={input} /></div>
            <div><label htmlFor="az-mp" className={label}>Marketplace</label>
              <select id="az-mp" value={mpCountry} onChange={e => setMpCountry(e.target.value)} className={input}>
                {Object.entries(MARKETPLACE_IDS).map(([code, mp]) => <option key={code} value={code}>{mp.name}</option>)}
              </select>
            </div>
            <div><label htmlFor="az-sid" className={label}>Amazon Seller ID</label><input id="az-sid" required value={sellerIdInput} onChange={e => setSellerIdInput(e.target.value)} placeholder="A1B2C3…" className={`${input} font-mono`} /></div>
            <div><label htmlFor="az-rt" className={label}>LWA refresh token</label><input id="az-rt" required type="password" autoComplete="off" value={rtInput} onChange={e => setRtInput(e.target.value)} placeholder="Atzr|…" className={`${input} font-mono`} /></div>
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={connecting} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold text-white bg-[#4361EE] disabled:opacity-50">{connecting && <Loader2 className="w-4 h-4 animate-spin" />} Connect</button>
            <button type="button" onClick={() => setShowConnectForm(false)} className="px-4 py-2 rounded-lg text-[13px] text-[#6B7280]">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-[#FAFBFF] border-b border-[#F3F4F6]">
          <div className="relative flex-1 min-w-[200px] md:max-w-[300px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
            <input id="az-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Seller, brand or Amazon ID" className="pl-8 pr-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] w-full" />
          </div>
          <span className="text-[12px] text-[#9CA3AF] ml-auto">{filtered.length} connections</span>
        </div>
        {loading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-[13px] text-[#9CA3AF]"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2 text-[13px] text-[#9CA3AF]"><Link2 className="w-8 h-8 text-[#D9E0F2]" />{accounts.length === 0 ? "No seller has connected Amazon yet." : "No results for that search."}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-[12.5px]">
              <thead>
                <tr className="bg-[#FAFBFF] text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                  <th className="px-4 py-2.5">Seller</th><th className="px-3 py-2.5">Amazon Seller ID</th><th className="px-3 py-2.5">Marketplace</th>
                  <th className="px-3 py-2.5 text-right">Orders</th><th className="px-3 py-2.5">Last sync</th><th className="px-3 py-2.5">Connected</th><th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {filtered.map(acc => {
                  const old = acc.isActive && stale(acc.lastSyncAt);
                  return (
                    <tr key={acc.id} className="hover:bg-[#FAFBFF]">
                      <td className="px-4 py-2.5">
                        <Link href={`/admin/sellers/${acc.sellerId}`} className="block font-semibold text-[#0C1220] hover:text-[#4361EE]">{acc.brandName ?? acc.sellerName ?? "—"}</Link>
                        <span className="block text-[11px] text-[#9CA3AF]">{acc.sellerEmail}</span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[#374151]">{acc.amazonSellerId ?? "—"}</td>
                      <td className="px-3 py-2.5 text-[#374151]">{MARKETPLACE_IDS[acc.marketplaceCountry ?? ""]?.name ?? acc.marketplaceCountry ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[#0C1220]">{fmt(acc.orderCount)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={old ? "text-[#B45309] font-semibold" : "text-[#374151]"}>
                          {acc.lastSyncAt ? new Date(acc.lastSyncAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "Never"}
                        </span>
                        {!acc.isActive && <span className="block text-[11px] text-[#B91C1C]">Inactive</span>}
                      </td>
                      <td className="px-3 py-2.5 text-[#6B7280] whitespace-nowrap">{acc.connectedAt ? new Date(acc.connectedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => handleSync(acc.sellerId)} disabled={syncing !== null} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-bold bg-[#E8EDFF] text-[#4361EE] disabled:opacity-40">
                            <RefreshCw className={`w-3 h-3 ${syncing === acc.sellerId ? "animate-spin" : ""}`} /> Sync
                          </button>
                          <button onClick={() => handleDisconnect(acc.sellerId, acc.sellerName)} aria-label="Disconnect" title="Disconnect" className="p-1.5 rounded-lg text-[#9CA3AF] hover:bg-[#FEF2F2] hover:text-[#B91C1C]"><Link2Off className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
