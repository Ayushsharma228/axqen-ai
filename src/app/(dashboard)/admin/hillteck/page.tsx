"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Phone, MessageSquare, CheckCircle2, XCircle, Clock, RefreshCw,
  Link2, Settings, AlertTriangle, Loader2, Copy, Check, Zap,
} from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";

interface Stats {
  total_cod: number; today_cod: number;
  pending: number; confirmed: number; failed: number; cancelled: number; not_required: number;
}

interface RecentOrder {
  id: string; externalOrderId: string; customerName: string | null;
  totalAmount: number; confirmationStatus: string; confirmationRequestedAt: string | null;
  confirmationCompletedAt: string | null; confirmationFailedAt: string | null;
  confirmationChannel: string | null; status: string; createdAt: string;
  seller: { name: string | null; brandName: string | null };
}

interface DashboardData {
  connected: boolean; enabled: boolean; baseUrl: string; webhookUrl: string;
  stats: Stats; recent: RecentOrder[];
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  NOT_REQUIRED: { bg: "#F3F4F6", color: "#6B7280", label: "Not Required" },
  PENDING:      { bg: "#FFF7ED", color: "#C2410C", label: "Pending" },
  CONFIRMED:    { bg: "#F0FDF4", color: "#15803D", label: "Confirmed ✓" },
  FAILED:       { bg: "#FEF2F2", color: "#DC2626", label: "Rejected ✗" },
  CANCELLED:    { bg: "#FFFBEB", color: "#B45309", label: "No Answer" },
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function HillteckPage() {
  const [data, setData]             = useState<DashboardData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [apiKey, setApiKey]         = useState("");
  const [baseUrl, setBaseUrl]       = useState("");
  const [enabled, setEnabled]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [saveMsg, setSaveMsg]       = useState("");
  const [copied, setCopied]         = useState(false);
  const [triggering, setTriggering] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/admin/hillteck");
    if (r.ok) {
      const d: DashboardData = await r.json();
      setData(d);
      setBaseUrl(d.baseUrl);
      setEnabled(d.enabled);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveConfig() {
    setSaving(true); setSaveMsg("");
    const keys = [
      { key: "HILLTECK_API_KEY",       value: apiKey.trim() },
      { key: "HILLTECK_BASE_URL",      value: baseUrl.trim() },
      { key: "HILLTECK_ENABLED",       value: enabled ? "true" : "false" },
    ].filter(k => k.value !== "");

    for (const { key, value } of keys) {
      await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
    }
    setSaveMsg("Saved");
    setSaving(false);
    setTimeout(() => setSaveMsg(""), 2500);
    await load();
  }

  async function copyWebhook() {
    await navigator.clipboard.writeText(data?.webhookUrl ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function triggerVerification(orderId: string) {
    setTriggering(orderId);
    await fetch("/api/admin/hillteck", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ orderId }),
    });
    setTriggering(null);
    await load();
  }

  const STAT_TILES = data ? [
    { label: "Today's COD",  value: data.stats.today_cod,  color: "#4361EE", icon: Phone },
    { label: "Pending",      value: data.stats.pending,    color: "#C2410C", icon: Clock },
    { label: "Confirmed",    value: data.stats.confirmed,  color: "#15803D", icon: CheckCircle2 },
    { label: "Rejected",     value: data.stats.failed,     color: "#DC2626", icon: XCircle },
  ] : [];

  return (
    <div className="min-h-screen" style={{ background: "#F7F8FC" }}>
      <PageHero
        title="HillTeck — COD Verification"
        subtitle="Auto-verify COD orders via IVR call and WhatsApp before processing"
        actions={
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: "white", border: "1px solid #E8EDF6", color: "#0C1220" }}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
        cards={
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STAT_TILES.map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="rounded-2xl px-5 py-4 flex items-center gap-4"
                style={{ background: "white", border: "1px solid #E8EDF6" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "#F7F8FC" }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: "#9CA3AF" }}>{label}</p>
                  <p className="text-2xl font-bold" style={{ color: "#0C1220" }}>
                    {loading ? "—" : value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        }
      />

      <div className="px-4 md:px-8 py-6 space-y-6">

        {/* ── Connection Status ── */}
        <div className="rounded-2xl p-5" style={{ background: "white", border: "1px solid #E8EDF6" }}>
          <div className="flex items-center gap-3 mb-4">
            <Link2 className="w-4 h-4" style={{ color: "#4361EE" }} />
            <h2 className="text-sm font-bold" style={{ color: "#0C1220" }}>Connection</h2>
            {data && (
              <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-semibold ${data.connected && data.enabled ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                {data.connected && data.enabled ? "Active" : data.connected ? "Disabled" : "Not Configured"}
              </span>
            )}
          </div>

          {/* Webhook URL */}
          {data?.webhookUrl && (
            <div className="mb-4">
              <p className="text-xs font-semibold mb-1.5" style={{ color: "#6B7280" }}>
                Give this webhook URL to HillTeck
              </p>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: "#F7F8FC", border: "1px solid #E8EDF6" }}>
                <code className="text-xs font-mono flex-1 truncate" style={{ color: "#4361EE" }}>
                  {data.webhookUrl}
                </code>
                <button onClick={copyWebhook}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                  style={{ background: "white", border: "1px solid #E8EDF6", color: "#6B7280" }}>
                  {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}

          {/* Config form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#6B7280" }}>
                API Key <span style={{ color: "#9CA3AF" }}>(from HillTeck dashboard)</span>
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={data?.connected ? "••••••••••••••••" : "Paste API key here"}
                className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-400"
                style={{ borderColor: "#E8EDF6" }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#6B7280" }}>
                Base URL <span style={{ color: "#9CA3AF" }}>(from HillTeck team)</span>
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://api.hillteck.com"
                className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-400"
                style={{ borderColor: "#E8EDF6" }}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setEnabled(p => !p)}
                className="relative w-10 h-5 rounded-full transition-colors cursor-pointer"
                style={{ background: enabled ? "#4361EE" : "#D1D5DB" }}
              >
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                  style={{ left: enabled ? "1.25rem" : "0.125rem" }} />
              </div>
              <span className="text-sm font-medium" style={{ color: "#0C1220" }}>
                Auto-verify all new COD orders
              </span>
            </label>

            <div className="flex items-center gap-3">
              {saveMsg && <span className="text-xs font-medium text-green-600">{saveMsg}</span>}
              <button onClick={saveConfig} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ background: "#4361EE", color: "white" }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                {saving ? "Saving..." : "Save Config"}
              </button>
            </div>
          </div>

          {!data?.connected && (
            <div className="mt-4 flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
              style={{ background: "#FFF7ED", border: "1px solid #FED7AA", color: "#C2410C" }}>
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Not yet configured</p>
                <p className="mt-0.5 opacity-80">
                  Enter your HillTeck API key and base URL above. Get them from the HillTeck partner team.
                  TODO: Update API endpoints in <code className="font-mono">src/lib/hillteck.ts</code> once HillTeck shares their API docs.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Recent Verifications ── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #E8EDF6" }}>
          <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid #E8EDF6" }}>
            <MessageSquare className="w-4 h-4" style={{ color: "#4361EE" }} />
            <h2 className="text-sm font-bold" style={{ color: "#0C1220" }}>
              Recent COD Verification Attempts
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
            </div>
          ) : !data?.recent?.length ? (
            <div className="py-16 text-center">
              <Phone className="w-10 h-10 mx-auto mb-3" style={{ color: "#D1D5DB" }} />
              <p className="text-sm font-medium" style={{ color: "#9CA3AF" }}>No verifications yet</p>
              <p className="text-xs mt-1" style={{ color: "#D1D5DB" }}>
                COD orders will appear here once HillTeck is configured and enabled
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "#F7F8FC", borderBottom: "1px solid #E8EDF6" }}>
                    {["Order #", "Seller", "Amount", "Status", "Channel", "Requested", "Completed", "Action"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "#9CA3AF" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map(o => {
                    const st = STATUS_STYLE[o.confirmationStatus] ?? STATUS_STYLE.NOT_REQUIRED;
                    return (
                      <tr key={o.id} className="hover:bg-gray-50/50"
                        style={{ borderBottom: "1px solid #F3F4F6" }}>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: "#4361EE" }}>
                          #{o.externalOrderId}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#6B7280" }}>
                          {o.seller.brandName ?? o.seller.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold" style={{ color: "#0C1220" }}>
                          ₹{o.totalAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#9CA3AF" }}>
                          {o.confirmationChannel ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#9CA3AF" }}>
                          {fmt(o.confirmationRequestedAt)}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#9CA3AF" }}>
                          {fmt(o.confirmationCompletedAt ?? o.confirmationFailedAt)}
                        </td>
                        <td className="px-4 py-3">
                          {o.confirmationStatus === "NOT_REQUIRED" && (
                            <button
                              onClick={() => triggerVerification(o.id)}
                              disabled={triggering === o.id}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold disabled:opacity-50"
                              style={{ background: "#EEF2FF", color: "#4361EE" }}>
                              {triggering === o.id
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <Zap className="w-3 h-3" />}
                              Verify
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
