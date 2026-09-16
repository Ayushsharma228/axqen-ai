import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  Package, Users, ShoppingCart, ListChecks,
  ArrowRight, Store, IndianRupee, AlertTriangle,
  TrendingUp, CheckCircle2, Truck, BarChart2,
  FileText, Bot, Globe, CreditCard, Settings,
  ShoppingBag, Zap, Clock, RotateCcw,
} from "lucide-react";
import { AdminOrderTrendChart } from "@/components/admin/order-trend-chart";

function fmt(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  });

  const [
    totalOrders, deliveredOrders, rtoOrders, activeOrders, cancelledOrders, newToday,
    totalSellers, activeSellers, totalSuppliers,
    pendingProducts, pendingListings,
    gmvResult,
    pendingNdrs, unremittedOrders, unassignedOrders,
    pendingPayablesAgg,
    recentListings,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: "DELIVERED" } }),
    prisma.order.count({ where: { status: "RTO" } }),
    prisma.order.count({ where: { status: { in: ["PROCESSING", "SHIPPED", "IN_TRANSIT"] } } }),
    prisma.order.count({ where: { status: "CANCELLED" } }),
    prisma.order.count({ where: { createdAt: { gte: today } } }),
    prisma.user.count({ where: { role: "SELLER" } }),
    prisma.user.count({ where: { role: "SELLER", accountStatus: "ACTIVE" } }),
    prisma.user.count({ where: { role: "SUPPLIER" } }),
    prisma.product.count({ where: { status: "PENDING" } }),
    prisma.listingRequest.count({ where: { status: "PENDING" } }),
    prisma.order.aggregate({ _sum: { totalAmount: true } }),
    prisma.order.count({ where: { ndrStatus: { not: null }, ndrActionTaken: null } }),
    prisma.order.count({ where: { remittedAt: null, status: { in: ["DELIVERED", "RTO"] } } }),
    prisma.order.count({ where: { supplierId: null, status: { notIn: ["DELIVERED", "CANCELLED", "RTO"] } } }),
    prisma.supplierPayment.aggregate({ where: { status: "PENDING" }, _sum: { amount: true }, _count: { id: true } }),
    prisma.listingRequest.findMany({
      take: 4, orderBy: { createdAt: "desc" },
      include: { seller: { select: { name: true, brandName: true } }, product: { select: { name: true } } },
    }),
  ]);

  const gmv = gmvResult._sum.totalAmount ?? 0;
  const pendingPayablesAmount = pendingPayablesAgg._sum.amount ?? 0;
  const pendingPayablesCount  = pendingPayablesAgg._count.id ?? 0;
  const firstName = session.user.name?.split(" ")[0] ?? "Admin";

  const alerts = [
    pendingNdrs > 0          && { label: "NDRs pending",        value: pendingNdrs,                href: "/admin/ndr",               color: "#EF4444", bg: "rgba(239,68,68,0.07)",   border: "rgba(239,68,68,0.2)" },
    unassignedOrders > 0     && { label: "Unassigned orders",   value: unassignedOrders,           href: "/admin/orders",            color: "#D97706", bg: "rgba(245,158,11,0.07)",  border: "rgba(245,158,11,0.2)" },
    unremittedOrders > 0     && { label: "Unremitted orders",   value: unremittedOrders,           href: "/admin/remittance",        color: "#4361EE", bg: "rgba(67,97,238,0.07)",   border: "rgba(67,97,238,0.2)" },
    pendingPayablesCount > 0 && { label: "Supplier payables",   value: fmt(pendingPayablesAmount), href: "/admin/supplier-payables", color: "#16A34A", bg: "rgba(22,163,74,0.07)",   border: "rgba(22,163,74,0.2)" },
    pendingProducts > 0      && { label: "Products pending",    value: pendingProducts,            href: "/admin/products",          color: "#8B5CF6", bg: "rgba(139,92,246,0.07)",  border: "rgba(139,92,246,0.2)" },
    pendingListings > 0      && { label: "Listing requests",    value: pendingListings,            href: "/admin/listings",          color: "#EC4899", bg: "rgba(236,72,153,0.07)",  border: "rgba(236,72,153,0.2)" },
  ].filter(Boolean) as { label: string; value: string | number; href: string; color: string; bg: string; border: string }[];

  const totalOrNon0 = totalOrders || 1;

  return (
    <div className="flex-1 overflow-auto" style={{ background: "var(--bg-page)" }}>
      <div className="p-5 md:p-7 max-w-[1280px] mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>
              {todayStr}
            </p>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              Good {greeting()}, {firstName}
            </h1>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: "rgba(67,97,238,0.1)", color: "#4361EE", border: "1px solid rgba(67,97,238,0.2)" }}>
            <Zap className="w-3 h-3" />
            Live
          </div>
        </div>

        {/* ── Top KPIs ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Platform GMV",   value: fmt(gmv),          sub: "all time",               color: "#4361EE", bg: "rgba(67,97,238,0.09)" },
            { label: "Total Orders",   value: totalOrders.toLocaleString(), sub: `${newToday} new today`, color: "#8B5CF6", bg: "rgba(139,92,246,0.09)" },
            { label: "Delivered",      value: deliveredOrders.toLocaleString(), sub: `${Math.round(deliveredOrders / totalOrNon0 * 100)}% delivery rate`, color: "#16A34A", bg: "rgba(22,163,74,0.09)" },
            { label: "Active Sellers", value: activeSellers.toLocaleString(), sub: `${totalSellers} total`,        color: "#D97706", bg: "rgba(245,158,11,0.09)" },
          ].map(({ label, value, sub, color, bg }) => (
            <div key={label} className="rounded-2xl p-4"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
              <div className="w-1.5 h-1.5 rounded-full mb-3" style={{ background: color }} />
              <p className="text-2xl font-black leading-none mb-1" style={{ color: "var(--text-primary)" }}>{value}</p>
              <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>
            </div>
          ))}
        </div>

        {/* ── Needs Attention ── */}
        {alerts.length > 0 && (
          <div className="rounded-2xl p-5"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4" style={{ color: "#D97706" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Needs Attention</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {alerts.map((a) => (
                <Link key={a.href} href={a.href}
                  className="flex items-center justify-between px-3.5 py-3 rounded-xl group"
                  style={{ background: a.bg, border: `1px solid ${a.border}` }}>
                  <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{a.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold" style={{ color: a.color }}>{a.value}</span>
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: a.color }} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick Access ── */}
        <div className="rounded-2xl p-5"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
          <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Quick Access</p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {[
              { label: "Orders",       href: "/admin/orders",            icon: ShoppingCart, color: "#4361EE" },
              { label: "Fulfillment",  href: "/admin/delivery",          icon: Truck,        color: "#8B5CF6" },
              { label: "Products",     href: "/admin/products",          icon: Package,      color: "#D97706" },
              { label: "Sellers",      href: "/admin/sellers",           icon: Store,        color: "#EC4899" },
              { label: "Finance",      href: "/admin/reconciliation",    icon: IndianRupee,  color: "#16A34A" },
              { label: "Listings",     href: "/admin/listings",          icon: ListChecks,   color: "#EF4444" },
              { label: "Inventory",    href: "/admin/inventory",         icon: ShoppingBag,  color: "#06B6D4" },
              { label: "Customers",    href: "/admin/crm",               icon: Users,        color: "#8B5CF6" },
              { label: "COD Verify",   href: "/admin/hillteck",          icon: CheckCircle2, color: "#16A34A" },
              { label: "Analytics",    href: "/admin/analytics",         icon: BarChart2,    color: "#4361EE" },
              { label: "AI Workforce", href: "/admin/ai-workforce",      icon: Bot,          color: "#8B5CF6" },
              { label: "Settings",     href: "/admin/config",            icon: Settings,     color: "#6B7280" },
            ].map(({ label, href, icon: Icon, color }) => (
              <Link key={href} href={href}
                className="flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl group text-center"
                style={{ background: "var(--bg-muted)", border: "1px solid var(--border)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: `${color}15` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <span className="text-[11px] font-medium leading-tight" style={{ color: "var(--text-secondary)" }}>{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Main grid: chart + status + listings ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Order Trend – takes 2/3 width */}
          <div className="md:col-span-2 rounded-2xl p-5"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Order Trend</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Last 30 days</p>
              </div>
              <Link href="/admin/analytics" className="flex items-center gap-1 text-xs font-medium"
                style={{ color: "var(--accent)" }}>
                Full report <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <AdminOrderTrendChart />
          </div>

          {/* Order Status – right 1/3 */}
          <div className="rounded-2xl p-5"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
            <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Order Status</p>
            <div className="space-y-4">
              {[
                { label: "Delivered",  value: deliveredOrders, color: "#16A34A", icon: CheckCircle2 },
                { label: "In Transit", value: activeOrders,    color: "#4361EE", icon: Truck },
                { label: "RTO",        value: rtoOrders,       color: "#D97706", icon: RotateCcw },
                { label: "Cancelled",  value: cancelledOrders, color: "#EF4444", icon: Clock },
              ].map(({ label, value, color, icon: Icon }) => {
                const pct = Math.round(value / totalOrNon0 * 100);
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5" style={{ color }} />
                        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{value.toLocaleString()}</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                          style={{ background: `${color}15`, color }}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-muted)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Supplier / seller mini stats */}
            <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="space-y-2">
                {[
                  { label: "Suppliers",    value: totalSuppliers, color: "#4361EE" },
                  { label: "Pending items",value: pendingProducts + pendingListings, color: "#D97706" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
                    <span className="text-sm font-bold" style={{ color }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Listing requests ── */}
        {recentListings.length > 0 && (
          <div className="rounded-2xl overflow-hidden"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Listing Requests</p>
              <Link href="/admin/listings" className="text-xs font-medium flex items-center gap-1" style={{ color: "var(--accent)" }}>
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {recentListings.map((l) => (
                <div key={l.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{l.product.name}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {l.seller.brandName || l.seller.name} → {l.platform}
                    </p>
                  </div>
                  <span className={`ml-3 flex-shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    (l.status as string) === "PENDING"  ? "bg-yellow-50 text-yellow-600" :
                    (l.status as string) === "APPROVED" ? "bg-green-50 text-green-600"  :
                    "bg-red-50 text-red-600"
                  }`}>
                    {l.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
