import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  Package, Users, ShoppingCart, ListChecks,
  ArrowRight, Store, IndianRupee, AlertTriangle,
  BadgeIndianRupee, TrendingUp, MoreHorizontal,
  Zap, CheckCircle2,
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

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  APPROVED:    { bg: "rgba(22,163,74,0.1)",  color: "#16A34A" },
  PENDING:     { bg: "rgba(245,158,11,0.1)", color: "#D97706" },
  REJECTED:    { bg: "rgba(239,68,68,0.1)",  color: "#EF4444" },
  LISTED:      { bg: "rgba(22,163,74,0.1)",  color: "#16A34A" },
  FAILED:      { bg: "rgba(239,68,68,0.1)",  color: "#EF4444" },
  IN_PROGRESS: { bg: "rgba(67,97,238,0.1)",  color: "#4361EE" },
};

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayStr = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const [
    totalOrders, deliveredOrders, rtoOrders, activeOrders, cancelledOrders, newToday,
    totalSellers, activeSellers, totalSuppliers,
    pendingProducts, pendingListings,
    gmvResult,
    pendingNdrs, unremittedOrders, unassignedOrders,
    pendingPayablesAgg,
    recentProducts, recentListings,
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
    prisma.product.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { supplier: { select: { name: true } } } }),
    prisma.listingRequest.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { seller: { select: { name: true, brandName: true } }, product: { select: { name: true } } } }),
  ]);

  const gmv = gmvResult._sum.totalAmount ?? 0;
  const pendingPayablesAmount = pendingPayablesAgg._sum.amount ?? 0;
  const pendingPayablesCount  = pendingPayablesAgg._count.id ?? 0;
  const firstName = session.user.name?.split(" ")[0] ?? "there";

  const alerts = [
    pendingNdrs > 0          && { label: "NDRs pending",       value: pendingNdrs,                href: "/admin/ndr",              color: "#EF4444", bg: "rgba(239,68,68,0.07)" },
    unassignedOrders > 0     && { label: "Unassigned orders",  value: unassignedOrders,           href: "/admin/orders",           color: "#D97706", bg: "rgba(245,158,11,0.07)" },
    unremittedOrders > 0     && { label: "Unremitted orders",  value: unremittedOrders,           href: "/admin/remittance",       color: "#4361EE", bg: "rgba(67,97,238,0.07)" },
    pendingPayablesCount > 0 && { label: "Supplier payables",  value: fmt(pendingPayablesAmount), href: "/admin/supplier-payables",color: "#16A34A", bg: "rgba(22,163,74,0.07)" },
  ].filter(Boolean) as { label: string; value: string | number; href: string; color: string; bg: string }[];

  return (
    <div className="flex-1 overflow-auto" style={{ background: "var(--bg-page)" }}>
      <div className="p-5 md:p-7">

        {/* ── Heading ── */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>
              {todayStr}
            </p>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              Good {greeting()}, {firstName}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {[
              { label: "Orders",    href: "/admin/orders" },
              { label: "Finance",   href: "/admin/finance" },
              { label: "Sellers",   href: "/admin/sellers" },
            ].map(({ label, href }) => (
              <Link key={label} href={href}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold hidden md:block"
                style={{ background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* ── Main two-column layout ── */}
        <div className="flex gap-5">

          {/* ── LEFT COLUMN ── */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* Featured GMV card — stays dark/colored as the hero element */}
            <div className="rounded-2xl p-6 relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #1e2d6b 0%, #111d45 60%, #0c1530 100%)",
                boxShadow: "0 4px 24px rgba(67,97,238,0.2)",
              }}>
              <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(67,97,238,0.4) 0%, transparent 70%)" }} />

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Platform GMV
                    </p>
                    <p className="text-4xl font-black text-white">{fmt(gmv)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                    style={{ background: "var(--bg-muted)", color: "var(--text-primary)" }}>
                    <Zap className="w-3 h-3" />
                    Live
                  </div>
                </div>

                <div className="flex items-center gap-5 flex-wrap">
                  {[
                    { label: "Total Orders", value: totalOrders,     color: "#fff" },
                    { label: "New Today",    value: newToday,        color: "#93C5FD" },
                    { label: "Delivered",    value: deliveredOrders, color: "#86EFAC" },
                    { label: "In Transit",   value: activeOrders,    color: "#FDE68A" },
                  ].map(({ label, value, color }, i) => (
                    <div key={label} className="flex items-center gap-4">
                      {i > 0 && <div className="w-px h-6" style={{ background: "var(--bg-muted)" }} />}
                      <div>
                        <p className="text-xl font-bold" style={{ color }}>{value}</p>
                        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* KPI mini row */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Active Sellers",   value: activeSellers,    sub: `${totalSellers} total`,                          color: "#8B5CF6", bg: "rgba(139,92,246,0.1)", icon: Store },
                { label: "Suppliers",        value: totalSuppliers,   sub: "connected",                                      color: "#4361EE", bg: "rgba(67,97,238,0.1)",  icon: IndianRupee },
                { label: "Pending Review",   value: pendingProducts + pendingListings, sub: `${pendingProducts}p · ${pendingListings}l`, color: "#D97706", bg: "rgba(245,158,11,0.1)", icon: Package },
              ].map(({ label, value, sub, color, bg, icon: Icon }) => (
                <div key={label} className="rounded-2xl p-4"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3" style={{ background: bg }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
                  <p className="text-xs font-medium mt-0.5" style={{ color: "var(--text-secondary)" }}>{label}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>
                </div>
              ))}
            </div>

            {/* Order trend chart */}
            <div className="rounded-2xl p-5"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Order Trend</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Last 30 days</p>
                </div>
                <button style={{ color: "var(--text-muted)" }}><MoreHorizontal className="w-4 h-4" /></button>
              </div>
              <AdminOrderTrendChart />
            </div>

            {/* Recent submissions — feed cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Recent Submissions</p>
                <Link href="/admin/products" className="text-xs font-medium flex items-center gap-1" style={{ color: "var(--accent)" }}>
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {recentProducts.length === 0 ? (
                <div className="rounded-2xl p-6 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>No products yet</p>
                </div>
              ) : recentProducts.map((p) => {
                const timeAgo = (() => {
                  const diff = Date.now() - new Date(p.createdAt).getTime();
                  const h = Math.floor(diff / 3600000);
                  if (h < 1) return "Just now";
                  if (h < 24) return `${h}h ago`;
                  return `${Math.floor(h / 24)}d ago`;
                })();
                const s = STATUS_STYLE[p.status];
                return (
                  <Link key={p.id} href="/admin/products"
                    className="block rounded-2xl p-4 transition-all group"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                    <div className="flex items-start justify-between mb-2">
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide"
                        style={{ background: s?.bg ?? "var(--bg-muted)", color: s?.color ?? "var(--text-secondary)" }}>
                        {p.status}
                      </span>
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{timeAgo}</span>
                    </div>
                    <p className="text-sm font-semibold mb-0.5 truncate" style={{ color: "var(--text-primary)" }}>{p.name}</p>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>by {p.supplier?.name ?? "Unknown"}</p>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                          style={{ background: "var(--accent)" }}>
                          {(p.supplier?.name ?? "?")[0]?.toUpperCase()}
                        </div>
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{p.supplier?.name ?? "Unknown"}</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-muted)" }} />
                    </div>
                  </Link>
                );
              })}
            </div>

          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="w-68 flex-shrink-0 space-y-4" style={{ width: "270px" }}>

            {/* Order status breakdown */}
            <div className="rounded-2xl p-5"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Order Status</p>
                <span className="text-[10px] font-medium px-2 py-1 rounded-lg"
                  style={{ background: "var(--bg-muted)", color: "var(--text-muted)" }}>
                  All time
                </span>
              </div>
              <div className="space-y-3.5">
                {[
                  { label: "Delivered",  value: deliveredOrders, color: "#16A34A", pct: totalOrders ? Math.round(deliveredOrders / totalOrders * 100) : 0 },
                  { label: "In Transit", value: activeOrders,    color: "#4361EE", pct: totalOrders ? Math.round(activeOrders / totalOrders * 100) : 0 },
                  { label: "RTO",        value: rtoOrders,       color: "#D97706", pct: totalOrders ? Math.round(rtoOrders / totalOrders * 100) : 0 },
                  { label: "Cancelled",  value: cancelledOrders, color: "#EF4444", pct: totalOrders ? Math.round(cancelledOrders / totalOrders * 100) : 0 },
                ].map(({ label, value, color, pct }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{value}</span>
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{pct}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-muted)" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alerts */}
            {alerts.length > 0 && (
              <div className="rounded-2xl p-5"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Needs Attention</p>
                  <AlertTriangle className="w-4 h-4" style={{ color: "#D97706" }} />
                </div>
                <div className="space-y-2">
                  {alerts.map((a) => (
                    <Link key={a.href} href={a.href}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                      style={{ background: a.bg, border: `1px solid ${a.color}20` }}>
                      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{a.label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold" style={{ color: a.color }}>{a.value}</span>
                        <ArrowRight className="w-3 h-3" style={{ color: a.color }} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="rounded-2xl p-5"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
              <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Quick Actions</p>
              <div className="space-y-1.5">
                {[
                  { label: "Manage Orders",    href: "/admin/orders",   icon: ShoppingCart, color: "#4361EE" },
                  { label: "Review Products",  href: "/admin/products", icon: Package,      color: "#D97706" },
                  { label: "Listing Requests", href: "/admin/listings", icon: ListChecks,   color: "#EF4444" },
                  { label: "Manage Sellers",   href: "/admin/sellers",  icon: Users,        color: "#8B5CF6" },
                  { label: "Finance OS",       href: "/admin/finance",  icon: TrendingUp,   color: "#4361EE" },
                ].map(({ label, href, icon: Icon, color }) => (
                  <Link key={href} href={href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl group"
                    style={{ background: "var(--bg-muted)", border: "1px solid var(--border)" }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${color}15` }}>
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    <span className="flex-1 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span>
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-muted)" }} />
                  </Link>
                ))}
              </div>
            </div>

            {/* Listing requests */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Listing Requests</p>
                <Link href="/admin/listings" className="text-xs font-medium" style={{ color: "var(--accent)" }}>See all</Link>
              </div>
              {recentListings.length === 0 ? (
                <p className="p-4 text-xs" style={{ color: "var(--text-muted)" }}>No requests</p>
              ) : recentListings.map((l, i) => (
                <div key={l.id} className="px-4 py-3 flex items-center justify-between"
                  style={{ borderBottom: i < recentListings.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{l.product.name}</p>
                    <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                      {l.seller.brandName || l.seller.name} → {l.platform}
                    </p>
                  </div>
                  <span className="ml-2 flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{ background: STATUS_STYLE[l.status]?.bg ?? "var(--bg-muted)", color: STATUS_STYLE[l.status]?.color ?? "var(--text-secondary)" }}>
                    {l.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Supplier payables quick info */}
            {pendingPayablesCount > 0 && (
              <div className="rounded-2xl p-5"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(22,163,74,0.1)" }}>
                    <CheckCircle2 className="w-4 h-4" style={{ color: "#16A34A" }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Supplier Payables</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{pendingPayablesCount} pending</p>
                  </div>
                </div>
                <Link href="/admin/supplier-payables"
                  className="flex items-center justify-between px-3 py-2 rounded-xl"
                  style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.15)" }}>
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Total due</span>
                  <span className="text-sm font-bold" style={{ color: "#16A34A" }}>{fmt(pendingPayablesAmount)}</span>
                </Link>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
