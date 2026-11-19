"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, AlertTriangle, Check, ExternalLink, Clock, FileText } from "lucide-react";

interface Config { key: string; value: string; label: string; description: string; unit: string; type: "number" | "string"; isDefault: boolean }
interface Integration { group: string; name: string; ok: boolean; missing: string[]; detail: string; href: string | null }
interface Job { path: string; schedule: string; what: string }

// Settings the current flows use. Older keys (commission %, GST on fees, platform charge, Arya, AiSensy) stay stored but aren't shown.
const SHOWN = ["PLATFORM_FEE", "DEFAULT_SHIPPING_CHARGE", "REMITTANCE_DAYS"];

export default function IntegrationsConfigPage() {
  const [configs, setConfigs] = useState<Config[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<{ key: string; text: string } | null>(null);
  const [ints, setInts] = useState<{ integrations: Integration[]; jobs: Job[] } | null>(null);

  const loadConfig = useCallback(() => fetch("/api/admin/config").then(r => r.json()).then(d => setConfigs((d.configs ?? []).filter((c: Config) => SHOWN.includes(c.key)).sort((a: Config, b: Config) => SHOWN.indexOf(a.key) - SHOWN.indexOf(b.key)))), []);
  useEffect(() => {
    loadConfig();
    fetch("/api/admin/config/integrations").then(r => r.json()).then(d => { if (d.integrations) setInts(d); });
  }, [loadConfig]);

  async function save(c: Config) {
    const value = draft[c.key];
    if (value == null || value === c.value) return;
    setSaving(c.key); setErr(null);
    const res = await fetch("/api/admin/config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: c.key, value }) });
    const d = await res.json().catch(() => ({}));
    setSaving(null);
    if (!res.ok) { setErr({ key: c.key, text: d.error ?? "Couldn't save" }); return; }
    setDraft(x => { const y = { ...x }; delete y[c.key]; return y; });
    setSaved(c.key); setTimeout(() => setSaved(s => (s === c.key ? null : s)), 1800);
    loadConfig();
  }

  const groups = ints ? [...new Set(ints.integrations.map(i => i.group))] : [];
  const problems = ints?.integrations.filter(i => !i.ok).length ?? 0;

  return (
    <div className="px-4 py-5 md:p-8 space-y-5 max-w-5xl" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div>
        <h1 className="text-[22px] font-black text-[#0C1220]">Integrations &amp; Config</h1>
        <p className="text-[12.5px] text-[#6B7280] mt-1">Platform charges your team can change, and which outside services AXQEN is connected to.</p>
      </div>

      <section className="bg-white rounded-xl border border-[#E8EDF6] p-5 space-y-4">
        <div>
          <h2 className="text-[15px] font-bold text-[#0C1220]">Charges</h2>
          <p className="text-[12px] text-[#9CA3AF] mt-0.5">Changes apply to new calculations straight away. Invoices and remittances already made don&apos;t change.</p>
        </div>
        {!configs ? <p className="py-6 text-[13px] text-[#9CA3AF] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p> : (
          <div className="divide-y divide-[#F3F4F6]">
            {configs.map(c => (
              <div key={c.key} className="py-3.5 flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-[240px]">
                  <label htmlFor={`cfg-${c.key}`} className="text-[13px] font-semibold text-[#0C1220]">{c.label}</label>
                  <p className="text-[12px] text-[#6B7280] mt-0.5">{c.description}</p>
                  {err?.key === c.key && <p className="text-[11.5px] text-[#B91C1C] mt-0.5">{err.text}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-lg border border-[#E8EDF6] focus-within:border-[#4361EE] overflow-hidden">
                    {c.unit === "₹" && <span className="px-2.5 text-[13px] text-[#6B7280] bg-[#FAFBFF] self-stretch flex items-center border-r border-[#E8EDF6]">₹</span>}
                    <input id={`cfg-${c.key}`} inputMode="decimal" value={draft[c.key] ?? c.value} onChange={e => setDraft(x => ({ ...x, [c.key]: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") save(c); }} className="w-[90px] px-2.5 py-2 text-[13px] text-right tabular-nums outline-none" />
                    {c.unit && c.unit !== "₹" && <span className="px-2.5 text-[12.5px] text-[#6B7280] bg-[#FAFBFF] self-stretch flex items-center border-l border-[#E8EDF6]">{c.unit}</span>}
                  </div>
                  <button onClick={() => save(c)} disabled={saving === c.key || draft[c.key] == null || draft[c.key] === c.value}
                    className="w-[72px] flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-[12.5px] font-bold text-white bg-[#4361EE] disabled:opacity-30">
                    {saving === c.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved === c.key ? <><Check className="w-3.5 h-3.5" /> Saved</> : "Save"}
                  </button>
                </div>
              </div>
            ))}
            <div className="py-3.5 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <p className="text-[13px] font-semibold text-[#0C1220]">Packing per order, invoice details and numbering</p>
                <p className="text-[12px] text-[#6B7280] mt-0.5">Set in Invoice settings. Remittance uses the same packing amount.</p>
              </div>
              <Link href="/admin/invoices/settings" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold border border-[#E8EDF6] text-[#374151] hover:border-[#C7D2FE]"><FileText className="w-3.5 h-3.5" /> Invoice settings</Link>
            </div>
            <div className="py-3.5 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <p className="text-[13px] font-semibold text-[#0C1220]">Product prices, HSN and GST</p>
                <p className="text-[12px] text-[#6B7280] mt-0.5">Per product, in Invoice pricing or on each product.</p>
              </div>
              <Link href="/admin/invoice-pricing" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold border border-[#E8EDF6] text-[#374151] hover:border-[#C7D2FE]"><FileText className="w-3.5 h-3.5" /> Invoice pricing</Link>
            </div>
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl border border-[#E8EDF6] p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-[15px] font-bold text-[#0C1220]">Integrations</h2>
            <p className="text-[12px] text-[#9CA3AF] mt-0.5">Keys live in Vercel → Settings → Environment Variables. This page only checks whether they&apos;re set; it never shows them.</p>
          </div>
          {ints && <span className={`text-[12px] font-bold px-2.5 py-1 rounded-lg ${problems ? "bg-[#FEF3C7] text-[#B45309]" : "bg-[#DCFCE7] text-[#047857]"}`}>{problems ? `${problems} not set up` : "All set up"}</span>}
        </div>
        {!ints ? <p className="py-6 text-[13px] text-[#9CA3AF] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Checking…</p> : groups.map(g => (
          <div key={g}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF] mb-1.5">{g}</p>
            <div className="rounded-lg border border-[#EEF1F8] divide-y divide-[#F3F4F6]">
              {ints.integrations.filter(i => i.group === g).map(i => (
                <div key={i.name} className="px-4 py-3 flex items-start gap-3">
                  {i.ok ? <CheckCircle2 className="w-4 h-4 text-[#059669] mt-0.5 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 text-[#D97706] mt-0.5 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#0C1220]">{i.name} <span className={`ml-1 text-[11px] font-bold ${i.ok ? "text-[#047857]" : "text-[#B45309]"}`}>{i.ok ? "Connected" : "Not set up"}</span></p>
                    <p className="text-[12px] text-[#6B7280]">{i.detail}</p>
                    {i.missing.length > 0 && <p className="text-[11px] text-[#B45309] mt-0.5">Missing in Vercel: <span className="font-mono">{i.missing.join(", ")}</span></p>}
                  </div>
                  {i.href && <Link href={i.href} className="text-[12px] font-semibold text-[#4361EE] inline-flex items-center gap-0.5 whitespace-nowrap">Open <ExternalLink className="w-3 h-3" /></Link>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {ints && (
        <section className="bg-white rounded-xl border border-[#E8EDF6] p-5">
          <h2 className="text-[15px] font-bold text-[#0C1220]">Scheduled jobs</h2>
          <p className="text-[12px] text-[#9CA3AF] mt-0.5 mb-3">These run automatically on Vercel.</p>
          <div className="rounded-lg border border-[#EEF1F8] divide-y divide-[#F3F4F6]">
            {ints.jobs.map(j => (
              <div key={j.path} className="px-4 py-2.5 flex items-center gap-3 flex-wrap text-[12.5px]">
                <Clock className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" />
                <span className="flex-1 min-w-[220px] text-[#0C1220]">{j.what}</span>
                <span className="text-[#6B7280] whitespace-nowrap">{j.schedule}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
