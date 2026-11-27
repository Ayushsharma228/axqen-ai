"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  CheckCircle, AlertCircle, ExternalLink, Trash2, Loader2, ShoppingBag, Key, RefreshCw, ChevronDown,
  ShoppingCart, CalendarDays, Package, Clock, PhoneCall, Truck, MessageCircle,
} from "lucide-react";
import { WA_LINK } from "@/components/landing/constants";

interface Store {
  id: string;
  storeName: string;
  storeUrl: string;
  createdAt: string;
  lastSyncAt: string | null;
  lastSyncError: string | null;
}
interface Stats {
  ordersToday: number;
  ordersThisMonth: number;
  lastOrderAt: string | null;
  lastOrderNumber: string | null;
  productsLive: number;
}

const ERRORS: Record<string, string> = {
  invalid_store:   "That doesn't look like a Shopify store name. Enter the part before .myshopify.com, e.g. mystore.",
  denied:          "Connection was cancelled on Shopify. Try again and click Install.",
  expired:         "The connection link expired. Please try again.",
  session:         "You were signed out during the connection. Sign in and try again.",
  store_in_use:    "This store is already connected to another AXQEN account. Contact support if this is your store.",
  not_configured:  "Shopify connection isn't set up on our side yet. Please contact support.",
  error:           "Shopify didn't confirm the connection. Please try again.",
};

function ago(iso: string) {
  const m = (Date.now() - new Date(iso).getTime()) / 60000;
  if (m < 1) return "just now";
  if (m < 60) return `${Math.round(m)} min ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
}
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function ShopifyConnectPage() {
  const { data: session } = useSession();
  const plan = (session?.user as { plan?: string } | undefined)?.plan;

  const [store, setStore] = useState<Store | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState("");
  const [error, setError] = useState("");
  const [justConnected, setJustConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Advanced (older custom-app method)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [connectingCustom, setConnectingCustom] = useState(false);

  async function loadStore() {
    const d = await fetch("/api/seller/shopify/store").then((r) => r.json()).catch(() => ({}));
    setStore(d.store ?? null);
    setStats(d.stats ?? null);
    setLoading(false);
    return d.store as Store | null;
  }

  async function syncOrders() {
    setSyncing(true);
    setSyncMsg(null);
    // Keeps webhooks current for stores connected before automatic registration existed.
    await fetch("/api/seller/shopify/register-webhooks", { method: "POST" }).catch(() => {});
    const res = await fetch("/api/seller/shopify/sync-orders", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (res.ok) setSyncMsg({ ok: true, text: `Orders synced: ${d.created ?? 0} new, ${d.updated ?? 0} updated.` });
    else setSyncMsg({ ok: false, text: d.error ? `Sync failed: ${d.error}` : "Sync failed. Try again." });
    setSyncing(false);
    loadStore();
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) setError(ERRORS[err] ?? `Connection failed: ${err}`);
    const connected = params.get("connected") === "1";
    if (connected) setJustConnected(true);
    // Store installed from the Shopify admin: the link carries a signed claim to attach it to this account.
    const claim = params.get("claim");
    if (err || connected || claim) window.history.replaceState({}, "", "/seller/shopify");

    (async () => {
      let claimed = false;
      if (claim) {
        const res = await fetch("/api/seller/shopify/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: claim }) });
        const d = await res.json().catch(() => ({}));
        if (res.ok) { claimed = !d.already; setJustConnected(true); }
        else setError(d.error ?? "Couldn't finish connecting your Shopify store. Try the button in Shopify again.");
      }
      const s = await loadStore();
      // Pull in recent orders right after a fresh connection.
      if ((connected || claimed) && s) syncOrders();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const name = shop.trim();
    if (!name) return;
    window.location.href = `/api/shopify/connect?shop=${encodeURIComponent(name)}`;
  }

  async function handleConnectCustom(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setConnectingCustom(true);
    const res = await fetch("/api/seller/shopify/oauth-init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeUrl: shop.trim(), clientId: clientId.trim(), clientSecret: clientSecret.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed to start connection"); setConnectingCustom(false); return; }
    window.location.href = data.authUrl;
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect your Shopify store? Orders will stop syncing.")) return;
    setDisconnecting(true);
    await fetch("/api/seller/shopify/store", { method: "DELETE" });
    setStore(null);
    setStats(null);
    setJustConnected(false);
    setDisconnecting(false);
  }

  const notOnPlan = !!plan && plan !== "DROPSHIPPING" && !store;
  const adminUrl = store ? `https://admin.shopify.com/store/${store.storeUrl.replace(/\.myshopify\.com$/i, "")}` : "";

  return (
    <div className="px-3 py-4 md:p-8 space-y-5" style={{ background: "#F7F8FC", minHeight: "100vh" }}>
      <div>
        <h1 className="text-[22px] font-black text-[#0C1220]">Shopify Store</h1>
        <p className="text-[12.5px] text-[#6B7280] mt-1">Connect your store once. New orders then arrive in AXQEN automatically, and products you push from the Catalogue go live on your store.</p>
      </div>

      {justConnected && (
        <div className="flex items-center gap-3 bg-[#ECFDF5] border border-[#BBF7D0] text-[#047857] px-4 py-3 rounded-xl">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-[13px] font-medium">Store connected. Recent orders are being pulled in now.</p>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] px-4 py-3 rounded-xl">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-[13px]">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-[#4361EE]" />
        </div>
      ) : notOnPlan ? (
        /* ── Not on the Dropshipping plan ── */
        <div className="bg-white rounded-xl border border-[#E8EDF6] p-6 max-w-2xl flex items-start gap-4 flex-wrap">
          <div className="w-11 h-11 rounded-xl bg-[#ECFDF5] flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-5 h-5 text-[#16A34A]" />
          </div>
          <div className="flex-1 min-w-[240px]">
            <p className="text-[15px] font-bold text-[#0C1220]">Shopify comes with the Dropshipping plan</p>
            <p className="text-[13px] text-[#6B7280] mt-1">
              With it, AXQEN pulls your Shopify orders automatically, pushes catalogue products to your store in one click, and our team confirms and ships every order. Talk to us to add it to your account.
            </p>
          </div>
          <a href={WA_LINK} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-bold text-white bg-[#16A34A]">
            <MessageCircle className="w-4 h-4" /> Talk to us
          </a>
        </div>
      ) : store ? (
        /* ── Connected ── */
        <>
          <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
            <div className="px-5 py-4 flex items-start gap-4 flex-wrap">
              <div className="w-12 h-12 bg-[#ECFDF5] rounded-xl flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-6 h-6 text-[#16A34A]" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-[17px] font-bold text-[#0C1220]">{store.storeName}</h2>
                  <span className="flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={store.lastSyncError ? { background: "#FFFBEB", color: "#B45309" } : { background: "#ECFDF5", color: "#047857" }}>
                    <span className={`w-1.5 h-1.5 rounded-full ${store.lastSyncError ? "bg-amber-500" : "bg-green-500"}`} />
                    {store.lastSyncError ? "Connection problem" : "Connected"}
                  </span>
                </div>
                <a href={`https://${store.storeUrl}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12.5px] text-[#4361EE] hover:underline mt-0.5 break-all">
                  {store.storeUrl} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
                <p className="text-[12px] text-[#6B7280] mt-1.5 flex items-center gap-x-3 gap-y-1 flex-wrap">
                  <span className="flex items-center gap-1">
                    <ShoppingCart className="w-3.5 h-3.5 text-[#9CA3AF]" />
                    {stats?.lastOrderAt ? <>Last order <b className="text-[#0C1220]">#{String(stats.lastOrderNumber ?? "").replace(/^#/, "")}</b> · {ago(stats.lastOrderAt)}</> : "No orders received yet"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#9CA3AF]" />
                    {store.lastSyncAt ? `Full sync ${ago(store.lastSyncAt)}` : "Not synced yet"}
                  </span>
                  <span className="text-[#9CA3AF]">Connected since {new Date(store.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                </p>
              </div>
            </div>

            {store.lastSyncError && (
              <div className="mx-5 mb-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] px-4 py-3 text-[13px] text-[#92400E] flex items-start justify-between gap-3 flex-wrap">
                <p className="flex-1 min-w-[220px]">We couldn&apos;t reach your store on the last sync, so new orders may be missing. This usually happens after AXQEN was uninstalled or its access changed.</p>
                <a href={`/api/shopify/connect?shop=${encodeURIComponent(store.storeUrl)}`}
                  className="px-3 py-1.5 rounded-lg text-[12.5px] font-bold text-white bg-[#D97706] whitespace-nowrap">Reconnect store</a>
              </div>
            )}

            <div className="px-5 py-3.5 border-t border-[#F3F4F6] bg-[#FAFBFF] flex items-center gap-2 flex-wrap">
              <button onClick={syncOrders} disabled={syncing}
                className="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold text-white bg-[#4361EE] rounded-lg disabled:opacity-60">
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing orders…" : "Sync orders now"}
              </button>
              <a href={adminUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold text-[#374151] bg-white border border-[#E8EDF6] rounded-lg hover:text-[#0C1220]">
                <ExternalLink className="w-3.5 h-3.5" /> Open Shopify admin
              </a>
              {!store.lastSyncError && (
                <a href={`/api/shopify/connect?shop=${encodeURIComponent(store.storeUrl)}`}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold text-[#374151] bg-white border border-[#E8EDF6] rounded-lg hover:text-[#0C1220]">
                  <RefreshCw className="w-3.5 h-3.5" /> Reconnect
                </a>
              )}
              <button onClick={handleDisconnect} disabled={disconnecting}
                className="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold text-[#DC2626] bg-white border border-[#FECACA] rounded-lg hover:bg-[#FEF2F2] disabled:opacity-50 sm:ml-auto">
                <Trash2 className="w-3.5 h-3.5" />
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
            {syncMsg && (
              <p className="px-5 py-2.5 text-[12.5px] font-medium border-t border-[#F3F4F6]"
                style={{ color: syncMsg.ok ? "#047857" : "#B91C1C", background: syncMsg.ok ? "#F0FDF4" : "#FEF2F2" }}>{syncMsg.text}</p>
            )}
          </div>

          {/* Numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: "Orders today",      value: stats?.ordersToday ?? 0,     icon: ShoppingCart, color: "#4361EE", href: "/seller/orders" },
              { label: "Orders this month", value: stats?.ordersThisMonth ?? 0, icon: CalendarDays, color: "#7C3AED", href: "/seller/orders" },
              { label: "Products live on your store", value: stats?.productsLive ?? 0, icon: Package, color: "#16A34A", href: "/seller/listings" },
            ].map(t => {
              const Icon = t.icon;
              return (
                <Link key={t.label} href={t.href} className="bg-white rounded-xl border border-[#E8EDF6] px-4 py-3.5 hover:border-[#C7D2FE] transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{t.label}</p>
                    <Icon className="w-3.5 h-3.5" style={{ color: t.color }} />
                  </div>
                  <p className="text-[24px] font-black leading-none tabular-nums text-[#0C1220]">{t.value.toLocaleString("en-IN")}</p>
                </Link>
              );
            })}
          </div>

          <p className="text-[12px] text-[#9CA3AF]">
            Orders reach AXQEN within seconds of being placed on Shopify. If one is missing, use <b>Sync orders now</b>.
            {stats?.lastOrderAt && <> Last order arrived {when(stats.lastOrderAt)}.</>}
          </p>
        </>
      ) : (
        /* ── Not connected ── */
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] gap-4 items-start">
          <div className="bg-white rounded-xl border border-[#E8EDF6] p-6 space-y-5">
            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label htmlFor="shop" className="block text-[13px] font-semibold text-[#374151] mb-1.5">Your Shopify store name</label>
                <div className="flex items-center border border-[#E8EDF6] rounded-xl overflow-hidden focus-within:border-[#4361EE]">
                  <input id="shop" type="text" value={shop} onChange={(e) => setShop(e.target.value)}
                    placeholder="your-store-name" required autoComplete="off"
                    className="flex-1 min-w-0 px-3 py-2.5 text-[14px] focus:outline-none" />
                  <span className="px-3 py-2.5 text-[13px] text-[#9CA3AF] bg-[#FAFBFF] border-l border-[#E8EDF6] whitespace-nowrap">.myshopify.com</span>
                </div>
                <p className="text-[11.5px] text-[#9CA3AF] mt-1.5">Find it in your Shopify admin address bar: admin.shopify.com/store/<strong>your-store-name</strong></p>
              </div>
              <button type="submit" disabled={!shop.trim()}
                className="w-full py-3 font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 text-white bg-[#16A34A] hover:opacity-90">
                <ShoppingBag className="w-4 h-4" /> Connect Shopify
              </button>
              <p className="text-[11.5px] text-center text-[#9CA3AF]">You&apos;ll approve AXQEN on Shopify, then come straight back here.</p>
            </form>

            <div className="border-t border-[#F3F4F6] pt-4">
              <button type="button" onClick={() => setShowAdvanced((v) => !v)}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-[#6B7280] hover:text-[#374151]">
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                Advanced: connect with your own app credentials
              </button>
              {showAdvanced && (
                <form onSubmit={handleConnectCustom} className="space-y-3 mt-4">
                  <p className="text-[12px] text-[#6B7280]">Only use this if the AXQEN team gave you a Client ID and Client Secret for your store.</p>
                  <input id="client-id" type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Client ID" required
                    className="w-full px-3 py-2.5 text-[13px] border border-[#E8EDF6] rounded-xl focus:outline-none focus:border-[#4361EE]" />
                  <div className="flex items-center border border-[#E8EDF6] rounded-xl overflow-hidden focus-within:border-[#4361EE]">
                    <span className="px-3 py-2.5 bg-[#FAFBFF] border-r border-[#E8EDF6]"><Key className="w-4 h-4 text-[#9CA3AF]" /></span>
                    <input id="client-secret" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="Client Secret" required
                      className="flex-1 px-3 py-2.5 text-[13px] focus:outline-none font-mono" />
                  </div>
                  <button type="submit" disabled={connectingCustom || !shop.trim() || !clientId.trim() || !clientSecret.trim()}
                    className="w-full py-2.5 text-[13px] font-semibold rounded-xl border border-[#E8EDF6] text-[#374151] hover:bg-[#FAFBFF] disabled:opacity-50">
                    {connectingCustom ? "Redirecting to Shopify…" : "Connect with credentials"}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* How it works */}
          <div className="bg-white rounded-xl border border-[#E8EDF6] p-5">
            <p className="text-[12px] font-bold uppercase tracking-wide text-[#9CA3AF] mb-4">How it works</p>
            <ol className="space-y-4">
              {[
                { icon: Package,   title: "Push products",            text: "Pick products in the Catalogue and push them to your store in one click." },
                { icon: ShoppingCart, title: "Orders arrive by themselves", text: "Every Shopify order shows up in AXQEN within seconds." },
                { icon: PhoneCall, title: "We confirm",               text: "Our team calls each customer before shipping." },
                { icon: Truck,     title: "We ship & track",          text: "Orders are packed, shipped and tracked to the doorstep." },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <li key={s.title} className="flex gap-3">
                    <span className="w-8 h-8 rounded-lg bg-[#EEF2FF] flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-[#4361EE]" />
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-[#0C1220]"><span className="text-[#9CA3AF] mr-1">{i + 1}.</span>{s.title}</p>
                      <p className="text-[12px] text-[#6B7280] mt-0.5">{s.text}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
