"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, X, KeyRound, UserX, UserCheck, Eye, EyeOff, ShieldCheck, Headphones, Package, Wand2 } from "lucide-react";

type Role = "ADMIN" | "SALES" | "SUPPLIER";
interface Member {
  id: string; name: string | null; email: string; phone: string | null; role: Role; accountStatus: "ACTIVE" | "PENDING" | "SUSPENDED";
  createdAt: string; updatedAt: string; products: number; openTickets: number;
}

const ROLES: Record<Role, { label: string; icon: React.ElementType; bg: string; fg: string; can: string }> = {
  ADMIN: { label: "Admin", icon: ShieldCheck, bg: "#E8EDFF", fg: "#4361EE", can: "Full admin panel: sellers, orders, money, settings and this page." },
  SALES: { label: "Sales", icon: Headphones, bg: "#FEF3C7", fg: "#B45309", can: "The sales panel only (their own leads). No admin panel access." },
  SUPPLIER: { label: "Supplier account", icon: Package, bg: "#F3E8FF", fg: "#7E22CE", can: "The supplier panel. Used as the account your catalogue products belong to." },
};
const fmt = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
function strongPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const a = new Uint32Array(12); crypto.getRandomValues(a);
  const p = Array.from(a, n => chars[n % chars.length]).join("");
  return /\d/.test(p) ? p : p.slice(0, 11) + "7";
}

export default function TeamRolesPage() {
  const [team, setTeam] = useState<Member[] | null>(null);
  const [me, setMe] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [pw, setPw] = useState<{ m: Member; mode: "resetPassword" | "restoreAccess" } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => fetch("/api/admin/team").then(r => r.json()).then(d => { setTeam(d.team ?? []); setMe(d.me ?? ""); }), []);
  useEffect(() => { load(); }, [load]);

  async function patch(m: Member, body: Record<string, unknown>, ok: string) {
    setBusy(m.id); setMsg(null);
    const res = await fetch("/api/admin/team", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: m.id, ...body }) });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    setMsg(res.ok ? { ok: true, text: ok } : { ok: false, text: d.error ?? "Couldn't save" });
    if (res.ok) load();
    return res.ok;
  }

  const groups = (["ADMIN", "SALES", "SUPPLIER"] as Role[]).map(r => ({ role: r, members: (team ?? []).filter(m => m.role === r) }));

  return (
    <div className="px-4 py-5 md:p-8 space-y-5" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-black text-[#0C1220]">Team &amp; Roles</h1>
          <p className="text-[12.5px] text-[#6B7280] mt-1">Who on the AXQEN team can log in, and what they can reach. Sellers are managed in Sellers.</p>
        </div>
        <button onClick={() => { setAdding(true); setMsg(null); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold text-white bg-[#4361EE]"><Plus className="w-3.5 h-3.5" /> Add team member</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(Object.keys(ROLES) as Role[]).map(r => {
          const R = ROLES[r], Icon = R.icon;
          return (
            <div key={r} className="bg-white rounded-xl border border-[#E8EDF6] p-4 flex gap-3">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: R.bg, color: R.fg }}><Icon className="w-4 h-4" /></span>
              <div><p className="text-[13px] font-bold text-[#0C1220]">{R.label} <span className="text-[#9CA3AF] font-semibold">· {(team ?? []).filter(m => m.role === r && m.accountStatus !== "SUSPENDED").length}</span></p><p className="text-[12px] text-[#6B7280] mt-0.5">{R.can}</p></div>
            </div>
          );
        })}
      </div>

      {msg && <div className="px-4 py-2.5 rounded-xl text-[13px]" style={{ background: msg.ok ? "#ECFDF5" : "#FEF2F2", color: msg.ok ? "#047857" : "#B91C1C" }}>{msg.text}</div>}

      {!team ? <div className="flex items-center justify-center gap-2 py-20 text-[13px] text-[#9CA3AF]"><Loader2 className="w-5 h-5 animate-spin" /> Loading team…</div> : groups.map(g => g.members.length > 0 && (
        <section key={g.role} className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
          <p className="px-5 py-3 border-b border-[#F3F4F6] text-[13px] font-bold text-[#0C1220]">{ROLES[g.role].label}{g.role === "SUPPLIER" ? " accounts" : "s"}</p>
          <div className="divide-y divide-[#F3F4F6]">
            {g.members.map(m => {
              const removed = m.accountStatus === "SUSPENDED", self = m.id === me;
              return (
                <div key={m.id} className={`px-5 py-3.5 flex items-center gap-3 flex-wrap ${removed ? "bg-[#FAFAFA]" : ""}`}>
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0 ${removed ? "bg-[#F3F4F6] text-[#9CA3AF]" : "bg-[#E8EDFF] text-[#4361EE]"}`}>{(m.name ?? m.email)[0]?.toUpperCase()}</span>
                  <div className="flex-1 min-w-[200px]">
                    <p className={`text-[13px] font-semibold ${removed ? "text-[#9CA3AF] line-through" : "text-[#0C1220]"}`}>{m.name ?? m.email}{self && <span className="ml-1.5 text-[11px] font-bold text-[#4361EE] no-underline">· You</span>}</p>
                    <p className="text-[11.5px] text-[#9CA3AF]">{m.email}{m.phone ? ` · ${m.phone}` : ""} · added {fmt(m.createdAt)}</p>
                    {removed && <p className="text-[11.5px] font-semibold text-[#B91C1C]">Access removed</p>}
                  </div>
                  <span className="text-[11.5px] text-[#6B7280]">
                    {m.role === "SUPPLIER" ? `${m.products} products` : m.role === "ADMIN" && m.openTickets ? `${m.openTickets} open tickets assigned` : ""}
                  </span>
                  {!self && !removed && (
                    <select id={`role-${m.id}`} aria-label="Role" value={m.role} disabled={busy === m.id}
                      onChange={e => { const r = e.target.value as Role; if (confirm(`Change ${m.name ?? m.email} to ${ROLES[r].label}? ${ROLES[r].can}`)) patch(m, { action: "setRole", role: r }, `${m.name ?? m.email} is now ${ROLES[r].label}. They need to log out and in again.`); }}
                      className="px-2 py-1.5 text-[12px] rounded-lg border border-[#E8EDF6] bg-white outline-none">
                      {(Object.keys(ROLES) as Role[]).map(r => <option key={r} value={r}>{ROLES[r].label}</option>)}
                    </select>
                  )}
                  <div className="flex items-center gap-1.5">
                    {busy === m.id && <Loader2 className="w-4 h-4 animate-spin text-[#9CA3AF]" />}
                    {removed ? (
                      <button onClick={() => setPw({ m, mode: "restoreAccess" })} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold bg-[#DCFCE7] text-[#047857]"><UserCheck className="w-3.5 h-3.5" /> Restore access</button>
                    ) : (
                      <>
                        <button onClick={() => setPw({ m, mode: "resetPassword" })} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border border-[#E8EDF6] text-[#374151] hover:border-[#C7D2FE]"><KeyRound className="w-3.5 h-3.5" /> {self ? "Change my password" : "Reset password"}</button>
                        {!self && (
                          <button onClick={() => { if (confirm(`Remove ${m.name ?? m.email}'s access? Their password stops working right away. Anyone already logged in stays logged in until their session ends.`)) patch(m, { action: "removeAccess" }, `${m.name ?? m.email} can no longer log in.`); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-[#B91C1C] hover:bg-[#FEF2F2]"><UserX className="w-3.5 h-3.5" /> Remove access</button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {adding && <AddMember onClose={() => setAdding(false)} onAdded={t => { setAdding(false); setMsg({ ok: true, text: t }); load(); }} />}
      {pw && <PasswordModal member={pw.m} mode={pw.mode} onClose={() => setPw(null)} onSave={async p => { const ok = await patch(pw.m, { action: pw.mode, password: p }, pw.mode === "restoreAccess" ? `${pw.m.name ?? pw.m.email} can log in again with the new password.` : "Password changed. Share it with them privately."); if (ok) setPw(null); }} />}
    </div>
  );
}

function PasswordField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <input id={id} type={show ? "text" : "password"} autoComplete="new-password" value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 pr-9 text-[13px] font-mono rounded-lg border border-[#E8EDF6] outline-none focus:border-[#4361EE]" />
        <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF]">{show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
      </div>
      <button type="button" onClick={() => { onChange(strongPassword()); setShow(true); }} className="flex items-center gap-1 px-2.5 rounded-lg text-[12px] font-semibold border border-[#E8EDF6] text-[#374151]"><Wand2 className="w-3.5 h-3.5" /> Generate</button>
    </div>
  );
}

function AddMember({ onClose, onAdded }: { onClose: () => void; onAdded: (text: string) => void }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", role: "ADMIN" as Role, password: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErr("");
    const res = await fetch("/api/admin/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setErr(d.error ?? "Couldn't add"); return; }
    onAdded(`${f.name} added as ${ROLES[f.role].label}. Share their email and password with them privately.`);
  }
  const input = "w-full px-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] outline-none focus:border-[#4361EE]";
  const label = "block text-[11.5px] font-semibold text-[#374151] mb-1";
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={save} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-5 py-4 border-b border-[#F3F4F6] flex items-center justify-between">
          <p className="text-[15px] font-bold text-[#0C1220]">Add team member</p>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg hover:bg-[#F3F4F6]"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          {err && <p className="text-[12.5px] text-[#B91C1C] bg-[#FEF2F2] rounded-lg px-3 py-2">{err}</p>}
          <div><label htmlFor="tm-name" className={label}>Name</label><input id="tm-name" required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={input} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="tm-email" className={label}>Email (login)</label><input id="tm-email" type="email" required value={f.email} onChange={e => setF({ ...f, email: e.target.value })} className={input} /></div>
            <div><label htmlFor="tm-phone" className={label}>Phone (optional)</label><input id="tm-phone" inputMode="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} className={input} /></div>
          </div>
          <div>
            <p className={label}>Role</p>
            <div className="space-y-1.5">
              {(Object.keys(ROLES) as Role[]).map(r => (
                <label key={r} className={`flex items-start gap-2 px-3 py-2 rounded-lg border cursor-pointer ${f.role === r ? "border-[#4361EE] bg-[#EEF2FF]" : "border-[#E8EDF6]"}`}>
                  <input type="radio" name="tm-role" checked={f.role === r} onChange={() => setF({ ...f, role: r })} className="mt-0.5 accent-[#4361EE]" />
                  <span><span className="block text-[13px] font-semibold text-[#0C1220]">{ROLES[r].label}</span><span className="block text-[11.5px] text-[#6B7280]">{ROLES[r].can}</span></span>
                </label>
              ))}
            </div>
          </div>
          <div><label htmlFor="tm-pw" className={label}>Password (8+ characters, with a number)</label><PasswordField id="tm-pw" value={f.password} onChange={v => setF({ ...f, password: v })} /></div>
        </div>
        <div className="px-5 py-3 border-t border-[#F3F4F6] flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] text-[#374151] border border-[#E8EDF6]">Cancel</button>
          <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold text-white bg-[#4361EE] disabled:opacity-60">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Add member</button>
        </div>
      </form>
    </div>
  );
}

function PasswordModal({ member, mode, onClose, onSave }: { member: Member; mode: "resetPassword" | "restoreAccess"; onClose: () => void; onSave: (p: string) => Promise<void> }) {
  const [p, setP] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="px-5 py-4 border-b border-[#F3F4F6] flex items-center justify-between">
          <div>
            <p className="text-[15px] font-bold text-[#0C1220]">{mode === "restoreAccess" ? "Restore access" : "Set a new password"}</p>
            <p className="text-[12px] text-[#9CA3AF]">{member.name ?? member.email}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg hover:bg-[#F3F4F6]"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-2">
          <label htmlFor="pw-new" className="block text-[11.5px] font-semibold text-[#374151]">New password</label>
          <PasswordField id="pw-new" value={p} onChange={setP} />
          <p className="text-[11.5px] text-[#9CA3AF]">Share it with them privately. They can log in with it straight away.</p>
        </div>
        <div className="px-5 py-3 border-t border-[#F3F4F6] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] text-[#374151] border border-[#E8EDF6]">Cancel</button>
          <button onClick={async () => { setSaving(true); await onSave(p); setSaving(false); }} disabled={saving || p.length < 8} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold text-white bg-[#4361EE] disabled:opacity-50">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Save password</button>
        </div>
      </div>
    </div>
  );
}
