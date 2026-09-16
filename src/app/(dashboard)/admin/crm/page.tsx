"use client";

import { useState, useEffect, useCallback } from "react";
import {
  UserCheck, Plus, Trash2, Loader2, Target,
  TrendingUp, Users, Phone, MapPin, ChevronDown, UserPlus,
  Upload, Download, RefreshCw, XCircle, Sparkles, DollarSign, AlertCircle, MessageCircle, FileDown, BarChart2,
} from "lucide-react";
import Link from "next/link";
import { PageHero } from "@/components/layout/page-hero";

const STAGES = [
  "LEAD","CALL_NOT_PICKED","BUSY","SCHEDULE_MEETING","NOT_INTERESTED",
  "PROSPECT","INTERESTED","WILL_PAY","PAID","ONBOARDED","WEBSITE_DONE","ENGAGEMENT_LIVE","ADS_LIVE",
];
const STAGE_LABEL: Record<string, string> = {
  LEAD: "Lead", CALL_NOT_PICKED: "Call Not Picked", BUSY: "Busy",
  SCHEDULE_MEETING: "Schedule Meeting", NOT_INTERESTED: "Not Interested",
  PROSPECT: "Prospect", INTERESTED: "Interested", WILL_PAY: "Will Pay",
  PAID: "Paid", ONBOARDED: "Onboarded", WEBSITE_DONE: "Website Done",
  ENGAGEMENT_LIVE: "Engagement Live", ADS_LIVE: "Ads Live",
};
const STAGE_COLOR: Record<string, { bg: string; color: string }> = {
  LEAD:{ bg:"#F9FAFB",color:"#6B7280"},CALL_NOT_PICKED:{bg:"#FFF7ED",color:"#D97706"},
  BUSY:{bg:"#FFF7ED",color:"#D97706"},SCHEDULE_MEETING:{bg:"#EFF6FF",color:"#3B82F6"},
  NOT_INTERESTED:{bg:"#FEF2F2",color:"#DC2626"},PROSPECT:{bg:"#F5F3FF",color:"#7C3AED"},
  INTERESTED:{bg:"#ECFDF5",color:"#059669"},WILL_PAY:{bg:"#F0FDF4",color:"#16A34A"},
  PAID:{bg:"#F0FDF4",color:"#16A34A"},ONBOARDED:{bg:"#F0FDF4",color:"#16A34A"},
  WEBSITE_DONE:{bg:"#EFF6FF",color:"#3B82F6"},ENGAGEMENT_LIVE:{bg:"#EFF6FF",color:"#3B82F6"},
  ADS_LIVE:{bg:"#F0FDF4",color:"#16A34A"},
};

interface SalesPerson { id: string; name: string | null; salesTitle: string | null; salesTarget: number | null; }
interface PerfStat extends SalesPerson { total: number; paid: number; paidThisMonth: number; onboarded: number; }
interface Lead {
  id: string; name: string; email: string | null; phone: string;
  city: string | null; investment: number | null; stage: string;
  isNI: boolean; createdAt: string; source: string;
  businessStage: string | null; recommendedPlan: string | null; timeline: string | null;
  assignedTo: { id: string; name: string | null } | null;
}

interface CustomerRow {
  customerName: string; phone: string | null;
  totalOrders: number; deliveredOrders: number; rtoOrders: number; cancelledOrders: number;
  totalSpend: number; lastOrderAt: string; firstOrderAt: string;
  isRepeat: boolean; deliveryRate: number;
}

const SERVICE_STYLE: Record<string, { bg: string; color: string; emoji: string }> = {
  "Dropshipping":           { bg: "rgba(59,130,246,0.12)", color: "#3B82F6", emoji: "🛒" },
  "Marketplace Management": { bg: "rgba(5,150,105,0.12)",  color: "#059669", emoji: "🏪" },
  "Brand Building":         { bg: "rgba(124,58,237,0.12)", color: "#7C3AED", emoji: "🏷️" },
};

export default function AdminCRMPage() {
  const [tab, setTab] = useState<"leads" | "team" | "customers">("leads");

  // Customers tab
  const [customers, setCustomers]         = useState<CustomerRow[]>([]);
  const [custSummary, setCustSummary]     = useState({ totalCustomers: 0, repeatCustomers: 0, totalOrders: 0, totalDelivered: 0 });
  const [custLoading, setCustLoading]     = useState(false);
  const [custSearch, setCustSearch]       = useState("");
  const [custRepeatOnly, setCustRepeatOnly] = useState(false);
  const [custPage, setCustPage]           = useState(1);
  const [custTotalPages, setCustTotalPages] = useState(1);
  const [custTotal, setCustTotal]         = useState(0);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [salesTeam, setSalesTeam] = useState<SalesPerson[]>([]);
  const [perfStats, setPerfStats] = useState<PerfStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [notUpdated, setNotUpdated] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [repFilter, setRepFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalLeadsCount, setTotalLeadsCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [convertingLead, setConvertingLead] = useState<{ id: string; name: string; email: string | null } | null>(null);
  const [convertPlan, setConvertPlan] = useState<"DROPSHIPPING" | "MARKETPLACE">("DROPSHIPPING");
  const [converting, setConverting] = useState(false);
  const [convertResult, setConvertResult] = useState<{ success?: boolean; error?: string; username?: string } | null>(null);

  // Bulk upload
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkRows, setBulkRows] = useState<Array<Record<string, string>>>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ created: number; skipped: number } | null>(null);
  const [bulkError, setBulkError] = useState("");

  // New lead form
  const [form, setForm] = useState({ name: "", email: "", phone: "", city: "", investment: "", assignedToId: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // New team member form
  const [teamForm, setTeamForm] = useState({ name: "", email: "", password: "", salesTitle: "", salesTarget: "" });
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [teamSuccess, setTeamSuccess] = useState("");

  // Reset password
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetSaving, setResetSaving] = useState(false);

  // Meta sync
  const [metaSyncing, setMetaSyncing] = useState(false);
  const [metaResult, setMetaResult] = useState<{ imported: number; skipped: number; found?: number; errors?: string[]; sampleFields?: string[]; tokenExpired?: boolean } | null>(null);
  const [tokenStatus, setTokenStatus] = useState<{ ok: boolean; page?: string; reason?: string; formLeadsAccessible?: boolean; sampleLeadsFound?: number } | null>(null);
  const [testingToken, setTestingToken] = useState(false);

  // Inline stage update
  const [updatingStage, setUpdatingStage] = useState<string | null>(null);

  async function handleStageUpdate(leadId: string, stage: string) {
    setUpdatingStage(leadId);
    setLeads(p => p.map(l => l.id === leadId ? { ...l, stage } : l));
    await fetch(`/api/admin/crm/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    setUpdatingStage(null);
  }

  const fetchCustomers = useCallback(async () => {
    setCustLoading(true);
    const params = new URLSearchParams();
    if (custSearch)    params.set("search",  custSearch);
    if (custRepeatOnly) params.set("repeat", "true");
    params.set("page", String(custPage));
    const res  = await fetch(`/api/admin/customers?${params}`);
    const data = await res.json();
    setCustomers(data.customers ?? []);
    setCustSummary(data.summary ?? { totalCustomers: 0, repeatCustomers: 0, totalOrders: 0, totalDelivered: 0 });
    setCustTotal(data.total ?? 0);
    setCustTotalPages(data.pages ?? 1);
    setCustLoading(false);
  }, [custSearch, custRepeatOnly, custPage]);

  useEffect(() => {
    if (tab === "customers") fetchCustomers();
  }, [tab, fetchCustomers]);

  // Deduplication
  const [deduping, setDeduping] = useState(false);
  const [dedupResult, setDedupResult] = useState<{ deleted: number } | null>(null);

  // Token manager
  const [showTokenPanel, setShowTokenPanel] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [exchanging, setExchanging] = useState(false);
  const [exchangeResult, setExchangeResult] = useState<{ ok?: boolean; message?: string; error?: string; daysUntilExpiry?: number; pageName?: string } | null>(null);
  const [tokenInfo, setTokenInfo] = useState<{ hasDbToken: boolean; usingEnvFallback: boolean; daysUntilExpiry: number | null; expiringSoon: boolean } | null>(null);

  // Form IDs manager
  const [formIds, setFormIds] = useState<string[]>([]);
  const [formIdsInput, setFormIdsInput] = useState("");
  const [savingFormIds, setSavingFormIds] = useState(false);
  const [formIdsResult, setFormIdsResult] = useState<{ ok?: boolean; error?: string } | null>(null);

  // WhatsApp outreach
  const [startingWa, setStartingWa] = useState<string | null>(null);

  async function handleWhatsAppOutreach(leadId: string) {
    setStartingWa(leadId);
    const res = await fetch(`/api/admin/crm/leads/${leadId}/whatsapp-outreach`, { method: "POST" });
    const data = await res.json();
    setStartingWa(null);
    if (!res.ok) { alert(data.error || "Failed to send WhatsApp message"); return; }
    alert("WhatsApp intro sent! Arya will handle the conversation when they reply.");
  }

  function exportCSV() {
    const params = new URLSearchParams({ export: "true" });
    if (search)       params.set("search", search);
    if (repFilter)    params.set("assignedToId", repFilter);
    if (stageFilter)  params.set("stage", stageFilter);
    if (sourceFilter) params.set("source", sourceFilter);
    const a = document.createElement("a");
    a.href = `/api/admin/crm/leads?${params}`;
    a.download = "";
    a.click();
  }

  async function fetchTokenInfo() {
    try {
      const [tokenRes, formRes] = await Promise.all([
        fetch("/api/admin/meta/exchange-token"),
        fetch("/api/admin/meta/form-ids"),
      ]);
      const tokenData = await tokenRes.json();
      const formData  = await formRes.json();
      setTokenInfo(tokenData);
      setFormIds(formData.formIds ?? []);
      setFormIdsInput((formData.formIds ?? []).join("\n"));
    } catch { /* silent */ }
  }

  async function handleSaveFormIds() {
    const ids = formIdsInput.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
    if (!ids.length) return;
    setSavingFormIds(true); setFormIdsResult(null);
    const res = await fetch("/api/admin/meta/form-ids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formIds: ids }),
    });
    const data = await res.json();
    if (res.ok) { setFormIds(data.formIds); setFormIdsResult({ ok: true }); }
    else         setFormIdsResult({ error: data.error || "Failed to save" });
    setSavingFormIds(false);
  }

  async function handleExchangeToken() {
    if (!tokenInput.trim()) return;
    setExchanging(true);
    setExchangeResult(null);
    try {
      const res = await fetch("/api/admin/meta/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userToken: tokenInput.trim() }),
      });
      const data = await res.json();
      setExchangeResult(data);
      if (data.ok) { setTokenInput(""); fetchTokenInfo(); }
    } catch {
      setExchangeResult({ error: "Network error — check Vercel logs" });
    } finally {
      setExchanging(false);
    }
  }

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    if (search)       params.set("search", search);
    if (repFilter)    params.set("assignedToId", repFilter);
    if (stageFilter)  params.set("stage", stageFilter);
    if (sourceFilter) params.set("source", sourceFilter);
    params.set("page", String(page));
    const res = await fetch(`/api/admin/crm/leads?${params}`);
    const data = await res.json();
    setLeads(data.leads ?? []);
    setSalesTeam(data.salesTeam ?? []);
    setPerfStats(data.perfStats ?? []);
    setStageCounts(data.stageCounts ?? {});
    setNotUpdated(data.notUpdated ?? 0);
    setTotalLeadsCount(data.total ?? 0);
    setTotalPages(data.pages ?? 1);
    setLoading(false);
  }, [search, repFilter, stageFilter, sourceFilter, page]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }

  useEffect(() => { fetchData(); fetchTokenInfo(); }, [fetchData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 30 seconds so new leads appear without clicking Refresh
  useEffect(() => {
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  async function handleAddLead(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.name || !form.phone) { setFormError("Name and phone are required"); return; }
    setSaving(true);
    const res = await fetch("/api/admin/crm/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setFormError(data.error || "Failed"); setSaving(false); return; }
    setForm({ name: "", email: "", phone: "", city: "", investment: "", assignedToId: "" });
    setShowForm(false);
    await fetchData();
    setSaving(false);
  }

  async function handleAssign(leadId: string, assignedToId: string) {
    setAssigning(leadId);
    await fetch(`/api/admin/crm/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToId }),
    });
    await fetchData();
    setAssigning(null);
  }

  async function handleDelete(leadId: string) {
    setDeleting(leadId);
    await fetch(`/api/admin/crm/leads/${leadId}`, { method: "DELETE" });
    setLeads(p => p.filter(l => l.id !== leadId));
    setDeleting(null);
  }

  function downloadTemplate() {
    const csv = [
      "date,type,experience,what they want,investment,when they start,name,number,email",
      "01/04/2026,Dropshipping,Beginner,Shopify store,50000,Immediately,Rahul Sharma,9876543210,rahul@example.com",
      "02/04/2026,Marketplace,Intermediate,Amazon listing,80000,Next month,Priya Singh,9123456789,",
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "leads_template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function parseCSV(text: string): Array<Record<string, string>> {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    return lines.slice(1).filter(l => l.trim()).map(line => {
      const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
      return row;
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target?.result as string);
      setBulkRows(rows); setBulkResult(null); setBulkError("");
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleBulkUpload() {
    if (!bulkRows.length) return;
    setBulkUploading(true); setBulkError("");
    const res = await fetch("/api/admin/crm/leads/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leads: bulkRows }),
    });
    const data = await res.json();
    if (!res.ok) { setBulkError(data.error || "Upload failed"); setBulkUploading(false); return; }
    setBulkResult({ created: data.created, skipped: data.skipped });
    setBulkRows([]);
    await fetchData();
    setBulkUploading(false);
  }

  async function handleResetPassword(id: string) {
    if (!resetPw.trim()) return;
    setResetSaving(true);
    await fetch("/api/admin/crm/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, password: resetPw }),
    });
    setResetId(null);
    setResetPw("");
    setResetSaving(false);
  }

  async function handleCreateMember(e: React.FormEvent) {
    e.preventDefault();
    setTeamError(""); setTeamSuccess("");
    setTeamSaving(true);
    const res = await fetch("/api/admin/crm/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(teamForm),
    });
    const data = await res.json();
    if (!res.ok) { setTeamError(data.error || "Failed"); setTeamSaving(false); return; }
    setTeamSuccess(`Account created for ${data.user.name} — they can now log in at /login`);
    setTeamForm({ name: "", email: "", password: "", salesTitle: "", salesTarget: "" });
    await fetchData();
    setTeamSaving(false);
  }

  const totalLeads  = Object.values(stageCounts).reduce((a, b) => a + b, 0);
  const totalPaid   = (stageCounts["PAID"] ?? 0) + (stageCounts["ONBOARDED"] ?? 0) + (stageCounts["WEBSITE_DONE"] ?? 0) + (stageCounts["ENGAGEMENT_LIVE"] ?? 0) + (stageCounts["ADS_LIVE"] ?? 0);
  const totalNI     = stageCounts["NOT_INTERESTED"] ?? 0;
  const totalProspect  = stageCounts["PROSPECT"] ?? 0;
  const totalInterested = (stageCounts["INTERESTED"] ?? 0) + (stageCounts["WILL_PAY"] ?? 0);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page)" }}>
      <PageHero
        title="Sales CRM"
        subtitle="Manage leads and track sales team performance"
        searchValue={search}
        searchPlaceholder="Search name, phone, city..."
        onSearchChange={v => { setSearch(v); setPage(1); }}
        onSearchSubmit={fetchData}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/crm/inbox"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "rgba(22,163,74,0.1)", color: "#16A34A", border: "1px solid rgba(22,163,74,0.2)" }}>
              <MessageCircle className="w-4 h-4" /> WhatsApp Inbox
            </Link>
            <button onClick={handleRefresh} disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
              style={{ background: "var(--bg-muted)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <button
              onClick={() => { setShowBulkUpload(p => !p); setShowForm(false); setBulkResult(null); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "var(--bg-muted)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              <Upload className="w-4 h-4" /> Bulk Upload
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "var(--bg-muted)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              <FileDown className="w-4 h-4" /> Export CSV
            </button>
            <button
              onClick={() => { setShowTokenPanel(p => !p); setExchangeResult(null); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: tokenInfo?.expiringSoon ? "rgba(239,68,68,0.12)" : tokenInfo?.hasDbToken ? "rgba(0,198,122,0.12)" : "var(--bg-muted)",
                color: tokenInfo?.expiringSoon ? "#EF4444" : tokenInfo?.hasDbToken ? "#16A34A" : "var(--text-400)",
                border: `1px solid ${tokenInfo?.expiringSoon ? "rgba(239,68,68,0.3)" : tokenInfo?.hasDbToken ? "rgba(0,198,122,0.3)" : "var(--border)"}`,
              }}>
              <span style={{ fontSize: 13 }}>🔒</span>
              {tokenInfo?.expiringSoon
                ? `Token expiring in ${tokenInfo.daysUntilExpiry}d`
                : tokenInfo?.hasDbToken
                  ? "Token Active"
                  : "Token Manager"}
            </button>
            <button
              onClick={async () => {
                setTestingToken(true); setTokenStatus(null);
                try {
                  const res = await fetch("/api/admin/meta/test-token");
                  const data = await res.json();
                  setTokenStatus(data);
                } catch {
                  setTokenStatus({ ok: false, reason: "Could not reach test endpoint" });
                } finally {
                  setTestingToken(false);
                }
              }}
              disabled={testingToken || metaSyncing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
              style={{ background: "var(--bg-card)", color: "var(--text-300)", border: "1px solid var(--border)" }}>
              {testingToken ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span style={{ fontSize: 13 }}>🔑</span>}
              {testingToken ? "Testing..." : "Test Token"}
            </button>
            {tokenStatus && (
              <span className="text-xs font-medium" style={{ color: tokenStatus.ok ? "#16A34A" : "#EF4444" }}>
                {tokenStatus.ok
                  ? `Token OK · ${tokenStatus.page} · Forms accessible · ${tokenStatus.sampleLeadsFound} lead(s) visible`
                  : tokenStatus.reason}
              </span>
            )}
            {(["", "?full=true"] as const).map((qs) => {
              const isFull = qs === "?full=true";
              return (
                <button
                  key={qs}
                  onClick={async () => {
                    setMetaSyncing(true); setMetaResult(null);
                    try {
                      const controller = new AbortController();
                      const timeout = setTimeout(() => controller.abort(), 60000);
                      const res = await fetch(`/api/admin/meta/sync-leads${qs}`, { method: "POST", signal: controller.signal });
                      clearTimeout(timeout);
                      const data = await res.json();
                      setMetaResult(data);
                      if (data.imported > 0) fetchData();
                    } catch (err: unknown) {
                      const isAbort = err instanceof Error && err.name === "AbortError";
                      setMetaResult({ imported: 0, skipped: 0, found: 0, errors: [isAbort ? "Request timed out — try again or check Vercel logs" : "Network error — check Vercel logs"] });
                    } finally {
                      setMetaSyncing(false);
                    }
                  }}
                  disabled={metaSyncing}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
                  style={{ background: "rgba(0,198,122,0.15)", color: "#16A34A", border: "1px solid rgba(0,198,122,0.3)" }}>
                  <RefreshCw className={`w-4 h-4 ${metaSyncing ? "animate-spin" : ""}`} />
                  {metaSyncing ? "Syncing..." : isFull ? "Full Sync" : "Sync (24h)"}
                </button>
              );
            })}
            {metaResult && (
              <div className="text-xs font-medium flex flex-col gap-0.5">
                <span style={{ color: metaResult.imported > 0 ? "#16A34A" : "var(--text-400)" }}>
                  Found {metaResult.found ?? 0} on Meta · {metaResult.imported} new · {metaResult.skipped} already exist
                </span>
                {metaResult.tokenExpired && (
                  <span style={{ color: "#EF4444" }}>Token expired — update META_PAGE_TOKEN in Vercel and redeploy</span>
                )}
                {metaResult.errors?.map((e: string, i: number) => (
                  <span key={i} style={{ color: "#EF4444" }}>{e}</span>
                ))}
              </div>
            )}
            <button
              onClick={async () => {
                if (!confirm("This will delete duplicate leads (same phone number). Keep going?")) return;
                setDeduping(true); setDedupResult(null);
                const res = await fetch("/api/admin/crm/deduplicate", { method: "DELETE" });
                const data = await res.json();
                setDedupResult(data);
                if (data.deleted > 0) fetchData();
                setDeduping(false);
              }}
              disabled={deduping}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
              style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" }}>
              {deduping ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>🧹</span>}
              {deduping ? "Cleaning..." : "Remove Duplicates"}
            </button>
            {dedupResult && (
              <span className="text-xs font-medium" style={{ color: dedupResult.deleted > 0 ? "#EF4444" : "var(--text-400)" }}>
                {dedupResult.deleted > 0 ? `${dedupResult.deleted} duplicates removed` : "No duplicates found"}
              </span>
            )}
            <button onClick={() => { setShowForm(p => !p); setShowBulkUpload(false); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "var(--accent)" }}>
              <Plus className="w-4 h-4" /> Add Lead
            </button>
          </div>
        }
        filters={
          <div className="flex items-center gap-2">
            <select value={repFilter} onChange={e => { setRepFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm rounded-xl outline-none" style={{ color: "var(--text-primary)", background: "var(--bg-muted)", border: "1px solid var(--border)" }}>
              <option value="" className="text-gray-900 bg-white">All Reps</option>
              {salesTeam.map(r => <option key={r.id} value={r.id} className="text-gray-900 bg-white">{r.name}</option>)}
            </select>
            <select value={stageFilter} onChange={e => { setStageFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm rounded-xl outline-none" style={{ color: "var(--text-primary)", background: "var(--bg-muted)", border: "1px solid var(--border)" }}>
              <option value="" className="text-gray-900 bg-white">All Stages</option>
              {STAGES.map(s => <option key={s} value={s} className="text-gray-900 bg-white">{STAGE_LABEL[s]}</option>)}
            </select>
            <select value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm rounded-xl outline-none" style={{ color: "var(--text-primary)", background: "var(--bg-muted)", border: "1px solid var(--border)" }}>
              <option value="" className="text-gray-900 bg-white">All Sources</option>
              <option value="META_ADS" className="text-gray-900 bg-white">Meta Ads</option>
              <option value="WEBSITE" className="text-gray-900 bg-white">Website Form</option>
              <option value="MANUAL" className="text-gray-900 bg-white">Manual</option>
            </select>
          </div>
        }
        cards={
          <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
            {[
              { label: "Total",        value: totalLeads,         color: "#3B82F6",  bg: "rgba(59,130,246,0.15)",  icon: Users },
              { label: "Not Updated",  value: notUpdated,         color: "#F59E0B",  bg: "rgba(245,158,11,0.15)",  icon: AlertCircle },
              { label: "NI",           value: totalNI,            color: "#EF4444",  bg: "rgba(239,68,68,0.15)",   icon: XCircle },
              { label: "Prospect",     value: totalProspect,      color: "#A78BFA",  bg: "rgba(167,139,250,0.15)", icon: Target },
              { label: "Interested",   value: totalInterested,    color: "#06B6D4",  bg: "rgba(6,182,212,0.15)",   icon: Sparkles },
              { label: "Paid",         value: stageCounts["PAID"] ?? 0,     color: "#16A34A",  bg: "rgba(0,198,122,0.15)",   icon: DollarSign },
              { label: "Onboarded",    value: stageCounts["ONBOARDED"] ?? 0, color: "#16A34A", bg: "rgba(22,163,74,0.15)",   icon: UserCheck },
              { label: "Sales Reps",   value: salesTeam.length,   color: "#E879F9",  bg: "rgba(232,121,249,0.15)", icon: TrendingUp },
            ].map(({ label, value, color, bg, icon: Icon }) => (
              <div key={label} className="rounded-2xl px-3 py-3 flex flex-col gap-1"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                  <p className="text-xs font-medium truncate" style={{ color: "var(--text-secondary)" }}>{label}</p>
                </div>
                <p className="text-2xl font-bold leading-none" style={{ color: "var(--text-primary)" }}>{value}</p>
              </div>
            ))}
          </div>
        }
      />

      <div className="px-8 pt-6 space-y-6 pb-8">

        {/* Tab switcher */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: "#F3F4F6" }}>
            {([["leads", "Leads", UserCheck], ["team", "Sales Team", Users], ["customers", "Customers", Users]] as const).map(([key, label, Icon]) => (
              <button key={key} onClick={() => setTab(key as "leads" | "team" | "customers")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={tab === key
                  ? { background: "white", color: "var(--text-900)", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }
                  : { color: "var(--text-400)" }}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
          <Link href="/admin/crm/overview"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "#F3F4F6", color: "var(--text-400)" }}>
            <BarChart2 className="w-4 h-4" /> Overview
          </Link>
        </div>

        {/* ── TEAM TAB ── */}
        {tab === "team" && (
          <div className="space-y-6">
            {/* Create member form */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus className="w-4 h-4" style={{ color: "var(--green-500)" }} />
                <h2 className="text-sm font-bold" style={{ color: "var(--text-900)" }}>Create Sales Account</h2>
              </div>
              {teamError && <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{teamError}</div>}
              {teamSuccess && <div className="mb-3 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{teamSuccess}</div>}
              <form onSubmit={handleCreateMember} className="grid grid-cols-3 gap-3">
                {[
                  { key: "name",        label: "Full Name *",      placeholder: "e.g. Keshav Sharma", type: "text" },
                  { key: "email",       label: "Email *",          placeholder: "work email",          type: "email" },
                  { key: "password",    label: "Password *",       placeholder: "Set a password",      type: "password" },
                  { key: "salesTitle",  label: "Title",            placeholder: "e.g. Sales Lead",     type: "text" },
                  { key: "salesTarget", label: "Monthly Target",   placeholder: "No. of paid leads",   type: "number" },
                ].map(({ key, label, placeholder, type }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-600)" }}>{label}</label>
                    <input type={type} value={teamForm[key as keyof typeof teamForm]}
                      onChange={e => setTeamForm(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                ))}
                <div className="col-span-3 flex justify-end">
                  <button type="submit" disabled={teamSaving}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
                    style={{ background: "var(--green-500)" }}>
                    {teamSaving ? <><Loader2 className="w-4 h-4 animate-spin" />Creating...</> : <><UserPlus className="w-4 h-4" />Create Account</>}
                  </button>
                </div>
              </form>
            </div>

            {/* Team list */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <Users className="w-4 h-4" style={{ color: "var(--text-400)" }} />
                <span className="font-semibold text-sm" style={{ color: "var(--text-900)" }}>
                  Team Members ({salesTeam.length})
                </span>
              </div>
              {salesTeam.length === 0 ? (
                <div className="py-12 text-center text-sm" style={{ color: "var(--text-400)" }}>
                  No sales team members yet — create one above
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", background: "#FAFAFA" }}>
                      {["Name","Title","Monthly Target","Password"].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                          style={{ color: "var(--text-400)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {salesTeam.map(rep => (
                      <tr key={rep.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                              style={{ background: "var(--green-500)" }}>
                              {rep.name?.[0]?.toUpperCase()}
                            </div>
                            <span className="font-medium" style={{ color: "var(--text-900)" }}>{rep.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-sm" style={{ color: "var(--text-600)" }}>
                          {rep.salesTitle || "—"}
                        </td>
                        <td className="px-5 py-3.5 text-sm font-semibold" style={{ color: "var(--text-900)" }}>
                          {rep.salesTarget ? `${rep.salesTarget} paid/month` : "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          {resetId === rep.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="password"
                                value={resetPw}
                                onChange={e => setResetPw(e.target.value)}
                                placeholder="New password"
                                autoFocus
                                className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 w-32"
                              />
                              <button
                                onClick={() => handleResetPassword(rep.id)}
                                disabled={resetSaving || !resetPw.trim()}
                                className="px-2.5 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50"
                                style={{ background: "var(--green-500)" }}>
                                {resetSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                              </button>
                              <button onClick={() => { setResetId(null); setResetPw(""); }}
                                className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-500">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setResetId(rep.id); setResetPw(""); }}
                              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors hover:bg-orange-50"
                              style={{ color: "#D97706" }}>
                              <RefreshCw className="w-3.5 h-3.5" /> Reset Password
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {tab === "leads" && <>
        {/* Add lead form */}
        {showForm && (
          <div className="card p-5">
            <h2 className="text-sm font-bold mb-4" style={{ color: "var(--text-900)" }}>Add New Lead</h2>
            {formError && (
              <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</div>
            )}
            <form onSubmit={handleAddLead} className="grid grid-cols-3 gap-3">
              {[
                { key: "name",       label: "Name *",       placeholder: "Full name",         type: "text" },
                { key: "phone",      label: "Phone *",      placeholder: "10-digit number",   type: "text" },
                { key: "email",      label: "Email",        placeholder: "email@example.com", type: "email" },
                { key: "city",       label: "City",         placeholder: "City",              type: "text" },
                { key: "investment", label: "Investment (₹)", placeholder: "Amount",          type: "number" },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-600)" }}>{label}</label>
                  <input type={type} value={form[key as keyof typeof form]}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-600)" }}>Assign To</label>
                <div className="relative">
                  <select value={form.assignedToId} onChange={e => setForm(p => ({ ...p, assignedToId: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none appearance-none pr-8">
                    <option value="">Unassigned</option>
                    {salesTeam.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 pointer-events-none" style={{ color: "var(--text-400)" }} />
                </div>
              </div>
              <div className="col-span-3 flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
                  style={{ background: "var(--green-500)" }}>
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : "Add Lead"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Bulk upload panel */}
        {showBulkUpload && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold" style={{ color: "var(--text-900)" }}>Bulk Upload Leads</h2>
              <button onClick={downloadTemplate}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
                style={{ background: "#EFF6FF", color: "#3B82F6" }}>
                <Download className="w-3.5 h-3.5" /> Download Template
              </button>
            </div>

            {bulkError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{bulkError}</div>
            )}
            {bulkResult && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                ✓ {bulkResult.created} leads uploaded successfully
                {bulkResult.skipped > 0 && ` · ${bulkResult.skipped} rows skipped (missing name/phone)`}
              </div>
            )}

            <label htmlFor="bulk-csv-input"
              className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors hover:bg-gray-50"
              style={{ borderColor: "#E5E7EB" }}>
              <Upload className="w-8 h-8" style={{ color: "var(--text-400)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--text-600)" }}>Click to choose a CSV file</p>
              <p className="text-xs" style={{ color: "var(--text-400)" }}>Columns: <span className="font-mono">date, type, experience, what they want, investment, when they start, name, number, email</span></p>
              <input id="bulk-csv-input" type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            </label>

            {bulkRows.length > 0 && (
              <>
                <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: "#F9FAFB", borderBottom: "1px solid var(--border)" }}>
                        {["Name","Number","Email","Type","Experience","Investment (₹)","When they start"].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                            style={{ color: "var(--text-400)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                      {bulkRows.slice(0, 5).map((row, i) => {
                        const phone = row["number"] || row["phone"] || "";
                        return (
                          <tr key={i}>
                            <td className="px-4 py-2.5 font-medium whitespace-nowrap" style={{ color: row["name"] ? "var(--text-900)" : "#EF4444" }}>
                              {row["name"] || "⚠ missing"}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: phone ? "var(--text-600)" : "#EF4444" }}>
                              {phone || "⚠ missing"}
                            </td>
                            <td className="px-4 py-2.5" style={{ color: "var(--text-400)" }}>{row["email"] || "—"}</td>
                            <td className="px-4 py-2.5" style={{ color: "var(--text-400)" }}>{row["type"] || "—"}</td>
                            <td className="px-4 py-2.5" style={{ color: "var(--text-400)" }}>{row["experience"] || "—"}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--text-400)" }}>
                              {row["investment"] ? `₹${parseFloat(row["investment"]).toLocaleString("en-IN")}` : "—"}
                            </td>
                            <td className="px-4 py-2.5" style={{ color: "var(--text-400)" }}>{row["when they start"] || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {bulkRows.length > 5 && (
                    <div className="px-4 py-2 text-xs text-center" style={{ color: "var(--text-400)", borderTop: "1px solid var(--border)" }}>
                      + {bulkRows.length - 5} more rows (not shown)
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm" style={{ color: "var(--text-600)" }}>
                    <span className="font-semibold" style={{ color: "var(--text-900)" }}>
                      {bulkRows.filter(r => r["name"]?.trim() && (r["number"]?.trim() || r["phone"]?.trim())).length}
                    </span> valid rows ready
                    {bulkRows.filter(r => !r["name"]?.trim() || (!r["number"]?.trim() && !r["phone"]?.trim())).length > 0 && (
                      <span className="text-red-500 ml-2">
                        · {bulkRows.filter(r => !r["name"]?.trim() || (!r["number"]?.trim() && !r["phone"]?.trim())).length} will be skipped
                      </span>
                    )}
                  </p>
                  <button onClick={handleBulkUpload} disabled={bulkUploading}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
                    style={{ background: "var(--green-500)" }}>
                    {bulkUploading
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading...</>
                      : <><Upload className="w-4 h-4" />Upload {bulkRows.length} Leads</>}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Meta Token Manager */}
        {showTokenPanel && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 16 }}>🔒</span>
                <h2 className="text-sm font-bold" style={{ color: "var(--text-900)" }}>Meta Token Manager</h2>
                {tokenInfo?.hasDbToken && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(0,198,122,0.12)", color: "#16A34A" }}>
                    Permanent token active
                  </span>
                )}
                {tokenInfo?.usingEnvFallback && !tokenInfo.hasDbToken && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(245,158,11,0.12)", color: "#D97706" }}>
                    Using short-lived env token
                  </span>
                )}
              </div>
              <button onClick={() => setShowTokenPanel(false)} className="text-xs px-2 py-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">✕</button>
            </div>

            {tokenInfo?.hasDbToken && tokenInfo.daysUntilExpiry !== null && (
              <div className="rounded-xl px-4 py-3 text-sm"
                style={{
                  background: tokenInfo.expiringSoon ? "rgba(239,68,68,0.08)" : "rgba(0,198,122,0.08)",
                  border: `1px solid ${tokenInfo.expiringSoon ? "rgba(239,68,68,0.2)" : "rgba(0,198,122,0.2)"}`,
                  color: tokenInfo.expiringSoon ? "#DC2626" : "#15803D",
                }}>
                {tokenInfo.expiringSoon
                  ? `⚠ User token expires in ${tokenInfo.daysUntilExpiry} day(s) — paste a fresh user token below to refresh.`
                  : `✓ Permanent page token active. User token valid for ~${tokenInfo.daysUntilExpiry} more days — no action needed until then.`}
              </div>
            )}

            {!tokenInfo?.hasDbToken && (
              <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#92400E" }}>
                No permanent token stored yet. Follow the steps below to generate one.
              </div>
            )}

            <div className="rounded-xl p-4 space-y-2 text-xs" style={{ background: "var(--bg-muted)", border: "1px solid var(--border)" }}>
              <p className="font-semibold" style={{ color: "var(--text-900)" }}>How to get a fresh user token:</p>
              <ol className="list-decimal list-inside space-y-1" style={{ color: "var(--text-600)" }}>
                <li>Open <strong>Meta Graph API Explorer</strong> (developers.facebook.com/tools/explorer)</li>
                <li>Top-right dropdown → select <strong>Vrinandya Ventures</strong> app</li>
                <li>Click <strong>Generate Access Token</strong> — grant all requested permissions</li>
                <li>Copy the token from the "Access Token" field and paste it below</li>
              </ol>
              <p className="text-xs mt-1" style={{ color: "var(--text-400)" }}>
                The server exchanges it for a 60-day long-lived token, then derives a <strong>permanent page token</strong> that never expires.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold" style={{ color: "var(--text-600)" }}>Paste short-lived user token from Graph API Explorer</label>
              <textarea
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                rows={3}
                placeholder="EAAxxxxxx..."
                className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                style={{ color: "var(--text-primary)" }}
              />
            </div>

            {exchangeResult && (
              <div className="rounded-xl px-4 py-3 text-sm"
                style={{
                  background: exchangeResult.ok ? "rgba(0,198,122,0.08)" : "rgba(239,68,68,0.08)",
                  border: `1px solid ${exchangeResult.ok ? "rgba(0,198,122,0.2)" : "rgba(239,68,68,0.2)"}`,
                  color: exchangeResult.ok ? "#15803D" : "#DC2626",
                }}>
                {exchangeResult.ok
                  ? `✓ ${exchangeResult.message} (Page: ${exchangeResult.pageName})`
                  : `✗ ${exchangeResult.error}`}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleExchangeToken}
                disabled={exchanging || !tokenInput.trim()}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
                style={{ background: "var(--green-500)" }}>
                {exchanging ? <><RefreshCw className="w-4 h-4 animate-spin" />Exchanging...</> : <><span>🔄</span> Exchange &amp; Save Token</>}
              </button>
            </div>

            {/* Form IDs section */}
            <div className="pt-4 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: "var(--text-900)" }}>Meta Lead Form IDs</p>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--bg-muted)", color: "var(--text-400)" }}>
                  {formIds.length} form{formIds.length !== 1 ? "s" : ""} active
                </span>
              </div>
              <p className="text-xs" style={{ color: "var(--text-400)" }}>
                One form ID per line (or comma-separated). Find it in Meta Ads Manager → Lead forms → Form ID column.
              </p>
              <textarea
                value={formIdsInput}
                onChange={e => setFormIdsInput(e.target.value)}
                rows={Math.max(2, formIds.length + 1)}
                placeholder={"2038602106739692\n(paste additional form IDs here)"}
                className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                style={{ color: "var(--text-primary)" }}
              />
              {formIdsResult && (
                <p className="text-xs font-medium" style={{ color: formIdsResult.ok ? "#16A34A" : "#EF4444" }}>
                  {formIdsResult.ok ? `✓ ${formIds.length} form ID(s) saved — next sync will pull from all of them` : formIdsResult.error}
                </p>
              )}
              <div className="flex justify-end">
                <button
                  onClick={handleSaveFormIds}
                  disabled={savingFormIds || !formIdsInput.trim()}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl disabled:opacity-50"
                  style={{ background: "#EFF6FF", color: "#3B82F6", border: "1px solid #BFDBFE" }}>
                  {savingFormIds ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Saving...</> : "Save Form IDs"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Team performance */}
        {perfStats.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4" style={{ color: "var(--green-500)" }} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-900)" }}>Team Performance (This Month)</h2>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {perfStats.map(rep => {
                const target = rep.salesTarget ?? 0;
                const pct = target > 0 ? Math.min(100, Math.round((rep.paidThisMonth / target) * 100)) : 0;
                return (
                  <div key={rep.id} className="card p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                        style={{ background: "var(--green-500)" }}>
                        {rep.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-sm" style={{ color: "var(--text-900)" }}>{rep.name}</p>
                        <p className="text-xs" style={{ color: "var(--text-400)" }}>{rep.salesTitle || "Sales"}</p>
                      </div>
                    </div>
                    {(() => {
                      const convRate = rep.total > 0 ? ((rep.paid / rep.total) * 100).toFixed(1) : "0.0";
                      const convNum  = parseFloat(convRate);
                      const convColor = convNum >= 20 ? "#16A34A" : convNum >= 10 ? "#D97706" : "#DC2626";
                      return (
                        <>
                          <div className="grid grid-cols-3 gap-2 mb-2 text-center">
                            {[
                              { label: "Assigned", value: rep.total },
                              { label: "Paid",     value: rep.paid },
                              { label: "Onboarded",value: rep.onboarded },
                            ].map(({ label, value }) => (
                              <div key={label} className="rounded-xl py-2" style={{ background: "#F9FAFB" }}>
                                <p className="text-lg font-bold" style={{ color: "var(--text-900)" }}>{value}</p>
                                <p className="text-xs" style={{ color: "var(--text-400)" }}>{label}</p>
                              </div>
                            ))}
                          </div>
                          <div className="rounded-xl py-2 px-3 mb-3 flex items-center justify-between"
                            style={{ background: "#F9FAFB" }}>
                            <p className="text-xs" style={{ color: "var(--text-400)" }}>Conversion Rate</p>
                            <p className="text-sm font-bold" style={{ color: convColor }}>{convRate}%</p>
                          </div>
                        </>
                      );
                    })()}
                    <div>
                      <div className="flex justify-between text-xs mb-1" style={{ color: "var(--text-400)" }}>
                        <span>Monthly target</span>
                        <span>{rep.paidThisMonth} / {target}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                        <div className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: pct >= 100 ? "#16A34A" : "var(--green-500)" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Leads table */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4" style={{ color: "var(--text-400)" }} />
              <span className="font-semibold text-sm" style={{ color: "var(--text-900)" }}>
                All Leads ({totalLeadsCount})
              </span>
              {totalPages > 1 && (
                <span className="text-xs" style={{ color: "var(--text-400)" }}>
                  — page {page} of {totalPages}
                </span>
              )}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 transition-colors hover:bg-gray-100"
                  style={{ color: "var(--text-600)", border: "1px solid var(--border)" }}>
                  ← Prev
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = totalPages <= 7 ? i + 1
                    : page <= 4 ? i + 1
                    : page >= totalPages - 3 ? totalPages - 6 + i
                    : page - 3 + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className="w-8 h-8 rounded-lg text-xs font-semibold transition-colors"
                      style={p === page
                        ? { background: "var(--accent)", color: "#fff" }
                        : { color: "var(--text-600)", border: "1px solid var(--border)" }}>
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 transition-colors hover:bg-gray-100"
                  style={{ color: "var(--text-600)", border: "1px solid var(--border)" }}>
                  Next →
                </button>
              </div>
            )}
          </div>
          {loading ? (
            <div className="py-16 text-center text-sm" style={{ color: "var(--text-400)" }}>Loading...</div>
          ) : leads.length === 0 ? (
            <div className="py-16 text-center text-sm" style={{ color: "var(--text-400)" }}>No leads found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "#FAFAFA" }}>
                    {["Lead","Phone / City","Investment","Stage","Assigned To","Added",""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                        style={{ color: "var(--text-400)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {leads.map(lead => {
                    const cfg = STAGE_COLOR[lead.stage] ?? STAGE_COLOR.LEAD;
                    return (
                      <tr key={lead.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                              style={{ background: "var(--green-500)" }}>
                              {lead.name[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-sm" style={{ color: "var(--text-900)" }}>{lead.name}</p>
                              {lead.email && <p className="text-xs" style={{ color: "var(--text-400)" }}>{lead.email}</p>}
                              {lead.businessStage && (() => {
                                const svc = SERVICE_STYLE[lead.businessStage] ?? { bg: "#F3F4F6", color: "#6B7280", emoji: "📋" };
                                const planShort = lead.recommendedPlan?.split("—")?.[0]?.trim() ?? lead.recommendedPlan;
                                return (
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap"
                                      style={{ background: svc.bg, color: svc.color }}>
                                      {svc.emoji} {lead.businessStage}
                                    </span>
                                    {planShort && (
                                      <span className="text-[10px] font-medium" style={{ color: "var(--text-500)" }}>
                                        {planShort}
                                      </span>
                                    )}
                                    {lead.timeline && (
                                      <span className="text-[10px]" style={{ color: "var(--text-400)" }}>
                                        ⏰ {lead.timeline}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-600)" }}>
                            <Phone className="w-3 h-3" />{lead.phone}
                          </div>
                          {lead.city && (
                            <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: "var(--text-400)" }}>
                              <MapPin className="w-3 h-3" />{lead.city}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--text-900)" }}>
                          {lead.investment ? `₹${lead.investment.toLocaleString("en-IN")}` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <select
                              value={lead.stage}
                              disabled={updatingStage === lead.id}
                              onChange={e => handleStageUpdate(lead.id, e.target.value)}
                              className="text-xs font-semibold px-2.5 py-1 rounded-full cursor-pointer outline-none disabled:opacity-60"
                              style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33` }}>
                              {STAGES.map(s => (
                                <option key={s} value={s} className="bg-white text-gray-900">{STAGE_LABEL[s]}</option>
                              ))}
                            </select>
                            {lead.isNI && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600">NI</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative">
                            <select
                              value={lead.assignedTo?.id ?? ""}
                              onChange={e => handleAssign(lead.id, e.target.value)}
                              disabled={assigning === lead.id}
                              className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg outline-none appearance-none pr-6 disabled:opacity-50"
                              style={{ color: "var(--text-900)" }}>
                              <option value="">Unassigned</option>
                              {salesTeam.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                            {assigning === lead.id
                              ? <Loader2 className="absolute right-1.5 top-1.5 w-3 h-3 animate-spin text-gray-400" />
                              : <ChevronDown className="absolute right-1.5 top-1.5 w-3 h-3 pointer-events-none text-gray-400" />
                            }
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--text-400)" }}>
                          {new Date(lead.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {lead.phone && (
                              <button
                                onClick={() => handleWhatsAppOutreach(lead.id)}
                                disabled={startingWa === lead.id}
                                title="Send WhatsApp intro via Arya"
                                className="p-1.5 rounded-lg transition-colors disabled:opacity-50"
                                style={{ color: "#25D366", background: "rgba(37,211,102,0.1)" }}>
                                {startingWa === lead.id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <MessageCircle className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            {(lead.stage === "PAID" || lead.stage === "ONBOARDED") && (
                              <button
                                onClick={() => { setConvertingLead({ id: lead.id, name: lead.name, email: lead.email }); setConvertResult(null); }}
                                title="Convert to Seller Account"
                                className="p-1.5 rounded-lg transition-colors"
                                style={{ color: "#16A34A", background: "rgba(0,198,122,0.1)" }}>
                                <UserCheck className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button onClick={() => handleDelete(lead.id)} disabled={deleting === lead.id}
                              className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                              {deleting === lead.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>}

        {/* ══ CUSTOMERS TAB ══ */}
        {tab === "customers" && (
          <div className="space-y-4">

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Customers",   value: custSummary.totalCustomers,  sub: "unique buyers",         color: "#4361EE" },
                { label: "Repeat Customers",  value: custSummary.repeatCustomers, sub: "ordered 2+ times",      color: "#8B5CF6" },
                { label: "Total Orders",      value: custSummary.totalOrders,     sub: "all time",              color: "#D97706" },
                { label: "Packets Delivered", value: custSummary.totalDelivered,  sub: `${custSummary.totalOrders > 0 ? Math.round(custSummary.totalDelivered / custSummary.totalOrders * 100) : 0}% delivery rate`, color: "#16A34A" },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="rounded-2xl p-4"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                  <div className="w-1.5 h-1.5 rounded-full mb-3" style={{ background: color }} />
                  <p className="text-2xl font-black leading-none mb-1" style={{ color: "var(--text-primary)" }}>
                    {value.toLocaleString()}
                  </p>
                  <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>
                </div>
              ))}
            </div>

            {/* Filters + table */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3.5 flex items-center gap-3 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
                <input
                  value={custSearch}
                  onChange={e => { setCustSearch(e.target.value); setCustPage(1); }}
                  placeholder="Search name or phone..."
                  className="px-3 py-1.5 text-sm rounded-lg outline-none"
                  style={{ background: "var(--bg-muted)", border: "1px solid var(--border)", color: "var(--text-primary)", width: "220px" }}
                />
                <button
                  onClick={() => { setCustRepeatOnly(p => !p); setCustPage(1); }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
                  style={custRepeatOnly
                    ? { background: "rgba(139,92,246,0.12)", color: "#8B5CF6", border: "1px solid rgba(139,92,246,0.3)" }
                    : { background: "var(--bg-muted)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                  Repeat only
                </button>
                <button onClick={fetchCustomers}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5"
                  style={{ background: "var(--bg-muted)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  <RefreshCw className={`w-3.5 h-3.5 ${custLoading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
                <span className="ml-auto text-xs" style={{ color: "var(--text-400)" }}>
                  {custTotal.toLocaleString()} customers
                </span>
              </div>

              {custLoading ? (
                <div className="py-16 text-center text-sm flex items-center justify-center gap-2" style={{ color: "var(--text-400)" }}>
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                </div>
              ) : customers.length === 0 ? (
                <div className="py-16 text-center text-sm" style={{ color: "var(--text-400)" }}>No customers found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-muted)" }}>
                        {["Customer", "Phone", "Total Orders", "Delivered", "RTO", "Delivery Rate", "Total Spend", "Last Order"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                            style={{ color: "var(--text-400)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                      {customers.map((c, i) => (
                        <tr key={i} className="hover:bg-gray-50/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium" style={{ color: "var(--text-900)" }}>{c.customerName}</span>
                              {c.isRepeat && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600">
                                  REPEAT
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-500)" }}>
                            {c.phone || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold" style={{ color: "var(--text-900)" }}>
                            {c.totalOrders}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold" style={{ color: "#16A34A" }}>
                            {c.deliveredOrders}
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: c.rtoOrders > 0 ? "#F97316" : "var(--text-400)" }}>
                            {c.rtoOrders > 0 ? c.rtoOrders : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 rounded-full overflow-hidden" style={{ background: "var(--bg-muted)" }}>
                                <div className="h-full rounded-full"
                                  style={{ width: `${c.deliveryRate}%`, background: c.deliveryRate >= 70 ? "#16A34A" : c.deliveryRate >= 40 ? "#D97706" : "#EF4444" }} />
                              </div>
                              <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{c.deliveryRate}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold" style={{ color: "var(--text-900)" }}>
                            ₹{c.totalSpend.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: "var(--text-400)" }}>
                            {new Date(c.lastOrderAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {custTotalPages > 1 && (
                <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)" }}>
                  <span className="text-xs" style={{ color: "var(--text-400)" }}>Page {custPage} of {custTotalPages}</span>
                  <div className="flex items-center gap-2">
                    <button disabled={custPage <= 1} onClick={() => setCustPage(p => p - 1)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                      style={{ color: "var(--text-600)", border: "1px solid var(--border)" }}>
                      ← Prev
                    </button>
                    <button disabled={custPage >= custTotalPages} onClick={() => setCustPage(p => p + 1)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                      style={{ color: "var(--text-600)", border: "1px solid var(--border)" }}>
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Convert to Seller Modal */}
      {convertingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h3 className="text-lg font-bold mb-1" style={{ color: "var(--text-900)" }}>Convert to Seller Account</h3>
            <p className="text-sm mb-4" style={{ color: "var(--text-400)" }}>
              Create a seller account for <strong>{convertingLead.name}</strong>
              {convertingLead.email ? ` · ${convertingLead.email}` : " (no email — account will be created without email invite)"}
            </p>

            {!convertResult ? (
              <>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-600)" }}>Plan</label>
                <select
                  value={convertPlan}
                  onChange={e => setConvertPlan(e.target.value as "DROPSHIPPING" | "MARKETPLACE")}
                  className="w-full px-3 py-2 rounded-xl text-sm border outline-none mb-4"
                  style={{ background: "var(--bg-input)", color: "var(--text-900)", borderColor: "var(--border)" }}>
                  <option value="DROPSHIPPING">Dropshipping</option>
                  <option value="MARKETPLACE">Marketplace</option>
                </select>

                <div className="flex gap-3">
                  <button
                    onClick={() => setConvertingLead(null)}
                    className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: "var(--bg-hover)", color: "var(--text-600)" }}>
                    Cancel
                  </button>
                  <button
                    disabled={converting}
                    onClick={async () => {
                      setConverting(true);
                      try {
                        const res = await fetch(`/api/admin/crm/leads/${convertingLead.id}/convert`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ plan: convertPlan, sendEmail: !!convertingLead.email }),
                        });
                        const data = await res.json();
                        setConvertResult(res.ok ? { success: true, username: data.username } : { error: data.error });
                        if (res.ok) fetchData();
                      } catch {
                        setConvertResult({ error: "Network error" });
                      } finally {
                        setConverting(false);
                      }
                    }}
                    className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: "#16A34A", color: "var(--text-primary)" }}>
                    {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                    {converting ? "Creating..." : "Create Seller Account"}
                  </button>
                </div>
              </>
            ) : convertResult.error ? (
              <>
                <p className="text-sm font-medium text-red-500 mb-4">{convertResult.error}</p>
                <button onClick={() => setConvertResult(null)} className="w-full px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: "var(--bg-hover)", color: "var(--text-600)" }}>Try Again</button>
              </>
            ) : (
              <>
                <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(0,198,122,0.08)", border: "1px solid rgba(0,198,122,0.2)" }}>
                  <p className="text-sm font-semibold" style={{ color: "#16A34A" }}>Seller account created!</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-400)" }}>Username: <strong>{convertResult.username}</strong></p>
                  {convertingLead.email && <p className="text-xs mt-0.5" style={{ color: "var(--text-400)" }}>Welcome email sent to {convertingLead.email}</p>}
                </div>
                <button onClick={() => { setConvertingLead(null); setConvertResult(null); }} className="w-full px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: "#16A34A", color: "var(--text-primary)" }}>Done</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
