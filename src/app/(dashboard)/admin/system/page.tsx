"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, ShieldCheck, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";

interface AuditRow { id: string; actorEmail: string | null; method: string; path: string; area: string; sellerId: string | null; sellerName: string | null; details: unknown; ip: string | null; createdAt: string }
interface ErrorRow { id: string; source: string; message: string; stack: string | null; path: string | null; count: number; firstSeenAt: string; lastSeenAt: string; resolvedAt: string | null }

const when = (s: string) => new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const VERB: Record<string, { label: string; bg: string; color: string }> = {
  POST:   { label: "Created", bg: "#E6EEFF", color: "#1D5CFF" },
  PATCH:  { label: "Changed", bg: "#FFF7E6", color: "#B45309" },
  PUT:    { label: "Changed", bg: "#FFF7E6", color: "#B45309" },
  DELETE: { label: "Removed", bg: "#FEF2F2", color: "#B91C1C" },
};

export default function SystemLogPage() {
  const [tab, setTab] = useState<"audit" | "errors">("audit");
  useEffect(() => { if (new URLSearchParams(window.location.search).get("tab") === "errors") setTab("errors"); }, []);

  return (
    <div className="px-4 py-5 md:p-8 space-y-5" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div>
        <h1 className="text-[22px] font-black text-[#0C1220]">Audit log &amp; errors</h1>
        <p className="text-[12.5px] text-[#6B7280] mt-1">Every change made in the admin panel, and every server error, in one place. Nothing here can be edited or deleted.</p>
      </div>
      <div className="flex gap-1.5">
        {([["audit", "Audit log", ShieldCheck], ["errors", "Errors", AlertTriangle]] as const).map(([k, l, I]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold ${tab === k ? "bg-[#E6EEFF] text-[#1D5CFF]" : "text-[#6B7280] hover:bg-white"}`}>
            <I className="w-4 h-4" /> {l}
          </button>
        ))}
      </div>
      {tab === "audit" ? <AuditTab /> : <ErrorsTab />}
    </div>
  );
}

function AuditTab() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [areas, setAreas] = useState<{ area: string; count: number }[]>([]);
  const [area, setArea] = useState("");
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async (more = false, from: string | null = null) => {
    const sp = new URLSearchParams();
    if (area) sp.set("area", area);
    if (q.trim()) sp.set("q", q.trim());
    if (more && from) sp.set("cursor", from);
    const d = await fetch(`/api/admin/system/audit?${sp}`).then(r => r.json()).catch(() => ({ rows: [] }));
    setRows(prev => (more ? [...(prev ?? []), ...(d.rows ?? [])] : d.rows ?? []));
    setCursor(d.nextCursor ?? null);
    if (d.areas) setAreas(d.areas);
  }, [area, q]);

  useEffect(() => { setRows(null); const t = setTimeout(() => load(), 250); return () => clearTimeout(t); }, [load]);

  return (
    <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
      <div className="flex items-center gap-2 flex-wrap px-4 py-3 bg-[#FAFBFF] border-b border-[#F3F4F6]">
        <label htmlFor="audit-area" className="sr-only">Area</label>
        <select id="audit-area" value={area} onChange={e => setArea(e.target.value)} className="px-2.5 py-1.5 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#1D5CFF]">
          <option value="">All areas</option>
          {areas.map(a => <option key={a.area} value={a.area}>{a.area} ({a.count})</option>)}
        </select>
        <div className="relative ml-auto w-full sm:w-[300px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
          <input id="audit-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search by team member email, seller ID or page" className="pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#1D5CFF] w-full" />
        </div>
      </div>
      {!rows ? <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#9CA3AF]" /></div>
        : rows.length === 0 ? <p className="py-16 text-center text-[13px] text-[#9CA3AF]">No admin changes recorded yet.</p>
        : (
          <ul className="divide-y divide-[#F3F4F6]">
            {rows.map(r => {
              const v = VERB[r.method] ?? VERB.PATCH;
              const isOpen = open === r.id;
              return (
                <li key={r.id}>
                  <button onClick={() => setOpen(isOpen ? null : r.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#FAFBFF]" aria-expanded={isOpen}>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />}
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md flex-shrink-0" style={{ background: v.bg, color: v.color }}>{v.label}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] text-[#0C1220] truncate"><strong>{r.area}</strong>{r.sellerName ? <> · {r.sellerName}</> : null}</p>
                      <p className="text-[12px] text-[#9CA3AF] truncate">{r.actorEmail ?? "Unknown"} · {r.path}</p>
                    </div>
                    <span className="text-[12px] text-[#6B7280] tabular-nums flex-shrink-0">{when(r.createdAt)}</span>
                  </button>
                  {isOpen && (
                    <div className="px-11 pb-4 text-[12px] text-[#4B5563] space-y-1">
                      <p>{r.method} {r.path}{r.ip ? ` · IP ${r.ip}` : ""}{r.sellerId ? ` · seller ${r.sellerId}` : ""}</p>
                      <pre className="bg-[#F8FAFF] border border-[#EEF2FA] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all text-[11.5px]">{r.details ? JSON.stringify(r.details, null, 2) : "No details sent"}</pre>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      {cursor && (
        <div className="p-3 border-t border-[#F3F4F6] flex justify-center">
          <button onClick={async () => { setLoadingMore(true); await load(true, cursor); setLoadingMore(false); }} disabled={loadingMore} className="px-4 py-1.5 rounded-lg text-[12.5px] font-semibold border border-[#E8EDF6] text-[#374151] flex items-center gap-1.5">
            {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Load older
          </button>
        </div>
      )}
    </div>
  );
}

function ErrorsTab() {
  const [rows, setRows] = useState<ErrorRow[] | null>(null);
  const [show, setShow] = useState<"open" | "fixed" | "all">("open");
  const [openCount, setOpenCount] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/admin/system/errors?show=${show}`).then(r => r.json()).then(d => { setRows(d.rows ?? []); setOpenCount(d.open ?? 0); }).catch(() => setRows([]));
  }, [show]);
  useEffect(() => { setRows(null); load(); }, [load]);

  async function mark(id: string, resolved: boolean) {
    setBusy(id);
    await fetch("/api/admin/system/errors", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, resolved }) });
    setBusy(null); load();
  }

  return (
    <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
      <div className="flex items-center gap-1.5 flex-wrap px-4 py-3 bg-[#FAFBFF] border-b border-[#F3F4F6]">
        {([["open", `Open (${openCount})`], ["fixed", "Fixed"], ["all", "All"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setShow(k)} className={`px-3 py-1.5 rounded-lg text-[12.5px] font-semibold ${show === k ? "bg-[#E6EEFF] text-[#1D5CFF]" : "text-[#6B7280] hover:bg-[#F0F5FF]"}`}>{l}</button>
        ))}
        <p className="ml-auto text-[11.5px] text-[#9CA3AF]">New errors are emailed to the team, at most once an hour each.</p>
      </div>
      {!rows ? <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#9CA3AF]" /></div>
        : rows.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2 text-[13px] text-[#9CA3AF]"><CheckCircle2 className="w-8 h-8 text-[#A7F3D0]" />{show === "open" ? "No open errors." : "Nothing here."}</div>
        ) : (
          <ul className="divide-y divide-[#F3F4F6]">
            {rows.map(r => {
              const isOpen = open === r.id;
              return (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${r.resolvedAt ? "text-[#9CA3AF]" : "text-[#DC2626]"}`} />
                    <button onClick={() => setOpen(isOpen ? null : r.id)} className="flex-1 min-w-0 text-left" aria-expanded={isOpen}>
                      <p className="text-[13.5px] font-semibold text-[#0C1220]">{r.source}</p>
                      <p className={`text-[12.5px] text-[#4B5563] ${isOpen ? "whitespace-pre-wrap break-words" : "truncate"}`}>{r.message}</p>
                      <p className="text-[11.5px] text-[#9CA3AF] mt-0.5 tabular-nums">{r.count}× · last {when(r.lastSeenAt)} · first {when(r.firstSeenAt)}{r.path ? ` · ${r.path}` : ""}</p>
                    </button>
                    <button onClick={() => mark(r.id, !r.resolvedAt)} disabled={busy === r.id} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border border-[#E8EDF6] text-[#374151] flex-shrink-0 disabled:opacity-50">
                      {busy === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : r.resolvedAt ? <RotateCcw className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      {r.resolvedAt ? "Reopen" : "Mark fixed"}
                    </button>
                  </div>
                  {isOpen && r.stack && <pre className="mt-2 ml-7 bg-[#F8FAFF] border border-[#EEF2FA] rounded-lg p-3 overflow-x-auto text-[11px] text-[#4B5563]">{r.stack}</pre>}
                </li>
              );
            })}
          </ul>
        )}
    </div>
  );
}
