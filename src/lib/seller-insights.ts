// Seller insights for AI Intelligence: one fact sheet built from the same rules as
// Profit & Analytics, Ad Spend, RTO and Customers, plus ranked "this week" actions
// and real counts of what the AXQEN team did. Numbers come from data, never from the model.
import { prisma } from "@/lib/prisma";
import { computeProfit } from "@/lib/profit";

const WINDOW_DAYS = 90;
const inr = (n: number) => (n < 0 ? "−₹" : "₹") + Math.abs(Math.round(n)).toLocaleString("en-IN");

export type Severity = "critical" | "warning" | "good" | "info";
export interface Action { id: string; severity: Severity; title: string; detail: string; href: string; cta: string }

type ProfitRow = { label: string; delivered: number; rto: number; units: number; revenue: number; costs: number; rtoLoss: number; profit: number; margin: number | null; rtoPct: number | null; costsMissing: number };

export async function buildFacts(sellerId: string) {
  const since = new Date(Date.now() - WINDOW_DAYS * 86400000);
  const seller = await prisma.user.findUnique({ where: { id: sellerId }, select: { dataStartDate: true, brandName: true, name: true } });
  const gte = seller?.dataStartDate && seller.dataStartDate > since ? seller.dataStartDate : since;

  const [profit, spendRows, taggedOrders, recharges, allSpend, spend7, customerOrders] = await Promise.all([
    computeProfit(sellerId, WINDOW_DAYS),
    prisma.adSpend.findMany({ where: { sellerId, date: { gte: since } }, select: { amount: true, campaignName: true, campaignId: true } }),
    prisma.order.findMany({
      where: { sellerId, createdAt: { gte }, utmCampaign: { not: null }, status: { in: ["DELIVERED", "RTO"] } },
      select: { utmCampaign: true, status: true, totalAmount: true, productCost: true, shippingCharge: true, packingCharge: true, rtoCharge: true },
    }),
    prisma.metaRecharge.aggregate({ where: { sellerId }, _sum: { amount: true } }),
    prisma.adSpend.aggregate({ where: { sellerId }, _sum: { amount: true } }),
    prisma.adSpend.aggregate({ where: { sellerId, date: { gte: new Date(Date.now() - 7 * 86400000) } }, _sum: { amount: true } }),
    prisma.order.findMany({
      where: { sellerId, createdAt: { gte }, status: { not: "HIDDEN" as never } },
      select: { status: true, customerAddress: true, customerEmail: true },
    }),
  ]);

  // Campaigns: spend vs tagged delivered/RTO orders (same idea as the Ad Spend page)
  const camp = new Map<string, { name: string; spend: number; delivered: number; rto: number; revenue: number; costs: number }>();
  for (const r of spendRows) {
    const name = r.campaignName ?? r.campaignId ?? "Unnamed campaign";
    const c = camp.get(name.toLowerCase()) ?? { name, spend: 0, delivered: 0, rto: 0, revenue: 0, costs: 0 };
    c.spend += r.amount;
    camp.set(name.toLowerCase(), c);
  }
  for (const o of taggedOrders) {
    const key = (o.utmCampaign ?? "").toLowerCase();
    const c = camp.get(key) ?? [...camp.entries()].find(([k]) => k.includes(key) || key.includes(k))?.[1];
    if (!c) continue;
    if (o.status === "DELIVERED") {
      c.delivered++; c.revenue += o.totalAmount;
      c.costs += (o.productCost ?? 0) + (o.shippingCharge ?? 0) + (o.packingCharge ?? 0);
    } else {
      c.rto++; c.costs += (o.productCost ?? 0) + (o.rtoCharge ?? 0) + (o.packingCharge ?? 0);
    }
  }
  const campaigns = [...camp.values()].map(c => {
    const done = c.delivered + c.rto;
    const profitAfterAds = Math.round(c.revenue - c.costs - c.spend);
    const verdict = done < 3 ? "too early" : profitAfterAds < 0 ? "losing money" : c.rto / done >= 0.3 ? "watch RTO" : "scale";
    return { name: c.name, spend: Math.round(c.spend), delivered: c.delivered, rto: c.rto, deliveredRevenue: Math.round(c.revenue), profitAfterAds, verdict };
  }).sort((a, b) => b.spend - a.spend);

  // Customers: one phone number = one customer
  const people = new Map<string, { orders: number; returnsOrCancels: number }>();
  for (const o of customerOrders) {
    const digits = (((o.customerAddress ?? {}) as Record<string, string>).phone ?? "").replace(/\D/g, "").slice(-10);
    const key = digits.length === 10 ? digits : o.customerEmail?.toLowerCase();
    if (!key) continue;
    const p = people.get(key) ?? { orders: 0, returnsOrCancels: 0 };
    p.orders++;
    if (o.status === "RTO" || o.status === "CANCELLED") p.returnsOrCancels++;
    people.set(key, p);
  }
  const customers = {
    total: people.size,
    repeat: [...people.values()].filter(p => p.orders > 1).length,
    risky: [...people.values()].filter(p => p.returnsOrCancels >= 2).length,
  };

  const walletBalance = (recharges._sum.amount ?? 0) - (allSpend._sum.amount ?? 0);
  const burn = (spend7._sum.amount ?? 0) / 7;

  return {
    periodDays: WINDOW_DAYS,
    seller: seller?.brandName || seller?.name || "your store",
    summary: profit.summary as Record<string, number>,
    byMonth: profit.byMonth,
    products: profit.byProduct as ProfitRow[],
    states: profit.byState as ProfitRow[],
    campaigns,
    adWallet: {
      recharged: Math.round(recharges._sum.amount ?? 0),
      balance: Math.round(walletBalance),
      dailySpend: Math.round(burn),
      daysLeft: burn > 0 && walletBalance > 0 ? Math.floor(walletBalance / burn) : null,
    },
    customers,
  };
}

export type Facts = Awaited<ReturnType<typeof buildFacts>>;

/** Ranked, data-backed actions. Each one names its number and links to the page that shows it. */
export function buildActions(f: Facts): Action[] {
  const out: Action[] = [];
  const s = f.summary;
  const approx = s.costsMissing > 0 ? "≈ " : "";

  if (s.delivered + s.rto > 0 && s.netProfit < 0) {
    out.push({ id: "net-loss", severity: "critical", title: `You're at a ${approx}${inr(s.netProfit)} loss over the last ${f.periodDays} days`,
      detail: `Delivered revenue ${inr(s.revenue)}, RTO loss ${inr(-s.rtoLoss)}, ads ${inr(-s.adSpend)}. Start with the products and campaigns below.`,
      href: "/seller/analytics", cta: "See profit" });
  }

  f.products.filter(p => p.delivered + p.rto >= 3 && p.profit < 0).sort((a, b) => a.profit - b.profit).slice(0, 2).forEach(p => {
    out.push({ id: `prod-loss-${p.label}`, severity: "critical", title: `"${p.label}" lost ${p.costsMissing ? "≈ " : ""}${inr(p.profit)} after returns`,
      detail: `${p.delivered} delivered, ${p.rto} returned${p.rtoPct != null ? ` (${p.rtoPct}% RTO)` : ""}. Consider pausing its ads or raising its price.`,
      href: "/seller/analytics", cta: "Open product profit" });
  });

  f.campaigns.filter(c => c.verdict === "losing money").slice(0, 2).forEach(c => {
    out.push({ id: `camp-loss-${c.name}`, severity: "critical", title: `Campaign "${c.name}" is losing money`,
      detail: `${inr(c.spend)} spent, ${c.delivered} delivered and ${c.rto} returned: ${inr(c.profitAfterAds)} after ads and returns.`,
      href: "/seller/meta-ads", cta: "Open Ad Spend" });
  });

  if (f.adWallet.recharged > 0 && (f.adWallet.balance <= 0 || (f.adWallet.daysLeft ?? 99) <= 3)) {
    out.push({ id: "wallet", severity: "warning",
      title: f.adWallet.balance <= 0 ? "Your ad wallet is empty" : `About ${f.adWallet.daysLeft} day${f.adWallet.daysLeft === 1 ? "" : "s"} of ads left`,
      detail: `Balance ${inr(f.adWallet.balance)} at about ${inr(f.adWallet.dailySpend)} a day. Recharge to avoid ads pausing.`,
      href: "/seller/meta-ads", cta: "Recharge" });
  }

  f.states.filter(st => st.delivered + st.rto >= 5 && (st.rtoPct ?? 0) >= 35).sort((a, b) => (b.rtoPct ?? 0) - (a.rtoPct ?? 0)).slice(0, 2).forEach(st => {
    out.push({ id: `state-${st.label}`, severity: "warning", title: `${st.label}: ${st.rtoPct}% of orders come back`,
      detail: `${st.rto} of ${st.delivered + st.rto} completed orders returned, costing ${inr(-st.rtoLoss)}. Consider prepaid offers or narrower ad targeting there.`,
      href: "/seller/rto", cta: "See RTO insights" });
  });

  if ((s.rtoPct ?? 0) >= 30 && !out.some(a => a.id.startsWith("state-"))) {
    out.push({ id: "rto", severity: "warning", title: `${s.rtoPct}% of your completed orders returned`,
      detail: `${s.rto} returns cost ${inr(-s.rtoLoss)}. The RTO page shows which states, products and reasons drive it.`,
      href: "/seller/rto", cta: "See RTO insights" });
  }

  if (s.costsMissing > 0) {
    out.push({ id: "costs", severity: "info", title: `Profit is approximate: ${s.costsMissing} orders have no product cost yet`,
      detail: "The AXQEN team fills these in when it reconciles orders. Until then, profit figures run high.",
      href: "/seller/analytics", cta: "See profit" });
  }

  const best = f.products.filter(p => p.delivered >= 3 && p.profit > 0 && (p.rtoPct ?? 100) <= 15 && !p.costsMissing).sort((a, b) => b.profit - a.profit)[0];
  if (best) {
    out.push({ id: `best-${best.label}`, severity: "good", title: `"${best.label}" is your best earner`,
      detail: `${inr(best.profit)} profit from ${best.delivered} delivered orders at ${best.rtoPct}% RTO. A good one to put more ad budget behind.`,
      href: "/seller/analytics", cta: "Open product profit" });
  }

  f.campaigns.filter(c => c.verdict === "scale").slice(0, 1).forEach(c => {
    out.push({ id: `camp-good-${c.name}`, severity: "good", title: `Campaign "${c.name}" is profitable`,
      detail: `${inr(c.profitAfterAds)} after ads and returns on ${inr(c.spend)} spend. Ask the ads team about scaling it.`,
      href: "/seller/meta-ads", cta: "Open Ad Spend" });
  });

  if (f.customers.repeat > 0) {
    out.push({ id: "repeat", severity: "good", title: `${f.customers.repeat} customer${f.customers.repeat === 1 ? "" : "s"} ordered more than once`,
      detail: `Out of ${f.customers.total} customers in the last ${f.periodDays} days.${f.customers.risky ? ` ${f.customers.risky} are marked risky (2+ returns or cancellations).` : ""}`,
      href: "/seller/customers", cta: "See customers" });
  }

  const rank: Record<Severity, number> = { critical: 0, warning: 1, info: 2, good: 3 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 7);
}

/** Real counts of work the AXQEN team and system did for this seller (no estimates). */
export async function teamActivity(sellerId: string, days = 30) {
  const gte = new Date(Date.now() - days * 86400000);
  const onSeller = { order: { sellerId }, createdAt: { gte } };
  const [calls, finals, ndrActions, returnsChecked, scans, shipped, payouts] = await Promise.all([
    prisma.orderTimeline.count({ where: { ...onSeller, eventType: "CONFIRMATION_ATTEMPT" } }),
    prisma.orderTimeline.findMany({ where: { ...onSeller, eventType: "CONFIRMATION_FINAL" }, select: { orderId: true, metadata: true, createdAt: true } }),
    prisma.orderTimeline.count({ where: { ...onSeller, eventType: "NDR_ACTION" } }),
    prisma.orderTimeline.count({ where: { ...onSeller, eventType: "RTO_RECEIVED" } }),
    prisma.orderTimeline.count({ where: { ...onSeller, eventType: "COURIER_SCAN" } }),
    prisma.order.count({ where: { sellerId, dispatchedAt: { gte } } }),
    prisma.walletTransaction.findMany({ where: { sellerId, type: "CREDIT", bankTxId: { not: null }, remittanceDate: { gte } }, select: { amount: true } }),
  ]);
  // Latest final status per order
  const latest = new Map<string, string>();
  for (const f of [...finals].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    latest.set(f.orderId, String(((f.metadata ?? {}) as Record<string, unknown>).value ?? ""));
  }
  const vals = [...latest.values()];
  return {
    days,
    confirmationCalls: calls,
    ordersConfirmed: vals.filter(v => v === "ORDER_PLACE" || v === "ORDER_DISPATCH").length,
    ordersCancelledOnCall: vals.filter(v => v === "CANCELLED").length,
    ordersShipped: shipped,
    courierScansTracked: scans,
    ndrActions,
    returnsChecked,
    payoutsSent: payouts.length,
    payoutsAmount: Math.round(payouts.reduce((s, p) => s + p.amount, 0)),
  };
}
