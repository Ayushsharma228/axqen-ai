"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck, ShieldAlert, FileText, Eye, EyeOff, ExternalLink, Phone, Mail, Landmark, Building2, Search } from "lucide-react";

type Status = "SUBMITTED" | "APPROVED" | "REJECTED" | "NOT_SUBMITTED";
interface Seller {
  id: string; name: string | null; email: string; brandName: string | null; businessName: string | null; phone: string | null;
  gstNumber: string | null; aadhaarNumber: string | null; aadhaarDocUrl: string | null; kycStatus: Status;
  onboardingDone: boolean; accountStatus: string; createdAt: string; businessAddress: string | null; pincode: string | null;
  bankName: string | null; bankHolder: string | null; bankIfsc: string | null;
}

const TABS: { key: Status; label: string }[] = [
  { key: "SUBMITTED", label: "To review" }, { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" }, { key: "NOT_SUBMITTED", label: "Not submitted" },
];
const fmt = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const isImage = (u: string) => /\.(png|jpe?g|webp|gif)(\?|$)/i.test(u) || u.startsWith("data:image");
const maskAadhaar = (a: string) => { const d = a.replace(/\D/g, ""); return d.length >= 4 ? `XXXX XXXX ${d.slice(-4)}` : a; };
const spaced = (a: string) => a.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");

export default function KycApprovalsPage() {
  const [tab, setTab] = useState<Status>("SUBMITTED");
  const [rows, setRows] = useState<Seller[]>([]);
  const [counts, setCounts] = useState<Partial<Record<Status, number>>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/kyc?status=${tab}`).then(r => r.json()).then(d => {
      setRows(d.sellers ?? []);
      setCounts(Object.fromEntries((d.counts ?? []).map((c: { kycStatus: Status; _count: { id: number } }) => [c.kycStatus, c._count.id])));
    }).finally(() => setLoading(false));
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  async function decide(s: Seller, action: "APPROVED" | "REJECTED") {
    setBusy(`${s.id}:${action}`); setMsg(null);
    const res = await fetch(`/api/admin/kyc/${s.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, adminNote: action === "REJECTED" ? reason[s.id]?.trim() : undefined }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? "Couldn't save" }); return; }
    setMsg({ ok: true, text: `${s.name ?? s.email}: KYC ${action === "APPROVED" ? "approved" : "rejected"}. The seller has been emailed.` });
    load();
  }

  const list = rows.filter(r => !q.trim() || [r.name, r.email, r.phone, r.brandName, r.businessName].some(v => v?.toLowerCase().includes(q.trim().toLowerCase())));
  const btn = "flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold disabled:opacity-50";

  return (
    <div className="px-4 py-5 md:p-8 space-y-5" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div>
        <h1 className="text-[22px] font-black text-[#0C1220]">KYC Approvals</h1>
        <p className="text-[12.5px] text-[#6B7280] mt-1">Check each seller&apos;s Aadhaar, business and bank details. Approving or rejecting emails the seller and sends them a notification.</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-white rounded-xl border border-[#E8EDF6] p-1.5">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5 ${tab === t.key ? "bg-[#E8EDFF] text-[#4361EE]" : "text-[#6B7280] hover:bg-[#F3F6FF]"}`}>
              {t.label}
              <span className={`text-[10.5px] px-1.5 rounded-full tabular-nums ${t.key === "SUBMITTED" && counts.SUBMITTED ? "bg-[#FEF3C7] text-[#B45309]" : "bg-[#F3F4F6] text-[#6B7280]"}`}>{counts[t.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] md:max-w-[280px] ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
          <input id="kyc-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search sellers"
            className="pl-8 pr-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] w-full" />
        </div>
      </div>

      {msg && <div className="px-4 py-2.5 rounded-xl text-[13px]" style={{ background: msg.ok ? "#ECFDF5" : "#FEF2F2", color: msg.ok ? "#047857" : "#B91C1C" }}>{msg.text}</div>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-[#9CA3AF]"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
      ) : list.length === 0 ? (
        <p className="py-24 text-center text-[13px] text-[#9CA3AF]">{tab === "SUBMITTED" ? "Nothing to review. All caught up." : "No sellers here."}</p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {list.map(s => {
            const missing = [!s.aadhaarNumber && "Aadhaar number", !s.aadhaarDocUrl && "Aadhaar document", !s.bankHolder && "bank details", !s.businessAddress && "address"].filter(Boolean) as string[];
            return (
              <article key={s.id} className="bg-white rounded-xl border border-[#E8EDF6] p-5 space-y-4">
                <header className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-full bg-[#E8EDFF] text-[#4361EE] text-[14px] font-bold flex items-center justify-center flex-shrink-0">{(s.name ?? s.email)[0]?.toUpperCase()}</span>
                  <div className="flex-1 min-w-0">
                    <Link href={`/admin/sellers/${s.id}`} className="text-[15px] font-bold text-[#0C1220] hover:text-[#4361EE] inline-flex items-center gap-1">{s.name ?? s.email} <ExternalLink className="w-3 h-3 opacity-50" /></Link>
                    <p className="text-[12px] text-[#6B7280] truncate">{[s.brandName || s.businessName, `signed up ${fmt(s.createdAt)}`].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {s.phone && <a href={`tel:${s.phone}`} aria-label="Call" className="p-2 rounded-lg text-[#6B7280] hover:bg-[#F3F6FF] hover:text-[#4361EE]"><Phone className="w-4 h-4" /></a>}
                    <a href={`mailto:${s.email}`} aria-label="Email" className="p-2 rounded-lg text-[#6B7280] hover:bg-[#F3F6FF] hover:text-[#4361EE]"><Mail className="w-4 h-4" /></a>
                  </div>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg bg-[#FAFBFF] border border-[#EEF1F8] p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF] flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Aadhaar</p>
                    {s.aadhaarNumber ? (
                      <p className="text-[14px] font-mono text-[#0C1220] mt-1 flex items-center gap-2">
                        {reveal[s.id] ? spaced(s.aadhaarNumber) : maskAadhaar(s.aadhaarNumber)}
                        <button onClick={() => setReveal(r => ({ ...r, [s.id]: !r[s.id] }))} aria-label={reveal[s.id] ? "Hide number" : "Show full number"} className="text-[#9CA3AF] hover:text-[#4361EE]">
                          {reveal[s.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </p>
                    ) : <p className="text-[12.5px] text-[#B45309] mt-1">Not provided</p>}
                    {s.aadhaarDocUrl ? (
                      <div className="flex items-center gap-3 mt-2 text-[12px]">
                        <button onClick={() => setPreview(p => ({ ...p, [s.id]: !p[s.id] }))} className="font-semibold text-[#4361EE] inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {preview[s.id] ? "Hide document" : "View document"}</button>
                        <a href={s.aadhaarDocUrl} target="_blank" rel="noreferrer" className="text-[#6B7280] inline-flex items-center gap-1 hover:text-[#4361EE]">Open <ExternalLink className="w-3 h-3" /></a>
                      </div>
                    ) : <p className="text-[12px] text-[#B45309] mt-2">No document uploaded</p>}
                  </div>
                  <div className="rounded-lg bg-[#FAFBFF] border border-[#EEF1F8] p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF] flex items-center gap-1.5"><Landmark className="w-3.5 h-3.5" /> Bank</p>
                    {s.bankHolder ? (
                      <>
                        <p className="text-[13px] text-[#0C1220] mt-1 font-semibold">{s.bankHolder}</p>
                        <p className="text-[12px] text-[#6B7280]">{[s.bankName, s.bankIfsc].filter(Boolean).join(" · ")}</p>
                        {s.name && s.bankHolder.trim().toLowerCase() !== s.name.trim().toLowerCase() && (s.businessName ?? "").trim().toLowerCase() !== s.bankHolder.trim().toLowerCase() && (
                          <p className="text-[11.5px] text-[#B45309] mt-1">Holder name differs from the seller and business name. Check it matches the Aadhaar.</p>
                        )}
                      </>
                    ) : <p className="text-[12.5px] text-[#B45309] mt-1">Not provided</p>}
                  </div>
                </div>

                {preview[s.id] && s.aadhaarDocUrl && (
                  <div className="rounded-lg border border-[#E8EDF6] overflow-hidden bg-[#F9FAFB]">
                    {isImage(s.aadhaarDocUrl)
                      ? <img src={s.aadhaarDocUrl} alt={`Aadhaar document of ${s.name ?? s.email}`} className="w-full max-h-[420px] object-contain" />
                      : <iframe src={s.aadhaarDocUrl} title="Aadhaar document" className="w-full h-[420px]" />}
                  </div>
                )}

                <div className="rounded-lg bg-[#FAFBFF] border border-[#EEF1F8] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF] flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Business</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-1 text-[12.5px]">
                    <p className="text-[#374151]"><span className="text-[#9CA3AF]">Name:</span> {s.businessName || "—"}</p>
                    <p className="text-[#374151]"><span className="text-[#9CA3AF]">GSTIN:</span> <span className="font-mono">{s.gstNumber || "—"}</span></p>
                    <p className="text-[#374151] sm:col-span-2"><span className="text-[#9CA3AF]">Address:</span> {[s.businessAddress, s.pincode].filter(Boolean).join(" – ") || "—"}</p>
                    <p className="text-[#374151]"><span className="text-[#9CA3AF]">Phone:</span> {s.phone || "—"}</p>
                    <p className="text-[#374151] truncate"><span className="text-[#9CA3AF]">Email:</span> {s.email}</p>
                  </div>
                </div>

                {missing.length > 0 && tab === "SUBMITTED" && <p className="text-[12px] text-[#B45309]">Missing: {missing.join(", ")}.</p>}

                {(tab === "SUBMITTED" || tab === "REJECTED") && (
                  <footer className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button onClick={() => decide(s, "APPROVED")} disabled={!!busy} className={`${btn} bg-[#059669] text-white justify-center`}>
                      {busy === `${s.id}:APPROVED` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />} Approve
                    </button>
                    {tab === "SUBMITTED" && <>
                      <input id={`reason-${s.id}`} value={reason[s.id] ?? ""} onChange={e => setReason(r => ({ ...r, [s.id]: e.target.value }))}
                        placeholder="Reason for rejecting (the seller sees this)" className="flex-1 px-3 py-2 text-[12.5px] rounded-lg border border-[#E8EDF6] outline-none focus:border-[#4361EE]" />
                      <button onClick={() => decide(s, "REJECTED")} disabled={!!busy || !reason[s.id]?.trim()} className={`${btn} bg-[#FEE2E2] text-[#B91C1C] justify-center`}>
                        {busy === `${s.id}:REJECTED` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />} Reject
                      </button>
                    </>}
                  </footer>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
