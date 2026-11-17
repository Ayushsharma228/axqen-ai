"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Bell, ShoppingCart, ClipboardCheck, Users, Truck, AlertTriangle, RotateCcw,
  Package, ListChecks, Store, ShoppingBag, Wallet, Megaphone, ChartColumn, Brain,
  FileText, UserCog, HelpCircle, LogOut, ChevronDown,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  exact?: boolean;
  soon?: boolean;              // page not built yet — shown, not clickable
}
interface NavSection { title: string; items: NavItem[] }

// Dashboard sits above the sections; Notifications is the bell next to the logo.
const DASHBOARD: NavItem = { label: "Dashboard", href: "/seller", icon: LayoutDashboard, exact: true };

const SECTIONS: NavSection[] = [
  { title: "Orders", items: [
    { label: "COD Confirmation", href: "/seller/order-confirmation", icon: ClipboardCheck },
    { label: "All Orders",       href: "/seller/orders",             icon: ShoppingCart },
    { label: "Customers",        href: "/seller/customers",          icon: Users },
  ]},
  { title: "Shipping", items: [
    { label: "Shipments", href: "/seller/deliveries", icon: Truck },
    { label: "NDR",       href: "/seller/ndr",        icon: AlertTriangle },
    { label: "RTO",       href: "/seller/rto",        icon: RotateCcw, soon: true },
  ]},
  { title: "Products & Store", items: [
    { label: "Product Catalogue", href: "/seller/catalog",  icon: Package },
    { label: "My Listings",       href: "/seller/listings", icon: ListChecks },
    { label: "Shopify Store",     href: "/seller/shopify",  icon: Store },
    { label: "Amazon",            href: "/seller/amazon",   icon: ShoppingBag },
  ]},
  { title: "Money", items: [
    { label: "Wallet & Payouts", href: "/seller/wallet",   icon: Wallet },
    { label: "Ad Spend",         href: "/seller/meta-ads", icon: Megaphone },
  ]},
  { title: "Insights", items: [
    { label: "Profit & Analytics", href: "/seller/analytics",    icon: ChartColumn, soon: true },
    { label: "AI Intelligence",    href: "/seller/intelligence", icon: Brain },
  ]},
];

const FOOTER: NavItem[] = [
  { label: "Documents & Invoices", href: "/seller/documents", icon: FileText, soon: true },
  { label: "Profile & Settings",   href: "/seller/profile",   icon: UserCog },
  { label: "Help & Support",       href: "/seller/support",   icon: HelpCircle },
];

const COLLAPSED_KEY = "axqen.seller.nav.collapsed";

export function SellerSidebar({ plan, userName }: {
  plan?: string;
  userName?: string;
  userEmail?: string;
}) {
  const pathname = usePathname();
  const initial  = userName?.[0]?.toUpperCase() || "U";

  const [unreadCount, setUnreadCount] = useState(0);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/seller/notifications")
      .then(r => r.json())
      .then(d => setUnreadCount(d.unreadCount ?? 0))
      .catch(() => {});
    try {
      const saved = localStorage.getItem(COLLAPSED_KEY);
      if (saved) setCollapsed(JSON.parse(saved));
    } catch {}
  }, []);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");

  function toggle(title: string) {
    setCollapsed(prev => {
      const next = { ...prev, [title]: !prev[title] };
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const planLabel = plan ? plan.charAt(0) + plan.slice(1).toLowerCase() + " Plan" : "Seller";

  function Item({ item }: { item: NavItem }) {
    const active = isActive(item);
    const Icon = item.icon;
    const base = "flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] font-medium transition-colors";

    if (item.soon) {
      return (
        <div className={cn(base, "text-[#9CA3AF] cursor-default")} title="Coming soon">
          <Icon className="w-[17px] h-[17px] flex-shrink-0 text-[#C4C9D4]" />
          <span className="flex-1">{item.label}</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none bg-[#F3F4F6] text-[#6B7280]">SOON</span>
        </div>
      );
    }

    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(base, active ? "bg-[#EEF2FF] text-[#4361EE]" : "text-[#6B7280] hover:bg-[#F5F7FB] hover:text-[#0C1220]")}
      >
        <Icon className="w-[17px] h-[17px] flex-shrink-0" style={{ color: active ? "#4361EE" : "#9CA3AF" }} />
        <span className="flex-1">{item.label}</span>
      </Link>
    );
  }

  return (
    <aside
      className="hidden md:flex md:flex-col fixed left-0 top-0 bottom-0 w-[232px] bg-white z-50"
      style={{ borderRight: "1px solid #E8EDF6" }}
    >
      {/* ── Logo ── */}
      <div className="pl-5 pr-3 h-[60px] flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid #E8EDF6" }}>
        <Link href="/seller" className="flex items-center gap-2.5">
          <img src="/axqen-icon.png" alt="AXQEN" className="w-8 h-8 rounded-lg object-cover" />
          <span className="font-bold text-[15.5px] tracking-tight" style={{ color: "#0C1220" }}>AXQEN</span>
        </Link>
        <Link
          href="/seller/notifications"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          className={cn(
            "relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
            pathname.startsWith("/seller/notifications") ? "bg-[#EEF2FF] text-[#4361EE]" : "text-[#6B7280] hover:bg-[#F5F7FB] hover:text-[#0C1220]"
          )}
        >
          <Bell className="w-[18px] h-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 text-[9px] font-bold min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center bg-[#EF4444] text-white ring-2 ring-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>
      </div>

      {/* ── Sections ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ scrollbarWidth: "none" }}>
        <Item item={DASHBOARD} />
        {SECTIONS.map(section => {
          const items = section.items;
          if (!items.length) return null;
          const containsActive = items.some(i => !i.soon && isActive(i));
          const isOpen = containsActive || !collapsed[section.title];
          return (
            <div key={section.title}>
              <button
                type="button"
                onClick={() => toggle(section.title)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF] hover:text-[#6B7280]"
              >
                {section.title}
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isOpen ? "" : "-rotate-90")} />
              </button>
              {isOpen && (
                <div className="mt-1 space-y-0.5">
                  {items.map(item => <Item key={item.href} item={item} />)}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div className="flex-shrink-0 p-3 space-y-0.5" style={{ borderTop: "1px solid #E8EDF6" }}>
        {FOOTER.map(item => <Item key={item.href} item={item} />)}

        <div className="flex items-center gap-3 px-3 py-2.5 mt-1 rounded-lg">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0" style={{ background: "#4361EE" }}>
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold truncate leading-tight" style={{ color: "#0C1220" }}>{userName || "User"}</p>
            <p className="text-[11px] truncate leading-tight" style={{ color: "#9CA3AF" }}>{planLabel}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Log out"
            aria-label="Log out"
            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
