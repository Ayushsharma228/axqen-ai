"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  RefreshCw, Link2Off, ShoppingCart, CheckCircle, AlertCircle, Loader2, ExternalLink, MessageCircle,
  ListChecks, Clock, ShieldCheck, Sparkles, BarChart3, Wallet,
} from "lucide-react";
import { MARKETPLACE_IDS } from "@/lib/amazon-sp";
import { WA_LINK } from "@/components/landing/constants";

// Self-serve "Connect with Amazon" stays off until Amazon approves AXQEN as a public app.
// Turn it on by setting NEXT_PUBLIC_AMAZON_SELF_CONNECT=1 in Vercel.
const SELF_CONNECT = process.env.NEXT_PUBLIC_AMAZON_SELF_CONNECT === "1";

interface Order { id: string; externalOrderId: string; status: string; totalAmount: number; createdAt: string }
interface StatusData {
  connected: boolean;
  amazonSellerId?: string;
  marketplaceCountry?: string;
  connectedAt?: string;
  lastSyncAt?: string | null;
  orderCount?: number;
  recentOrders?: Order[];
}

const STATUS: Record<string, { color: string; bg: string; label: string }> = {
  NEW:        { label: "New",        color: "#4361EE", bg: "#EEF2FF" },
  PROCESSING: { label: "Confirmed",  color: "#D97706", bg: "#FFF7ED" },
  SHIPPED:    { label: "Shipped",    color: "#7C3AED", bg: "#F5F3FF" },
  IN_TRANSIT: { label: "In transit", color: "#0369A1", bg: "#E0F2FE" },
  DELIVERED:  { label: "Delivered",  color: "#047857", bg: "#ECFDF5" },
  RTO:        { label: "RTO",        color: "#DC2626", bg: "#FEF2F2" },
  CANCELLED:  { label: "Cancelled",  color: "#6B7280", bg: "#F3F4F6" },
};

const SC_URL: Record<string, string> = {
  IN: "https://sellercentral.amazon.in", US: "https://sellercentral.amazon.com", UK: "https://sellercentral.amazon.co.uk",
  DE: "https://sellercentral.amazon.de", AE: "https://sellercentral.amazon.ae", JP: "https://sellercentral.amazon.co.jp",
};

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const when = (d: string) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function AmazonPage() {
  const { data: session } = useSession();
  const plan = (session?.user as { plan?: string } | undefined)?.plan;

  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [marketplace, setMarketplace] = useState("IN");
  const didReadParams = useRef(false);

  useEffect(() => {
    fetchStatus();
    if (didReadParams.current) return;
    didReadParams.current = true;
    const params = new URLSearchParams(window.location.search);
    const conn = params.get("connected");
    const err = params.get("error");
    if (conn === "oauth") setSuccess("Amazon account connected.");
    else if (err) {
      const MAP: Record<string, string> = {
        missing_params: "Authorization was cancelled on Amazon.",
        no_state_cookie: "The connection took too long. Please try again.",
        state_mismatch: "Security check failed. Please try again.",
        token_exchange_failed: "Amazon didn't confirm the connection. Please try again.",
        no_refresh_token: "Amazon didn't return access. Please try again.",
      };
      setError(MAP[err] ?? `Connection failed: ${err}`);
    }
    if (conn || err) window.history.replaceState({}, "", "/seller/amazon");
  }, []);

  async function fetchStatus() {
    setLoading(true);
    const data = await fetch("/api/seller/amazon/status").then(r => r.json()).catch(() => ({ connected: false })) as StatusData;
    setStatus(data);
    setLoading(false);
  }

  async function handleSync() {
    setSyncing(true); setError(""); setSuccess("");
    const res = await fetch("/api/seller/amazon/sync-orders", { method: "POST" });
    const data = await res.json().catch(() => ({})) as { created?: number; updated?: number; errors?: number; error?: string };
    if (!res.ok) setError(data.error || "Sync failed. Try again in a few minutes.");
    else setSuccess(`Synced: ${data.created ?? 0} new, ${data.updated ?? 0} updated${data.errors ? `, ${data.errors} could not be read` : ""}.`);
    setSyncing(false);
    fetchStatus();
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect your Amazon account? Orders already synced stay in AXQEN, but new ones stop coming in.")) return;
    setDisconnecting(true);
    await fetch("/api/seller/amazon/disconnect", { method: "DELETE" });
    setStatus({ connected: false });
    setDisconnecting(false);
  }

  const onMarketplace = plan === "MARKETPLACE";
  const country = status?.marketplaceCountry ?? "IN";

  return (
    <div className="px-3 py-4 md:p-8 space-y-5" style={{ background: "#F7F8FC", minHeight: "100vh" }}>
      <div>
        <h1 className="text-[22px] font-black text-[#0C1220]">Amazon</h1>
        <p className="text-[12.5px] text-[#6B7280] mt-1">Your Amazon orders, listings and account in one place, managed with your AXQEN account manager.</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-[13px] bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C]">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-[13px] bg-[#ECFDF5] border border-[#BBF7D0] text-[#047857]">
          <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {success}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-[#4361EE]" /></div>
      ) : status?.connected ? (
        /* ── Connected ── */
        <>
          <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
            <div className="px-5 py-4 flex items-start gap-4 flex-wrap">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-[18px] font-black flex-shrink-0" style={{ background: "#FF9900" }}>a</div>
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-[17px] font-bold text-[#0C1220]">Amazon {MARKETPLACE_IDS[country]?.name ?? country}</h2>
                  <span className="flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#047857]">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Connected
                  </span>
                </div>
                <p className="text-[12.5px] text-[#6B7280] mt-0.5">Seller ID <span className="font-mono">{status.amazonSellerId ?? "—"}</span></p>
                <p className="text-[12px] text-[#6B7280] mt-1.5 flex items-center gap-x-3 gap-y-1 flex-wrap">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-[#9CA3AF]" />{status.lastSyncAt ? `Last synced ${when(status.lastSyncAt)}` : "Not synced yet"}</span>
                  {status.connectedAt && <span className="text-[#9CA3AF]">Connected since {new Date(status.connectedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>}
                </p>
              </div>
            </div>
            <div className="px-5 py-3.5 border-t border-[#F3F4F6] bg-[#FAFBFF] flex items-center gap-2 flex-wrap">
              <button onClick={handleSync} disabled={syncing}
                className="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold text-white bg-[#4361EE] rounded-lg disabled:opacity-60">
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Syncing orders…" : "Sync orders now"}
              </button>
              <a href={SC_URL[country] ?? SC_URL.IN} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold text-[#374151] bg-white border border-[#E8EDF6] rounded-lg hover:text-[#0C1220]">
                <ExternalLink className="w-3.5 h-3.5" /> Open Seller Central
              </a>
              <button onClick={handleDisconnect} disabled={disconnecting}
                className="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold text-[#DC2626] bg-white border border-[#FECACA] rounded-lg hover:bg-[#FEF2F2] disabled:opacity-50 sm:ml-auto">
                <Link2Off className="w-3.5 h-3.5" /> {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link href="/seller/orders?source=AMAZON" className="bg-white rounded-xl border border-[#E8EDF6] px-4 py-3.5 hover:border-[#C7D2FE]">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Amazon orders</p>
                <ShoppingCart className="w-3.5 h-3.5 text-[#FF9900]" />
              </div>
              <p className="text-[24px] font-black leading-none tabular-nums text-[#0C1220]">{(status.orderCount ?? 0).toLocaleString("en-IN")}</p>
              <p className="text-[11.5px] text-[#4361EE] font-semibold mt-1.5">View all →</p>
            </Link>
            <Link href="/seller/listings" className="bg-white rounded-xl border border-[#E8EDF6] px-4 py-3.5 hover:border-[#C7D2FE]">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Listings</p>
                <ListChecks className="w-3.5 h-3.5 text-[#16A34A]" />
              </div>
              <p className="text-[14px] font-bold text-[#0C1220] leading-tight">Live listings &amp; health check</p>
              <p className="text-[11.5px] text-[#4361EE] font-semibold mt-1.5">Open My Listings → Amazon →</p>
            </Link>
            <div className="bg-white rounded-xl border border-dashed border-[#E8EDF6] px-4 py-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Amazon payouts</p>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#F3F4F6] text-[#6B7280]">SOON</span>
              </div>
              <p className="text-[12.5px] text-[#9CA3AF] leading-snug">Every payout with Amazon fees, refunds and tax withheld, order by order.</p>
            </div>
          </div>

          {(status.recentOrders?.length ?? 0) > 0 && (
            <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#F3F4F6] flex items-center justify-between">
                <p className="text-[14px] font-bold text-[#0C1220]">Recent Amazon orders</p>
                <Link href="/seller/orders?source=AMAZON" className="text-[12px] font-semibold text-[#4361EE]">View all</Link>
              </div>
              <ul className="divide-y divide-[#F3F4F6]">
                {status.recentOrders!.map(o => {
                  const st = STATUS[o.status] ?? STATUS.NEW;
                  return (
                    <li key={o.id}>
                      <Link href={`/seller/orders/${o.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-[#FAFBFF]">
                        <div>
                          <p className="text-[13px] font-semibold text-[#0C1220]">#{o.externalOrderId}</p>
                          <p className="text-[11.5px] text-[#9CA3AF]">{new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[13px] font-bold tabular-nums text-[#0C1220]">{inr(o.totalAmount)}</span>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      ) : onMarketplace ? (
        /* ── Marketplace plan, not connected yet ── */
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] gap-4 items-start">
          <div className="bg-white rounded-xl border border-[#E8EDF6] p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-[18px] font-black flex-shrink-0" style={{ background: "#FF9900" }}>a</div>
              <div>
                <p className="text-[15px] font-bold text-[#0C1220]">Your account manager connects your Amazon account</p>
                <p className="text-[13px] text-[#6B7280] mt-1">
                  As part of your Marketplace plan, the AXQEN team links your Amazon Seller Central account for you. Message us and we&apos;ll set it up, usually the same day.
                </p>
              </div>
            </div>
            <a href={`${WA_LINK}?text=${encodeURIComponent("Hi AXQEN team, please connect my Amazon seller account.")}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-bold text-white bg-[#16A34A]">
              <MessageCircle className="w-4 h-4" /> Ask us to connect Amazon
            </a>

            {SELF_CONNECT && (
              <div className="border-t border-[#F3F4F6] pt-4 space-y-3">
                <p className="text-[12.5px] font-semibold text-[#374151]">Or connect it yourself</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <select id="amazon-marketplace" aria-label="Marketplace" value={marketplace} onChange={e => setMarketplace(e.target.value)}
                    className="px-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE]">
                    {Object.entries(MARKETPLACE_IDS).map(([code, mp]) => <option key={code} value={code}>{mp.name}</option>)}
                  </select>
                  <a href={`/api/seller/amazon/auth?marketplace=${marketplace}`}
                    className="px-4 py-2 rounded-lg text-[13px] font-bold text-white" style={{ background: "#FF9900" }}>
                    Connect with Amazon
                  </a>
                </div>
                <p className="text-[11.5px] text-[#9CA3AF]">You approve AXQEN on Amazon and come straight back. We never see your Amazon password.</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-[#E8EDF6] p-5">
            <p className="text-[12px] font-bold uppercase tracking-wide text-[#9CA3AF] mb-4">What you get once it&apos;s connected</p>
            <ul className="space-y-3.5">
              {[
                { icon: ShoppingCart, text: "Amazon orders show up in AXQEN next to your other channels" },
                { icon: ListChecks, text: "Live listings with an AI health check and better titles" },
                { icon: BarChart3, text: "Delivered, returned and RTO numbers per product" },
                { icon: Wallet, text: "Soon: every Amazon payout with fees and tax withheld" },
                { icon: ShieldCheck, text: "Read-only access approved through Amazon. No password shared" },
              ].map(r => (
                <li key={r.text} className="flex gap-3 text-[12.5px] text-[#374151]">
                  <span className="w-7 h-7 rounded-lg bg-[#FFF7ED] flex items-center justify-center flex-shrink-0"><r.icon className="w-3.5 h-3.5 text-[#EA580C]" /></span>
                  <span className="pt-1">{r.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        /* ── Other plans ── */
        <div className="bg-white rounded-xl border border-[#E8EDF6] p-6 max-w-3xl flex items-start gap-4 flex-wrap">
          <div className="w-11 h-11 rounded-xl bg-[#FFF7ED] flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-[#EA580C]" />
          </div>
          <div className="flex-1 min-w-[240px]">
            <p className="text-[15px] font-bold text-[#0C1220]">Sell on Amazon with AXQEN</p>
            <p className="text-[13px] text-[#6B7280] mt-1">
              The Marketplace plan gives you an account manager who sets up and runs your Amazon store: listings, orders and account health, all visible here in AXQEN. ₹8,999 for 3 months.
            </p>
          </div>
          <a href={`${WA_LINK}?text=${encodeURIComponent("Hi AXQEN team, I want to start selling on Amazon.")}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-bold text-white bg-[#16A34A]">
            <MessageCircle className="w-4 h-4" /> Talk to us
          </a>
        </div>
      )}
    </div>
  );
}
