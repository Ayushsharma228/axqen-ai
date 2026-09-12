"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, ShoppingCart, Truck, AlertTriangle,
  Wallet, Receipt, Store, Activity, HelpCircle, Bell,
  LogOut, ChevronDown, Package, Layers, BarChart2,
  User, Box,
} from "lucide-react";

interface NavItem  { label: string; href: string; icon: React.ElementType }
interface NavGroup { label: string; href?: string; icon?: React.ElementType; items?: NavItem[] }

const dropshippingNav: NavGroup[] = [
  { label: "Dashboard",  href: "/seller",            icon: LayoutDashboard },
  { label: "Analytics",  href: "/seller/analytics",  icon: BarChart2 },
  {
    label: "Fulfilment",
    icon: Truck,
    items: [
      { label: "Orders",   href: "/seller/orders",      icon: ShoppingCart },
      { label: "Delivery", href: "/seller/deliveries",  icon: Truck },
      { label: "NDR",      href: "/seller/ndr",         icon: AlertTriangle },
    ],
  },
  { label: "Products", href: "/seller/catalog", icon: Package },
  {
    label: "Finance",
    icon: Wallet,
    items: [
      { label: "Wallet",       href: "/seller/wallet",       icon: Wallet },
      { label: "Settlements",  href: "/seller/settlements",   icon: Receipt },
    ],
  },
  {
    label: "Account",
    icon: User,
    items: [
      { label: "Shopify Store", href: "/seller/shopify",     icon: Store },
      { label: "Activation",   href: "/seller/activation",   icon: Activity },
      { label: "Support",      href: "/seller/support",      icon: HelpCircle },
    ],
  },
];

const marketplaceNav: NavGroup[] = [
  { label: "Dashboard",  href: "/seller",            icon: LayoutDashboard },
  { label: "Analytics",  href: "/seller/analytics",  icon: BarChart2 },
  {
    label: "Fulfilment",
    icon: Truck,
    items: [
      { label: "Orders",   href: "/seller/orders",      icon: ShoppingCart },
      { label: "Delivery", href: "/seller/deliveries",  icon: Truck },
      { label: "Returns",  href: "/seller/ndr",         icon: AlertTriangle },
    ],
  },
  {
    label: "Products",
    icon: Package,
    items: [
      { label: "Listings",   href: "/seller/listings",   icon: Layers },
      { label: "Inventory",  href: "/seller/inventory",  icon: Box },
    ],
  },
  {
    label: "Finance",
    icon: Wallet,
    items: [
      { label: "Wallet",      href: "/seller/wallet",       icon: Wallet },
      { label: "Settlements", href: "/seller/settlements",   icon: Receipt },
    ],
  },
  {
    label: "Account",
    icon: User,
    items: [
      { label: "Amazon",     href: "/seller/amazon",      icon: ShoppingCart },
      { label: "Activation", href: "/seller/activation",  icon: Activity },
      { label: "Support",    href: "/seller/support",     icon: HelpCircle },
    ],
  },
];

export function SellerSidebar({ plan, userName, userEmail }: {
  plan?: string;
  userName?: string;
  userEmail?: string;
}) {
  const pathname   = usePathname();
  const nav        = plan === "MARKETPLACE" ? marketplaceNav : dropshippingNav;
  const initial    = userName?.[0]?.toUpperCase() || "U";

  const [openGroups,  setOpenGroups]  = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);

  // Auto-expand group whose child is active
  useEffect(() => {
    const toOpen = new Set<string>();
    nav.forEach(g => {
      if (g.items?.some(i => pathname === i.href || pathname.startsWith(i.href + "/"))) {
        toOpen.add(g.label);
      }
    });
    setOpenGroups(toOpen);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    fetch("/api/seller/notifications")
      .then(r => r.json())
      .then(d => setUnreadCount(d.unreadCount ?? 0))
      .catch(() => {});
  }, []);

  const isGroupActive = (g: NavGroup) =>
    g.href
      ? g.href === "/seller" ? pathname === "/seller" : pathname.startsWith(g.href + "/") || pathname === g.href
      : (g.items?.some(i => pathname === i.href || pathname.startsWith(i.href + "/")) ?? false);

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const planLabel = plan
    ? plan.charAt(0) + plan.slice(1).toLowerCase() + " Plan"
    : "Growth Plan";

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[232px] bg-white flex flex-col z-50"
      style={{ borderRight: "1px solid #E8EDF6" }}>

      {/* ── Logo ── */}
      <div className="px-5 h-[60px] flex items-center flex-shrink-0"
        style={{ borderBottom: "1px solid #E8EDF6" }}>
        <Link href="/seller" className="flex items-center gap-2.5">
          <img src="/axqen-icon.png" alt="AXQEN" className="w-8 h-8 rounded-lg object-cover" />
          <span className="font-bold text-[15.5px] tracking-tight" style={{ color: "#0C1220" }}>
            AXQEN
          </span>
        </Link>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5" style={{ scrollbarWidth: "none" }}>
        {nav.map(group => {
          const active = isGroupActive(group);
          const Icon   = group.icon;
          const isOpen = openGroups.has(group.label);

          /* Simple link */
          if (!group.items) {
            return (
              <Link
                key={group.label}
                href={group.href!}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors",
                  active
                    ? "bg-[#EEF2FF] text-[#4361EE]"
                    : "text-[#6B7280] hover:bg-[#F5F7FB] hover:text-[#0C1220]"
                )}
              >
                {Icon && (
                  <Icon
                    className="w-[17px] h-[17px] flex-shrink-0"
                    style={{ color: active ? "#4361EE" : "#9CA3AF" }}
                  />
                )}
                {group.label}
              </Link>
            );
          }

          /* Collapsible group */
          return (
            <div key={group.label}>
              <button
                onClick={() => toggleGroup(group.label)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors",
                  active
                    ? "bg-[#EEF2FF] text-[#4361EE]"
                    : "text-[#6B7280] hover:bg-[#F5F7FB] hover:text-[#0C1220]"
                )}
              >
                {Icon && (
                  <Icon
                    className="w-[17px] h-[17px] flex-shrink-0"
                    style={{ color: active ? "#4361EE" : "#9CA3AF" }}
                  />
                )}
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown
                  className="w-3.5 h-3.5 flex-shrink-0 transition-transform duration-150"
                  style={{
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    color: active ? "#4361EE" : "#9CA3AF",
                  }}
                />
              </button>

              {isOpen && (
                <div className="mt-0.5 space-y-0.5 ml-2">
                  {group.items.map(item => {
                    const ItemIcon   = item.icon;
                    const itemActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 pl-8 pr-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
                          itemActive
                            ? "bg-[#EEF2FF] text-[#4361EE]"
                            : "text-[#6B7280] hover:bg-[#F5F7FB] hover:text-[#0C1220]"
                        )}
                      >
                        <ItemIcon
                          className="w-3.5 h-3.5 flex-shrink-0"
                          style={{ color: itemActive ? "#4361EE" : "#9CA3AF" }}
                        />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Bottom ── */}
      <div className="flex-shrink-0 p-3 space-y-0.5" style={{ borderTop: "1px solid #E8EDF6" }}>

        {/* Help & Support */}
        <Link
          href="/seller/support"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium text-[#6B7280] hover:bg-[#F5F7FB] hover:text-[#0C1220] transition-colors"
        >
          <HelpCircle className="w-[17px] h-[17px] text-[#9CA3AF] flex-shrink-0" />
          Help &amp; Support
        </Link>

        {/* Notifications */}
        <Link
          href="/seller/notifications"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium text-[#6B7280] hover:bg-[#F5F7FB] hover:text-[#0C1220] transition-colors"
        >
          <div className="relative flex-shrink-0">
            <Bell className="w-[17px] h-[17px] text-[#9CA3AF]" />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <span className="flex-1">Notifications</span>
          {unreadCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-100 text-red-600 text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        {/* User profile */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#F5F7FB] transition-colors cursor-default group">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
            style={{ background: "#4361EE" }}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold truncate" style={{ color: "#0C1220" }}>
              {userName || "User"}
            </p>
            <p className="text-[11px] truncate" style={{ color: "#9CA3AF" }}>{planLabel}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
            className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            style={{ color: "#9CA3AF" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#EF4444"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#9CA3AF"; }}
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
