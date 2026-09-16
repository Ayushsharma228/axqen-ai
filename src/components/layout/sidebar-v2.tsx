"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, Package, ShoppingCart, Users, Bell,
  LogOut, Truck, Store, ListChecks, CheckSquare,
  Wallet, BadgeIndianRupee, User, Megaphone, AlertTriangle, UserCheck,
  Menu, X, ClipboardList, BarChart2, Boxes, Receipt, TrendingUp,
  Settings2, ShieldCheck, BanknoteIcon, MonitorDot, Zap, Layers,
  Bot, Activity, MessageCircle, HelpCircle, ChevronLeft, ChevronRight,
  Network, Route, CreditCard, FileText, Cpu, BookOpen, Wrench,
  BarChart, Globe, Key, ScrollText, SlidersHorizontal,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  section?: string;
}

const adminNav: NavItem[] = [
  // ── COMMAND CENTER ──────────────────────────────────────────────────────
  { label: "Overview",           href: "/admin",                   icon: LayoutDashboard, section: "COMMAND CENTER" },
  { label: "AI Activity",        href: "/admin/ai-workforce",      icon: Bot },
  { label: "Alerts",             href: "/admin/notifications",     icon: AlertTriangle },

  // ── COMMERCE ────────────────────────────────────────────────────────────
  { label: "Orders",             href: "/admin/orders",            icon: ShoppingCart,    section: "COMMERCE" },
  { label: "Fulfillment",        href: "/admin/delivery",          icon: Truck },
  { label: "Products",           href: "/admin/products",          icon: Package },
  { label: "Inventory",          href: "/admin/inventory",         icon: Boxes },
  { label: "Customers",          href: "/admin/customers",         icon: Users },

  // ── NETWORK ─────────────────────────────────────────────────────────────
  { label: "Sellers",            href: "/admin/sellers",           icon: Store,           section: "NETWORK" },
  { label: "Suppliers",          href: "/admin/purchase-orders",   icon: Network },
  { label: "Shipping",           href: "/admin/delivery",          icon: Route },

  // ── FINANCE ─────────────────────────────────────────────────────────────
  { label: "Transactions",       href: "/admin/reconciliation",    icon: Receipt,         section: "FINANCE" },
  { label: "Seller Settlements", href: "/admin/remittance",        icon: BadgeIndianRupee },
  { label: "Supplier Payments",  href: "/admin/supplier-payables", icon: TrendingUp },
  { label: "Platform Revenue",   href: "/admin/analytics",         icon: BarChart },
  { label: "Reconciliation",     href: "/admin/reconciliation",    icon: CheckSquare },

  // ── OPERATIONS ──────────────────────────────────────────────────────────
  { label: "COD Verification",   href: "/admin/hillteck",          icon: MessageCircle,   section: "OPERATIONS" },
  { label: "NDR Management",     href: "/admin/ndr",               icon: MonitorDot },
  { label: "Automation",         href: "/admin/automation",        icon: Zap },
  { label: "Tasks & Approvals",  href: "/admin/operations",        icon: ClipboardList },

  // ── AI WORKFORCE ────────────────────────────────────────────────────────
  { label: "AI Employees",       href: "/admin/ai-workforce",      icon: Cpu,             section: "AI WORKFORCE" },
  { label: "AI Tasks",           href: "/admin/ai-workforce",      icon: ListChecks },
  { label: "AI Tools",           href: "/admin/ai-workforce",      icon: Wrench },
  { label: "AI Memory",          href: "/admin/ai-workforce",      icon: BookOpen },
  { label: "Activity Logs",      href: "/admin/ai-workforce",      icon: ScrollText },

  // ── GROWTH ──────────────────────────────────────────────────────────────
  { label: "Meta Ads",           href: "/admin/ad-spend",          icon: Megaphone,       section: "GROWTH" },
  { label: "Sales & CRM",        href: "/admin/crm",               icon: UserCheck },
  { label: "Campaigns",          href: "/admin/whatsapp",          icon: BarChart2 },

  // ── PLATFORM ────────────────────────────────────────────────────────────
  { label: "Integrations",       href: "/admin/config",            icon: Globe,           section: "PLATFORM" },
  { label: "API & Webhooks",     href: "/admin/config",            icon: Key },
  { label: "Notifications",      href: "/admin/notifications",     icon: Bell },
  { label: "Plans & Billing",    href: "/admin/activation",        icon: CreditCard },

  // ── ADMIN ───────────────────────────────────────────────────────────────
  { label: "Team & Roles",       href: "/admin/users",             icon: ShieldCheck,     section: "ADMIN" },
  { label: "Permissions",        href: "/admin/users",             icon: SlidersHorizontal },
  { label: "Audit Logs",         href: "/admin/operations",        icon: FileText },
  { label: "System Settings",    href: "/admin/config",            icon: Settings2 },
];

const dropshippingNav: NavItem[] = [
  { label: "Dashboard",     href: "/seller",                  icon: LayoutDashboard, section: "MAIN" },
  { label: "Analytics",     href: "/seller/analytics",        icon: BarChart2 },
  { label: "Orders",        href: "/seller/orders",           icon: ShoppingCart,    section: "FULFILMENT" },
  { label: "Delivery",      href: "/seller/deliveries",       icon: Truck },
  { label: "NDR",           href: "/seller/ndr",              icon: AlertTriangle },
  { label: "Products",      href: "/seller/catalog",          icon: Package,         section: "PRODUCTS" },
  { label: "Wallet",        href: "/seller/wallet",           icon: Wallet,          section: "FINANCE" },
  { label: "Settlements",   href: "/seller/settlements",      icon: Receipt },
  { label: "Shopify Store", href: "/seller/shopify",          icon: Store,           section: "SETTINGS" },
  { label: "Activation",    href: "/seller/activation",       icon: Activity,        section: "ACCOUNT" },
  { label: "Support",       href: "/seller/support",          icon: HelpCircle },
  { label: "Notifications", href: "/seller/notifications",    icon: Bell },
  { label: "Profile",       href: "/seller/profile",          icon: User },
];

const marketplaceNav: NavItem[] = [
  { label: "Dashboard",     href: "/seller",                  icon: LayoutDashboard, section: "MAIN" },
  { label: "Analytics",     href: "/seller/analytics",        icon: BarChart2 },
  { label: "Orders",        href: "/seller/orders",           icon: ShoppingCart,    section: "FULFILMENT" },
  { label: "Delivery",      href: "/seller/deliveries",       icon: Truck },
  { label: "Returns",       href: "/seller/ndr",              icon: AlertTriangle },
  { label: "Listings",      href: "/seller/listings",         icon: ListChecks,      section: "PRODUCTS" },
  { label: "Inventory",     href: "/seller/inventory",        icon: Boxes },
  { label: "Wallet",        href: "/seller/wallet",           icon: Wallet,          section: "FINANCE" },
  { label: "Settlements",   href: "/seller/settlements",      icon: Receipt },
  { label: "Advertising",   href: "/seller/advertising",      icon: Megaphone },
  { label: "Amazon",        href: "/seller/amazon",           icon: ShoppingCart,    section: "MARKETPLACES" },
  { label: "Shopify Store", href: "/seller/shopify",          icon: Store },
  { label: "Activation",    href: "/seller/activation",       icon: Activity,        section: "ACCOUNT" },
  { label: "Support",       href: "/seller/support",          icon: HelpCircle },
  { label: "Notifications", href: "/seller/notifications",    icon: Bell },
  { label: "Profile",       href: "/seller/profile",          icon: User },
];

const salesNav: NavItem[] = [
  { label: "Dashboard",  href: "/sales",         icon: LayoutDashboard, section: "MAIN" },
  { label: "My Leads",   href: "/sales/leads",   icon: UserCheck },
  { label: "Inbox",      href: "/sales/inbox",   icon: MessageCircle },
];

const supplierNav: NavItem[] = [
  { label: "Dashboard",       href: "/supplier",                 icon: LayoutDashboard, section: "MAIN" },
  { label: "Performance",     href: "/supplier/performance",     icon: TrendingUp },
  { label: "Order Queue",     href: "/supplier/orders",          icon: ShoppingCart,    section: "ORDERS" },
  { label: "Purchase Orders", href: "/supplier/purchase-orders", icon: ClipboardList },
  { label: "My Products",     href: "/supplier/products",        icon: Package,         section: "CATALOGUE" },
  { label: "Add Product",     href: "/supplier/products/new",    icon: CheckSquare },
  { label: "Inventory",       href: "/supplier/inventory",       icon: Boxes },
  { label: "Wallet",          href: "/supplier/wallet",          icon: Wallet,          section: "FINANCE" },
  { label: "Settlements",     href: "/supplier/settlements",     icon: Receipt },
  { label: "Notifications",   href: "/supplier/notifications",   icon: Bell,            section: "ACCOUNT" },
  { label: "Profile",         href: "/supplier/profile",         icon: User },
];

interface SidebarV2Props {
  role: "admin" | "seller" | "supplier" | "sales";
  plan?: string;
  userName?: string;
  userEmail?: string;
}

export function SidebarV2({ role, plan, userName, userEmail }: SidebarV2Props) {
  const pathname = usePathname();
  const [collapsed,    setCollapsed]    = useState(false);
  const [unreadCount,  setUnreadCount]  = useState(0);
  const [waUnread,     setWaUnread]     = useState(0);
  const [mobileOpen,   setMobileOpen]   = useState(false);

  // Persist collapsed state per role
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`sidebar-collapsed-${role}`);
      if (stored !== null) setCollapsed(stored === "true");
    } catch {}
  }, [role]);

  function toggleCollapsed() {
    setCollapsed(prev => {
      try { localStorage.setItem(`sidebar-collapsed-${role}`, String(!prev)); } catch {}
      return !prev;
    });
  }

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (role !== "seller") return;
    fetch("/api/seller/notifications").then(r => r.json()).then(d => setUnreadCount(d.unreadCount ?? 0)).catch(() => {});
  }, [role]);

  useEffect(() => {
    if (role !== "sales") return;
    const poll = () =>
      fetch("/api/sales/conversations/unread").then(r => r.json()).then(d => setWaUnread(d.unread ?? 0)).catch(() => {});
    poll();
    const t = setInterval(poll, 30000);
    return () => clearInterval(t);
  }, [role]);

  const sellerNav = plan === "MARKETPLACE" ? marketplaceNav : dropshippingNav;
  const nav = role === "admin" ? adminNav : role === "seller" ? sellerNav : role === "sales" ? salesNav : supplierNav;
  const initial = userName?.[0]?.toUpperCase() || "U";

  const content = (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-sidebar)" }}>

      {/* Logo + toggle */}
      <div className="h-14 px-3 flex items-center gap-2 flex-shrink-0 relative"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <img src="/axqen-icon.png" alt="AXQEN" className="w-7 h-7 rounded-lg flex-shrink-0 object-cover" />
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm tracking-wide truncate leading-tight" style={{ color: "var(--text-primary)" }}>
              AXQEN
            </p>
            {role === "admin" && (
              <p className="text-[9px] font-semibold uppercase tracking-widest truncate leading-tight" style={{ color: "var(--text-muted)" }}>
                Admin Console
              </p>
            )}
          </div>
        )}
        <button
          onClick={toggleCollapsed}
          className="hidden md:flex w-6 h-6 items-center justify-center rounded-lg transition-colors flex-shrink-0"
          style={{ color: "var(--text-muted)" }}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto overflow-x-hidden">
        {nav.map((item) => {
          const Icon = item.icon;
          const roots = ["/admin", "/seller", "/supplier", "/sales"];
          const itemPath = item.href.split("?")[0];
          const isActive = pathname === itemPath || (!roots.includes(itemPath) && pathname.startsWith(itemPath));
          const badge =
            item.href === "/seller/notifications" && unreadCount > 0 ? unreadCount :
            item.href === "/sales/inbox"           && waUnread > 0    ? waUnread : 0;

          return (
            <div key={item.href}>
              {/* Section label — only when expanded */}
              {item.section && !collapsed && (
                <p className="text-[9px] font-bold uppercase tracking-widest px-2 pb-1 mt-5 mb-0.5"
                  style={{ color: "var(--text-muted)", letterSpacing: "0.12em" }}>
                  {item.section}
                </p>
              )}
              {/* Section divider — only when collapsed */}
              {item.section && collapsed && (
                <div className="my-2 mx-2 h-px" style={{ background: "var(--border)" }} />
              )}

              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                className="flex items-center gap-2.5 py-2 rounded-xl text-sm transition-all duration-100 mb-0.5 relative"
                style={{
                  paddingLeft: collapsed ? "0" : "10px",
                  paddingRight: collapsed ? "0" : "10px",
                  justifyContent: collapsed ? "center" : "flex-start",
                  background: isActive ? "rgba(67,97,238,0.1)" : "transparent",
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  fontWeight: isActive ? 600 : 500,
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--bg-muted)"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span className="flex-1 truncate text-xs">{item.label}</span>}
                {!collapsed && badge > 0 && (
                  <span className="w-4 h-4 text-[9px] font-bold rounded-full bg-red-500 text-white flex items-center justify-center flex-shrink-0">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
                {collapsed && badge > 0 && (
                  <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-red-500" />
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
        {/* User */}
        <div className={`flex items-center gap-2.5 px-2 py-2 rounded-xl mb-1 ${collapsed ? "justify-center" : ""}`}
          style={{ background: "var(--bg-muted)" }}
          title={collapsed ? `${userName} · ${userEmail}` : undefined}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: "var(--accent)" }}>
            {initial}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{userName || "User"}</p>
              <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{userEmail}</p>
            </div>
          )}
        </div>

        {/* Sign out */}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={`flex items-center gap-2.5 w-full py-2 rounded-xl text-sm transition-all ${collapsed ? "justify-center px-0" : "px-2"}`}
          style={{ color: "var(--text-muted)" }}
          title={collapsed ? "Sign out" : undefined}
          onMouseEnter={e => { e.currentTarget.style.color = "#EF4444"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="text-xs font-medium">Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile topbar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4"
        style={{ background: "var(--bg-sidebar)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <img src="/axqen-icon.png" alt="AXQEN" className="w-7 h-7 rounded-lg object-cover" />
          <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>AXQEN</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="p-2" style={{ color: "var(--text-secondary)" }}>
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-56 h-full z-10">
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 p-1.5 rounded-lg z-10"
              style={{ color: "var(--text-secondary)" }}>
              <X className="w-5 h-5" />
            </button>
            {content}
          </aside>
        </div>
      )}

      {/* Desktop */}
      <aside
        className="hidden md:flex flex-col min-h-screen flex-shrink-0 transition-all duration-200"
        style={{
          width: collapsed ? "60px" : "216px",
          background: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {content}
      </aside>
    </>
  );
}
