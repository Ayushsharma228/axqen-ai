"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, ShoppingCart, Wallet, MoreHorizontal,
  Package, Users, Megaphone, Brain, HelpCircle, X, LogOut,
  ClipboardCheck, Truck,
} from "lucide-react";
import { signOut } from "next-auth/react";

const PRIMARY = [
  { label: "Home",    href: "/seller",                    icon: LayoutDashboard, exact: true },
  { label: "Confirm", href: "/seller/order-confirmation", icon: ClipboardCheck,  isNew: true },
  { label: "Orders",  href: "/seller/orders",             icon: ShoppingCart },
  { label: "Finance", href: "/seller/wallet",             icon: Wallet },
];

const MORE = [
  { label: "Fulfilment",   href: "/seller/deliveries",   icon: Truck },
  { label: "Products",     href: "/seller/catalog",      icon: Package },
  { label: "Customers",    href: "/seller/customers",    icon: Users },
  { label: "Meta Spends",  href: "/seller/meta-ads",     icon: Megaphone },
  { label: "Intelligence", href: "/seller/intelligence", icon: Brain },
  { label: "Support",      href: "/seller/support",      icon: HelpCircle },
];

export function MobileBottomNav({ userName, plan }: { userName?: string; plan?: string }) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  }

  const moreIsActive = MORE.some(m => isActive(m.href));
  const planLabel = plan ? plan.charAt(0) + plan.slice(1).toLowerCase() + " Plan" : "Dropshipping Plan";
  const initial = userName?.[0]?.toUpperCase() ?? "U";

  return (
    <>
      {/* Slide-up sheet backdrop */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
          onClick={() => setSheetOpen(false)}
        />
      )}

      {/* Slide-up More sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl transition-transform duration-300 md:hidden"
        style={{
          transform: sheetOpen ? "translateY(0)" : "translateY(110%)",
          boxShadow: "0 -4px 30px rgba(0,0,0,0.10)",
          borderTop: "1px solid #E8EDF6",
        }}
      >
        {/* Sheet handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#E8EDF6]" />
        </div>

        {/* Sheet header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#F3F4F6]">
          <p className="text-[14px] font-bold text-[#0C1220]">More</p>
          <button
            onClick={() => setSheetOpen(false)}
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: "#F3F4F6" }}
          >
            <X className="w-4 h-4 text-[#6B7280]" />
          </button>
        </div>

        {/* More nav grid */}
        <div className="grid grid-cols-4 gap-0 px-4 py-4">
          {MORE.map(item => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSheetOpen(false)}
                className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl transition-colors"
                style={{ background: active ? "#EEF2FF" : "transparent" }}
              >
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center"
                  style={{ background: active ? "#4361EE" : "#F5F7FB" }}
                >
                  <Icon className="w-5 h-5" style={{ color: active ? "white" : "#6B7280" }} />
                </div>
                <span
                  className="text-[11px] font-semibold text-center leading-tight"
                  style={{ color: active ? "#4361EE" : "#6B7280" }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Profile + sign out */}
        <div className="mx-4 mb-4 px-4 py-3 rounded-xl flex items-center gap-3" style={{ background: "#F5F7FB" }}>
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0"
            style={{ background: "#4361EE" }}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[#0C1220] truncate">{userName || "User"}</p>
            <p className="text-[11px] text-[#9CA3AF] truncate">{planLabel}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
            style={{ background: "#FEF2F2", color: "#EF4444" }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </div>

      {/* ── Bottom navigation bar ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
        style={{
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: "1px solid #E8EDF6",
          boxShadow: "0 -2px 16px rgba(0,0,0,0.06)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="flex items-center justify-around px-2 h-[60px]">
          {PRIMARY.map(item => {
            const active = isActive(item.href, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors flex-1 relative"
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: active ? "#EEF2FF" : "transparent" }}
                >
                  <Icon
                    className="w-[18px] h-[18px]"
                    style={{ color: active ? "#4361EE" : "#9CA3AF" }}
                  />
                  {item.isNew && !active && (
                    <span
                      className="absolute top-1 right-2.5 w-1.5 h-1.5 rounded-full"
                      style={{ background: "#059669" }}
                    />
                  )}
                </div>
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: active ? "#4361EE" : "#9CA3AF" }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setSheetOpen(p => !p)}
            className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors flex-1"
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: moreIsActive || sheetOpen ? "#EEF2FF" : "transparent" }}
            >
              <MoreHorizontal
                className="w-[18px] h-[18px]"
                style={{ color: moreIsActive || sheetOpen ? "#4361EE" : "#9CA3AF" }}
              />
            </div>
            <span
              className="text-[10px] font-semibold"
              style={{ color: moreIsActive || sheetOpen ? "#4361EE" : "#9CA3AF" }}
            >
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
