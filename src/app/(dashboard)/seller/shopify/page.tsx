"use client";

import { useState, useEffect } from "react";
import { CheckCircle, AlertCircle, ExternalLink, Trash2, Loader2, ShoppingBag, Key, RefreshCw, ChevronDown } from "lucide-react";

interface Store {
  id: string;
  storeName: string;
  storeUrl: string;
  createdAt: string;
  lastSyncAt: string | null;
  lastSyncError: string | null;
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

export default function ShopifyConnectPage() {
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState("");
  const [error, setError] = useState("");
  const [justConnected, setJustConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [disconnecting, setDisconnecting] = useState(false);

  // Advanced (older custom-app method)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [connectingCustom, setConnectingCustom] = useState(false);

  async function loadStore() {
    const d = await fetch("/api/seller/shopify/store").then((r) => r.json()).catch(() => ({}));
    setStore(d.store ?? null);
    setLoading(false);
    return d.store as Store | null;
  }

  async function syncOrders() {
    setSyncing(true);
    setSyncMsg("");
    // Keeps webhooks current for stores connected before automatic registration existed.
    await fetch("/api/seller/shopify/register-webhooks", { method: "POST" }).catch(() => {});
    const res = await fetch("/api/seller/shopify/sync-orders", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (res.ok) setSyncMsg(`Orders synced: ${d.created ?? 0} new, ${d.updated ?? 0} updated.`);
    else setSyncMsg(d.error ? `Sync failed: ${d.error}` : "Sync failed. Try again.");
    setSyncing(false);
    loadStore();
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) setError(ERRORS[err] ?? `Connection failed: ${err}`);
    const connected = params.get("connected") === "1";
    if (connected) setJustConnected(true);
    if (err || connected) window.history.replaceState({}, "", "/seller/shopify");

    loadStore().then((s) => {
      // Pull in recent orders right after a fresh connection.
      if (connected && s) syncOrders();
    });
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
    setJustConnected(false);
    setDisconnecting(false);
  }

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Shopify store</h1>
        <p className="text-sm text-gray-500 mt-0.5">Connect your store once. New orders then arrive in AXQEN automatically.</p>
      </div>

      {justConnected && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">Store connected. New orders will now sync automatically.</p>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : store ? (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full inline-block ${store.lastSyncError ? "bg-amber-500" : "bg-green-500"}`} />
            <span className="text-sm font-semibold text-gray-700">{store.lastSyncError ? "Connected · last sync had a problem" : "Connected"}</span>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 text-lg">{store.storeName}</h3>
                <a href={`https://${store.storeUrl}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-blue-500 hover:underline mt-0.5 break-all">
                  {store.storeUrl} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
                <p className="text-xs text-gray-400 mt-1">
                  {store.lastSyncAt
                    ? `Last synced ${new Date(store.lastSyncAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
                    : "Not synced yet"}
                </p>
              </div>
            </div>

            {store.lastSyncError && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 space-y-2">
                <p>We couldn&apos;t reach your store on the last sync. If you recently uninstalled AXQEN or changed access, reconnect below.</p>
                <form onSubmit={(e) => { e.preventDefault(); window.location.href = `/api/shopify/connect?shop=${encodeURIComponent(store.storeUrl)}`; }}>
                  <button type="submit" className="text-sm font-semibold underline">Reconnect store</button>
                </form>
              </div>
            )}

            {syncMsg && <p className="text-sm text-gray-600">{syncMsg}</p>}

            <div className="flex flex-wrap items-center gap-3">
              <button onClick={syncOrders} disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing orders…" : "Sync orders now"}
              </button>
              <button onClick={handleDisconnect} disabled={disconnecting}
                className="flex items-center gap-2 px-4 py-2 text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50">
                <Trash2 className="w-4 h-4" />
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label htmlFor="shop" className="block text-sm font-semibold text-gray-700 mb-1.5">Your Shopify store name</label>
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-transparent">
                <input id="shop" type="text" value={shop} onChange={(e) => setShop(e.target.value)}
                  placeholder="your-store-name" required autoComplete="off"
                  className="flex-1 min-w-0 px-3 py-2.5 text-sm focus:outline-none" />
                <span className="px-3 py-2.5 text-sm text-gray-400 bg-gray-50 border-l border-gray-200 whitespace-nowrap">.myshopify.com</span>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Find it in your Shopify admin address bar: admin.shopify.com/store/<strong>your-store-name</strong></p>
            </div>

            <button type="submit" disabled={!shop.trim()}
              className="w-full py-3 font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity hover:opacity-90 text-white"
              style={{ background: "#16A34A" }}>
              <ShoppingBag className="w-4 h-4" /> Connect Shopify
            </button>
            <p className="text-xs text-center text-gray-400">You&apos;ll approve AXQEN on Shopify, then come straight back here.</p>
          </form>

          <div className="border-t border-gray-100 pt-4">
            <button type="button" onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
              Advanced: connect with your own app credentials
            </button>

            {showAdvanced && (
              <form onSubmit={handleConnectCustom} className="space-y-3 mt-4">
                <p className="text-xs text-gray-500">Only use this if the AXQEN team gave you a Client ID and Client Secret for your store.</p>
                <input type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Client ID" required
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-400">
                  <span className="px-3 py-2.5 bg-gray-50 border-r border-gray-200"><Key className="w-4 h-4 text-gray-400" /></span>
                  <input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="Client Secret" required
                    className="flex-1 px-3 py-2.5 text-sm focus:outline-none font-mono" />
                </div>
                <button type="submit" disabled={connectingCustom || !shop.trim() || !clientId.trim() || !clientSecret.trim()}
                  className="w-full py-2.5 text-sm font-semibold rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  {connectingCustom ? "Redirecting to Shopify…" : "Connect with credentials"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
