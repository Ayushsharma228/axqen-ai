import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  ArrowRight, AlertTriangle, TrendingUp, CheckCircle2,
  Truck, RotateCcw, XCircle, Clock, Package,
  IndianRupee, BarChart2, Bot, Settings,
  ShoppingCart, Users, Store, ListChecks,
  ShoppingBag, Zap, UserCheck, PhoneCall,
  Wallet, BadgeCheck, Flame,
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
    // Platform overview
    gmvResult,
    platformEarningsResult,
    totalOrders,
    productsListed,

    // Orders breakdown
    newToday,
    pendingOrders,
    deliveredOrders,
    rtoOrders,
    cancelledOrders,
    inTransitOrders,

    // Remittance
    remittancePendingCount,
    remittancePendingAmtResult,
    remittanceDoneCount,
    remittanceDoneAmtResult,

    // Leads
    totalLeads,
    closedLeads,
    notInterestedLeads,
    hotLeads,
    salesCallsBooked,

    // Alerts
    pendingNdrs,
    unassignedOrders,
    pendingProducts,
    pendingPayablesAgg,

    // Misc
    activeSellers,
    totalSellers,
    totalSuppliers,
  ] = await Promise.all([
    // Platform overview
    prisma.order.aggregate({ _sum: { totalAmount: true } }),
    prisma.settlement.aggregate({ _sum: { platformEarnings: true } }),
    prisma.order.count(),
    prisma.listingRequest.count({ where: { status: "LISTED" } }),

    // Orders breakdown
    prisma.order.count({ where: { createdAt: { gte: today } } }),
    prisma.order.count({ where: { status: { in: ["NEW", "PROCESSING"] as never[] } } }),
    prisma.order.count({ where: { status: "DELIVERED" as never } }),
    prisma.order.count({ where: { status: "RTO" as never } }),
    prisma.order.count({ where: { status: "CANCELLED" as never } }),
    prisma.order.count({ where: { status: { in: ["SHIPPED", "IN_TRANSIT"] as never[] } } }),

    // Remittance
    prisma.order.count({ where: { remittedAt: null, status: { in: ["DELIVERED", "RTO"] as never[] } } }),
    prisma.order.aggregate({ where: { remittedAt: null, status: { in: ["DELIVERED", "RTO"] as never[] } }, _sum: { totalAmount: true } }),
    prisma.order.count({ where: { remittedAt: { not: null } } }),
    prisma.order.aggregate({ where: { remittedAt: { not: null } }, _sum: { totalAmount: true } }),

    // Leads
    prisma.lead.count(),
    prisma.lead.count({ where: { stage: { in: ["PAID", "ONBOARDED"] as never[] } } }),
    prisma.lead.count({ where: { isNI: true } }),
    prisma.lead.count({ where: { temperature: "HOT" as never } }),
    prisma.lead.count({ where: { salesCallBookedAt: { not: null } } }),

    // Alerts
    prisma.order.count({ where: { ndrStatus: { not: null }, ndrActionTaken: null } }),
    prisma.order.count({ where: { supplierId: null, status: { notIn: ["DELIVERED", "CANCELLED", "RTO"] as never[] } } }),
    prisma.product.count({ where: { status: "PENDING" as never } }),
    prisma.supplierPayment.aggregate({ where: { status: "PENDING" as never }, _sum: { amount: true }, _count: { id: true } }),

    // Misc
    prisma.user.count({ where: { role: "SELLER", accountStatus: "ACTIVE" } }),
    prisma.user.count({ where: { role: "SELLER" } }),
    prisma.user.count({ where: { role: "SUPPLIER" } }),
  ]);

  const gmv               = gmvResult._sum.totalAmount ?? 0;
  const platformEarnings  = platformEarningsResult._sum.platformEarnings ?? 0;
  const remittancePending = remittancePendingAmtResult._sum.totalAmount ?? 0;
  const remittanceCollected = remittanceDoneAmtResult._sum.totalAmount ?? 0;
  const pendingPayablesCount = pendingPayablesAgg._count.id ?? 0;
  const pendingPayablesAmount = pendingPayablesAgg._sum.amount ?? 0;
  const firstName = session.user.name?.split(" ")[0] ?? "Admin";
  const totalOrNon0 = totalOrders || 1;
  const totalLeadsNon0 = totalLeads || 1;

  const alerts = [
    pendingNdrs > 0          && { label: "NDRs pending",       value: pendingNdrs,                href: "/admin/ndr",               color: "#EF4444", border: "rgba(239,68,68,0.2)",   bg: "rgba(239,68,68,0.06)" },
    unassignedOrders > 0     && { label: "Unassigned orders",  value: unassignedOrders,           href: "/admin/orders",            color: "#D97706", border: "rgba(245,158,11,0.2)",  bg: "rgba(245,158,11,0.06)" },
    pendingPayablesCount > 0 && { label: "Supplier payables",  value: fmt(pendingPayablesAmount), href: "/admin/supplier-payables", color: "#16A34A", border: "rgba(22,163,74,0.2)",   bg: "rgba(22,163,74,0.06)" },
    pendingProducts > 0      && { label: "Products pending",   value: pendingProducts,            href: "/admin/products",          color: "#8B5CF6", border: "rgba(139,92,246,0.2)",  bg: "rgba(139,92,246,0.06)" },
  ].filter(Boolean) as { label: string; value: string | number; href: string; color: string; border: string; bg: string }[];

  return (
    <div className="flex-1 overflow-auto" style={{ background: "var(--bg-page)" }}>
      <div className="p-5 md:p-7 max-w-[1280px] mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>{todayStr}</p>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              Good {greeting()}, {firstName}
            </h1>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: "rgba(67,97,238,0.1)", color: "#4361EE", border: "1px solid rgba(67,97,238,0.2)" }}>
            <Zap className="w-3 h-3" /> Live
          </div>
        </div>

        {/* ══ SECTION 1: Platform ══ */}
        <Section label="Platform" href="/admin/analytics">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiTile label="Revenue Generated" value={fmt(gmv)}              sub="all-time GMV"          color="#4361EE" icon={TrendingUp} />
            <KpiTile label="Platform Earnings"  value={fmt(platformEarnings)} sub="net after GST"         color="#16A34A" icon={IndianRupee} />
            <KpiTile label="Total Orders"       value={totalOrders.toLocaleString()} sub={`${newToday} new today`} color="#8B5CF6" icon={ShoppingCart} />
            <KpiTile label="Products Listed"    value={productsListed.toLocaleString()} sub="on marketplaces"  color="#D97706" icon={Package} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <MiniStat label="Active Sellers"  value={activeSellers}   sub={`${totalSellers} total`}  color="#8B5CF6" />
            <MiniStat label="Suppliers"       value={totalSuppliers}  sub="connected"                color="#4361EE" />
            <MiniStat label="NDRs Pending"    value={pendingNdrs}     sub="needs action"             color={pendingNdrs > 0 ? "#EF4444" : "#9CA3AF"} />
          </div>
        </Section>

        {/* ══ SECTION 2: Orders ══ */}
        <Section label="Orders" href="/admin/orders">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Received",   value: totalOrders,    color: "#4361EE", icon: ShoppingCart, pct: null },
              { label: "Pending",    value: pendingOrders,  color: "#D97706", icon: Clock,        pct: Math.round(pendingOrders / totalOrNon0 * 100) },
              { label: "In Transit", value: inTransitOrders,color: "#06B6D4", icon: Truck,        pct: Math.round(inTransitOrders / totalOrNon0 * 100) },
              { label: "Delivered",  value: deliveredOrders,color: "#16A34A", icon: CheckCircle2, pct: Math.round(deliveredOrders / totalOrNon0 * 100) },
              { label: "RTO",        value: rtoOrders,      color: "#F97316", icon: RotateCcw,    pct: Math.round(rtoOrders / totalOrNon0 * 100) },
              { label: "Cancelled",  value: cancelledOrders,color: "#EF4444", icon: XCircle,      pct: Math.round(cancelledOrders / totalOrNon0 * 100) },
            ].map(({ label, value, color, icon: Icon, pct }) => (
              <div key={label} className="rounded-2xl p-4"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                  {pct !== null && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                      style={{ background: `${color}15`, color }}>
                      {pct}%
                    </span>
                  )}
                </div>
                <p className="text-2xl font-black leading-none mb-1" style={{ color: "var(--text-primary)" }}>
                  {value.toLocaleString()}
                </p>
                <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</p>
              </div>
            ))}
          </div>
          {/* Order trend inline */}
          <div className="mt-3 rounded-2xl p-5"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Order Trend — Last 30 Days
            </p>
            <AdminOrderTrendChart />
          </div>
        </Section>

        {/* ══ SECTION 3: Remittance ══ */}
        <Section label="Remittance" href="/admin/remittance">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <RemittanceTile
              label="Pending"
              count={remittancePendingCount}
              amount={remittancePending}
              color="#EF4444"
              icon={Clock}
              sub="delivered/RTO not remitted"
            />
            <RemittanceTile
              label="Remitted"
              count={remittanceDoneCount}
              amount={remittanceCollected}
              color="#16A34A"
              icon={BadgeCheck}
              sub="settled to sellers"
            />
            <div className="rounded-2xl p-5"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(67,97,238,0.1)" }}>
                  <Wallet className="w-3.5 h-3.5" style={{ color: "#4361EE" }} />
                </div>
                <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Supplier Payables</span>
              </div>
              <p className="text-2xl font-black mb-0.5" style={{ color: pendingPayablesCount > 0 ? "#4361EE" : "var(--text-primary)" }}>
                {fmt(pendingPayablesAmount)}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{pendingPayablesCount} invoices pending</p>
              {pendingPayablesCount > 0 && (
                <Link href="/admin/supplier-payables"
                  className="mt-3 flex items-center gap-1 text-xs font-medium"
                  style={{ color: "#4361EE" }}>
                  Pay now <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>
        </Section>

        {/* ══ SECTION 4: Leads ══ */}
        <Section label="Leads" href="/admin/crm">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: "Received",      value: totalLeads,         color: "#4361EE", icon: Users,      sub: "total pipeline" },
              { label: "Closed / Won",  value: closedLeads,        color: "#16A34A", icon: UserCheck,  sub: `${Math.round(closedLeads / totalLeadsNon0 * 100)}% conv. rate` },
              { label: "Not Interested",value: notInterestedLeads, color: "#EF4444", icon: XCircle,    sub: `${Math.round(notInterestedLeads / totalLeadsNon0 * 100)}% of leads` },
              { label: "Hot Leads",     value: hotLeads,           color: "#F97316", icon: Flame,      sub: "high intent" },
              { label: "Calls Booked",  value: salesCallsBooked,   color: "#8B5CF6", icon: PhoneCall,  sub: "scheduled demos" },
            ].map(({ label, value, color, icon: Icon, sub }) => (
              <div key={label} className="rounded-2xl p-4"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ background: `${color}15` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <p className="text-2xl font-black leading-none mb-1" style={{ color: "var(--text-primary)" }}>
                  {value.toLocaleString()}
                </p>
                <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ══ Needs Attention ══ */}
        {alerts.length > 0 && (
          <div className="rounded-2xl p-5"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4" style={{ color: "#D97706" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Needs Attention</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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

        {/* ══ Quick Access ══ */}
        <div className="rounded-2xl p-5"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
          <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Quick Access</p>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {[
              { label: "Orders",       href: "/admin/orders",         icon: ShoppingCart, color: "#4361EE" },
              { label: "Fulfillment",  href: "/admin/delivery",       icon: Truck,        color: "#8B5CF6" },
              { label: "Products",     href: "/admin/products",       icon: Package,      color: "#D97706" },
              { label: "Sellers",      href: "/admin/sellers",        icon: Store,        color: "#EC4899" },
              { label: "Finance",      href: "/admin/reconciliation", icon: BarChart2,    color: "#16A34A" },
              { label: "Listings",     href: "/admin/listings",       icon: ListChecks,   color: "#EF4444" },
              { label: "AI Workforce", href: "/admin/ai-workforce",   icon: Bot,          color: "#8B5CF6" },
              { label: "Settings",     href: "/admin/config",         icon: Settings,     color: "#6B7280" },
            ].map(({ label, href, icon: Icon, color }) => (
              <Link key={href} href={href}
                className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-center"
                style={{ background: "var(--bg-muted)", border: "1px solid var(--border)" }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <span className="text-[11px] font-medium leading-tight" style={{ color: "var(--text-secondary)" }}>{label}</span>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Section({ label, href, children }: { label: string; href: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
        <Link href={href} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent)" }}>
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {children}
    </div>
  );
}

function KpiTile({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub: string; color: string; icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl p-4"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}15` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <p className="text-2xl font-black leading-none mb-1" style={{ color: "var(--text-primary)" }}>{value}</p>
      <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</p>
      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>
    </div>
  );
}

function MiniStat({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <div className="rounded-xl px-4 py-3 flex items-center justify-between"
      style={{ background: "var(--bg-muted)", border: "1px solid var(--border)" }}>
      <div>
        <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</p>
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{sub}</p>
      </div>
      <p className="text-xl font-black" style={{ color }}>{value.toLocaleString()}</p>
    </div>
  );
}

function RemittanceTile({ label, count, amount, color, icon: Icon, sub }: {
  label: string; count: number; amount: number; color: string; icon: React.ElementType; sub: string;
}) {
  return (
    <div className="rounded-2xl p-5"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{label}</span>
      </div>
      <p className="text-2xl font-black mb-0.5" style={{ color: "var(--text-primary)" }}>
        {fmt(amount)}
      </p>
      <p className="text-xs font-medium" style={{ color }}>{count.toLocaleString()} orders</p>
      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>
    </div>
  );
}
