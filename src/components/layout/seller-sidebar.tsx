"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, ShoppingCart, Truck, Package,
  Users, Megaphone, Wallet, Brain, HelpCircle, LogOut,
  ClipboardCheck,
} from "lucide-react";

interface NavItem { label: string; href: string; icon: React.ElementType; exact?: boolean; isNew?: boolean }

const NAV: NavItem[] = [
  { label: "Dashboard",           href: "/seller",                      icon: LayoutDashboard, exact: true },
  { label: "Order Confirmation",  href: "/seller/order-confirmation",   icon: ClipboardCheck, isNew: true },
  { label: "Orders",              href: "/seller/orders",               icon: ShoppingCart },
  { label: "Fulfilment",          href: "/seller/deliveries",           icon: Truck },
  { label: "Products",            href: "/seller/catalog",              icon: Package },
  { label: "Customers",           href: "/seller/customers",            icon: Users },
  { label: "Meta Ads",            href: "/seller/meta-ads",             icon: Megaphone },
  { label: "Finance",             href: "/seller/wallet",               icon: Wallet },
  { label: "Intelligence",        href: "/seller/intelligence",         icon: Brain, isNew: true },
];

export function SellerSidebar({ plan, userName, userEmail }: {
  plan?: string;
  userName?: string;
  userEmail?: string;
}) {
  const pathname = usePathname();
  const initial  = userName?.[0]?.toUpperCase() || "U";

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch("/api/seller/notifications")
      .then(r => r.json())
      .then(d => setUnreadCount(d.unreadCount ?? 0))
      .catch(() => {});
  }, []);

  const isActive = (item: NavItem) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(item.href + "/");

  const planLabel = plan
    ? plan.charAt(0) + plan.slice(1).toLowerCase() + " Plan"
    : "Growth Plan";

  return (
    <aside
      className="hidden md:flex md:flex-col fixed left-0 top-0 bottom-0 w-[232px] bg-white z-50"
      style={{ borderRight: "1px solid #E8EDF6" }}
    >
      {/* ── Logo ── */}
      <div
        className="px-5 h-[60px] flex items-center flex-shrink-0"
        style={{ borderBottom: "1px solid #E8EDF6" }}
      >
        <Link href="/seller" className="flex items-center gap-2.5">
          <img src="/axqen-icon.png" alt="AXQEN" className="w-8 h-8 rounded-lg object-cover" />
          <span className="font-bold text-[15.5px] tracking-tight" style={{ color: "#0C1220" }}>
            AXQEN
          </span>
        </Link>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5" style={{ scrollbarWidth: "none" }}>
        {NAV.map(item => {
          const active = isActive(item);
          const Icon   = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors",
                active
                  ? "bg-[#EEF2FF] text-[#4361EE]"
                  : "text-[#6B7280] hover:bg-[#F5F7FB] hover:text-[#0C1220]"
              )}
            >
              <Icon
                className="w-[17px] h-[17px] flex-shrink-0"
                style={{ color: active ? "#4361EE" : "#9CA3AF" }}
              />
              <span className="flex-1">{item.label}</span>
              {item.isNew && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                  style={{ background: active ? "#4361EE" : "#ECFDF5", color: active ? "white" : "#059669" }}
                >
                  NEW
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div
        className="flex-shrink-0 p-3 space-y-0.5"
        style={{ borderTop: "1px solid #E8EDF6" }}
      >
        {/* Support */}
        <Link
          href="/seller/support"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors",
            pathname.startsWith("/seller/support")
              ? "bg-[#EEF2FF] text-[#4361EE]"
              : "text-[#6B7280] hover:bg-[#F5F7FB] hover:text-[#0C1220]"
          )}
        >
          <HelpCircle
            className="w-[17px] h-[17px] flex-shrink-0"
            style={{ color: pathname.startsWith("/seller/support") ? "#4361EE" : "#9CA3AF" }}
          />
          Support
        </Link>

        {/* Profile */}
        <Link
          href="/seller/profile"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group",
            pathname.startsWith("/seller/profile")
              ? "bg-[#EEF2FF]"
              : "hover:bg-[#F5F7FB]"
          )}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
            style={{ background: "#4361EE" }}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-[13px] font-semibold truncate leading-tight"
              style={{ color: "#0C1220" }}
            >
              {userName || "User"}
            </p>
            <p className="text-[11px] truncate leading-tight" style={{ color: "#9CA3AF" }}>
              {planLabel}
            </p>
          </div>
          <button
            onClick={e => {
              e.preventDefault();
              signOut({ callbackUrl: "/login" });
            }}
            title="Sign out"
            className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            style={{ color: "#9CA3AF" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#EF4444"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#9CA3AF"; }}
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </Link>
      </div>
    </aside>
  );
}
