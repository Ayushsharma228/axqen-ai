import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  Package, CheckCircle, Clock, XCircle,
  Plus, ArrowRight, AlertCircle, ShoppingCart,
  ClipboardList, Boxes, TrendingUp, Wallet,
  Truck, Receipt, ChevronRight, Activity,
} from "lucide-react";

export default async function SupplierDashboard() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const supplierId = session.user.id;
  const firstName = session.user.name?.split(" ")[0] || "Supplier";

  const [
    totalProducts, pendingProducts, approvedProducts, rejectedProducts,
    pendingOrders, activeOrders, dispatchedOrders,
    pendingPOs, activePOs,
    totalInventoryItems, lowStockItems,
  ] = await Promise.all([
    prisma.product.count({ where: { supplierId } }),
    prisma.product.count({ where: { supplierId, status: "PENDING" } }),
    prisma.product.count({ where: { supplierId, status: "APPROVED" } }),
    prisma.product.count({ where: { supplierId, status: "REJECTED" } }),
    prisma.order.count({ where: { supplierId, supplierStatus: "ASSIGNED" } }),
    prisma.order.count({ where: { supplierId, supplierStatus: { in: ["ACCEPTED", "PROCESSING", "PACKED", "READY_TO_SHIP"] } } }),
    prisma.order.count({ where: { supplierId, supplierStatus: "DISPATCHED" } }),
    prisma.purchaseOrder.count({ where: { supplierId, status: "SENT" } }),
    prisma.purchaseOrder.count({ where: { supplierId, status: { in: ["ACCEPTED", "PROCESSING", "PACKED"] } } }),
    prisma.inventoryItem.count({ where: { supplierId } }),
    prisma.inventoryItem.count({ where: { supplierId, availableQty: { lte: 5 } } }),
  ]);

  const recentOrders = await prisma.order.findMany({
    where: { supplierId },
    take: 6,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, externalOrderId: true, status: true, supplierStatus: true,
      totalAmount: true, customerName: true, createdAt: true,
    },
  });

  const rejectedWithNotes = await prisma.product.findMany({
    where: { supplierId, status: "REJECTED", adminNote: { not: null } },
    take: 3,
    select: { id: true, name: true, adminNote: true },
  });

  const SUPPLIER_STATUS_BADGE: Record<string, { bg: string; text: string; label: string; dot: string }> = {
    ASSIGNED:      { bg: "#FFF7ED", text: "#D97706", label: "Pending Acceptance", dot: "#F59E0B" },
    ACCEPTED:      { bg: "#EFF6FF", text: "#3B82F6", label: "Accepted",           dot: "#3B82F6" },
    PROCESSING:    { bg: "#F5F3FF", text: "#7C3AED", label: "Processing",         dot: "#7C3AED" },
    PACKED:        { bg: "#F0F9FF", text: "#0369A1", label: "Packed",             dot: "#0369A1" },
    READY_TO_SHIP: { bg: "#FFF7ED", text: "#EA580C", label: "Ready to Ship",      dot: "#EA580C" },
    DISPATCHED:    { bg: "#F0FDF4", text: "#15803D", label: "Dispatched",         dot: "#16A34A" },
    REJECTED:      { bg: "#FEF2F2", text: "#DC2626", label: "Rejected",           dot: "#EF4444" },
  };

  const urgentCount = pendingOrders + pendingPOs;
  const totalOrdersActive = pendingOrders + activeOrders;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page)" }}>

      {/* ── Hero ── */}
      <div className="px-4 md:px-8 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              Good day, {firstName}
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {urgentCount > 0
                ? `${urgentCount} item${urgentCount !== 1 ? "s" : ""} need your attention`
                : "Everything looks good today"}
            </p>
          </div>
          <Link
            href="/supplier/products/new"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white flex-shrink-0"
            style={{ background: "#4361EE" }}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Product</span>
            <span className="sm:hidden">Add</span>
          </Link>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="px-4 md:px-8 mb-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Pending Orders",
              value: pendingOrders,
              icon: Clock,
              color: "#F59E0B",
              bg: "#FFFBEB",
              href: "/supplier/orders",
              urgent: pendingOrders > 0,
            },
            {
              label: "Active Orders",
              value: activeOrders,
              icon: Activity,
              color: "#3B82F6",
              bg: "#EFF6FF",
              href: "/supplier/orders",
              urgent: false,
            },
            {
              label: "Approved Products",
              value: approvedProducts,
              icon: Package,
              color: "#16A34A",
              bg: "#F0FDF4",
              href: "/supplier/products",
              urgent: false,
            },
            {
              label: "Pending POs",
              value: pendingPOs,
              icon: ClipboardList,
              color: "#7C3AED",
              bg: "#F5F3FF",
              href: "/supplier/purchase-orders",
              urgent: pendingPOs > 0,
            },
          ].map(({ label, value, icon: Icon, color, bg, href, urgent }) => (
            <Link key={label} href={href}
              className="rounded-2xl px-4 py-4 flex items-center gap-3 transition-shadow hover:shadow-md"
              style={{
                background: "var(--bg-card)",
                border: urgent ? `1px solid ${color}40` : "1px solid var(--border)",
                position: "relative",
              }}>
              {urgent && value > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse" style={{ background: color }} />
              )}
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: "var(--text-muted)" }}>{label}</p>
                <p className="text-2xl font-bold leading-tight" style={{ color: "var(--text-primary)" }}>{value}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Alert banners ── */}
      <div className="px-4 md:px-8 space-y-3 mb-5">
        {rejectedWithNotes.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-4 rounded-2xl"
            style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-700">
                {rejectedWithNotes.length} product{rejectedWithNotes.length > 1 ? "s" : ""} need attention
              </p>
              <ul className="mt-1 space-y-0.5">
                {rejectedWithNotes.map((p) => (
                  <li key={p.id} className="text-xs text-red-600 truncate">
                    <span className="font-medium">{p.name}:</span> {p.adminNote}
                  </li>
                ))}
              </ul>
            </div>
            <Link href="/supplier/products"
              className="flex-shrink-0 text-xs font-semibold text-red-600 underline">
              View
            </Link>
          </div>
        )}

        {pendingOrders > 0 && (
          <Link href="/supplier/orders"
            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl w-full text-left"
            style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
            <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-700">
                {pendingOrders} order{pendingOrders !== 1 ? "s" : ""} awaiting acceptance
              </p>
              <p className="text-xs text-amber-600">Accept promptly to maintain your rating</p>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-500 flex-shrink-0" />
          </Link>
        )}

        {lowStockItems > 0 && (
          <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
            style={{ background: "#FFF7ED", border: "1px solid #FDBA74" }}>
            <Boxes className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-700">{lowStockItems} inventory item{lowStockItems !== 1 ? "s" : ""} low on stock</p>
              <p className="text-xs text-orange-600">Restock soon to avoid order failures</p>
            </div>
            <Link href="/supplier/inventory" className="flex-shrink-0 text-xs font-semibold text-orange-600 underline">Manage</Link>
          </div>
        )}
      </div>

      <div className="px-4 md:px-8 space-y-5 pb-8">

        {/* ── Quick nav cards ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Quick Access</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              {
                label: "Order Queue",
                sub: `${pendingOrders} pending · ${activeOrders} active`,
                href: "/supplier/orders",
                icon: ShoppingCart,
                accentBg: "#EFF6FF",
                accentColor: "#3B82F6",
                badge: pendingOrders > 0 ? pendingOrders : null,
                badgeColor: "#F59E0B",
              },
              {
                label: "Purchase Orders",
                sub: `${pendingPOs} pending · ${activePOs} active`,
                href: "/supplier/purchase-orders",
                icon: ClipboardList,
                accentBg: "#F5F3FF",
                accentColor: "#7C3AED",
                badge: pendingPOs > 0 ? pendingPOs : null,
                badgeColor: "#7C3AED",
              },
              {
                label: "Inventory",
                sub: `${totalInventoryItems} items tracked`,
                href: "/supplier/inventory",
                icon: Boxes,
                accentBg: "#F0FDF4",
                accentColor: "#16A34A",
                badge: lowStockItems > 0 ? lowStockItems : null,
                badgeColor: "#F97316",
              },
              {
                label: "My Products",
                sub: `${approvedProducts} approved · ${pendingProducts} pending`,
                href: "/supplier/products",
                icon: Package,
                accentBg: "#EFF6FF",
                accentColor: "#3B82F6",
                badge: null,
                badgeColor: "",
              },
              {
                label: "Wallet",
                sub: "Orders & remittances",
                href: "/supplier/wallet",
                icon: Wallet,
                accentBg: "rgba(0,198,122,0.1)",
                accentColor: "#059669",
                badge: null,
                badgeColor: "",
              },
              {
                label: "Performance",
                sub: `${dispatchedOrders} dispatched`,
                href: "/supplier/performance",
                icon: TrendingUp,
                accentBg: "#F5F3FF",
                accentColor: "#7C3AED",
                badge: null,
                badgeColor: "",
              },
            ].map(({ label, sub, href, icon: Icon, accentBg, accentColor, badge, badgeColor }) => (
              <Link key={href} href={href}
                className="rounded-2xl px-4 py-4 flex items-center gap-3 hover:shadow-md transition-shadow group relative"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                {badge !== null && (
                  <span className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                    style={{ background: badgeColor }}>
                    {badge}
                  </span>
                )}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: accentBg }}>
                  <Icon className="w-5 h-5" style={{ color: accentColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{label}</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{sub}</p>
                </div>
                <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: "var(--text-muted)" }} />
              </Link>
            ))}
          </div>
        </div>

        {/* ── Stats summary ── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Activity Summary</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0" style={{ borderColor: "var(--border)" }}>
            {[
              { label: "Total Products", value: totalProducts, sub: `${pendingProducts} pending review`, icon: Package, color: "#3B82F6" },
              { label: "Active Orders", value: totalOrdersActive, sub: `${dispatchedOrders} dispatched`, icon: Truck, color: "#059669" },
              { label: "Products Rejected", value: rejectedProducts, sub: rejectedProducts > 0 ? "Check admin notes" : "All clear", icon: XCircle, color: rejectedProducts > 0 ? "#EF4444" : "#9CA3AF" },
              { label: "Inventory Items", value: totalInventoryItems, sub: `${lowStockItems} low stock`, icon: Boxes, color: lowStockItems > 0 ? "#F97316" : "#059669" },
            ].map(({ label, value, sub, icon: Icon, color }) => (
              <div key={label} className="px-5 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4" style={{ color }} />
                  <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</p>
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Recent Orders ── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Recent Orders</h2>
            </div>
            <Link href="/supplier/orders"
              className="flex items-center gap-1 text-xs font-semibold"
              style={{ color: "#4361EE" }}>
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-3">
              <ShoppingCart className="w-8 h-8" style={{ color: "var(--border)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No orders assigned yet</p>
              <p className="text-xs text-center px-8" style={{ color: "var(--text-muted)" }}>
                Orders from sellers will appear here once the admin assigns them to you.
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {recentOrders.map((order) => {
                const badge = order.supplierStatus ? SUPPLIER_STATUS_BADGE[order.supplierStatus] : null;
                return (
                  <div key={order.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {badge && (
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: badge.dot }} />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold font-mono" style={{ color: "var(--text-primary)" }}>
                          #{order.externalOrderId}
                        </p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                          {order.customerName ?? "—"} · ₹{order.totalAmount.toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {badge && (
                        <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{ background: badge.bg, color: badge.text }}>
                          {badge.label}
                        </span>
                      )}
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Secondary links ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Link href="/supplier/settlements"
            className="flex items-center gap-4 px-5 py-4 rounded-2xl hover:shadow-md transition-shadow group"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#F0FDF4" }}>
              <Receipt className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Settlements</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>View payment history from admin</p>
            </div>
            <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: "var(--text-muted)" }} />
          </Link>

          <Link href="/supplier/profile"
            className="flex items-center gap-4 px-5 py-4 rounded-2xl hover:shadow-md transition-shadow group"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#EFF6FF" }}>
              <CheckCircle className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Profile & Shipping</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Manage your account & shipping partners</p>
            </div>
            <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: "var(--text-muted)" }} />
          </Link>
        </div>

      </div>
    </div>
  );
}
