"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type AnalyticsData = {
  totalOrders: number;
  deliveredCount: number;
  rtoCount: number;
  cancelledCount: number;
  inTransitCount: number;
  deliveryRate: number;
  rtoRate: number;
  cancelledRate: number;
  totalRevenue: number;
  earnings: {
    totalGMV: number; netProfit: number; margin: number;
    totalAdSpend: number; totalPlatformFee: number;
    totalProductCost: number; totalRtoCharge: number; totalShipping: number;
  };
  topProducts: { name: string; orders: number; delPct: number; rtoPct: number }[];
  rtoByState: { state: string; total: number; delivered: number; rto: number; rtoPct: number; deliveryPct: number }[];
  pipeline: { new: number; ndr: number; rtoRisk: number; shipped: number; inTransit: number; delivered: number };
  unassignedCount: number;
  supplierDelayCount: number;
  prevPeriod: { totalOrders: number; deliveryRate: number; rtoRate: number; totalRevenue: number; netProfit: number } | null;
};

type AttributionData = {
  campaigns: {
    campaignName: string; totalSpend: number; totalClicks: number;
    orderCount: number; roas: number | null; cpc: number | null; cpr: number | null; roi: number | null;
  }[];
  summary: {
    totalSpend: number; totalRevenue: number; totalOrders: number;
    overallRoas: number | null; overallCpc: number | null; overallCpr: number | null; overallRoi: number | null;
  };
};

type ActivityData = {
  autoDispatched: number; newOrdersToday: number; ndrOpenedToday: number;
  supplierDelaysDetectedToday: number; humanActionsNeeded: number;
  timeSaved: number; timeSavedLabel: string;
};

type SpendData = { total: number; metaConnected: boolean; last30DaysRevenue: number };

type Severity = "critical" | "warning" | "info";

interface Opportunity {
  id: string; category: string; title: string;
  evidence: string; impact: string; action: string;
}

interface Risk {
  id: string; severity: Severity; category: string; title: string;
  evidence: string; comparison?: string; action: string;
}

interface MetaInsight {
  type: "scale" | "pause" | "warning" | "info";
  campaign: string; insight: string; metric: string; action: string;
}

interface Recommendation {
  problem: string; evidence: string; impact: string; action: string;
}

interface ChatMessage { role: "user" | "assistant"; content: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────

const rupee = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const num   = (n: number) => n.toLocaleString("en-IN");

function daysAgoISO(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ── Rule Engine — Opportunities ───────────────────────────────────────────────

function computeOpportunities(a: AnalyticsData, attr: AttributionData): Opportunity[] {
  const ops: Opportunity[] = [];

  const expandStates = (a.rtoByState ?? []).filter(s => s.total >= 3 && s.deliveryPct >= 70)
    .sort((x, y) => y.deliveryPct - x.deliveryPct);
  if (expandStates.length > 0) {
    const best = expandStates[0];
    ops.push({
      id: "state-expand", category: "Geographic Expansion",
      title: `Scale marketing in ${best.state}`,
      evidence: `${num(best.total)} orders | ${best.deliveryPct}% delivery rate | only ${best.rto} RTO`,
      impact: "High delivery rate means low return risk — every ad rupee here is safer",
      action: `Run targeted Meta Ads for ${best.state} — high-quality audience with proven intent`,
    });
  }

  const scaleProduct = (a.topProducts ?? []).filter(p => p.orders >= 3 && p.delPct >= 70)[0];
  if (scaleProduct) {
    ops.push({
      id: "product-scale", category: "Product Growth",
      title: `Scale "${scaleProduct.name}"`,
      evidence: `${scaleProduct.orders} orders | ${scaleProduct.delPct}% delivered | ${scaleProduct.rtoPct}% RTO`,
      impact: "Strong delivery rate signals genuine demand — low risk to increase inventory and spend",
      action: "Increase stock levels and Meta Ads budget for this product",
    });
  }

  if (a.earnings.margin > 15 && a.totalOrders >= 5) {
    ops.push({
      id: "margin-reinvest", category: "Finance",
      title: "Profitable period — right time to reinvest for growth",
      evidence: `${a.earnings.margin}% net margin | ${rupee(a.earnings.netProfit)} net profit on ${num(a.totalOrders)} orders`,
      impact: "Margin compresses as you scale — reinvesting now captures growth before costs rise",
      action: "Allocate 20–30% of net profit to new product testing or Meta Ads scaling",
    });
  }

  const bestCampaign = (attr.campaigns ?? [])
    .filter(c => (c.roas ?? 0) > 2 && c.orderCount >= 2)
    .sort((x, y) => (y.roas ?? 0) - (x.roas ?? 0))[0];
  if (bestCampaign) {
    ops.push({
      id: "campaign-scale", category: "Meta Ads",
      title: `Scale "${bestCampaign.campaignName}"`,
      evidence: `ROAS: ${bestCampaign.roas}x | ${bestCampaign.orderCount} orders | ${rupee(bestCampaign.totalSpend)} spent`,
      impact: `Every ₹1 in ad spend returns ₹${bestCampaign.roas} in revenue — compounding opportunity`,
      action: "Increase daily budget 20–30% — monitor ROAS for 3 days before scaling further",
    });
  }

  if (a.cancelledRate <= 5 && a.totalOrders >= 10) {
    ops.push({
      id: "low-cancel", category: "Operations",
      title: "Low cancellations — safe to push order volume",
      evidence: `Only ${a.cancelledRate}% cancellation rate across ${num(a.totalOrders)} orders`,
      impact: "Low cancellations signal genuine purchase intent — scaling now wastes less per lead",
      action: "Launch new SKU tests or increase ad budgets across active campaigns",
    });
  }

  return ops;
}

// ── Rule Engine — Risks ───────────────────────────────────────────────────────

function computeRisks(a: AnalyticsData, attr: AttributionData): Risk[] {
  const risks: Risk[] = [];

  if (a.rtoRate >= 30) {
    risks.push({
      id: "rto-critical", severity: "critical", category: "Fulfillment",
      title: `RTO rate is critically high: ${a.rtoRate}%`,
      evidence: `${a.rtoCount} returns out of ${a.totalOrders} orders — each return costs shipping both ways`,
      comparison: a.prevPeriod ? `Previous period: ${a.prevPeriod.rtoRate}%` : undefined,
      action: "Restrict COD in top RTO states. Add address confirmation call before dispatch.",
    });
  } else if (a.rtoRate >= 15) {
    risks.push({
      id: "rto-warning", severity: "warning", category: "Fulfillment",
      title: `RTO rate elevated: ${a.rtoRate}%`,
      evidence: `${a.rtoCount} returns — RTO cost: ~${rupee(a.earnings.totalRtoCharge)}`,
      comparison: a.prevPeriod ? `Previous period: ${a.prevPeriod.rtoRate}%` : undefined,
      action: "Identify which products and states are driving returns",
    });
  }

  if (a.unassignedCount >= 10) {
    risks.push({
      id: "unassigned-critical", severity: "critical", category: "Operations",
      title: `${a.unassignedCount} orders have no supplier assigned`,
      evidence: "These orders are stuck — customers are waiting and may cancel or raise disputes",
      action: "Go to Orders → assign suppliers immediately",
    });
  } else if (a.unassignedCount >= 3) {
    risks.push({
      id: "unassigned-warning", severity: "warning", category: "Operations",
      title: `${a.unassignedCount} orders need supplier assignment`,
      evidence: "Delayed supplier assignment = delayed dispatch = increased cancellation risk",
      action: "Go to Orders → assign suppliers",
    });
  }

  if (a.supplierDelayCount >= 3) {
    risks.push({
      id: "supplier-delay", severity: "warning", category: "Supply Chain",
      title: `${a.supplierDelayCount} orders stuck with suppliers >24h`,
      evidence: "Orders accepted but not dispatched — SLA breach risk, customer satisfaction impact",
      action: "Follow up with suppliers directly or reassign to backup supplier",
    });
  }

  if (a.pipeline.ndr >= 5) {
    risks.push({
      id: "ndr-risk", severity: "warning", category: "Delivery",
      title: `${a.pipeline.ndr} NDR cases need action`,
      evidence: "Failed delivery attempts — courier awaiting re-delivery instructions",
      action: "Go to Deliveries → action each NDR before they convert to RTO",
    });
  }

  if (a.earnings.netProfit < 0 && a.totalOrders >= 5) {
    risks.push({
      id: "negative-profit", severity: "warning", category: "Finance",
      title: "Operating at a loss this period",
      evidence: `Net: ${rupee(a.earnings.netProfit)} | Margin: ${a.earnings.margin}%`,
      comparison: a.prevPeriod ? `Previous period profit: ${rupee(a.prevPeriod.netProfit)}` : undefined,
      action: "Review product cost, reduce low-ROAS ad spend, check RTO charges",
    });
  }

  if (a.earnings.totalAdSpend > 0 && a.earnings.totalGMV > 0) {
    const adToRev = Math.round((a.earnings.totalAdSpend / a.earnings.totalGMV) * 100);
    if (adToRev > 50) {
      risks.push({
        id: "high-ad-spend", severity: "warning", category: "Meta Ads",
        title: `Ad spend at ${adToRev}% of your revenue`,
        evidence: `${rupee(a.earnings.totalAdSpend)} spend vs ${rupee(a.earnings.totalGMV)} GMV`,
        action: "Pause low-ROAS campaigns — maintain profitable spend only",
      });
    }
  }

  if (a.prevPeriod && a.prevPeriod.deliveryRate > 0) {
    const drop = a.prevPeriod.deliveryRate - a.deliveryRate;
    if (drop >= 10) {
      risks.push({
        id: "delivery-drop", severity: "info", category: "Fulfillment",
        title: `Delivery rate dropped ${drop}pp vs previous period`,
        evidence: `Now: ${a.deliveryRate}%`,
        comparison: `Previous: ${a.prevPeriod.deliveryRate}%`,
        action: "Check NDR trends and RTO by state — something changed last period",
      });
    }
  }

  const topState = (a.rtoByState ?? [])[0];
  if (topState && a.totalOrders >= 10) {
    const pctOrders = Math.round((topState.total / a.totalOrders) * 100);
    if (pctOrders >= 40) {
      risks.push({
        id: "state-concentration", severity: "info", category: "Geographic",
        title: `${pctOrders}% of orders concentrated in ${topState.state}`,
        evidence: `${topState.total} of ${a.totalOrders} total orders from one state`,
        action: "Diversify ad spend to other states to reduce single-market dependency",
      });
    }
  }

  const highRtoState = (a.rtoByState ?? []).find(s => s.rtoPct >= 40 && s.total >= 3);
  if (highRtoState) {
    risks.push({
      id: `state-rto-${highRtoState.state}`, severity: "warning", category: "Geographic",
      title: `${highRtoState.state}: ${highRtoState.rtoPct}% RTO rate`,
      evidence: `${highRtoState.rto} returns from ${highRtoState.total} orders`,
      action: `Add COD verification or prepaid-only checkout for ${highRtoState.state}`,
    });
  }

  const wasted = (attr.campaigns ?? []).filter(c => c.totalSpend > 500 && c.orderCount === 0);
  if (wasted.length > 0) {
    const wastedTotal = wasted.reduce((s, c) => s + c.totalSpend, 0);
    risks.push({
      id: "wasted-spend", severity: "warning", category: "Meta Ads",
      title: `${wasted.length} campaign(s) spent ${rupee(wastedTotal)} with 0 orders`,
      evidence: wasted.slice(0, 3).map(c => `"${c.campaignName}": ${rupee(c.totalSpend)}`).join(" · "),
      action: "Pause these campaigns — review targeting and creative",
    });
  }

  const sevOrder: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
  return risks.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
}

// ── Rule Engine — Meta Ads Insights ──────────────────────────────────────────

function computeMetaInsights(attr: AttributionData, storeRevenue: number): MetaInsight[] {
  const insights: MetaInsight[] = [];
  const cams = attr.campaigns ?? [];

  const best = cams.filter(c => (c.roas ?? 0) > 1.5 && c.orderCount >= 2)
    .sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0))[0];
  if (best) {
    insights.push({
      type: "scale", campaign: best.campaignName,
      insight: "Top performing campaign — strong ROAS with real order volume",
      metric: `ROAS: ${best.roas}x | Orders: ${best.orderCount} | Spend: ${rupee(best.totalSpend)} | CPC: ${best.cpc ? rupee(best.cpc) : "—"}`,
      action: "Scale budget 20–30% and monitor ROAS daily for 3 days",
    });
  }

  const worst = cams.filter(c => c.totalSpend > 500 && c.orderCount === 0)
    .sort((a, b) => b.totalSpend - a.totalSpend)[0];
  if (worst) {
    insights.push({
      type: "pause", campaign: worst.campaignName,
      insight: "Spending with zero orders — budget is converting to nothing",
      metric: `Spend: ${rupee(worst.totalSpend)} | Clicks: ${worst.totalClicks} | Orders: 0`,
      action: "Pause immediately. Refresh creative and narrow audience before restarting",
    });
  }

  const highCpc = cams.filter(c => (c.cpc ?? 0) > 20 && c.orderCount < 2)
    .sort((a, b) => (b.cpc ?? 0) - (a.cpc ?? 0))[0];
  if (highCpc) {
    insights.push({
      type: "warning", campaign: highCpc.campaignName,
      insight: "Very high CPC with low orders — creative fatigue or targeting mismatch",
      metric: `CPC: ₹${highCpc.cpc} | Orders: ${highCpc.orderCount} | Spend: ${rupee(highCpc.totalSpend)}`,
      action: "Replace ad creative and test a tighter audience",
    });
  }

  if (attr.summary.totalSpend > 0 && storeRevenue > 0) {
    const blended = Math.round((storeRevenue / attr.summary.totalSpend) * 100) / 100;
    insights.push({
      type: blended >= 2 ? "info" : "warning", campaign: "Overall / Blended",
      insight: blended >= 2
        ? "Blended ROAS is healthy — store revenue covers ad spend"
        : "Blended ROAS below 2x — ad spend is not translating efficiently to revenue",
      metric: `Store Revenue: ${rupee(storeRevenue)} | Ad Spend: ${rupee(attr.summary.totalSpend)} | Blended ROAS: ${blended}x`,
      action: blended >= 2 ? "Maintain current strategy — consider scaling top campaigns" : "Audit underperforming campaigns, cut wasteful spend",
    });
  }

  return insights;
}

// ── UI Components ─────────────────────────────────────────────────────────────

function SevBadge({ sev }: { sev: Severity }) {
  const map: Record<Severity, [string, string]> = {
    critical: ["#FEE2E2", "#DC2626"],
    warning:  ["#FEF3C7", "#D97706"],
    info:     ["#EEF2FF", "#4361EE"],
  };
  const [bg, color] = map[sev];
  return (
    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: bg, color }}>
      {sev === "critical" ? "Critical" : sev === "warning" ? "Warning" : "Info"}
    </span>
  );
}

function TypeBadge({ type }: { type: MetaInsight["type"] }) {
  const map = {
    scale:   ["#D1FAE5", "#059669", "Scale"],
    pause:   ["#FEE2E2", "#DC2626", "Pause"],
    warning: ["#FEF3C7", "#D97706", "Warning"],
    info:    ["#EEF2FF", "#4361EE", "Insight"],
  } as const;
  const [bg, color, label] = map[type];
  return (
    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: bg, color }}>
      {label}
    </span>
  );
}

function CardShell({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div className="bg-white rounded-xl p-5 flex flex-col gap-3.5 border" style={{ borderColor: accent ?? "#E8EDF6" }}>
      {children}
    </div>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">{label}</span>;
}

function ActionBox({ text, color = "#059669", bg = "#F0FDF4", border = "#BBF7D0" }: {
  text: string; color?: string; bg?: string; border?: string;
}) {
  return (
    <div className="rounded-lg px-3 py-2 border" style={{ background: bg, borderColor: border }}>
      <FieldLabel label="Action" />
      <p className="text-[13px] mt-0.5 font-medium" style={{ color }}>{text}</p>
    </div>
  );
}

function OpportunityCard({ opp }: { opp: Opportunity }) {
  return (
    <CardShell>
      <div>
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#4361EE" }}>{opp.category}</span>
        <p className="text-[15px] font-semibold text-[#0C1220] mt-1 leading-snug">{opp.title}</p>
      </div>
      <div className="flex flex-col gap-2.5">
        <div><FieldLabel label="Evidence" /><p className="text-[13px] text-[#374151] mt-0.5">{opp.evidence}</p></div>
        <div><FieldLabel label="Impact" /><p className="text-[13px] text-[#374151] mt-0.5">{opp.impact}</p></div>
        <ActionBox text={opp.action} />
      </div>
    </CardShell>
  );
}

function RiskCard({ risk }: { risk: Risk }) {
  const accentMap: Record<Severity, string> = { critical: "#FECACA", warning: "#FDE68A", info: "#C7D2FE" };
  return (
    <CardShell accent={accentMap[risk.severity]}>
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <SevBadge sev={risk.severity} />
          <span className="text-[11px] text-[#9CA3AF] font-medium">{risk.category}</span>
        </div>
        <p className="text-[15px] font-semibold text-[#0C1220] leading-snug">{risk.title}</p>
      </div>
      <div className="flex flex-col gap-2.5">
        <div><FieldLabel label="Evidence" /><p className="text-[13px] text-[#374151] mt-0.5">{risk.evidence}</p></div>
        {risk.comparison && (
          <div><FieldLabel label="vs Previous Period" /><p className="text-[13px] text-[#374151] mt-0.5">{risk.comparison}</p></div>
        )}
        <ActionBox text={risk.action} color="#92400E" bg="#FFF7ED" border="#FED7AA" />
      </div>
    </CardShell>
  );
}

function MetaCard({ insight }: { insight: MetaInsight }) {
  return (
    <CardShell>
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <TypeBadge type={insight.type} />
          <span className="text-[11px] text-[#9CA3AF] font-medium truncate max-w-[180px]">{insight.campaign}</span>
        </div>
        <p className="text-[14px] font-semibold text-[#0C1220] leading-snug">{insight.insight}</p>
      </div>
      <div>
        <FieldLabel label="Metrics" />
        <p className="text-[12px] text-[#374151] mt-0.5 font-mono">{insight.metric}</p>
      </div>
      <ActionBox text={insight.action} color="#1E3A8A" bg="#EEF2FF" border="#C7D2FE" />
    </CardShell>
  );
}

function RecCard({ rec, index }: { rec: Recommendation; index: number }) {
  return (
    <CardShell>
      <div className="flex items-start gap-3">
        <span className="w-6 h-6 rounded-full bg-[#EEF2FF] text-[#4361EE] text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1 flex flex-col gap-2.5">
          <div><FieldLabel label="Problem" /><p className="text-[14px] font-semibold text-[#0C1220] mt-0.5 leading-snug">{rec.problem}</p></div>
          <div><FieldLabel label="Evidence" /><p className="text-[13px] text-[#374151] mt-0.5">{rec.evidence}</p></div>
          <div><FieldLabel label="Impact" /><p className="text-[13px] text-[#374151] mt-0.5">{rec.impact}</p></div>
          <ActionBox text={rec.action} />
        </div>
      </div>
    </CardShell>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-[#F3F4F6] flex items-center justify-center mb-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <p className="text-[14px] text-[#6B7280] max-w-xs">{label}</p>
    </div>
  );
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

function OverviewTab({ a, activity, risks, opps }: {
  a: AnalyticsData; activity: ActivityData | null;
  risks: Risk[]; opps: Opportunity[];
}) {
  const critical = risks.filter(r => r.severity === "critical");
  const warnings = risks.filter(r => r.severity === "warning");

  const headline = critical.length > 0
    ? `You have ${critical.length} critical issue${critical.length > 1 ? "s" : ""} to address today.`
    : warnings.length > 0
      ? `${warnings.length} item${warnings.length > 1 ? "s" : ""} need your attention.`
      : opps.length > 0
        ? `${opps.length} growth opportunit${opps.length > 1 ? "ies" : "y"} detected in your data.`
        : `Operations look stable. Keep monitoring.`;

  const subline = `${num(a.totalOrders)} orders · ${a.deliveryRate}% delivery · ${a.rtoRate}% RTO · ${a.earnings.margin}% margin`;

  const statColor = (n: number, good: "high" | "low") =>
    good === "high" ? (n >= 70 ? "#059669" : n >= 40 ? "#D97706" : "#EF4444")
                    : (n <= 10 ? "#059669" : n <= 25 ? "#D97706" : "#EF4444");

  return (
    <div className="flex flex-col gap-6">
      {/* Headline */}
      <div className="bg-white border border-[#E8EDF6] rounded-xl p-5">
        <p className="text-[18px] font-bold text-[#0C1220] leading-snug">{headline}</p>
        <p className="text-[13px] text-[#9CA3AF] mt-1.5">{subline} — last 30 days</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Delivery Rate", value: `${a.deliveryRate}%`, color: statColor(a.deliveryRate, "high") },
          { label: "RTO Rate",      value: `${a.rtoRate}%`,      color: statColor(a.rtoRate, "low") },
          { label: "Net Profit",    value: rupee(a.earnings.netProfit), color: a.earnings.netProfit >= 0 ? "#059669" : "#EF4444" },
          { label: "Ad Spend",      value: rupee(a.earnings.totalAdSpend), color: "#4361EE" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-[#E8EDF6] rounded-xl px-4 py-3.5">
            <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide">{s.label}</p>
            <p className="text-[20px] font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Top critical risk */}
      {critical.length > 0 && (
        <div>
          <p className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-3">Top Critical Risk</p>
          <RiskCard risk={critical[0]} />
        </div>
      )}

      {/* Top opportunity */}
      {opps.length > 0 && (
        <div>
          <p className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-3">Top Opportunity</p>
          <OpportunityCard opp={opps[0]} />
        </div>
      )}

      {/* Pipeline status */}
      <div>
        <p className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-3">Order Pipeline</p>
        <div className="bg-white border border-[#E8EDF6] rounded-xl p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: "Needs Assignment", value: a.unassignedCount, alert: a.unassignedCount > 0 },
              { label: "NDR Pending",      value: a.pipeline.ndr,    alert: a.pipeline.ndr > 0 },
              { label: "Supplier Delays",  value: a.supplierDelayCount, alert: a.supplierDelayCount > 0 },
              { label: "In Transit",       value: a.inTransitCount,  alert: false },
              { label: "Delivered",        value: a.deliveredCount,  alert: false },
              { label: "RTO",              value: a.rtoCount,        alert: a.rtoCount > 0 },
            ].map(s => (
              <div key={s.label}>
                <p className="text-[11px] text-[#9CA3AF] font-medium">{s.label}</p>
                <p className="text-[18px] font-bold mt-0.5" style={{ color: s.alert ? "#EF4444" : "#0C1220" }}>{num(s.value)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Activity today */}
      {activity && (
        <div>
          <p className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-3">AXQEN Activity Today</p>
          <div className="bg-white border border-[#E8EDF6] rounded-xl p-5">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Auto Dispatched",  value: activity.autoDispatched },
                { label: "Orders Ingested",  value: activity.newOrdersToday },
                { label: "NDR Cases Opened", value: activity.ndrOpenedToday },
                { label: "Delays Detected",  value: activity.supplierDelaysDetectedToday },
              ].map(s => (
                <div key={s.label}>
                  <p className="text-[11px] text-[#9CA3AF] font-medium">{s.label}</p>
                  <p className="text-[18px] font-bold text-[#4361EE] mt-0.5">{num(s.value)}</p>
                </div>
              ))}
            </div>
            {activity.timeSaved > 0 && (
              <div className="mt-4 pt-4 border-t border-[#F3F4F6]">
                <p className="text-[13px] text-[#059669] font-semibold">
                  ~{activity.timeSavedLabel} saved today through automation
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Recommendations ──────────────────────────────────────────────────────

function RecommendationsTab({ recs, loading, error, onGenerate, hasData }: {
  recs: Recommendation[] | null;
  loading: boolean; error: string | null;
  onGenerate: () => void; hasData: boolean;
}) {
  if (!hasData) return <Empty label="Add at least 3 orders to unlock AI recommendations." />;

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white border border-[#E8EDF6] rounded-xl p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4361EE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.16Z" />
              <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.16Z" />
            </svg>
            <p className="text-[14px] font-semibold text-[#0C1220]">AI Recommendations</p>
          </div>
          <p className="text-[13px] text-[#6B7280]">
            AXQEN analyzes your data and generates specific, actionable recommendations.
            Grounded in your real metrics — not generic advice.
          </p>
          <p className="text-[11px] text-[#9CA3AF] mt-1">Powered by Claude Haiku · Each generation uses a small number of tokens</p>
        </div>
        <button
          onClick={onGenerate}
          disabled={loading}
          className="px-4 py-2.5 rounded-lg text-[13px] font-semibold text-white flex-shrink-0 transition-opacity disabled:opacity-50"
          style={{ background: "#4361EE" }}
        >
          {loading ? "Generating…" : recs ? "Regenerate" : "Generate Recommendations"}
        </button>
      </div>

      {error && <p className="text-[13px] text-[#EF4444] px-1">{error}</p>}

      {loading && (
        <div className="flex flex-col gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-[#F9FAFB] border border-[#E8EDF6] rounded-xl h-40" />
          ))}
        </div>
      )}

      {!loading && recs && (
        <div className="flex flex-col gap-4">
          {recs.map((r, i) => <RecCard key={i} rec={r} index={i} />)}
        </div>
      )}

      {!loading && !recs && !error && (
        <Empty label="Click 'Generate Recommendations' to get AI-powered insights based on your data." />
      )}
    </div>
  );
}

// ── Tab: Meta Ads ─────────────────────────────────────────────────────────────

function MetaTab({ insights, summary, storeRevenue, campaigns, connected }: {
  insights: MetaInsight[];
  summary: AttributionData["summary"] | null;
  storeRevenue: number;
  campaigns: AttributionData["campaigns"];
  connected: boolean;
}) {
  if (!summary || summary.totalSpend === 0) {
    return (
      <Empty label={
        connected
          ? "No ad spend recorded in the last 30 days. Add spend data from the Meta Ads page."
          : "Meta Ads not connected. Connect from the Meta Ads page to see intelligence here."
      } />
    );
  }

  const blended = summary.totalSpend > 0 && storeRevenue > 0
    ? Math.round((storeRevenue / summary.totalSpend) * 100) / 100 : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Spend",    value: rupee(summary.totalSpend) },
          { label: "Store Revenue",  value: rupee(storeRevenue) },
          { label: "Blended ROAS",   value: blended !== null ? `${blended}x` : "—" },
          { label: "Attributed Orders", value: num(summary.totalOrders) },
        ].map(s => (
          <div key={s.label} className="bg-white border border-[#E8EDF6] rounded-xl px-4 py-3.5">
            <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide">{s.label}</p>
            <p className="text-[18px] font-bold text-[#0C1220] mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div>
          <p className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-3">Campaign Intelligence</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((ins, i) => <MetaCard key={i} insight={ins} />)}
          </div>
        </div>
      )}

      {/* Campaign table */}
      {campaigns.length > 0 && (
        <div>
          <p className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-3">Campaign Breakdown</p>
          <div className="bg-white border border-[#E8EDF6] rounded-xl overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F3F4F6]">
                  {["Campaign", "Spend", "Orders", "ROAS", "CPC", "CPR"].map(h => (
                    <th key={h} className="px-4 py-3 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wide text-right first:text-left whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F9FAFB]">
                {campaigns.map((c, i) => (
                  <tr key={i} className="hover:bg-[#FAFBFF]">
                    <td className="px-4 py-3 text-[13px] font-medium text-[#0C1220] max-w-[160px] truncate">{c.campaignName}</td>
                    <td className="px-4 py-3 text-[13px] text-[#374151] text-right">{rupee(c.totalSpend)}</td>
                    <td className="px-4 py-3 text-[13px] text-[#374151] text-right">{c.orderCount}</td>
                    <td className="px-4 py-3 text-[13px] font-semibold text-right" style={{ color: (c.roas ?? 0) > 1.5 ? "#059669" : (c.roas ?? 0) > 0 ? "#D97706" : "#EF4444" }}>
                      {c.roas !== null && c.roas > 0 ? `${c.roas}x` : "—"}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#374151] text-right">{c.cpc !== null ? rupee(c.cpc) : "—"}</td>
                    <td className="px-4 py-3 text-[13px] text-[#374151] text-right">{c.cpr !== null ? rupee(c.cpr) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Ask AXQEN ────────────────────────────────────────────────────────────

const SUGGESTED = [
  "Which product should I focus on?",
  "Why is my RTO rate high?",
  "Which state should I target next?",
  "Is my ad spend efficient?",
];

function AskTab({ messages, input, loading, onInput, onSend, chatEndRef, hasData }: {
  messages: ChatMessage[]; input: string; loading: boolean;
  onInput: (v: string) => void; onSend: () => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>; hasData: boolean;
}) {
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-[#E8EDF6] rounded-xl p-4">
        <p className="text-[13px] text-[#6B7280]">
          Ask AXQEN anything about your business data. Answers are grounded in your real metrics — no fabricated numbers.
        </p>
      </div>

      {/* Chat area */}
      <div className="bg-white border border-[#E8EDF6] rounded-xl flex flex-col" style={{ minHeight: 320 }}>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3" style={{ maxHeight: 400 }}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
              <p className="text-[13px] text-[#9CA3AF]">Try asking:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTED.map(s => (
                  <button
                    key={s}
                    onClick={() => onInput(s)}
                    className="px-3 py-1.5 rounded-lg border border-[#E8EDF6] text-[12px] text-[#374151] hover:border-[#4361EE] hover:text-[#4361EE] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[85%] px-4 py-3 rounded-xl text-[13px] leading-relaxed"
                style={{
                  background: m.role === "user" ? "#4361EE" : "#F7F8FC",
                  color: m.role === "user" ? "#fff" : "#0C1220",
                }}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#F7F8FC] px-4 py-3 rounded-xl flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#9CA3AF] animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-[#9CA3AF] animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-[#9CA3AF] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="border-t border-[#F3F4F6] p-3 flex gap-2">
          <input
            value={input}
            onChange={e => onInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={hasData ? "Ask about your data…" : "Add orders first to ask questions"}
            disabled={!hasData || loading}
            className="flex-1 bg-[#F7F8FC] rounded-lg px-3 py-2.5 text-[13px] text-[#0C1220] outline-none border border-transparent focus:border-[#4361EE] transition-colors"
          />
          <button
            onClick={onSend}
            disabled={!input.trim() || loading || !hasData}
            className="px-4 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ background: "#4361EE" }}
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: AI Activity ──────────────────────────────────────────────────────────

function ActivityTab({ activity }: { activity: ActivityData | null }) {
  if (!activity) return <Empty label="Activity data unavailable." />;

  const rows = [
    {
      label: "Orders auto-dispatched",
      value: activity.autoDispatched,
      desc: "AWB assigned and status progressed today",
      icon: "📦",
    },
    {
      label: "Orders ingested & routed",
      value: activity.newOrdersToday,
      desc: "New orders picked up and queued for supplier assignment",
      icon: "📥",
    },
    {
      label: "NDR cases opened",
      value: activity.ndrOpenedToday,
      desc: "Failed delivery attempts detected and flagged",
      icon: "⚠️",
    },
    {
      label: "Supplier delays detected",
      value: activity.supplierDelaysDetectedToday,
      desc: "Orders stuck >24h with supplier — flagged for action",
      icon: "🕐",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-[#E8EDF6] rounded-xl p-5">
        <p className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-1">Today</p>
        <p className="text-[22px] font-bold text-[#059669]">~{activity.timeSavedLabel} saved</p>
        <p className="text-[13px] text-[#6B7280] mt-0.5">through automated actions — time you didn&apos;t have to spend manually</p>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map(r => (
          <div key={r.label} className="bg-white border border-[#E8EDF6] rounded-xl p-4 flex items-center gap-4">
            <span className="text-2xl">{r.icon}</span>
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-[#0C1220]">{r.label}</p>
              <p className="text-[12px] text-[#9CA3AF] mt-0.5">{r.desc}</p>
            </div>
            <span className="text-[22px] font-bold" style={{ color: r.value > 0 ? "#4361EE" : "#9CA3AF" }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>

      {activity.humanActionsNeeded > 0 && (
        <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-xl p-4 flex items-start gap-3">
          <span className="text-lg mt-0.5">👤</span>
          <div>
            <p className="text-[14px] font-semibold text-[#92400E]">{activity.humanActionsNeeded} item{activity.humanActionsNeeded > 1 ? "s" : ""} need your attention</p>
            <p className="text-[12px] text-[#B45309] mt-0.5">Unassigned orders or pending NDR actions — AXQEN cannot act on these automatically</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function IntelligencePage() {
  const [analytics,   setAnalytics]   = useState<AnalyticsData | null>(null);
  const [attribution, setAttribution] = useState<AttributionData | null>(null);
  const [activity,    setActivity]    = useState<ActivityData | null>(null);
  const [spend,       setSpend]       = useState<SpendData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState("overview");
  const [recs,        setRecs]        = useState<Recommendation[] | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError,   setRecsError]   = useState<string | null>(null);
  const [chatMsgs,    setChatMsgs]    = useState<ChatMessage[]>([]);
  const [chatInput,   setChatInput]   = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const from = daysAgoISO(30);
  const to   = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [aRes, atRes, acRes, spRes] = await Promise.all([
          fetch(`/api/seller/analytics?from=${from}&to=${to}`),
          fetch(`/api/seller/ad-spend/attribution?from=${from}&to=${to}`),
          fetch(`/api/seller/ai-activity`),
          fetch(`/api/seller/ad-spend`),
        ]);
        if (aRes.ok)  setAnalytics(await aRes.json());
        if (atRes.ok) setAttribution(await atRes.json());
        if (acRes.ok) setActivity(await acRes.json());
        if (spRes.ok) setSpend(await spRes.json());
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, [from, to]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  const buildContext = useCallback(() => {
    if (!analytics || !attribution) return null;
    return {
      period: "Last 30 days",
      orders: {
        total: analytics.totalOrders, delivered: analytics.deliveredCount,
        rto: analytics.rtoCount, cancelled: analytics.cancelledCount,
        deliveryRate: analytics.deliveryRate, rtoRate: analytics.rtoRate,
      },
      revenue: {
        gmv: analytics.earnings.totalGMV, netProfit: analytics.earnings.netProfit,
        margin: analytics.earnings.margin, adSpend: analytics.earnings.totalAdSpend,
      },
      topProducts: (analytics.topProducts ?? []).slice(0, 5).map(p => ({
        name: p.name, orders: p.orders, deliveryPct: p.delPct, rtoPct: p.rtoPct,
      })),
      riskStates: (analytics.rtoByState ?? []).filter(s => s.rtoPct > 20).slice(0, 5).map(s => ({
        state: s.state, orders: s.total, rto: s.rto, rtoPct: s.rtoPct, deliveryPct: s.deliveryPct,
      })),
      metaAds: {
        totalSpend: attribution.summary.totalSpend,
        overallRoas: attribution.summary.overallRoas,
        attributedOrders: attribution.summary.totalOrders,
        storeRevenue: spend?.last30DaysRevenue ?? 0,
      },
      pipeline: {
        unassigned: analytics.unassignedCount, ndr: analytics.pipeline.ndr,
        supplierDelays: analytics.supplierDelayCount,
      },
    };
  }, [analytics, attribution, spend]);

  async function generateRecs() {
    const ctx = buildContext();
    if (!ctx) return;
    setRecsLoading(true); setRecsError(null);
    try {
      const res = await fetch("/api/seller/intelligence/recommend", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: ctx }),
      });
      const data = await res.json();
      if (!res.ok) { setRecsError(data.error ?? `Error ${res.status}`); return; }
      setRecs(data.recommendations);
    } catch (e) { setRecsError(String(e)); }
    finally { setRecsLoading(false); }
  }

  async function sendChat() {
    const q = chatInput.trim();
    if (!q || chatLoading) return;
    setChatMsgs(m => [...m, { role: "user", content: q }]);
    setChatInput(""); setChatLoading(true);
    try {
      const res = await fetch("/api/seller/intelligence/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, context: buildContext() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setChatMsgs(m => [...m, { role: "assistant", content: `Error: ${data.error ?? res.status}` }]);
      } else {
        setChatMsgs(m => [...m, { role: "assistant", content: data.answer ?? "No answer returned." }]);
      }
    } catch (e) {
      setChatMsgs(m => [...m, { role: "assistant", content: `Error: ${String(e)}` }]);
    }
    finally { setChatLoading(false); }
  }

  const opportunities = analytics && attribution ? computeOpportunities(analytics, attribution) : [];
  const risks         = analytics && attribution ? computeRisks(analytics, attribution) : [];
  const metaInsights  = attribution && spend
    ? computeMetaInsights(attribution, spend.last30DaysRevenue) : [];

  const criticalCount = risks.filter(r => r.severity === "critical").length;

  const TABS = [
    { id: "overview",        label: "Overview" },
    { id: "opportunities",   label: opportunities.length > 0 ? `Opportunities (${opportunities.length})` : "Opportunities" },
    { id: "risks",           label: criticalCount > 0 ? `Risks 🔴` : risks.length > 0 ? `Risks (${risks.length})` : "Risks" },
    { id: "recommendations", label: "AI Recs" },
    { id: "meta",            label: "Meta Ads" },
    { id: "ask",             label: "Ask AXQEN" },
    { id: "activity",        label: "AI Activity" },
  ];

  if (loading) {
    return (
      <div className="px-3 py-4 md:p-8">
        <div className="animate-pulse flex flex-col gap-4">
          <div className="h-8 w-40 bg-[#F3F4F6] rounded" />
          <div className="h-4 w-64 bg-[#F3F4F6] rounded" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-[#F3F4F6] rounded-xl" />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            {[...Array(2)].map((_, i) => <div key={i} className="h-48 bg-[#F3F4F6] rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="px-3 py-4 md:p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] flex items-center justify-center mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4361EE" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.16Z" />
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.16Z" />
          </svg>
        </div>
        <h2 className="text-[17px] font-bold text-[#0C1220] mb-1">Intelligence</h2>
        <p className="text-[13px] text-[#6B7280] max-w-xs">Add orders to your account and Intelligence will start detecting patterns and opportunities.</p>
      </div>
    );
  }

  return (
    <div className="px-3 py-4 md:p-8 pb-[80px] md:pb-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-[22px] font-bold text-[#0C1220]">Intelligence</h1>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EEF2FF] text-[#4361EE]">V1</span>
        </div>
        <p className="text-[13px] text-[#9CA3AF] mt-0.5">Why things are happening · What to watch · What to do next</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto mb-6" style={{ scrollbarWidth: "none" }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="px-3 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors flex-shrink-0"
            style={{
              background: activeTab === t.id ? "#4361EE" : "#F3F4F6",
              color: activeTab === t.id ? "#fff" : "#6B7280",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "overview" && (
        <OverviewTab a={analytics} activity={activity} risks={risks} opps={opportunities} />
      )}
      {activeTab === "opportunities" && (
        opportunities.length === 0
          ? <Empty label="No clear opportunities detected yet. More data will unlock insights." />
          : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {opportunities.map(o => <OpportunityCard key={o.id} opp={o} />)}
            </div>
      )}
      {activeTab === "risks" && (
        risks.length === 0
          ? <Empty label="No significant risks detected in the last 30 days." />
          : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {risks.map(r => <RiskCard key={r.id} risk={r} />)}
            </div>
      )}
      {activeTab === "recommendations" && (
        <RecommendationsTab
          recs={recs} loading={recsLoading} error={recsError}
          onGenerate={generateRecs} hasData={analytics.totalOrders >= 3}
        />
      )}
      {activeTab === "meta" && (
        <MetaTab
          insights={metaInsights} summary={attribution?.summary ?? null}
          storeRevenue={spend?.last30DaysRevenue ?? 0}
          campaigns={attribution?.campaigns ?? []}
          connected={spend?.metaConnected ?? false}
        />
      )}
      {activeTab === "ask" && (
        <AskTab
          messages={chatMsgs} input={chatInput} loading={chatLoading}
          onInput={setChatInput} onSend={sendChat}
          chatEndRef={chatEndRef} hasData={analytics.totalOrders > 0}
        />
      )}
      {activeTab === "activity" && <ActivityTab activity={activity} />}
    </div>
  );
}
