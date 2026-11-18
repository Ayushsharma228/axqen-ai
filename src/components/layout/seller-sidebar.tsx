"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Bell, ShoppingCart, ClipboardCheck, Users, Truck, AlertTriangle, RotateCcw,
  Package, ListChecks, Store, ShoppingBag, Wallet, Megaphone, ChartColumn, Brain,
  FileText, UserCog, HelpCircle, LogOut, ChevronDown, ChevronLeft, ChevronRight, Boxes, BadgeIndianRupee, Sparkles,
} from "lucide-react";

type BadgeKey = "cod" | "ndr";
interface Child { label: string; href: string; icon: React.ElementType; badge?: BadgeKey; soon?: boolean }
interface Entry { id: string; label: string; icon: React.ElementType; href?: string; exact?: boolean; children?: Child[] }
interface Group { title: string; entries: Entry[] }

const GROUPS: Group[] = [
  { title: "Main", entries: [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/seller", exact: true },
    { id: "orders", label: "Orders", icon: ShoppingCart, children: [
      { label: "COD Confirmation", href: "/seller/order-confirmation", icon: ClipboardCheck, badge: "cod" },
      { label: "All Orders",       href: "/seller/orders",             icon: ShoppingCart },
      { label: "Customers",        href: "/seller/customers",          icon: Users },
    ]},
    { id: "shipping", label: "Shipping", icon: Truck, children: [
      { label: "Shipments", href: "/seller/deliveries", icon: Truck },
      { label: "NDR",       href: "/seller/ndr",        icon: AlertTriangle, badge: "ndr" },
      { label: "RTO",       href: "/seller/rto",        icon: RotateCcw },
    ]},
    { id: "store", label: "Products & Store", icon: Boxes, children: [
      { label: "Product Catalogue", href: "/seller/catalog",  icon: Package },
      { label: "My Listings",       href: "/seller/listings", icon: ListChecks },
      { label: "Shopify Store",     href: "/seller/shopify",  icon: Store },
      { label: "Amazon",            href: "/seller/amazon",   icon: ShoppingBag },
    ]},
    { id: "money", label: "Money", icon: BadgeIndianRupee, children: [
      { label: "Wallet & Payouts",     href: "/seller/wallet",    icon: Wallet },
      { label: "Ad Spend",             href: "/seller/meta-ads",  icon: Megaphone },
      { label: "Documents & Invoices", href: "/seller/documents", icon: FileText },
    ]},
    { id: "insights", label: "Insights", icon: Sparkles, children: [
      { label: "Profit & Analytics", href: "/seller/analytics",    icon: ChartColumn },
      { label: "AI Intelligence",    href: "/seller/intelligence", icon: Brain },
    ]},
  ]},
  { title: "Account", entries: [
    { id: "profile", label: "Profile & Settings", icon: UserCog, href: "/seller/profile" },
    { id: "support", label: "Help & Support",     icon: HelpCircle, href: "/seller/support" },
  ]},
];

const OPEN_KEY = "axqen.seller.nav.open";
const MINI_KEY = "axqen.seller.nav.mini";
const W_FULL = 248, W_MINI = 76;
const BLUE = "#4361EE";

export function SellerSidebar({ plan, userName }: { plan?: string; userName?: string; userEmail?: string }) {
  const pathname = usePathname();
  const initial = userName?.[0]?.toUpperCase() || "U";
  const planLabel = plan ? `${plan === "MARKETPLACE" ? "Marketplace" : "Dropshipping"} plan` : "Seller";

  const [mini, setMini] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [flyout, setFlyout] = useState<string | null>(null);
  const [flyTop, setFlyTop] = useState(0);
  const [unread, setUnread] = useState(0);
  const [counts, setCounts] = useState<Record<BadgeKey, number>>({ cod: 0, ndr: 0 });
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore preferences + live counts
  useEffect(() => {
    try {
      setMini(localStorage.getItem(MINI_KEY) === "1");
      const saved = localStorage.getItem(OPEN_KEY);
      if (saved) setOpen(JSON.parse(saved));
    } catch {}
    fetch("/api/seller/notifications").then(r => r.json()).then(d => setUnread(d.unreadCount ?? 0)).catch(() => {});
    const loadCounts = () => fetch("/api/seller/nav-counts").then(r => r.json())
      .then(d => setCounts({ cod: d.codBeingCalled ?? 0, ndr: d.ndrOpen ?? 0 })).catch(() => {});
    loadCounts();
    const t = setInterval(loadCounts, 120_000);
    return () => clearInterval(t);
  }, []);

  // Page content follows the sidebar width
  useEffect(() => {
    document.documentElement.style.setProperty("--seller-nav-w", `${mini ? W_MINI : W_FULL}px`);
  }, [mini]);

  useEffect(() => { setFlyout(null); }, [pathname]);

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

  const Badge = ({ n, tone }: { n: number; tone: BadgeKey | "red" }) => n > 0 ? (
    <span className="text-[10px] font-bold min-w-[18px] h-[18px] px-1.5 rounded-full flex items-center justify-center tabular-nums"
      style={tone === "cod" ? { background: "#FEF3C7", color: "#B45309" } : { background: "#FEE2E2", color: "#DC2626" }}>
      {n > 99 ? "99+" : n}
    </span>
  ) : null;

  return (
    <aside
      className="hidden md:flex md:flex-col fixed left-0 top-0 bottom-0 z-50 transition-[width] duration-200"
      style={{ width: mini ? W_MINI : W_FULL, background: "linear-gradient(180deg, #FFFFFF 0%, #F7F9FF 100%)", borderRight: "1px solid #E6EBF7" }}
    >
      {/* Collapse handle */}
      <button
        onClick={toggleMini}
        aria-label={mini ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-[34px] w-6 h-6 rounded-full bg-white flex items-center justify-center text-[#6B7280] hover:text-[#4361EE] z-10"
        style={{ border: "1px solid #E6EBF7", boxShadow: "0 1px 4px rgba(12,18,32,0.08)" }}
      >
        {mini ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Profile */}
      <div className={cn("flex-shrink-0 pt-5 pb-4", mini ? "px-0 flex flex-col items-center gap-3" : "px-4")}>
        <div className={cn("flex items-center", mini ? "flex-col gap-3" : "gap-3")}>
          <Link href="/seller/profile" title="Profile & Settings"
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[15px] font-bold flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${BLUE}, #7B8CFF)`, boxShadow: "0 0 0 3px #E8EDFF" }}>
            {initial}
          </Link>
          {!mini && (
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF] truncate">{planLabel}</p>
              <p className="text-[14px] font-bold text-[#0C1220] truncate leading-tight">{userName || "Seller"}</p>
            </div>
          )}
          <Link href="/seller/notifications" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
            className={cn("relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors flex-shrink-0",
              pathname.startsWith("/seller/notifications") ? "bg-[#E8EDFF] text-[#4361EE]" : "text-[#6B7280] hover:bg-[#EEF2FF] hover:text-[#4361EE]")}>
            <Bell className="w-[18px] h-[18px]" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 text-[9px] font-bold min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center bg-[#EF4444] text-white ring-2 ring-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 overflow-y-auto pb-3", mini ? "px-2.5" : "px-3")} style={{ scrollbarWidth: "none" }}>
        {GROUPS.map(g => (
          <div key={g.title} className="mt-2">
            {mini
              ? <div className="mx-auto my-2 w-6 h-px bg-[#E6EBF7]" />
              : <p className="px-3 pt-2 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#A3ABBD]">{g.title}</p>}
            <div className="space-y-1">
              {g.entries.map(e => {
                const active = entryActive(e);
                const Icon = e.icon;
                const badge = entryBadge(e);
                const expanded = isOpen(e);

                // ── Collapsed rail ──
                if (mini) {
                  const inner = (
                    <span className={cn("relative w-11 h-11 rounded-xl flex items-center justify-center transition-colors",
                      active ? "text-[#4361EE]" : "text-[#6B7280] hover:bg-[#EEF2FF] hover:text-[#4361EE]")}
                      style={active ? { background: "#E8EDFF" } : undefined}>
                      <Icon className="w-[19px] h-[19px]" />
                      {badge > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#EF4444] ring-2 ring-white" />}
                    </span>
                  );
                  return (
                    <div key={e.id} className="relative flex justify-center"
                      onMouseEnter={ev => { const r = ev.currentTarget.getBoundingClientRect(); setFlyTop(Math.max(8, Math.min(r.top, window.innerHeight - (e.children ? 64 + e.children.length * 40 : 52)))); showFlyout(e.children ? e.id : `tip-${e.id}`); }} onMouseLeave={hideFlyout}>
                      {e.href
                        ? <Link href={e.href} aria-label={e.label} aria-current={active ? "page" : undefined}>{inner}</Link>
                        : <button type="button" aria-label={e.label} aria-expanded={flyout === e.id} onClick={() => setFlyout(f => (f === e.id ? null : e.id))}>{inner}</button>}

                      {/* Flyout: sub-pages, or just the label */}
                      {(flyout === e.id || flyout === `tip-${e.id}`) && (
                        <div className="fixed z-[60] min-w-[196px] rounded-xl bg-white p-1.5"
                          style={{ left: W_MINI - 6, top: flyTop, border: "1px solid #E6EBF7", boxShadow: "0 12px 32px rgba(12,18,32,0.12)" }}
                          onMouseEnter={() => showFlyout(flyout!)} onMouseLeave={hideFlyout}>
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
                                    {c.badge && <Badge n={counts[c.badge]} tone={c.badge} />}
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
                }

                // ── Expanded ──
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

                    {/* Sub-pages joined by tree lines */}
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
                                {c.badge && <Badge n={counts[c.badge]} tone={c.badge} />}
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
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className={cn("flex-shrink-0 p-3", mini && "flex justify-center")} style={{ borderTop: "1px solid #E6EBF7" }}>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          aria-label="Log out"
          title="Log out"
          className={cn("flex items-center gap-3 rounded-xl text-[13.5px] font-semibold text-[#6B7280] hover:bg-[#FEF2F2] hover:text-[#DC2626] transition-colors",
            mini ? "w-11 h-11 justify-center" : "w-full h-11 px-3")}
        >
          <LogOut className="w-[19px] h-[19px] flex-shrink-0" />
          {!mini && <span>Log out</span>}
        </button>
      </div>
    </aside>
  );
}
