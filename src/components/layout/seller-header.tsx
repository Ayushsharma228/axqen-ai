"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import {
  ShoppingCart, Truck, AlertTriangle, Wallet, Receipt,
  Store, Activity, HelpCircle, Bell, User, LogOut,
  ChevronDown, Menu, X, Settings, Package, Layers,
} from "lucide-react";

interface NavItem  { label: string; href: string; icon: React.ElementType }
interface NavGroup { label: string; href?: string; items?: NavItem[] }

const dropshippingNav: NavGroup[] = [
  { label: "Dashboard", href: "/seller" },
  { label: "Analytics",  href: "/seller/analytics" },
  {
    label: "Fulfilment",
    items: [
      { label: "Orders",   href: "/seller/orders",     icon: ShoppingCart },
      { label: "Delivery", href: "/seller/deliveries", icon: Truck },
      { label: "NDR",      href: "/seller/ndr",        icon: AlertTriangle },
    ],
  },
  { label: "Products", href: "/seller/catalog" },
  {
    label: "Finance",
    items: [
      { label: "Wallet",      href: "/seller/wallet",      icon: Wallet },
      { label: "Settlements", href: "/seller/settlements",  icon: Receipt },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Shopify Store", href: "/seller/shopify",    icon: Store },
      { label: "Activation",   href: "/seller/activation",  icon: Activity },
      { label: "Support",      href: "/seller/support",     icon: HelpCircle },
    ],
  },
];

const marketplaceNav: NavGroup[] = [
  { label: "Dashboard", href: "/seller" },
  { label: "Analytics",  href: "/seller/analytics" },
  {
    label: "Fulfilment",
    items: [
      { label: "Orders",   href: "/seller/orders",     icon: ShoppingCart },
      { label: "Delivery", href: "/seller/deliveries", icon: Truck },
      { label: "Returns",  href: "/seller/ndr",        icon: AlertTriangle },
    ],
  },
  {
    label: "Products",
    items: [
      { label: "Listings",  href: "/seller/listings",  icon: Layers },
      { label: "Inventory", href: "/seller/inventory", icon: Package },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Wallet",      href: "/seller/wallet",      icon: Wallet },
      { label: "Settlements", href: "/seller/settlements",  icon: Receipt },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Amazon",     href: "/seller/amazon",      icon: ShoppingCart },
      { label: "Activation", href: "/seller/activation",  icon: Activity },
      { label: "Support",    href: "/seller/support",     icon: HelpCircle },
    ],
  },
];

export function SellerHeader({ plan, userName, userEmail }: {
  plan?: string;
  userName?: string;
  userEmail?: string;
}) {
  const pathname  = usePathname();
  const sellerNav = plan === "MARKETPLACE" ? marketplaceNav : dropshippingNav;

  const [openGroup,   setOpenGroup]   = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLElement>(null);

  const initial = userName?.[0]?.toUpperCase() || "U";

  useEffect(() => {
    fetch("/api/seller/notifications")
      .then(r => r.json())
      .then(d => setUnreadCount(d.unreadCount ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenGroup(null);
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setOpenGroup(null);
    setProfileOpen(false);
  }, [pathname]);

  const isGroupActive = (g: NavGroup) =>
    g.href
      ? g.href === "/seller" ? pathname === "/seller" : pathname.startsWith(g.href)
      : (g.items?.some(i => pathname === i.href || pathname.startsWith(i.href)) ?? false);

  return (
    <>
      <header
        ref={ref}
        className="fixed top-0 left-0 right-0 z-50 flex items-stretch"
        style={{ height: "60px", background: "white", borderBottom: "1px solid #E8EDF6" }}
      >
        <div className="flex items-stretch w-full px-5 md:px-8">

          {/* ── Brand ── */}
          <Link
            href="/seller"
            className="flex items-center gap-2.5 flex-shrink-0 pr-6 mr-2"
            style={{ borderRight: "1px solid #E8EDF6" }}
          >
            <img src="/axqen-icon.png" alt="AXQEN" className="w-7 h-7 rounded-lg object-cover" />
            <span
              className="hidden sm:block font-bold text-[15px]"
              style={{ color: "#0C1220", letterSpacing: "-0.2px" }}
            >
              AXQEN
            </span>
          </Link>

          {/* ── Primary Nav ── */}
          <nav
            className="hidden md:flex items-stretch flex-1 px-1 overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
          >
            {sellerNav.map((group) => {
              const active = isGroupActive(group);
              const isOpen = openGroup === group.label;

              /* Simple link — no dropdown */
              if (!group.items) {
                return (
                  <Link
                    key={group.label}
                    href={group.href!}
                    className="flex items-center px-3 text-[13.5px] whitespace-nowrap flex-shrink-0 transition-colors"
                    style={{
                      fontWeight: active ? 600 : 500,
                      color: active ? "#4361EE" : "#6B7280",
                      boxShadow: active ? "inset 0 -2px 0 #4361EE" : "none",
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        e.currentTarget.style.color = "#0C1220";
                        e.currentTarget.style.background = "#F5F7FB";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        e.currentTarget.style.color = "#6B7280";
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    {group.label}
                  </Link>
                );
              }

              /* Group with dropdown */
              return (
                <div key={group.label} className="relative flex items-stretch flex-shrink-0">
                  <button
                    className="flex items-center gap-1 px-3 text-[13.5px] whitespace-nowrap h-full transition-colors"
                    style={{
                      fontWeight: active ? 600 : 500,
                      color: active ? "#4361EE" : "#6B7280",
                      boxShadow: active ? "inset 0 -2px 0 #4361EE" : "none",
                      background: "transparent",
                      border: "none",
                    }}
                    onClick={() => setOpenGroup(isOpen ? null : group.label)}
                    onMouseEnter={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.color = "#0C1220";
                        (e.currentTarget as HTMLElement).style.background = "#F5F7FB";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.color = "#6B7280";
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                      }
                    }}
                  >
                    {group.label}
                    <ChevronDown
                      className="w-3.5 h-3.5 transition-transform"
                      style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                    />
                  </button>

                  {isOpen && (
                    <div
                      className="absolute top-full left-0 mt-1 w-44 rounded-xl overflow-hidden py-1.5"
                      style={{
                        background: "white",
                        boxShadow: "0 8px 28px rgba(12,18,32,0.10)",
                        border: "1px solid #E8EDF6",
                      }}
                    >
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const itemActive = pathname === item.href || pathname.startsWith(item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="flex items-center gap-3 mx-1.5 px-3 py-2.5 rounded-lg text-sm transition-colors"
                            style={{
                              background: itemActive ? "rgba(67,97,238,0.07)" : "transparent",
                              color: itemActive ? "#4361EE" : "#374151",
                              fontWeight: itemActive ? 600 : 500,
                            }}
                            onMouseEnter={e => { if (!itemActive) e.currentTarget.style.background = "#F5F7FB"; }}
                            onMouseLeave={e => { if (!itemActive) e.currentTarget.style.background = "transparent"; }}
                          >
                            <Icon
                              className="w-4 h-4 flex-shrink-0"
                              style={{ color: itemActive ? "#4361EE" : "#9CA3AF" }}
                            />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* ── Right cluster ── */}
          <div
            className="flex items-center gap-1.5 ml-auto pl-4"
            style={{ borderLeft: "1px solid #E8EDF6" }}
          >
            {/* Notifications */}
            <Link
              href="/seller/notifications"
              className="relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
              style={{ color: "#6B7280" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#F5F7FB"; e.currentTarget.style.color = "#0C1220"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#6B7280"; }}
            >
              <Bell className="w-[15px] h-[15px]" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>

            {/* Settings */}
            <Link
              href="/seller/profile"
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
              style={{ color: "#6B7280" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#F5F7FB"; e.currentTarget.style.color = "#0C1220"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#6B7280"; }}
            >
              <Settings className="w-[15px] h-[15px]" />
            </Link>

            {/* Profile */}
            <div className="relative flex-shrink-0">
              <button
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors"
                onClick={() => setProfileOpen(v => !v)}
                onMouseEnter={e => { e.currentTarget.style.background = "#F5F7FB"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <div
                  className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                  style={{ background: "#4361EE" }}
                >
                  {initial}
                </div>
                <span
                  className="hidden sm:block text-[12.5px] font-semibold truncate max-w-[90px]"
                  style={{ color: "#0C1220" }}
                >
                  {userName || "User"}
                </span>
              </button>

              {profileOpen && (
                <div
                  className="absolute top-full right-0 mt-2 w-52 rounded-xl overflow-hidden py-1.5"
                  style={{
                    background: "white",
                    boxShadow: "0 8px 28px rgba(12,18,32,0.10)",
                    border: "1px solid #E8EDF6",
                  }}
                >
                  <div className="px-4 py-3 mx-1.5 mb-1 rounded-lg" style={{ background: "#F9FAFB" }}>
                    <p className="text-sm font-semibold truncate" style={{ color: "#0C1220" }}>
                      {userName || "User"}
                    </p>
                    <p className="text-xs truncate mt-0.5" style={{ color: "#9CA3AF" }}>{userEmail}</p>
                  </div>
                  <Link
                    href="/seller/profile"
                    className="flex items-center gap-3 mx-1.5 px-3 py-2.5 rounded-lg text-sm transition-colors"
                    style={{ color: "#374151" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#F5F7FB"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <User className="w-4 h-4" style={{ color: "#9CA3AF" }} />
                    <span className="font-medium">Profile</span>
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex items-center gap-3 mx-1.5 px-3 py-2.5 rounded-lg text-sm w-[calc(100%-12px)] transition-colors"
                    style={{ color: "#EF4444" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#FEF2F2"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="font-medium">Sign Out</span>
                  </button>
                </div>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
              style={{ color: "#6B7280" }}
              onClick={() => setMobileOpen(v => !v)}
              onMouseEnter={e => { e.currentTarget.style.background = "#F5F7FB"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.2)" }} />
          <div
            className="absolute top-[60px] left-0 right-0 bg-white shadow-xl overflow-y-auto max-h-[calc(100vh-60px)]"
            onClick={e => e.stopPropagation()}
          >
            {sellerNav.map((group) =>
              !group.items ? (
                <Link
                  key={group.label}
                  href={group.href!}
                  className="flex items-center px-6 py-4 text-sm font-medium"
                  style={{
                    color: isGroupActive(group) ? "#4361EE" : "#374151",
                    borderBottom: "1px solid #F3F4F6",
                    background: isGroupActive(group) ? "rgba(67,97,238,0.05)" : "transparent",
                  }}
                >
                  {group.label}
                </Link>
              ) : (
                <div key={group.label}>
                  <div
                    className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "#9CA3AF", background: "#FAFAFA", borderBottom: "1px solid #F3F4F6" }}
                  >
                    {group.label}
                  </div>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href || pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-3 px-8 py-3.5 text-sm"
                        style={{
                          color: active ? "#4361EE" : "#374151",
                          borderBottom: "1px solid #F3F4F6",
                          background: active ? "rgba(67,97,238,0.05)" : "transparent",
                          fontWeight: active ? 600 : 500,
                        }}
                      >
                        <Icon className="w-4 h-4" style={{ color: active ? "#4361EE" : "#9CA3AF" }} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}
