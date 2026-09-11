"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  ShoppingCart, Wallet, ArrowRight, Store, CheckCircle2,
  ChevronDown, Megaphone, Clock, Package, Layers, IndianRupee,
} from "lucide-react";

interface Analytics {
  totalOrders: number;
  deliveredCount: number;
  rtoCount: number;
  inTransitCount: number;
  cancelledCount: number;
  deliveryRate: number;
  rtoRate: number;
  totalRevenue: number;
  trend: { date: string; total: number; delivered: number; rto: number }[];
  store: { storeUrl: string; storeName: string; lastSyncAt: string | null; lastSyncError: string | null } | null;
  earnings: {
    totalGMV: number;
    totalProductCost: number;
    totalShipping: number;
    totalPackingCost: number;
    totalPlatformFee: number;
    platformFeePerOrder: number;
    totalRtoCharge: number;
    totalEarned: number;
    totalAdSpend: number;
    // Availability flags — number of delivered orders that have cost data populated
    productCostTracked: number;
    shippingTracked: number;
    deliveredCount: number;
    netProfit: number;
    margin: number;
  };
  pipeline?: {
    new: number; confirmed: number; processing: number;
    shipped: number; inTransit: number; delivered: number;
    ndr: number; rtoRisk: number; cancelled: number;
  };
  unassignedCount?: number;
  autoHandledCount?: number;
  supplierDelayCount?: number;
  computedAt?: string;       // ISO timestamp when DB data was computed (server clock)
}

interface WalletData { balance: number; totalRemittance: number; totalDeductions: number }

interface NdrOrder {
  id: string; externalOrderId: string; customerName: string;
  totalAmount: number; ndrReason: string | null; ndrAttempts: number;
  ndrCreatedAt: string | null;
}
interface AttentionNewOrder {
  id: string; externalOrderId: string; customerName: string; totalAmount: number;
  createdAt: string; supplierId?: string | null;
  paymentMode?: string | null; confirmationStatus?: string | null;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}
function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  NEW:        { label: "New",        color: "#4361EE", bg: "rgba(67,97,238,0.1)" },
  PROCESSING: { label: "Processing", color: "#F59E0B", bg: "#FFF7ED" },
  SHIPPED:    { label: "Shipped",    color: "#7C3AED", bg: "#F5F3FF" },
  IN_TRANSIT: { label: "In Transit", color: "#0891B2", bg: "#ECFEFF" },
  DELIVERED:  { label: "Delivered",  color: "#059669", bg: "#ECFDF5" },
  RTO:        { label: "RTO",        color: "#EF4444", bg: "#FEF2F2" },
  CANCELLED:  { label: "Cancelled",  color: "#6B7280", bg: "rgba(107,114,128,0.1)" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl shadow-lg p-3 text-xs"
      style={{ background: "white", border: "1px solid #E5E7EB" }}>
      <p className="font-semibold mb-1" style={{ color: "#6B7280" }}>{label}</p>
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

function Accordion({ label, icon: Icon, open, onToggle, badge }: {
  label: string; icon: React.ElementType; open: boolean;
  onToggle: () => void; badge?: string;
}) {
  return (
    <button onClick={onToggle}
      className="w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-colors text-left"
      style={{
        background: open ? "white" : "white",
        border: "1px solid #E5E7EB",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(67,97,238,0.1)" }}>
          <Icon className="w-4 h-4" style={{ color: "#4361EE" }} />
        </div>
        <span className="text-sm font-semibold" style={{ color: "#1e1b4b" }}>{label}</span>
        {badge && (
          <span className="text-xs px-2.5 py-0.5 rounded-full font-medium"
            style={{ background: "rgba(67,97,238,0.1)", color: "#4361EE" }}>{badge}</span>
        )}
      </div>
      <ChevronDown className="w-4 h-4 transition-transform flex-shrink-0"
        style={{ color: "#9CA3AF", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
    </button>
  );
}

export default function SellerDashboard() {
  const { data: session } = useSession();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [wallet, setWallet]       = useState<WalletData | null>(null);
  const [recentOrders, setRecentOrders] = useState<{
    id: string; externalOrderId: string; customerName: string;
    totalAmount: number; status: string; createdAt: string;
    updatedAt?: string;
    supplierId?: string | null;
    supplierStatus?: string | null;
    paymentMode?: "COD" | "PREPAID" | "UNKNOWN" | null;
    confirmationStatus?: string | null;
    ndrStatus?: string | null;
    ndrActionTaken?: string | null;
    customerOrderCount?: number;
  }[]>([]);
  const [loading, setLoading]           = useState(true);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey]       = useState(0);
  const [adSpend, setAdSpend]           = useState(0);
  const [adRevenue, setAdRevenue]       = useState(0);
  const [metaConnected, setMetaConnected] = useState(false);
  const [openNdrs, setOpenNdrs]         = useState(0);
  const [ndrOrders, setNdrOrders]       = useState<NdrOrder[]>([]);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [attentionNewOrders, setAttentionNewOrders] = useState<AttentionNewOrder[]>([]);
  const [orderFilter, setOrderFilter]   = useState("ALL");
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [chartDays, setChartDays]       = useState(14);
  const [showFinancials, setShowFinancials] = useState(false);
  const [aiActivity, setAiActivity] = useState<{
    autoDispatched: number; newOrdersToday: number; ndrOpenedToday: number;
    supplierDelaysDetectedToday: number; humanActionsNeeded: number;
    timeSaved: number; timeSavedLabel: string;
    timeSavedRates: { autoDispatchedMinutes: number; newOrderIngestedMinutes: number; ndrOpenedMinutes: number; supplierDelayMinutes: number };
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Marketplace-specific
  const [listingStats, setListingStats] = useState<{
    total: number; pending: number; inProgress: number; listed: number; failed: number;
  } | null>(null);
  const [amazonConnected, setAmazonConnected] = useState(false);
  const [amazonSellerId, setAmazonSellerId]   = useState("");

  const name         = session?.user?.name?.split(" ")[0] || "Seller";
  const plan         = (session?.user as { plan?: string })?.plan ?? "DROPSHIPPING";
  const isMarketplace = plan === "MARKETPLACE";

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    if (isMarketplace) {
      Promise.all([
        fetch("/api/seller/analytics").then(r => { if (!r.ok) throw new Error("analytics"); return r.json(); }),
        fetch("/api/seller/wallet").then(r => r.json()),
        fetch("/api/seller/listings").then(r => r.json()),
        fetch("/api/seller/amazon/status").then(r => r.json()),
        fetch("/api/seller/ad-spend").then(r => r.json()),
      ]).then(([a, w, l, amz, ads]) => {
        setAnalytics(a); setWallet(w);
        setListingStats(l.stats ?? null);
        setAmazonConnected(amz.connected ?? false);
        setAmazonSellerId(amz.sellerId ?? "");
        setAdSpend(ads.total ?? 0);
        setAdRevenue(ads.last30DaysRevenue ?? 0);
        setMetaConnected(ads.metaConnected ?? false);
        setLoading(false);
        setLastFetchedAt(new Date());
      }).catch(() => {
        setLoadError("Unable to load latest data. Check your connection and refresh.");
        setLoading(false);
      });
    } else {
      Promise.all([
        fetch("/api/seller/analytics").then(r => { if (!r.ok) throw new Error("analytics"); return r.json(); }),
        fetch("/api/seller/wallet").then(r => r.json()),
        fetch("/api/seller/ad-spend").then(r => r.json()),
        fetch("/api/seller/ndr").then(r => r.json()),
      ]).then(([a, w, ads, ndr]) => {
        setAnalytics(a); setWallet(w);
        setAdSpend(ads.total ?? 0);
        setAdRevenue(ads.last30DaysRevenue ?? 0);
        setMetaConnected(ads.metaConnected ?? false);
        setOpenNdrs(ndr.pending?.length ?? 0);
        setNdrOrders(ndr.pending?.slice(0, 5) ?? []);
        setLoading(false);
        setLastFetchedAt(new Date());
      }).catch(() => {
        setLoadError("Unable to load latest data. Check your connection and refresh.");
        setLoading(false);
      });
    }
    fetch("/api/seller/orders?status=NEW&limit=5")
      .then(r => r.json()).then(d => {
        setNewOrdersCount(d.stats?.totalOrders ?? d.total ?? 0);
        setAttentionNewOrders(d.orders ?? []);
      }).catch(() => {});
    fetch("/api/seller/ai-activity")
      .then(r => r.json()).then(d => setAiActivity(d)).catch(() => {});
  }, [isMarketplace, refreshKey]);

  useEffect(() => {
    setOrdersLoading(true);
    const p = new URLSearchParams({ limit: "10" });
    if (orderFilter !== "ALL") p.set("status", orderFilter);
    fetch(`/api/seller/orders?${p}`).then(r => r.json()).then(o => {
      setRecentOrders(o.orders?.slice(0, 10) || []);
      setOrdersLoading(false);
    });
  }, [orderFilter, refreshKey]);

  const chartData = analytics?.trend
    ?.slice(chartDays > 0 ? -chartDays : undefined)
    .map(d => ({
      date: new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      Orders: d.total, Delivered: d.delivered, RTO: d.rto,
    })) ?? [];

  const deliveryRate  = analytics?.deliveryRate ?? 0;
  const rtoRate       = analytics?.rtoRate ?? 0;
  const todayData     = analytics?.trend?.at(-1);
  const yesterdayData = analytics?.trend?.at(-2);
  const todayOrders   = todayData?.total ?? 0;
  const todayDelta    = todayOrders - (yesterdayData?.total ?? 0);
  const avgOrderValue = analytics ? analytics.totalRevenue / Math.max(analytics.totalOrders, 1) : 0;
  const todayRevEst   = Math.round(todayOrders * avgOrderValue);
  const last7         = analytics?.trend?.slice(-7) ?? [];
  const prior7        = analytics?.trend?.slice(-14, -7) ?? [];
  const last7Total    = last7.reduce((s, d) => s + d.total, 0);
  const prior7Total   = prior7.reduce((s, d) => s + d.total, 0);
  const weekOverWeek  = prior7Total > 0 ? Math.round(((last7Total - prior7Total) / prior7Total) * 100) : 0;
  const bestDay       = analytics?.trend?.reduce<typeof analytics.trend[0] | null>(
    (best, d) => (d.total > (best?.total ?? 0) ? d : best), null
  );

  const last7Delivered = last7.reduce((s, d) => s + d.delivered, 0);

  return (
    <div className="min-h-screen" style={{ background: "#F1F5FF" }}>

      {/* ── Welcome Hero ────────── */}
      <div className="px-4 md:px-8 pt-8 pb-6" style={{ background: "white" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: "#9CA3AF" }}>
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
            <h1 className="text-3xl font-bold" style={{ color: "#1e1b4b" }}>
              {getGreeting()}, {name}! 👋
            </h1>
            <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>
              Here&apos;s what needs your attention today.
            </p>
          </div>
          {/* Data freshness + refresh */}
          <div className="flex flex-col items-end gap-1 flex-shrink-0 pt-1">
            {analytics?.computedAt && (
              <p className="text-[10px]" style={{ color: "#9CA3AF" }}>
                Data as of {new Date(analytics.computedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
            {analytics?.store?.lastSyncAt && (
              <p className="text-[10px]" style={{ color: analytics.store.lastSyncError ? "#EF4444" : "#9CA3AF" }}>
                {analytics.store.lastSyncError
                  ? "Shopify sync failed"
                  : `Shopify sync ${(() => {
                      const mins = Math.round((Date.now() - new Date(analytics.store!.lastSyncAt!).getTime()) / 60000);
                      return mins < 2 ? "just now" : `${mins}m ago`;
                    })()}`}
              </p>
            )}
            <button
              onClick={() => { setLoading(true); setLoadError(null); setRefreshKey(k => k + 1); }}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-opacity"
              style={{ background: "rgba(67,97,238,0.08)", color: "#4361EE", opacity: loading ? 0.5 : 1 }}>
              <span style={{ display: "inline-block", animation: loading ? "spin 1s linear infinite" : "none" }}>↻</span>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* API/database failure banner */}
        {!loading && loadError && (
          <div className="mt-4 flex items-center gap-2.5 px-4 py-3 rounded-2xl"
            style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
            <span className="text-base flex-shrink-0">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: "#991B1B" }}>{loadError}</p>
            </div>
          </div>
        )}

        {/* Shopify sync failure banner */}
        {!loading && analytics?.store?.lastSyncError && (
          <div className="mt-4 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl"
            style={{ background: "#FFF7ED", border: "1px solid #FED7AA" }}>
            <div className="flex items-center gap-2.5">
              <span className="text-base flex-shrink-0">🔄</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: "#92400E" }}>Shopify sync failed</p>
                <p className="text-xs" style={{ color: "#B45309" }}>
                  {analytics.store.lastSyncAt
                    ? `Last successful sync: ${new Date(analytics.store.lastSyncAt).toLocaleString("en-IN")}`
                    : "No successful sync recorded"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Demo mode banner — no store connected and no orders */}
        {!loading && !analytics?.store && (analytics?.totalOrders ?? 0) === 0 && (
          <div className="mt-4 flex items-center justify-between px-4 py-3 rounded-2xl"
            style={{ background: "rgba(67,97,238,0.06)", border: "1px solid rgba(67,97,238,0.15)" }}>
            <div className="flex items-center gap-2.5">
              <Store className="w-4 h-4 flex-shrink-0" style={{ color: "#4361EE" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "#1e1b4b" }}>No store connected</p>
                <p className="text-xs" style={{ color: "#6B7280" }}>Connect your Shopify store to see live orders and metrics.</p>
              </div>
            </div>
            <Link href="/seller/shopify"
              className="px-4 py-2 rounded-xl text-xs font-bold text-white flex-shrink-0"
              style={{ background: "#4361EE" }}>
              Connect Store
            </Link>
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* ── Stats Cards ──────────────────────────────── */}
      <div className="px-4 md:px-8 pt-6 pb-2">
        {isMarketplace ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Total Listings — featured */}
            <div className="rounded-3xl px-6 py-5"
              style={{ background: "linear-gradient(135deg, #4361EE 0%, #3752D3 100%)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold mb-3 uppercase tracking-wide"
                    style={{ color: "rgba(255,255,255,0.65)" }}>Total Listings</p>
                  <div className="flex items-end gap-2.5 mb-1.5 flex-wrap">
                    {loading ? (
                      <div className="h-10 w-20 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.2)" }} />
                    ) : (
                      <>
                        <p className="text-4xl font-black leading-none" style={{ color: "white" }}>
                          {fmt(listingStats?.total ?? 0)}
                        </p>
                        {(listingStats?.listed ?? 0) > 0 && (
                          <span className="mb-1 text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(255,255,255,0.22)", color: "white" }}>
                            {listingStats?.listed} Live
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                    {fmt(listingStats?.pending ?? 0)} pending approval
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.2)" }}>
                  <Layers className="w-5 h-5" style={{ color: "white" }} />
                </div>
              </div>
            </div>

            {/* Amazon Orders */}
            <div className="rounded-3xl px-6 py-5"
              style={{ background: "white", border: "1px solid #E5E7EB", boxShadow: "0 1px 12px rgba(0,0,0,0.04)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{ color: "#9CA3AF" }}>
                    Amazon Orders
                  </p>
                  <div className="flex items-end gap-2.5 mb-1.5 flex-wrap">
                    {loading ? (
                      <div className="h-10 w-16 rounded-xl bg-gray-100 animate-pulse" />
                    ) : (
                      <>
                        <p className="text-4xl font-black leading-none" style={{ color: "#1e1b4b" }}>
                          {fmt(analytics?.totalOrders ?? 0)}
                        </p>
                        {deliveryRate > 0 && (
                          <span className="mb-1 text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{
                              background: deliveryRate >= 70 ? "rgba(67,97,238,0.1)" : "#FEF2F2",
                              color: deliveryRate >= 70 ? "#4361EE" : "#EF4444",
                            }}>
                            {deliveryRate.toFixed(1)}% delivered
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: "#9CA3AF" }}>
                    {amazonConnected ? `Seller ID: ${amazonSellerId}` : "Connect Amazon to sync"}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "#F3F5FF" }}>
                  <ShoppingCart className="w-5 h-5" style={{ color: "#4361EE" }} />
                </div>
              </div>
            </div>

            {/* Revenue */}
            <div className="rounded-3xl px-6 py-5"
              style={{ background: "white", border: "1px solid #E5E7EB", boxShadow: "0 1px 12px rgba(0,0,0,0.04)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{ color: "#9CA3AF" }}>
                    Total Revenue
                  </p>
                  <div className="flex items-end gap-2.5 mb-1.5 flex-wrap">
                    {loading ? (
                      <div className="h-10 w-24 rounded-xl bg-gray-100 animate-pulse" />
                    ) : (
                      <>
                        <p className="text-4xl font-black leading-none" style={{ color: "#1e1b4b" }}>
                          ₹{fmt(analytics?.totalRevenue ?? 0)}
                        </p>
                        {weekOverWeek !== 0 && (
                          <span className="mb-1 text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: weekOverWeek >= 0 ? "rgba(67,97,238,0.1)" : "#FEF2F2", color: weekOverWeek >= 0 ? "#4361EE" : "#EF4444" }}>
                            {weekOverWeek >= 0 ? "+" : ""}{weekOverWeek}% WoW
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: "#9CA3AF" }}>
                    Wallet: ₹{fmt(wallet?.balance ?? 0)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "#F3F5FF" }}>
                  <IndianRupee className="w-5 h-5" style={{ color: "#4361EE" }} />
                </div>
              </div>
            </div>

          </div>

        ) : (
          <div className="space-y-4">

            {/* ── Row 1: 4 operational cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

              {/* 1. Total Orders */}
              <div className="rounded-3xl px-5 py-5"
                style={{ background: "linear-gradient(135deg, #4361EE 0%, #3752D3 100%)" }}>
                <p className="text-xs font-semibold mb-3 uppercase tracking-wide"
                  style={{ color: "rgba(255,255,255,0.65)" }}>Total Orders</p>
                {loading ? (
                  <div className="h-9 w-16 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.2)" }} />
                ) : (
                  <>
                    <p className="text-4xl font-black leading-none mb-1.5" style={{ color: "white" }}>
                      {fmt(analytics?.totalOrders ?? 0)}
                    </p>
                    <p className="text-xs flex items-center gap-1.5 flex-wrap" style={{ color: "rgba(255,255,255,0.65)" }}>
                      {weekOverWeek !== 0 && (
                        <span className="font-bold" style={{ color: weekOverWeek >= 0 ? "#A7F3D0" : "#FCA5A5" }}>
                          {weekOverWeek >= 0 ? "+" : ""}{weekOverWeek}%
                        </span>
                      )}
                      vs last week
                    </p>
                  </>
                )}
              </div>

              {/* 2. Needs Action */}
              {(() => {
                // Only count orders that genuinely need a human decision
                const unassigned = analytics?.unassignedCount ?? 0;
                const needsAction = unassigned + openNdrs;
                const autoHandled = analytics?.autoHandledCount ?? 0;
                const urgent = openNdrs;
                const isUrgent = urgent > 0;
                return (
                  <Link href="/seller/orders" className="rounded-3xl px-5 py-5 block"
                    style={{
                      background: isUrgent ? "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)" : "white",
                      border: isUrgent ? "none" : "1px solid #E5E7EB",
                      boxShadow: "0 1px 12px rgba(0,0,0,0.04)",
                    }}>
                    <p className="text-xs font-semibold mb-3 uppercase tracking-wide"
                      style={{ color: isUrgent ? "rgba(255,255,255,0.7)" : "#9CA3AF" }}>
                      Needs Action
                    </p>
                    {loading ? (
                      <div className="h-9 w-12 rounded-xl bg-gray-100 animate-pulse" />
                    ) : (
                      <>
                        <p className="text-4xl font-black leading-none mb-1.5"
                          style={{ color: isUrgent ? "white" : (needsAction > 0 ? "#EF4444" : "#1e1b4b") }}>
                          {needsAction}
                        </p>
                        <p className="text-xs" style={{ color: isUrgent ? "rgba(255,255,255,0.7)" : "#9CA3AF" }}>
                          {urgent > 0
                            ? `${urgent} NDR urgent`
                            : needsAction > 0
                              ? `${unassigned} unassigned`
                              : autoHandled > 0
                                ? `${autoHandled} auto-handled ✓`
                                : "All caught up ✓"}
                        </p>
                      </>
                    )}
                  </Link>
                );
              })()}

              {/* 3. In Fulfillment */}
              {(() => {
                const total = analytics?.totalOrders ?? 0;
                // Active orders = total minus terminal states (delivered, RTO, cancelled)
                const inFulfillment = Math.max(0, total - (analytics?.deliveredCount ?? 0) - (analytics?.rtoCount ?? 0) - (analytics?.cancelledCount ?? 0));
                const pct = total > 0 ? Math.round((inFulfillment / total) * 100) : 0;
                return (
                  <div className="rounded-3xl px-5 py-5"
                    style={{ background: "white", border: "1px solid #E5E7EB", boxShadow: "0 1px 12px rgba(0,0,0,0.04)" }}>
                    <p className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{ color: "#9CA3AF" }}>
                      In Fulfillment
                    </p>
                    {loading ? (
                      <div className="h-9 w-12 rounded-xl bg-gray-100 animate-pulse" />
                    ) : (
                      <>
                        <p className="text-4xl font-black leading-none mb-1.5" style={{ color: "#1e1b4b" }}>
                          {fmt(inFulfillment)}
                        </p>
                        <p className="text-xs" style={{ color: "#9CA3AF" }}>
                          Active — excl. delivered &amp; cancelled
                        </p>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* 4. Delivered */}
              <div className="rounded-3xl px-5 py-5"
                style={{ background: "white", border: "1px solid #E5E7EB", boxShadow: "0 1px 12px rgba(0,0,0,0.04)" }}>
                <p className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{ color: "#9CA3AF" }}>
                  Delivered
                </p>
                {loading ? (
                  <div className="h-9 w-12 rounded-xl bg-gray-100 animate-pulse" />
                ) : (
                  <>
                    <p className="text-4xl font-black leading-none mb-1.5" style={{ color: "#059669" }}>
                      {fmt(analytics?.deliveredCount ?? 0)}
                    </p>
                    <p className="text-xs" style={{ color: "#9CA3AF" }}>
                      {deliveryRate > 0 ? `${deliveryRate.toFixed(1)}% delivery rate` : "No data yet"}
                    </p>
                  </>
                )}
              </div>

            </div>

            {/* ── Row 2: COD / RTO / Revenue ── */}
            <div className="grid grid-cols-3 gap-4">

              {/* Gross Revenue */}
              <div className="rounded-2xl px-5 py-4"
                style={{ background: "white", border: "1px solid #E5E7EB", boxShadow: "0 1px 8px rgba(0,0,0,0.03)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#9CA3AF" }}>Gross Revenue</p>
                {loading ? <div className="h-7 w-24 rounded-lg bg-gray-100 animate-pulse" /> : (
                  <>
                    <p className="text-2xl font-black" style={{ color: "#1e1b4b" }}>₹{fmt(analytics?.totalRevenue ?? 0)}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>Across all orders</p>
                  </>
                )}
              </div>

              {/* RTO */}
              <div className="rounded-2xl px-5 py-4"
                style={{ background: "white", border: "1px solid #E5E7EB", boxShadow: "0 1px 8px rgba(0,0,0,0.03)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#9CA3AF" }}>RTO</p>
                {loading ? <div className="h-7 w-16 rounded-lg bg-gray-100 animate-pulse" /> : (
                  <>
                    <p className="text-2xl font-black" style={{ color: rtoRate > 20 ? "#EF4444" : "#1e1b4b" }}>
                      {fmt(analytics?.rtoCount ?? 0)}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>
                      {rtoRate > 0 ? `${rtoRate.toFixed(1)}% return rate` : "No RTOs yet"}
                    </p>
                  </>
                )}
              </div>

              {/* Net Earnings */}
              <div className="rounded-2xl px-5 py-4"
                style={{ background: "white", border: "1px solid #E5E7EB", boxShadow: "0 1px 8px rgba(0,0,0,0.03)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#9CA3AF" }}>Wallet Balance</p>
                {loading ? <div className="h-7 w-20 rounded-lg bg-gray-100 animate-pulse" /> : (
                  <>
                    <p className="text-2xl font-black" style={{ color: "#059669" }}>₹{fmt(wallet?.balance ?? 0)}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>Available to withdraw</p>
                  </>
                )}
              </div>

            </div>

          </div>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────── */}
      <div className="px-4 md:px-8 py-6 space-y-5">

        {/* ── AXQEN Needs Your Attention ── */}
        {(() => {
          // Build unified attention items — one source of truth, real conditions only
          type Priority = "HIGH" | "ATTENTION" | "MONITOR";
          interface AttentionItem {
            id: string; priority: Priority; type: string;
            externalOrderId: string; badge: string; title: string;
            problem: string; recommendation: string; amount?: number; href: string;
          }

          // NDR reason → human-readable problem
          const ndrProblemLabel = (reason: string | null, attempts: number): string => {
            if (!reason) return `Delivery failed — ${attempts} attempt${attempts !== 1 ? "s" : ""}`;
            const r = reason.toLowerCase();
            if (r.includes("not home") || r.includes("absent")) return "Customer not available at address";
            if (r.includes("refused") || r.includes("reject")) return "Customer refused delivery";
            if (r.includes("wrong address") || r.includes("incorrect")) return "Address issue reported by courier";
            if (r.includes("pincode") || r.includes("serviceable")) return "Pincode not serviceable by courier";
            if (r.includes("phone") || r.includes("contact")) return "Customer unreachable by courier";
            return reason.length > 60 ? `${reason.slice(0, 60)}…` : reason;
          };

          const ndrRecommendation = (reason: string | null): string => {
            if (!reason) return "Call customer and reschedule delivery";
            const r = reason.toLowerCase();
            if (r.includes("refused")) return "Confirm order intent before re-attempt";
            if (r.includes("wrong address") || r.includes("incorrect")) return "Get correct address from customer";
            if (r.includes("pincode") || r.includes("serviceable")) return "Arrange alternate courier for this pincode";
            if (r.includes("not home") || r.includes("absent")) return "Schedule re-delivery at preferred time";
            return "Call customer and reschedule delivery";
          };

          // COD orders with supplier assigned but confirmation still pending
          const codConfirmPending = attentionNewOrders.filter(
            o => o.paymentMode === "COD" && !!o.supplierId && o.confirmationStatus === "PENDING"
          );
          // Only include unassigned new orders (AXQEN hasn't handled them)
          const unassignedNew = attentionNewOrders.filter(o => !o.supplierId);

          // Supplier delay orders (from analytics, count only — no order details here)
          const delayCount = analytics?.supplierDelayCount ?? 0;

          const items: AttentionItem[] = [
            // HIGH: NDR orders — each unique (different reason, recommendation)
            ...ndrOrders.map(o => ({
              id: o.id,
              priority: "HIGH" as Priority,
              type: "NDR",
              externalOrderId: o.externalOrderId,
              badge: "NDR",
              title: ndrProblemLabel(o.ndrReason, o.ndrAttempts),
              problem: `${o.ndrAttempts} delivery attempt${o.ndrAttempts !== 1 ? "s" : ""} failed`,
              recommendation: ndrRecommendation(o.ndrReason),
              amount: o.totalAmount,
              href: "/seller/ndr",
            })),
            // ATTENTION: supplier delay notice (single summary card if any)
            ...(delayCount > 0 ? [{
              id: "supplier-delay",
              priority: "ATTENTION" as Priority,
              type: "SUPPLIER_DELAY",
              externalOrderId: `${delayCount} order${delayCount !== 1 ? "s" : ""}`,
              badge: "Delayed",
              title: `Supplier processing delayed >24h`,
              problem: `${delayCount} order${delayCount !== 1 ? "s have" : " has"} no progress update from supplier`,
              recommendation: "Contact supplier to confirm status",
              href: "/seller/orders?status=PROCESSING",
            }] : []),
            // ATTENTION: unassigned new orders
            ...unassignedNew.slice(0, 3).map(o => ({
              id: o.id,
              priority: "ATTENTION" as Priority,
              type: "NEW_ORDER",
              externalOrderId: o.externalOrderId,
              badge: "Unassigned",
              title: "No supplier assigned yet",
              problem: "Order is new and awaiting fulfillment start",
              recommendation: "Assign to supplier or auto-dispatch",
              amount: o.totalAmount,
              href: "/seller/orders?status=NEW",
            })),
            // ATTENTION: COD orders with supplier assigned but confirmation pending
            // HillTeck is handling the call — seller does not need to contact the customer.
            // Card informs of the state without asking for manual action.
            ...codConfirmPending.slice(0, 3).map(o => ({
              id: `cod-confirm-${o.id}`,
              priority: "ATTENTION" as Priority,
              type: "COD_CONFIRM",
              externalOrderId: o.externalOrderId,
              badge: "COD Confirm",
              title: "COD confirmation pending",
              problem: "Awaiting customer confirmation before dispatch",
              recommendation: "HillTeck is handling customer confirmation — no action needed from you",
              amount: o.totalAmount,
              href: `/seller/orders/${o.id}`,
            })),
          ];

          const highCount      = items.filter(i => i.priority === "HIGH").length;
          const attentionCount = items.filter(i => i.priority === "ATTENTION").length;
          const monitorCount   = items.filter(i => i.priority === "MONITOR").length;

          const priorityStyle: Record<Priority, { dot: string; text: string; bg: string; border: string }> = {
            HIGH:      { dot: "#EF4444", text: "#EF4444", bg: "#FEF2F2",             border: "#FECACA" },
            ATTENTION: { dot: "#F59E0B", text: "#D97706", bg: "#FFFBEB",             border: "#FDE68A" },
            MONITOR:   { dot: "#EAB308", text: "#A16207", bg: "rgba(234,179,8,0.08)", border: "#FEF08A" },
          };

          if (items.length === 0 && !loading) return null;

          return (
            <div className="rounded-3xl overflow-hidden"
              style={{ background: "white", border: "1px solid #E5E7EB", boxShadow: "0 1px 12px rgba(0,0,0,0.04)" }}>

              {/* Header */}
              <div className="px-6 pt-5 pb-4 flex items-center justify-between flex-wrap gap-3"
                style={{ borderBottom: "1px solid #F3F4F6" }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: highCount > 0 ? "#FEF2F2" : "#FFF7ED" }}>
                    <span className="text-base">{highCount > 0 ? "🔴" : "🟠"}</span>
                  </div>
                  <div>
                    <h2 className="text-base font-bold tracking-tight" style={{ color: "#1e1b4b" }}>
                      AXQEN Needs Your Attention
                    </h2>
                    {loading ? (
                      <div className="h-3 w-32 rounded mt-1 bg-gray-100 animate-pulse" />
                    ) : (
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {highCount > 0 && (
                          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#EF4444" }}>
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                            {highCount} High priority
                          </span>
                        )}
                        {attentionCount > 0 && (
                          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#D97706" }}>
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                            {attentionCount} Attention required
                          </span>
                        )}
                        {monitorCount > 0 && (
                          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#A16207" }}>
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
                            {monitorCount} Monitor
                          </span>
                        )}
                        {items.length === 0 && (
                          <span className="text-xs" style={{ color: "#9CA3AF" }}>All caught up ✓</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <Link href="/seller/orders"
                  className="text-xs font-semibold flex items-center gap-1 transition-opacity hover:opacity-70"
                  style={{ color: "#4361EE" }}>
                  View all <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Cards */}
              <div className="p-4 space-y-3">
                {loading ? (
                  [1, 2].map(i => (
                    <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: "#F9FAFB" }} />
                  ))
                ) : items.length === 0 ? (
                  <div className="py-10 flex flex-col items-center gap-2">
                    <span className="text-2xl">✅</span>
                    <p className="text-sm font-semibold" style={{ color: "#1e1b4b" }}>All orders are on track</p>
                    <p className="text-xs" style={{ color: "#9CA3AF" }}>Nothing needs your attention right now</p>
                  </div>
                ) : (
                  items.slice(0, 5).map(item => {
                    const s = priorityStyle[item.priority];
                    return (
                      <div key={item.id} className="rounded-2xl px-4 py-3.5 flex items-start justify-between gap-3"
                        style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-bold" style={{ color: "#1e1b4b" }}>
                              #{item.externalOrderId}
                            </span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: "white", color: s.text, border: `1px solid ${s.border}` }}>
                              {item.badge}
                            </span>
                            {item.amount != null && (
                              <span className="text-xs font-semibold" style={{ color: "#6B7280" }}>
                                ₹{fmt(item.amount)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium mb-0.5 leading-snug" style={{ color: "#374151" }}>
                            {item.title}
                          </p>
                          {"problem" in item && (item as { problem?: string }).problem && (
                            <p className="text-xs mb-0.5" style={{ color: "#6B7280" }}>
                              {(item as { problem?: string }).problem}
                            </p>
                          )}
                          <p className="text-xs" style={{ color: s.text }}>
                            AXQEN recommends: {item.recommendation}
                          </p>
                        </div>
                        <Link href={item.href}
                          className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-opacity hover:opacity-80"
                          style={{ background: "white", color: s.text, border: `1px solid ${s.border}` }}>
                          Review
                        </Link>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })()}

        {/* Order Health */}
        <div className="rounded-3xl overflow-hidden"
          style={{ background: "white", border: "1px solid #E5E7EB", boxShadow: "0 1px 12px rgba(0,0,0,0.04)" }}>

          {/* Header */}
          <div className="px-6 pt-5 pb-4 flex items-center justify-between flex-wrap gap-3"
            style={{ borderBottom: "1px solid #F3F4F6" }}>
            <div>
              <h2 className="text-base font-bold" style={{ color: "#1e1b4b" }}>Order Health</h2>
              <div className="flex items-center gap-4 mt-1">
                {[
                  { label: "Orders",    color: "#4361EE" },
                  { label: "Delivered", color: "#059669" },
                ].map(l => (
                  <span key={l.label} className="flex items-center gap-1.5 text-xs" style={{ color: "#9CA3AF" }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />{l.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-0.5 rounded-xl p-1" style={{ background: "#F3F4F6" }}>
              {[7, 14, 30, 60].map((d) => (
                <button key={d} onClick={() => setChartDays(d)}
                  className="px-3 py-1 text-xs font-semibold rounded-lg transition-all"
                  style={chartDays === d
                    ? { background: "white", color: "#1e1b4b", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
                    : { color: "#9CA3AF" }}>
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {/* Operational State Strip */}
          {(() => {
            const total       = analytics?.totalOrders ?? 0;
            const confirmed   = newOrdersCount; // NEW = placed but not yet assigned
            const delivered   = analytics?.deliveredCount ?? 0;
            const rto         = analytics?.rtoCount ?? 0;
            const cancelled   = analytics?.cancelledCount ?? 0;
            const shipped     = analytics?.inTransitCount ?? 0;
            const processing  = Math.max(0, total - confirmed - shipped - delivered - rto - cancelled);
            const ndrCount    = openNdrs;

            const states = [
              { label: "Orders",     count: total,      color: "#4361EE", bg: "rgba(67,97,238,0.08)"  },
              { label: "Confirmed",  count: confirmed,  color: "#6366F1", bg: "rgba(99,102,241,0.08)" },
              { label: "Processing", count: processing, color: "#F59E0B", bg: "#FFFBEB"               },
              { label: "Shipped",    count: shipped,    color: "#7C3AED", bg: "rgba(124,58,237,0.08)" },
              { label: "Delivered",  count: delivered,  color: "#059669", bg: "#ECFDF5"               },
              { label: "NDR",        count: ndrCount,   color: "#F97316", bg: "#FFF7ED"               },
              { label: "RTO",        count: rto,        color: "#EF4444", bg: "#FEF2F2"               },
            ];

            return (
              <div className="px-4 py-3 overflow-x-auto" style={{ borderBottom: "1px solid #F3F4F6" }}>
                <div className="flex items-center gap-2 min-w-max">
                  {loading ? (
                    Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} className="h-9 w-20 rounded-xl animate-pulse" style={{ background: "#F3F4F6" }} />
                    ))
                  ) : (
                    states.map(s => (
                      <div key={s.label} className="flex flex-col items-center px-3.5 py-1.5 rounded-xl"
                        style={{ background: s.bg, minWidth: 72 }}>
                        <span className="text-base font-black leading-tight" style={{ color: s.color }}>
                          {fmt(s.count)}
                        </span>
                        <span className="text-[10px] font-semibold mt-0.5" style={{ color: s.color, opacity: 0.75 }}>
                          {s.label}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })()}

          {/* Chart */}
          <div className="px-6 pt-5 pb-3">
            {loading ? (
              <div className="h-52 rounded-2xl animate-pulse" style={{ background: "#F9FAFB" }} />
            ) : chartData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm" style={{ color: "#9CA3AF" }}>No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="Orders"    stroke="#4361EE" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Delivered" stroke="#059669" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Breakdown + Last 7 days */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x"
            style={{ borderTop: "1px solid #F3F4F6", borderColor: "#F3F4F6" }}>

            <div className="px-6 py-5">
              {isMarketplace ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: "#9CA3AF" }}>Listing Breakdown</p>
                  <div className="space-y-3">
                    {[
                      { label: "Live",        count: listingStats?.listed     ?? 0, color: "#4361EE" },
                      { label: "In Progress", count: listingStats?.inProgress ?? 0, color: "#7C3AED" },
                      { label: "Pending",     count: listingStats?.pending    ?? 0, color: "#F59E0B" },
                      { label: "Failed",      count: listingStats?.failed     ?? 0, color: "#EF4444" },
                    ].map(item => {
                      const total = listingStats?.total || 1;
                      const pct   = Math.round((item.count / total) * 100);
                      return (
                        <div key={item.label}>
                          <div className="flex justify-between mb-1.5">
                            <span className="text-xs font-medium" style={{ color: "#6B7280" }}>{item.label}</span>
                            <span className="text-xs font-bold" style={{ color: "#1e1b4b" }}>
                              {item.count} <span style={{ color: "#9CA3AF" }}>({pct}%)</span>
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full" style={{ background: "#F3F4F6" }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: item.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: "#9CA3AF" }}>Delivery Breakdown</p>
                  <div className="space-y-3">
                    {[
                      { label: "Delivered",  count: analytics?.deliveredCount ?? 0, color: "#4361EE" },
                      { label: "In Transit", count: analytics?.inTransitCount ?? 0, color: "#7C3AED" },
                      { label: "Cancelled",  count: analytics?.cancelledCount ?? 0, color: "#9CA3AF" },
                    ].map(item => {
                      const total = analytics?.totalOrders || 1;
                      const pct   = Math.round((item.count / total) * 100);
                      return (
                        <div key={item.label}>
                          <div className="flex justify-between mb-1.5">
                            <span className="text-xs font-medium" style={{ color: "#6B7280" }}>{item.label}</span>
                            <span className="text-xs font-bold" style={{ color: "#1e1b4b" }}>
                              {item.count} <span style={{ color: "#9CA3AF" }}>({pct}%)</span>
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full" style={{ background: "#F3F4F6" }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: item.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {last7.length >= 3 && (
              <div className="px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: "#9CA3AF" }}>Last 7 Days</p>
                <div className="space-y-1">
                  {(isMarketplace ? [
                    { label: "Orders",    value: last7Total,                                 icon: ShoppingCart, color: "#4361EE", delta: weekOverWeek },
                    { label: "Delivered", value: last7.reduce((s, d) => s + d.delivered, 0), icon: CheckCircle2, color: "#059669", delta: null },
                    { label: "Listings",  value: listingStats?.total ?? 0,                   icon: Layers,       color: "#7C3AED", delta: null },
                  ] : [
                    { label: "Orders",    value: last7Total,                                        icon: ShoppingCart, color: "#4361EE", delta: weekOverWeek },
                    { label: "Delivered", value: last7.reduce((s, d) => s + d.delivered, 0),        icon: CheckCircle2, color: "#059669", delta: null },
                    { label: "Avg/day",   value: +(last7Total / 7).toFixed(1),                      icon: Clock,        color: "#6366F1", delta: null },
                  ]).map(row => {
                    const Icon = row.icon;
                    return (
                      <div key={row.label} className="flex items-center justify-between py-2.5"
                        style={{ borderBottom: "1px solid #F9FAFB" }}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                            style={{ background: `${row.color}15` }}>
                            <Icon className="w-3.5 h-3.5" style={{ color: row.color }} />
                          </div>
                          <span className="text-xs font-medium" style={{ color: "#6B7280" }}>{row.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold" style={{ color: "#1e1b4b" }}>{row.value}</span>
                          {row.delta !== null && Math.abs(row.delta) > 0 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                              style={{ background: row.delta >= 0 ? "rgba(67,97,238,0.1)" : "#FEF2F2", color: row.delta >= 0 ? "#4361EE" : "#DC2626" }}>
                              {row.delta >= 0 ? "▲" : "▼"}{Math.abs(row.delta)}%
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {bestDay && (
                    <p className="text-[10px] pt-2" style={{ color: "#9CA3AF" }}>
                      🏆 Best: {new Date(bestDay.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} — {bestDay.total} orders
                    </p>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── Fulfillment Health ── */}
        {!isMarketplace && (
          <div className="rounded-3xl overflow-hidden"
            style={{ background: "white", border: "1px solid #E5E7EB", boxShadow: "0 1px 12px rgba(0,0,0,0.04)" }}>

            {/* Header */}
            <div className="px-6 pt-5 pb-4 flex items-center justify-between"
              style={{ borderBottom: "1px solid #F3F4F6" }}>
              <div>
                <h2 className="text-base font-bold" style={{ color: "#1e1b4b" }}>Fulfillment Pipeline</h2>
                <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>Where are your orders right now?</p>
              </div>
              <Link href="/seller/orders"
                className="text-xs font-semibold flex items-center gap-1 transition-opacity hover:opacity-70"
                style={{ color: "#4361EE" }}>
                View orders <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Pipeline flow */}
              {(() => {
                const p = analytics?.pipeline;
                const stages = [
                  { label: "New",        count: p?.new        ?? newOrdersCount, color: "#4361EE", bg: "rgba(67,97,238,0.08)"  },
                  { label: "Confirmed",  count: p?.confirmed  ?? 0,              color: "#6366F1", bg: "rgba(99,102,241,0.08)" },
                  { label: "Processing", count: p?.processing ?? 0,              color: "#F59E0B", bg: "#FFFBEB"               },
                  { label: "Shipped",    count: p?.shipped    ?? 0,              color: "#7C3AED", bg: "rgba(124,58,237,0.08)" },
                  { label: "In Transit", count: p?.inTransit  ?? (analytics?.inTransitCount ?? 0), color: "#0891B2", bg: "#ECFEFF" },
                  { label: "Delivered",  count: p?.delivered  ?? (analytics?.deliveredCount  ?? 0), color: "#059669", bg: "#ECFDF5" },
                ];

                return (
                  <div className="overflow-x-auto">
                    <div className="flex items-stretch gap-0 min-w-max">
                      {stages.map((stage, i) => (
                        <div key={stage.label} className="flex items-center">
                          {/* Stage box */}
                          <div className="flex flex-col items-center px-5 py-4 rounded-2xl"
                            style={{
                              background: loading || stage.count === 0 ? "#F9FAFB" : stage.bg,
                              minWidth: 88,
                              opacity: loading ? 0.5 : 1,
                            }}>
                            {loading ? (
                              <div className="h-8 w-8 rounded-lg animate-pulse bg-gray-200 mb-2" />
                            ) : (
                              <span className="text-3xl font-black leading-none mb-1"
                                style={{ color: stage.count === 0 ? "#D1D5DB" : stage.color }}>
                                {fmt(stage.count)}
                              </span>
                            )}
                            <span className="text-[10px] font-bold uppercase tracking-wide"
                              style={{ color: stage.count === 0 ? "#D1D5DB" : stage.color }}>
                              {stage.label}
                            </span>
                          </div>
                          {/* Arrow connector */}
                          {i < stages.length - 1 && (
                            <span className="px-1 text-lg font-light flex-shrink-0" style={{ color: "#D1D5DB" }}>→</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Problem states row */}
              <div className="grid grid-cols-3 gap-3 pt-1" style={{ borderTop: "1px solid #F3F4F6" }}>
                {[
                  { label: "NDR",       count: analytics?.pipeline?.ndr       ?? openNdrs, color: "#F97316", bg: "#FFF7ED", border: "#FED7AA", desc: "Action needed" },
                  { label: "RTO Risk",  count: analytics?.pipeline?.rtoRisk   ?? 0,        color: "#EF4444", bg: "#FEF2F2", border: "#FECACA", desc: "Monitor closely" },
                  { label: "Cancelled", count: analytics?.pipeline?.cancelled ?? (analytics?.cancelledCount ?? 0), color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB", desc: "This period" },
                ].map(s => (
                  <div key={s.label} className="rounded-2xl px-4 py-3 flex items-center gap-3"
                    style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                    <div>
                      {loading ? (
                        <div className="h-7 w-10 rounded animate-pulse" style={{ background: s.border }} />
                      ) : (
                        <p className="text-2xl font-black leading-none" style={{ color: s.color }}>
                          {fmt(s.count)}
                        </p>
                      )}
                      <p className="text-xs font-bold mt-0.5" style={{ color: s.color }}>{s.label}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: s.color, opacity: 0.7 }}>{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Recent Orders */}
        <div className="rounded-3xl overflow-hidden"
          style={{ background: "white", border: "1px solid #E5E7EB", boxShadow: "0 1px 12px rgba(0,0,0,0.04)" }}>
          <div className="px-6 pt-5 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold" style={{ color: "#1e1b4b" }}>Recent Orders</h2>
              <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>Your latest {recentOrders.length} orders</p>
            </div>
            <Link href="/seller/orders"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
              style={{ background: "rgba(67,97,238,0.08)", color: "#4361EE" }}>
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Status filter */}
          <div className="px-6 pb-3 flex gap-1.5 flex-wrap" style={{ borderBottom: "1px solid #F3F4F6" }}>
            {["ALL", "NEW", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "RTO", "CANCELLED"].map((s) => {
              const cfg = STATUS_CONFIG[s];
              const active = orderFilter === s;
              return (
                <button key={s} onClick={() => setOrderFilter(s)}
                  className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                  style={active
                    ? { background: cfg ? cfg.color : "#4361EE", color: "#fff" }
                    : { background: cfg ? cfg.bg : "#F3F4F6", color: cfg ? cfg.color : "#6B7280" }}>
                  {s === "ALL" ? "All" : cfg?.label ?? s}
                </button>
              );
            })}
          </div>

          {loading || ordersLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 rounded-2xl animate-pulse" style={{ background: "#F9FAFB" }} />
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="py-14 flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center" style={{ background: "#F9FAFB" }}>
                <ShoppingCart className="w-7 h-7" style={{ color: "#D1D5DB" }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: "#6B7280" }}>
                {orderFilter === "ALL" ? "No orders yet" : `No ${STATUS_CONFIG[orderFilter]?.label ?? orderFilter} orders`}
              </p>
              {orderFilter === "ALL" && (
                <Link href="/seller/shopify"
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: "#4361EE" }}>
                  <Store className="w-4 h-4" /> Connect Store
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* Column headers */}
              <div className="px-6 py-2 grid items-center gap-3 hidden md:grid"
                style={{
                  gridTemplateColumns: "1fr 80px 76px 80px 100px",
                  borderBottom: "1px solid #F3F4F6",
                  background: "#FAFBFF",
                }}>
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#9CA3AF" }}>Order / Customer</span>
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#9CA3AF" }}>Amount</span>
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#9CA3AF" }}>Payment</span>
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#9CA3AF" }}>Status</span>
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#4361EE" }}>AXQEN</span>
              </div>

              {recentOrders.map((order, idx) => {
                const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.NEW;
                // paymentMode is a proper DB field (PaymentMode enum: COD | PREPAID | UNKNOWN)
                const isCod     = order.paymentMode === "COD";
                const hasNdr    = !!order.ndrStatus && !order.ndrActionTaken;
                const isRto     = order.status === "RTO";
                const isNew     = order.status === "NEW";
                const ageHours  = (Date.now() - new Date(order.createdAt).getTime()) / 3600000;
                // Stale = NEW, no supplier assigned, no update in 48h (truly stuck)
                const isStale   = isNew && !order.supplierId && ageHours > 48;
                const isRepeat  = (order.customerOrderCount ?? 1) > 1;

                // AXQEN signal — priority order matters, all rules are explicit
                const isAutoHandled = isNew && !!order.supplierId; // AXQEN already assigned
                // COD + supplier assigned + confirmation still pending → not yet fully auto-handled
                const isConfirmPending = isNew && isCod && !!order.supplierId && order.confirmationStatus === "PENDING";
                type Signal = { dot: string; label: string | null; color: string; bg: string };
                const signal: Signal = (() => {
                  if (hasNdr)             return { dot: "#EF4444", label: "NDR",             color: "#EF4444", bg: "#FEF2F2" };
                  if (isRto)              return { dot: "#EF4444", label: "RTO",             color: "#EF4444", bg: "#FEF2F2" };
                  if (isStale)            return { dot: "#EAB308", label: "Stale 48h+",     color: "#A16207", bg: "#FEFCE8" };
                  if (isNew && !order.supplierId) return { dot: "#F59E0B", label: "Unassigned", color: "#D97706", bg: "#FFFBEB" };
                  if (isConfirmPending)   return { dot: "#F59E0B", label: "Confirm pending", color: "#D97706", bg: "#FFFBEB" };
                  if (isAutoHandled)      return { dot: "#6366F1", label: "Auto-handled",    color: "#4338CA", bg: "rgba(99,102,241,0.08)" };
                  if (isRepeat && isNew)  return { dot: "#6366F1", label: "Repeat",          color: "#4338CA", bg: "rgba(99,102,241,0.08)" };
                  return                         { dot: "#059669", label: null,               color: "#059669", bg: "#ECFDF5" };
                })();

                return (
                  <Link key={order.id} href={`/seller/orders/${order.id}`}
                    className="px-6 py-3.5 flex items-center gap-3 transition-colors cursor-pointer"
                    style={{ borderBottom: idx < recentOrders.length - 1 ? "1px solid #F9FAFB" : "none", display: "flex" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FAFBFF"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>

                    {/* Order + customer */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "#1e1b4b" }}>
                        #{order.externalOrderId}
                      </p>
                      <p className="text-xs truncate" style={{ color: "#9CA3AF" }}>{order.customerName}</p>
                    </div>

                    {/* Amount */}
                    <span className="text-sm font-bold flex-shrink-0 hidden md:inline" style={{ color: "#1e1b4b" }}>
                      ₹{fmt(order.totalAmount)}
                    </span>

                    {/* Payment mode */}
                    {order.paymentMode && order.paymentMode !== "UNKNOWN" ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 hidden md:inline"
                        style={isCod
                          ? { background: "#FFF7ED", color: "#D97706" }
                          : { background: "#F0FDF4", color: "#059669" }}>
                        {isCod ? "COD" : "Prepaid"}
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 hidden md:inline"
                        style={{ background: "#F3F4F6", color: "#9CA3AF" }}>—</span>
                    )}

                    {/* Status */}
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 hidden md:inline"
                      style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>

                    {/* AXQEN signal */}
                    <div className="flex items-center gap-1.5 flex-shrink-0" style={{ minWidth: 72 }}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: signal.dot }} />
                      {signal.label ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: signal.bg, color: signal.color }}>
                          {signal.label}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold" style={{ color: "#9CA3AF" }}>On track</span>
                      )}
                    </div>

                    {/* Date */}
                    <span className="text-xs flex-shrink-0 hidden lg:block" style={{ color: "#9CA3AF" }}>
                      {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </Link>
                );
              })}
            </>
          )}
        </div>


        {/* Financial Health — collapsible */}
        {analytics?.earnings && (
          <div className="rounded-3xl overflow-hidden"
            style={{ border: "1px solid #E5E7EB", boxShadow: "0 1px 12px rgba(0,0,0,0.04)" }}>
            <Accordion
              label="Financial Health"
              icon={Wallet}
              open={showFinancials}
              onToggle={() => setShowFinancials(v => !v)}
              badge={metaConnected && adSpend > 0 ? `${(adRevenue / adSpend).toFixed(2)}x ROAS` : undefined}
            />
            {showFinancials && (() => {
              const e = analytics.earnings;
              const net    = e.netProfit - adSpend;
              const margin = e.totalGMV > 0 ? (net / e.totalGMV) * 100 : 0;
              const profit = net >= 0;
              // Show "—" for cost rows where data is not tracked for any delivered orders
              const noProductCost = e.productCostTracked === 0;
              const noShipping    = e.shippingTracked === 0;

              type FinRow = { label: string; value: number | null; color: string; sign: string; note?: string };
              const rows: FinRow[] = [
                { label: "Revenue (Delivered orders)", value: e.totalGMV,        color: "#4361EE", sign: "+" },
                { label: "Product Cost",               value: noProductCost ? null : e.totalProductCost, color: "#EF4444", sign: "−", note: noProductCost ? "Not tracked" : undefined },
                { label: "Shipping",                   value: noShipping    ? null : e.totalShipping,    color: "#EF4444", sign: "−", note: noShipping ? "Not tracked" : undefined },
                { label: `AXQEN Platform Fee (₹${e.platformFeePerOrder}×${e.deliveredCount})`, value: e.totalPlatformFee, color: "#EF4444", sign: "−" },
                { label: "RTO Losses",                 value: e.totalRtoCharge, color: "#EF4444", sign: "−" },
                { label: "Ad Spend",                   value: adSpend,          color: "#7C3AED", sign: "−" },
              ];
              return (
                <div className="bg-white px-6 py-5" style={{ borderTop: "1px solid #F3F4F6" }}>
                  {/* Estimated profit hero */}
                  <div className="flex items-start justify-between mb-5 p-4 rounded-2xl"
                    style={{ background: profit ? "rgba(67,97,238,0.06)" : "#FEF2F2" }}>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#9CA3AF" }}>
                          Estimated Profit
                        </p>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                          style={{ background: "rgba(245,158,11,0.12)", color: "#D97706" }}>
                          Estimate
                        </span>
                      </div>
                      <p className="text-2xl font-black" style={{ color: profit ? "#4361EE" : "#EF4444" }}>
                        {profit ? "+" : "−"}₹{fmt(Math.abs(net))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs" style={{ color: "#9CA3AF" }}>Est. margin</p>
                      <p className="text-xl font-black" style={{ color: profit ? "#4361EE" : "#EF4444" }}>{margin.toFixed(1)}%</p>
                    </div>
                  </div>

                  {/* Line items */}
                  <div className="space-y-0">
                    {rows.map(r => (
                      <div key={r.label} className="flex items-center justify-between py-2.5"
                        style={{ borderBottom: "1px solid #F9FAFB" }}>
                        <p className="text-xs font-medium" style={{ color: "#6B7280" }}>{r.label}</p>
                        {r.value === null ? (
                          <p className="text-xs font-semibold" style={{ color: "#D1D5DB" }}>{r.note ?? "—"}</p>
                        ) : (
                          <p className="text-xs font-bold" style={{ color: r.color }}>{r.sign}₹{fmt(r.value)}</p>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-3">
                      <div>
                        <p className="text-sm font-black" style={{ color: "#1e1b4b" }}>Estimated Profit</p>
                        <p className="text-[10px] mt-0.5" style={{ color: "#9CA3AF" }}>
                          Delivered orders only · refunds not yet included{(noProductCost || noShipping) ? " · some costs not tracked" : ""}
                        </p>
                      </div>
                      <p className="text-sm font-black" style={{ color: profit ? "#4361EE" : "#EF4444" }}>
                        {profit ? "+" : "−"}₹{fmt(Math.abs(net))} ({margin.toFixed(1)}%)
                      </p>
                    </div>
                  </div>

                  {!metaConnected && (
                    <Link href="/seller/profile?tab=integrations"
                      className="flex items-center justify-between mt-4 px-4 py-3 rounded-2xl"
                      style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.12)" }}>
                      <div className="flex items-center gap-2.5">
                        <Megaphone className="w-4 h-4" style={{ color: "#7C3AED" }} />
                        <span className="text-xs font-semibold" style={{ color: "#7C3AED" }}>Connect Meta Ads to track ROAS</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5" style={{ color: "#7C3AED" }} />
                    </Link>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── AXQEN Activity ── */}
        {!isMarketplace && (
          <div className="rounded-3xl px-6 py-6 overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #0f0c29 0%, #1e1b4b 60%, #24243e 100%)",
              boxShadow: "0 4px 32px rgba(67,97,238,0.18)",
            }}>

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(99,102,241,0.3)" }}>
                  <span className="text-sm">✦</span>
                </div>
                <div>
                  <p className="text-sm font-black tracking-tight" style={{ color: "white" }}>
                    AXQEN Activity
                  </p>
                  <p className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>
                    What AXQEN handled for you today
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider"
                style={{ background: "rgba(99,102,241,0.25)", color: "rgba(165,180,252,0.9)" }}>
                Today
              </span>
            </div>

            {/* Activity list — all counts are today-scoped (actual events, not standing state) */}
            {(() => {
              const a = aiActivity;
              const items = [
                { count: a?.autoDispatched            ?? 0, label: "shipments auto-dispatched today",     icon: "📦" },
                { count: a?.newOrdersToday            ?? 0, label: "new orders ingested today",           icon: "⚡" },
                { count: a?.ndrOpenedToday            ?? 0, label: "NDR cases opened today",              icon: "⚠️" },
                { count: a?.supplierDelaysDetectedToday ?? 0, label: "supplier delays detected today",   icon: "🔍" },
                { count: a?.humanActionsNeeded        ?? 0, label: "items currently need your attention", icon: "🤝" },
              ];
              const activityLoading = !a;

              return (
                <div className="space-y-2.5 mb-5">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      {activityLoading ? (
                        <div className="h-5 w-full rounded-lg animate-pulse"
                          style={{ background: "rgba(255,255,255,0.08)" }} />
                      ) : item.count === 0 ? (
                        <div className="flex items-center gap-2 opacity-30">
                          <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>—</span>
                          <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                            0 {item.label}
                          </span>
                        </div>
                      ) : (
                        <>
                          <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]"
                            style={{ background: "rgba(99,102,241,0.35)" }}>
                            ✓
                          </span>
                          <span className="text-sm" style={{ color: "rgba(255,255,255,0.9)" }}>
                            <span className="font-black" style={{ color: "white" }}>{item.count}</span>
                            {" "}{item.label}
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Divider */}
            <div className="mb-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />

            {/* Time saved — formula from API; caption reproduces exactly same calculation */}
            {aiActivity ? (
              aiActivity.timeSaved > 0 ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>
                      Estimated time saved today
                    </p>
                    <p className="text-2xl font-black mt-0.5" style={{ color: "white" }}>
                      {aiActivity.timeSavedLabel}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: "rgba(165,180,252,0.5)" }}>
                      {aiActivity.autoDispatched}×{aiActivity.timeSavedRates.autoDispatchedMinutes}m dispatch
                      {" + "}{aiActivity.newOrdersToday}×{aiActivity.timeSavedRates.newOrderIngestedMinutes}m ingestion
                      {" + "}{aiActivity.ndrOpenedToday}×{aiActivity.timeSavedRates.ndrOpenedMinutes}m NDR
                      {" + "}{aiActivity.supplierDelaysDetectedToday}×{aiActivity.timeSavedRates.supplierDelayMinutes}m delays
                      {" = "}{aiActivity.timeSaved}min
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(99,102,241,0.25)" }}>
                    <span className="text-xl">⏱</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                  No automated actions yet today — activity updates throughout the day.
                </p>
              )
            ) : (
              <div className="h-8 w-40 rounded-lg animate-pulse"
                style={{ background: "rgba(255,255,255,0.08)" }} />
            )}
          </div>
        )}

        {/* Bottom spacer */}
        <div className="h-4" />
      </div>
    </div>
  );
}
