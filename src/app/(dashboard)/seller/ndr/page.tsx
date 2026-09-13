"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle, RefreshCw, Loader2, RotateCcw, PackageX,
  Phone, MapPin, CheckCircle, ChevronDown, ChevronUp, Clock, Flame,
} from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";

interface NdrOrder {
  id: string;
  externalOrderId: string;
  customerName: string | null;
  customerAddress: { phone?: string; address?: string; city?: string; state?: string; pincode?: string } | null;
  totalAmount: number;
  awbNumber: string | null;
  trackingUrl: string | null;
  ndrReason: string | null;
  ndrStatus: string | null;
  ndrAttempts: number;
  ndrActionTaken: string | null;
  createdAt: string;
  ndrCreatedAt: string | null;
}

function ndrAge(ndrCreatedAt: string | null) {
  if (!ndrCreatedAt) return null;
  const ms = Date.now() - new Date(ndrCreatedAt).getTime();
  const hours = Math.floor(ms / 3600000);
  const days  = Math.floor(ms / 86400000);
  if (days === 0) return { label: hours <= 1 ? "< 1h" : `${hours}h`, level: "ok" as const };
  if (days === 1) return { label: "1d",            level: "warn" as const };
  if (days === 2) return { label: "2d",            level: "urgent" as const };
  return { label: `${days}d`, level: "escalated" as const };
}

const AGE_STYLE: Record<string, { bg: string; color: string; border?: string }> = {
  ok:        { bg: "#F0FDF4", color: "#15803D" },
  warn:      { bg: "#FFFBEB", color: "#B45309" },
  urgent:    { bg: "#FFF7ED", color: "#C2410C" },
  escalated: { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
};

export default function NdrPage() {
  const [pending, setPending] = useState<NdrOrder[]>([]);
  const [actioned, setActioned] = useState<NdrOrder[]>([]);
  const [escalatedCount, setEscalatedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [forms, setForms] = useState<Record<string, {
    action: "REATTEMPT" | "RTO";
    name: string; phone: string; address: string;
    city: string; pincode: string; state: string; comments: string;
  }>>({});

  useEffect(() => { fetchNdr(); }, []);

  async function fetchNdr() {
    setLoading(true);
    const res = await fetch("/api/seller/ndr");
    const data = await res.json();
    setPending(data.pending || []);
    setActioned(data.actioned || []);
    setEscalatedCount(data.escalatedCount ?? 0);
    const init: typeof forms = {};
    for (const o of data.pending || []) {
      init[o.id] = {
        action: "REATTEMPT",
        name: o.customerName || "",
        phone: o.customerAddress?.phone || "",
        address: o.customerAddress?.address || "",
        city: o.customerAddress?.city || "",
        pincode: o.customerAddress?.pincode || "",
        state: o.customerAddress?.state || "",
        comments: "",
      };
    }
    setForms(init);
    setLoading(false);
  }

  async function handleSync() {
    setSyncing(true); setSyncMsg("");
    const res = await fetch("/api/seller/ndr/sync", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setSyncMsg(`Error: ${data.error || "Sync failed"}`);
    } else if ((data.found ?? 0) === 0) {
      setSyncMsg(data.debug ?? "0 NDRs found — AWBs may not be set on orders");
    } else {
      setSyncMsg(`${data.found} NDR(s) synced from Delhivery`);
    }
    await fetchNdr();
    setSyncing(false);
  }

  async function handleSubmit(orderId: string) {
    const form = forms[orderId];
    if (!form) return;
    if (form.action === "REATTEMPT" && !form.phone) {
      setError("Phone number is required for re-attempt"); return;
    }
    setSubmitting(orderId); setError(null); setSuccess(null);

    const res = await fetch("/api/seller/ndr/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, ...form }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed"); setSubmitting(null); return; }
    setSuccess(orderId);
    await fetchNdr();
    setSubmitting(null);
  }

  function setForm(orderId: string, patch: Partial<typeof forms[string]>) {
    setForms(p => ({ ...p, [orderId]: { ...p[orderId], ...patch } }));
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page)" }}>
      <PageHero
        title="NDR Management"
        subtitle="Manage failed delivery attempts — re-attempt or return to origin"
        actions={
          <div className="flex items-center gap-3">
            {syncMsg && <span className="text-xs font-medium" style={{ color: "#16A34A" }}>{syncMsg}</span>}
            <button onClick={handleSync} disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--bg-muted)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Checking..." : "Sync NDRs"}
            </button>
          </div>
        }
        cards={
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Pending Action",       value: pending.length,                                             color: "#EF4444", icon: AlertTriangle },
              { label: "Escalated (2d+)",      value: escalatedCount,                                             color: "#DC2626", icon: Flame },
              { label: "Re-attempt Requested", value: actioned.filter(a => a.ndrActionTaken === "REATTEMPT").length, color: "#3B82F6", icon: RotateCcw },
              { label: "RTO Initiated",        value: actioned.filter(a => a.ndrActionTaken === "RTO").length,    color: "#F59E0B", icon: PackageX },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="rounded-2xl px-5 py-4 flex items-center gap-4"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--bg-muted)" }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</p>
                  <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        }
      />

      <div className="px-4 md:px-8 py-6 space-y-6">
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {/* Escalation banner */}
        {escalatedCount > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-200"
            style={{ background: "#FEF2F2" }}>
            <Flame className="w-4 h-4 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-700">
                {escalatedCount} NDR{escalatedCount !== 1 ? "s" : ""} pending for 2+ days — action required
              </p>
              <p className="text-xs text-red-500 mt-0.5">
                Delayed action risks auto-RTO by the courier. Address these first.
              </p>
            </div>
          </div>
        )}

        {/* Pending NDRs */}
        <div>
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: "var(--text-900)" }}>
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Pending Action ({pending.length})
            <span className="text-xs font-normal ml-1" style={{ color: "var(--text-400)" }}>sorted by oldest first</span>
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : pending.length === 0 ? (
            <div className="card py-12 flex flex-col items-center gap-3 text-center">
              <CheckCircle className="w-10 h-10 text-green-400" />
              <p className="text-sm text-gray-500 font-medium">No pending NDRs</p>
              <p className="text-xs text-gray-400 max-w-xs">
                Click &ldquo;Sync NDRs&rdquo; to pull failed delivery data from Delhivery.
                If AWBs are not set on your orders, contact admin to bulk-import them.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map(order => {
                const form = forms[order.id];
                const isExpanded = expanded === order.id;
                const isRTO = form?.action === "RTO";
                const age = ndrAge(order.ndrCreatedAt);
                const ageStyle = age ? AGE_STYLE[age.level] : null;
                const isEscalated = age?.level === "escalated";
                // Orders that became RTO without NDR action (fell through the gap)
                const isAlreadyRto = !order.ndrStatus && order.ndrAttempts === 0;

                return (
                  <div key={order.id} className="card overflow-hidden"
                    style={{ borderColor: isEscalated ? "#FECACA" : isAlreadyRto ? "#FED7AA" : undefined }}>
                    {/* Header row */}
                    <div className="px-5 py-4 flex items-center gap-4 cursor-pointer"
                      onClick={() => setExpanded(isExpanded ? null : order.id)}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isEscalated ? "bg-red-100" : isAlreadyRto ? "bg-orange-100" : "bg-red-50"}`}>
                        {isEscalated
                          ? <Flame className="w-4 h-4 text-red-600" />
                          : isAlreadyRto
                            ? <PackageX className="w-4 h-4 text-orange-600" />
                            : <AlertTriangle className="w-4 h-4 text-red-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-gray-900">#{order.externalOrderId}</span>
                          {isAlreadyRto && (
                            <span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-xs font-semibold rounded-full border border-orange-200">
                              Auto-RTO — Sync to get NDR details
                            </span>
                          )}
                          <span className="px-2 py-0.5 bg-red-50 text-red-600 text-xs font-semibold rounded-full">
                            {order.ndrAttempts} attempt{order.ndrAttempts !== 1 ? "s" : ""}
                          </span>
                          {age && ageStyle && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                              style={{ background: ageStyle.bg, color: ageStyle.color, border: ageStyle.border ? `1px solid ${ageStyle.border}` : undefined }}>
                              <Clock className="w-3 h-3" />
                              {age.label} open
                              {isEscalated && " — escalated"}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{order.ndrReason || "Delivery failed"}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-gray-800">₹{order.totalAmount.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">{order.customerName || "—"}</p>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>

                    {/* Action form */}
                    {isExpanded && form && (
                      <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
                        {success === order.id && (
                          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                            <CheckCircle className="w-4 h-4" /> Action submitted successfully!
                          </div>
                        )}

                        {isEscalated && (
                          <div className="flex items-center gap-2 text-xs bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg">
                            <Flame className="w-3.5 h-3.5 flex-shrink-0" />
                            This NDR has been open for {age?.label}. Courier may auto-RTO if not actioned soon.
                          </div>
                        )}

                        {/* Action toggle */}
                        <div>
                          <label className="block text-xs font-semibold mb-2" style={{ color: "var(--text-600)" }}>Action</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setForm(order.id, { action: "REATTEMPT" })}
                              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-all"
                              style={!isRTO
                                ? { background: "#EFF6FF", color: "#3B82F6", borderColor: "#BFDBFE" }
                                : { background: "#F9FAFB", color: "#6B7280", borderColor: "#E5E7EB" }}>
                              <RotateCcw className="w-4 h-4" /> Re-attempt Delivery
                            </button>
                            <button type="button" onClick={() => setForm(order.id, { action: "RTO" })}
                              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-all"
                              style={isRTO
                                ? { background: "#FEF2F2", color: "#EF4444", borderColor: "#FECACA" }
                                : { background: "#F9FAFB", color: "#6B7280", borderColor: "#E5E7EB" }}>
                              <PackageX className="w-4 h-4" /> Return to Origin (RTO)
                            </button>
                          </div>
                        </div>

                        {!isRTO && (
                          <>
                            <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
                              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                              Update customer details if address/phone was wrong
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-600)" }}>Customer Name</label>
                                <input value={form.name} onChange={e => setForm(order.id, { name: e.target.value })}
                                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: "var(--text-600)" }}>
                                  <Phone className="w-3 h-3" /> Phone *
                                </label>
                                <input value={form.phone} onChange={e => setForm(order.id, { phone: e.target.value })}
                                  placeholder="10-digit mobile" required
                                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" />
                              </div>
                              <div className="col-span-2">
                                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-600)" }}>Address</label>
                                <input value={form.address} onChange={e => setForm(order.id, { address: e.target.value })}
                                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-600)" }}>City</label>
                                <input value={form.city} onChange={e => setForm(order.id, { city: e.target.value })}
                                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-600)" }}>Pincode</label>
                                <input value={form.pincode} onChange={e => setForm(order.id, { pincode: e.target.value })}
                                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-600)" }}>State</label>
                                <input value={form.state} onChange={e => setForm(order.id, { state: e.target.value })}
                                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-600)" }}>Comments (optional)</label>
                                <input value={form.comments} onChange={e => setForm(order.id, { comments: e.target.value })}
                                  placeholder="e.g. Call before delivery"
                                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" />
                              </div>
                            </div>
                          </>
                        )}

                        {isRTO && (
                          <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 px-3 py-2 rounded-lg">
                            <PackageX className="w-3.5 h-3.5 flex-shrink-0" />
                            Order will be returned to your pickup address. Status will change to RTO.
                          </div>
                        )}

                        <button onClick={() => handleSubmit(order.id)}
                          disabled={submitting === order.id}
                          className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                          style={{ background: isRTO ? "#EF4444" : "#3B82F6", color: "#fff" }}>
                          {submitting === order.id
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                            : isRTO
                              ? <><PackageX className="w-4 h-4" /> Confirm RTO</>
                              : <><RotateCcw className="w-4 h-4" /> Submit Re-attempt Request</>
                          }
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actioned NDRs */}
        {actioned.length > 0 && (
          <div>
            <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-900)" }}>Recent Actions ({actioned.length})</h2>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-muted)" }}>
                    {["Order #", "Customer", "AWB", "NDR Reason", "Action Taken", "Attempts", "Was Open"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--text-500)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ borderColor: "var(--border)" }}>
                  {actioned.map(o => {
                    const age = ndrAge(o.ndrCreatedAt);
                    return (
                      <tr key={o.id} className="hover:bg-gray-50/50" style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="px-4 py-3 font-mono text-xs text-blue-600">#{o.externalOrderId}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{o.customerName || "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{o.awbNumber || "—"}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">{o.ndrReason || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            o.ndrActionTaken === "RTO" ? "bg-orange-50 text-orange-600" : "bg-blue-50 text-blue-600"
                          }`}>
                            {o.ndrActionTaken === "RTO" ? "RTO" : "Re-attempt"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{o.ndrAttempts}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{age?.label ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
