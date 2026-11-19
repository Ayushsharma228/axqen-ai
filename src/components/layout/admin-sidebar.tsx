"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Bell, Store, ShoppingCart, Boxes, BadgeIndianRupee, Megaphone, LifeBuoy, Settings2,
  LogOut, ChevronDown, ChevronLeft, ChevronRight, Menu, X,
} from "lucide-react";

type BadgeKey = "kyc" | "plan" | "calling" | "ndr" | "rto" | "listings" | "invoices" | "support";
interface Child { label: string; href: string; badge?: BadgeKey }
interface Entry { id: string; label: string; icon: React.ElementType; href?: string; exact?: boolean; children?: Child[] }

const NAV: Entry[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/admin", exact: true },
  { id: "sellers", label: "Sellers", icon: Store, children: [
    { label: "All Sellers",       href: "/admin/sellers" },
    { label: "KYC Approvals",     href: "/admin/kyc",          badge: "kyc" },
    { label: "Seller Activation", href: "/admin/activation" },
    { label: "Plan Billing",      href: "/admin/plan-billing", badge: "plan" },
  ]},
  { id: "orders", label: "Orders", icon: ShoppingCart, children: [
    { label: "All Orders",    href: "/admin/orders" },
    { label: "Order Calling", href: "/admin/order-confirmation", badge: "calling" },
    { label: "Fulfillment",   href: "/admin/delivery" },
    { label: "NDR",           href: "/admin/ndr", badge: "ndr" },
    { label: "RTO",           href: "/admin/rto", badge: "rto" },
    { label: "Customers",     href: "/admin/customers" },
  ]},
  { id: "catalogue", label: "Catalogue", icon: Boxes, children: [
    { label: "Products",         href: "/admin/products" },
    { label: "Listing Requests", href: "/admin/listings", badge: "listings" },
    { label: "Amazon",           href: "/admin/amazon" },
    { label: "Inventory",        href: "/admin/inventory" },
    { label: "Invoice Pricing",  href: "/admin/invoice-pricing" },
  ]},
  { id: "money", label: "Money", icon: BadgeIndianRupee, children: [
    { label: "Seller Remittance",  href: "/admin/remittance" },
    { label: "Wallet Management",  href: "/admin/wallet" },
    { label: "Invoices",           href: "/admin/invoices", badge: "invoices" },
    { label: "Reconciliation",     href: "/admin/reconciliation" },
    { label: "Platform Analytics", href: "/admin/analytics" },
  ]},
  { id: "growth", label: "Meta Ads", icon: Megaphone, href: "/admin/ad-spend" },
  { id: "support", label: "Support", icon: LifeBuoy, children: [
    { label: "Support Tickets", href: "/admin/support", badge: "support" },
    { label: "Notifications",   href: "/admin/notifications" },
  ]},
  { id: "system", label: "System", icon: Settings2, children: [
    { label: "Team & Roles",          href: "/admin/users" },
    { label: "Integrations & Config", href: "/admin/config" },
  ]},
];

const OPEN_KEY = "axqen.admin.nav.open";
const MINI_KEY = "axqen.admin.nav.mini";
const W_FULL = 248, W_MINI = 76;
const BLUE = "#4361EE";
const EMPTY: Record<BadgeKey, number> = { kyc: 0, plan: 0, calling: 0, ndr: 0, rto: 0, listings: 0, invoices: 0, support: 0 };

export function AdminSidebar({ userName }: { userName?: string }) {
  const pathname = usePathname();
  const initial = userName?.[0]?.toUpperCase() || "A";

  const [mini, setMini] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [flyout, setFlyout] = useState<string | null>(null);
  const [flyTop, setFlyTop] = useState(0);
  const [unread, setUnread] = useState(0);
  const [counts, setCounts] = useState<Record<BadgeKey, number>>(EMPTY);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      setMini(localStorage.getItem(MINI_KEY) === "1");
      const saved = localStorage.getItem(OPEN_KEY);
      if (saved) setOpen(JSON.parse(saved));
    } catch {}
    fetch("/api/admin/notifications").then(r => r.json()).then(d => setUnread(d.unreadCount ?? 0)).catch(() => {});
    const load = () => fetch("/api/admin/nav-counts").then(r => r.json())
      .then(d => { if (!d.error) setCounts({ ...EMPTY, ...d }); }).catch(() => {});
    load();
    const t = setInterval(load, 120_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--admin-nav-w", `${mini ? W_MINI : W_FULL}px`);
  }, [mini]);

  useEffect(() => { setFlyout(null); setMobileOpen(false); }, [pathname]);

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(href + "/"));
  const entryActive = (e: Entry) => (e.href ? isActive(e.href, e.exact) : !!e.children?.some(c => isActive(c.href)));
  const entryBadge = (e: Entry) => (e.children ?? []).reduce((s, c) => s + (c.badge ? counts[c.badge] : 0), 0);
  const isOpen = (e: Entry) => entryActive(e) || (open[e.id] ?? false);

  function toggleOpen(id: string) {
    setOpen(prev => {
      const next = { ...prev, [id]: !(prev[id] ?? false) };
      try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }
  function toggleMini() {
    setMini(m => {
      try { localStorage.setItem(MINI_KEY, m ? "0" : "1"); } catch {}
      return !m;
    });
    setFlyout(null);
  }
  const showFlyout = (id: string) => { if (closeTimer.current) clearTimeout(closeTimer.current); setFlyout(id); };
  const hideFlyout = () => { closeTimer.current = setTimeout(() => setFlyout(null), 140); };

  const Badge = ({ n, k }: { n: number; k: BadgeKey }) => n > 0 ? (
    <span className="text-[10px] font-bold min-w-[18px] h-[18px] px-1.5 rounded-full flex items-center justify-center tabular-nums"
      style={k === "calling" || k === "listings" ? { background: "#FEF3C7", color: "#B45309" } : { background: "#FEE2E2", color: "#DC2626" }}>
      {n > 999 ? "999+" : n}
    </span>
  ) : null;

  // ── Profile header ──
  const profile = (compact: boolean) => (
    <div className={cn("flex-shrink-0 pt-5 pb-4", compact ? "px-0 flex flex-col items-center gap-3" : "px-4")}>
      <div className={cn("flex items-center", compact ? "flex-col gap-3" : "gap-3")}>
        <span className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[15px] font-bold flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${BLUE}, #7B8CFF)`, boxShadow: "0 0 0 3px #E8EDFF" }}>
          {initial}
        </span>
        {!compact && (
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF] truncate">Admin</p>
            <p className="text-[14px] font-bold text-[#0C1220] truncate leading-tight">{userName || "Admin"}</p>
          </div>
        )}
        <Link href="/admin/notifications" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          className={cn("relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors flex-shrink-0",
            pathname.startsWith("/admin/notifications") ? "bg-[#E8EDFF] text-[#4361EE]" : "text-[#6B7280] hover:bg-[#EEF2FF] hover:text-[#4361EE]")}>
          <Bell className="w-[18px] h-[18px]" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 text-[9px] font-bold min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center bg-[#EF4444] text-white ring-2 ring-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>
      </div>
    </div>
  );

  // ── Expanded navigation (desktop + mobile drawer) ──
  const fullNav = (
    <div className="space-y-1">
      {NAV.map(e => {
        const active = entryActive(e);
        const Icon = e.icon;
        const badge = entryBadge(e);
        const expanded = isOpen(e);
        const rowCls = cn("w-full flex items-center gap-3 px-3 h-11 rounded-xl text-[13.5px] font-semibold transition-colors",
          active && !e.children ? "text-[#4361EE]" : active ? "text-[#0C1220]" : "text-[#4B5563] hover:bg-[#F1F4FF] hover:text-[#0C1220]");
        const rowStyle = active ? { background: e.children ? "#EEF2FF" : "#E8EDFF" } : undefined;
        const iconColor = active ? BLUE : "#8A93A6";

        if (e.href) {
          return (
            <Link key={e.id} href={e.href} aria-current={active ? "page" : undefined} className={rowCls} style={rowStyle}>
              <Icon className="w-[19px] h-[19px] flex-shrink-0" style={{ color: iconColor }} />
              <span className="flex-1 truncate">{e.label}</span>
            </Link>
          );
        }
        return (
          <div key={e.id}>
            <button type="button" onClick={() => toggleOpen(e.id)} aria-expanded={expanded} className={rowCls} style={rowStyle}>
              <Icon className="w-[19px] h-[19px] flex-shrink-0" style={{ color: iconColor }} />
              <span className="flex-1 truncate text-left">{e.label}</span>
              {!expanded && badge > 0 && <span className="w-2 h-2 rounded-full bg-[#EF4444]" />}
              <ChevronDown className={cn("w-4 h-4 text-[#9CA3AF] transition-transform", expanded ? "rotate-180" : "")} />
            </button>
            {expanded && (
              <div className="relative ml-[22px] mt-1 mb-1 pl-4">
                <span className="absolute left-0 top-0 bottom-[18px] w-px bg-[#D9E0F2]" />
                {e.children!.map(c => {
                  const ca = isActive(c.href);
                  return (
                    <div key={c.href} className="relative">
                      <span className="absolute -left-4 top-0 h-[19px] w-3.5 rounded-bl-[10px]" style={{ borderLeft: "1px solid #D9E0F2", borderBottom: "1px solid #D9E0F2" }} />
                      <Link href={c.href} aria-current={ca ? "page" : undefined}
                        className={cn("flex items-center gap-2 px-3 h-[38px] rounded-lg text-[13px] font-medium transition-colors",
                          ca ? "text-[#4361EE] font-semibold" : "text-[#6B7280] hover:bg-[#F1F4FF] hover:text-[#0C1220]")}
                        style={ca ? { background: "#E8EDFF" } : undefined}>
                        <span className="flex-1 truncate">{c.label}</span>
                        {c.badge && <Badge n={counts[c.badge]} k={c.badge} />}
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ── Collapsed icon rail ──
  const miniNav = (
    <div className="space-y-1">
      {NAV.map(e => {
        const active = entryActive(e);
        const Icon = e.icon;
        const badge = entryBadge(e);
        const inner = (
          <span className={cn("relative w-11 h-11 rounded-xl flex items-center justify-center transition-colors",
            active ? "text-[#4361EE]" : "text-[#6B7280] hover:bg-[#EEF2FF] hover:text-[#4361EE]")}
            style={active ? { background: "#E8EDFF" } : undefined}>
            <Icon className="w-[19px] h-[19px]" />
            {badge > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#EF4444] ring-2 ring-white" />}
          </span>
        );
        const fid = e.children ? e.id : `tip-${e.id}`;
        return (
          <div key={e.id} className="relative flex justify-center"
            onMouseEnter={ev => {
              const r = ev.currentTarget.getBoundingClientRect();
              setFlyTop(Math.max(8, Math.min(r.top, window.innerHeight - (e.children ? 64 + e.children.length * 40 : 52))));
              showFlyout(fid);
            }}
            onMouseLeave={hideFlyout}>
            {e.href
              ? <Link href={e.href} aria-label={e.label} aria-current={active ? "page" : undefined}>{inner}</Link>
              : <button type="button" aria-label={e.label} aria-expanded={flyout === e.id} onClick={() => setFlyout(f => (f === e.id ? null : e.id))}>{inner}</button>}
            {flyout === fid && (
              <div className="fixed z-[60] min-w-[200px] rounded-xl bg-white p-1.5"
                style={{ left: W_MINI - 6, top: flyTop, border: "1px solid #E6EBF7", boxShadow: "0 12px 32px rgba(12,18,32,0.12)" }}
                onMouseEnter={() => showFlyout(fid)} onMouseLeave={hideFlyout}>
                {e.children ? (
                  <>
                    <p className="px-2.5 pt-1.5 pb-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#A3ABBD]">{e.label}</p>
                    {e.children.map(c => {
                      const ca = isActive(c.href);
                      return (
                        <Link key={c.href} href={c.href} aria-current={ca ? "page" : undefined}
                          className={cn("flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] font-medium",
                            ca ? "bg-[#E8EDFF] text-[#4361EE]" : "text-[#4B5563] hover:bg-[#F3F6FF] hover:text-[#0C1220]")}>
                          <span className="flex-1 whitespace-nowrap">{c.label}</span>
                          {c.badge && <Badge n={counts[c.badge]} k={c.badge} />}
                        </Link>
                      );
                    })}
                  </>
                ) : (
                  <p className="px-2.5 py-1.5 text-[13px] font-medium text-[#0C1220] whitespace-nowrap">{e.label}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const logout = (compact: boolean) => (
    <div className={cn("flex-shrink-0 p-3", compact && "flex justify-center")} style={{ borderTop: "1px solid #E6EBF7" }}>
      <button onClick={() => signOut({ callbackUrl: "/login" })} aria-label="Log out" title="Log out"
        className={cn("flex items-center gap-3 rounded-xl text-[13.5px] font-semibold text-[#6B7280] hover:bg-[#FEF2F2] hover:text-[#DC2626] transition-colors",
          compact ? "w-11 h-11 justify-center" : "w-full h-11 px-3")}>
        <LogOut className="w-[19px] h-[19px] flex-shrink-0" />
        {!compact && <span>Log out</span>}
      </button>
    </div>
  );

  const panelStyle = { background: "linear-gradient(180deg, #FFFFFF 0%, #F7F9FF 100%)", borderRight: "1px solid #E6EBF7" };
  const totalBadge = NAV.reduce((s, e) => s + entryBadge(e), 0);

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 bg-white" style={{ borderBottom: "1px solid #E6EBF7" }}>
        <div className="flex items-center gap-2">
          <img src="/axqen-icon.png" alt="AXQEN" className="w-7 h-7 rounded-lg object-cover" />
          <span className="font-bold text-sm text-[#0C1220]">AXQEN Admin</span>
        </div>
        <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="relative p-2 text-[#4B5563]">
          <Menu className="w-5 h-5" />
          {totalBadge > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#EF4444]" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex flex-col h-full z-10" style={{ width: W_FULL + 24, ...panelStyle }}>
            <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="absolute top-3 right-3 p-1.5 rounded-lg text-[#6B7280] z-10"><X className="w-5 h-5" /></button>
            {profile(false)}
            <nav className="flex-1 overflow-y-auto px-3 pb-3">{fullNav}</nav>
            {logout(false)}
          </aside>
        </div>
      )}

      {/* Desktop */}
      <aside className="hidden md:flex md:flex-col fixed left-0 top-0 bottom-0 z-50 transition-[width] duration-200"
        style={{ width: mini ? W_MINI : W_FULL, ...panelStyle }}>
        <button onClick={toggleMini} aria-label={mini ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-[34px] w-6 h-6 rounded-full bg-white flex items-center justify-center text-[#6B7280] hover:text-[#4361EE] z-10"
          style={{ border: "1px solid #E6EBF7", boxShadow: "0 1px 4px rgba(12,18,32,0.08)" }}>
          {mini ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
        {profile(mini)}
        <nav className={cn("flex-1 overflow-y-auto pb-3 pt-1", mini ? "px-2.5" : "px-3")} style={{ scrollbarWidth: "none" }}>
          {mini ? miniNav : fullNav}
        </nav>
        {logout(mini)}
      </aside>
    </>
  );
}
