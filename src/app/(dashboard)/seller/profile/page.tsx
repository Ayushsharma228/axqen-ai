"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  User, Building2, Landmark, Lock, Plug, BadgeCheck, Loader2, CheckCircle2, AlertCircle, ShieldCheck,
  MessageCircle, ExternalLink, Store, Megaphone, ShoppingBag, Clock, Trash2,
} from "lucide-react";
import { DeleteAccountPanel } from "@/components/seller/delete-account-panel";
import { WA_LINK } from "@/components/landing/constants";
import { PlanDueNotice, useBilling } from "@/components/billing/plan-payments-panel";

type Tab = "account" | "business" | "bank" | "plan" | "connections" | "password" | "delete";
interface Profile {
  name: string | null; email: string; phone: string | null; phoneVerified: boolean;
  brandName: string | null; gstNumber: string | null;
  bankHolder: string | null; bankAccount: string | null; bankIfsc: string | null; bankName: string | null;
  kycStatus: "NOT_SUBMITTED" | "SUBMITTED" | "APPROVED" | "REJECTED";
  planInfo: { plan: "DROPSHIPPING" | "MARKETPLACE" | null; tier: string | null; price: number | null; paymentConfirmed: boolean; accountStatus: "PENDING" | "ACTIVE" | "SUSPENDED"; memberSince: string };
  connections: { shopify: { name: string; url: string; problem: boolean } | null; amazon: boolean; meta: boolean };
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "account",     label: "Account",      icon: User },
  { id: "business",    label: "Business",     icon: Building2 },
  { id: "bank",        label: "Bank account", icon: Landmark },
  { id: "plan",        label: "Plan",         icon: BadgeCheck },
  { id: "connections", label: "Connections",  icon: Plug },
  { id: "password",    label: "Password",     icon: Lock },
  { id: "delete",      label: "Delete account", icon: Trash2 },
];

const KYC: Record<Profile["kycStatus"], { label: string; bg: string; color: string; note: string }> = {
  APPROVED:      { label: "Verified",      bg: "#ECFDF5", color: "#047857", note: "Your business documents are verified." },
  SUBMITTED:     { label: "Under review",  bg: "#FFFBEB", color: "#B45309", note: "The AXQEN team is checking your documents." },
  REJECTED:      { label: "Action needed", bg: "#FEF2F2", color: "#DC2626", note: "Something in your documents needs fixing. Message us and we'll guide you." },
  NOT_SUBMITTED: { label: "Not submitted", bg: "#F3F4F6", color: "#6B7280", note: "Share your GST or PAN and ID with the AXQEN team to get verified." },
};

const PLAN_NAME: Record<string, string> = { DROPSHIPPING: "Dropshipping", MARKETPLACE: "Amazon Marketplace" };
const tierName = (t: string | null) => (t ? t.charAt(0) + t.slice(1).toLowerCase() : "");

export default function ProfilePage() {
  const [tab, setTab] = useState<Tab>("account");
  const { billing } = useBilling();
  const [data, setData] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [account, setAccount] = useState({ name: "", phone: "" });
  const [business, setBusiness] = useState({ brandName: "", gst: "" });
  const [bank, setBank] = useState({ accountHolder: "", accountNumber: "", confirmAccountNumber: "", ifsc: "", bankName: "", currentPassword: "" });
  const [editingBank, setEditingBank] = useState(false);
  const [pw, setPw] = useState({ current: "", newPass: "", confirm: "" });

  function load() {
    fetch("/api/seller/profile").then(r => r.json()).then((d: Profile) => {
      setData(d);
      setAccount({ name: d.name ?? "", phone: (d.phone ?? "").replace(/^\+91/, "") });
      setBusiness({ brandName: d.brandName ?? "", gst: d.gstNumber ?? "" });
    }).finally(() => setLoading(false));
  }
  useEffect(load, []);
  // Deep link, e.g. /seller/profile?tab=delete (linked from the app store listings)
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (t && TABS.some(x => x.id === t)) setTab(t);
  }, []);
  useEffect(() => { setMsg(null); }, [tab]);

  async function save(type: string, payload: Record<string, string>, after?: () => void) {
    setSaving(true); setMsg(null);
    const res = await fetch("/api/seller/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, ...payload }) });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? "Couldn't save. Try again." }); return; }
    setMsg({ ok: true, text: type === "bank" ? "Bank account saved. We've emailed you a confirmation." : type === "password" ? "Password changed." : "Saved." });
    after?.();
    load();
  }

  if (loading || !data) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-[#4361EE]" /></div>;
  }

  const kyc = KYC[data.kycStatus] ?? KYC.NOT_SUBMITTED;
  const p = data.planInfo;
  const input = "w-full px-3 py-2.5 text-[13.5px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#4361EE] disabled:bg-[#F9FAFB] disabled:text-[#6B7280]";
  const label = "block text-[12px] font-semibold text-[#374151] mb-1.5";
  const saveBtn = "inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-bold text-white bg-[#4361EE] disabled:opacity-60";

  return (
    <div className="px-3 py-4 md:p-8 space-y-5" style={{ background: "#F7F8FC", minHeight: "100vh" }}>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-black text-[#0C1220]">Profile &amp; Settings</h1>
          <p className="text-[12.5px] text-[#6B7280] mt-1">Your account, business, payout bank and plan.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11.5px] font-bold px-2.5 py-1 rounded-full" style={{ background: kyc.bg, color: kyc.color }}>
            <ShieldCheck className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />{kyc.label}
          </span>
          {p.plan && <span className="text-[11.5px] font-bold px-2.5 py-1 rounded-full bg-[#EEF2FF] text-[#4361EE]">{PLAN_NAME[p.plan]}{p.tier && p.plan === "DROPSHIPPING" ? ` · ${tierName(p.tier)}` : ""}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-5 items-start">
        {/* Section nav */}
        <nav className="bg-white rounded-xl border border-[#E8EDF6] p-2 flex lg:flex-col gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-semibold whitespace-nowrap text-left"
              style={{ background: tab === t.id ? "#EEF2FF" : "transparent", color: tab === t.id ? "#4361EE" : "#6B7280" }}>
              <t.icon className="w-4 h-4" /> {t.label}
              {t.id === "bank" && !data.bankAccount && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#EF4444]" />}
            </button>
          ))}
        </nav>

        <div className="bg-white rounded-xl border border-[#E8EDF6] p-5 md:p-6 space-y-5 max-w-2xl">
          {msg && (
            <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-lg text-[13px]"
              style={{ background: msg.ok ? "#ECFDF5" : "#FEF2F2", color: msg.ok ? "#047857" : "#B91C1C" }}>
              {msg.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />} {msg.text}
            </div>
          )}

          {tab === "account" && (
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); save("personal", account); }}>
              <h2 className="text-[16px] font-bold text-[#0C1220]">Account</h2>
              <div>
                <label htmlFor="pf-name" className={label}>Full name</label>
                <input id="pf-name" value={account.name} onChange={e => setAccount(a => ({ ...a, name: e.target.value }))} className={input} />
              </div>
              <div>
                <label htmlFor="pf-email" className={label}>Email</label>
                <input id="pf-email" value={data.email} disabled className={input} />
                <p className="text-[11.5px] text-[#9CA3AF] mt-1">Your login email. To change it, message the AXQEN team.</p>
              </div>
              <div>
                <label htmlFor="pf-phone" className={label}>Mobile number</label>
                <div className="flex items-center border border-[#E8EDF6] rounded-lg overflow-hidden focus-within:border-[#4361EE]">
                  <span className="px-3 py-2.5 text-[13.5px] text-[#6B7280] bg-[#FAFBFF] border-r border-[#E8EDF6]">+91</span>
                  <input id="pf-phone" inputMode="numeric" maxLength={10} value={account.phone} onChange={e => setAccount(a => ({ ...a, phone: e.target.value.replace(/\D/g, "") }))}
                    className="flex-1 px-3 py-2.5 text-[13.5px] outline-none" />
                </div>
              </div>
              <button type="submit" disabled={saving} className={saveBtn}>{saving && <Loader2 className="w-4 h-4 animate-spin" />} Save</button>
            </form>
          )}

          {tab === "business" && (
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); save("business", business); }}>
              <h2 className="text-[16px] font-bold text-[#0C1220]">Business</h2>
              <div className="rounded-lg px-3.5 py-3 flex items-start gap-2.5" style={{ background: kyc.bg }}>
                <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: kyc.color }} />
                <div className="text-[12.5px]">
                  <p className="font-bold" style={{ color: kyc.color }}>Verification: {kyc.label}</p>
                  <p className="text-[#374151] mt-0.5">{kyc.note}</p>
                </div>
                {(data.kycStatus === "REJECTED" || data.kycStatus === "NOT_SUBMITTED") && (
                  <a href={`${WA_LINK}?text=${encodeURIComponent("Hi AXQEN team, I want to complete my business verification.")}`} target="_blank" rel="noopener noreferrer"
                    className="ml-auto text-[12px] font-bold text-[#047857] whitespace-nowrap self-center">WhatsApp us</a>
                )}
              </div>
              <div>
                <label htmlFor="pf-brand" className={label}>Brand / business name</label>
                <input id="pf-brand" value={business.brandName} onChange={e => setBusiness(b => ({ ...b, brandName: e.target.value }))} className={input} />
              </div>
              <div>
                <label htmlFor="pf-gst" className={label}>GST number <span className="font-normal text-[#9CA3AF]">(optional)</span></label>
                <input id="pf-gst" value={business.gst} maxLength={15} placeholder="e.g. 09ABCDE1234F1Z5"
                  onChange={e => setBusiness(b => ({ ...b, gst: e.target.value.toUpperCase().replace(/\s/g, "") }))} className={`${input} font-mono`} />
              </div>
              <button type="submit" disabled={saving} className={saveBtn}>{saving && <Loader2 className="w-4 h-4 animate-spin" />} Save</button>
            </form>
          )}

          {tab === "bank" && (
            <div className="space-y-4">
              <h2 className="text-[16px] font-bold text-[#0C1220]">Payout bank account</h2>
              <p className="text-[12.5px] text-[#6B7280]">Your AXQEN payouts are sent here. For your safety, changing it needs your password, and we email you every time it changes.</p>

              {data.bankAccount && !editingBank ? (
                <div className="rounded-xl border border-[#E8EDF6] p-4 flex items-center gap-4 flex-wrap">
                  <span className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center"><Landmark className="w-5 h-5 text-[#4361EE]" /></span>
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-[14px] font-bold text-[#0C1220]">{data.bankHolder}</p>
                    <p className="text-[12.5px] font-mono text-[#6B7280]">••••{data.bankAccount.slice(-4)} · {data.bankIfsc}{data.bankName ? ` · ${data.bankName}` : ""}</p>
                  </div>
                  <button onClick={() => { setEditingBank(true); setBank({ accountHolder: data.bankHolder ?? "", accountNumber: "", confirmAccountNumber: "", ifsc: data.bankIfsc ?? "", bankName: data.bankName ?? "", currentPassword: "" }); }}
                    className="px-3.5 py-2 rounded-lg text-[13px] font-semibold bg-white border border-[#E8EDF6] text-[#374151] hover:text-[#0C1220]">Change</button>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={e => { e.preventDefault(); save("bank", bank, () => setEditingBank(false)); }}>
                  {!data.bankAccount && (
                    <p className="text-[12.5px] text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2">No bank account yet. Add one so we can send your payouts.</p>
                  )}
                  <div>
                    <label htmlFor="bk-holder" className={label}>Account holder name</label>
                    <input id="bk-holder" value={bank.accountHolder} onChange={e => setBank(b => ({ ...b, accountHolder: e.target.value }))} className={input} placeholder="As printed on your passbook" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="bk-acc" className={label}>Account number</label>
                      <input id="bk-acc" inputMode="numeric" autoComplete="off" value={bank.accountNumber} onChange={e => setBank(b => ({ ...b, accountNumber: e.target.value.replace(/\D/g, "") }))} className={`${input} font-mono`} />
                    </div>
                    <div>
                      <label htmlFor="bk-acc2" className={label}>Re-enter account number</label>
                      <input id="bk-acc2" inputMode="numeric" autoComplete="off" value={bank.confirmAccountNumber} onPaste={e => e.preventDefault()}
                        onChange={e => setBank(b => ({ ...b, confirmAccountNumber: e.target.value.replace(/\D/g, "") }))} className={`${input} font-mono`} />
                      {bank.confirmAccountNumber && bank.confirmAccountNumber !== bank.accountNumber && <p className="text-[11.5px] text-[#DC2626] mt-1">Doesn&apos;t match yet</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="bk-ifsc" className={label}>IFSC</label>
                      <input id="bk-ifsc" maxLength={11} value={bank.ifsc} placeholder="HDFC0001234"
                        onChange={e => setBank(b => ({ ...b, ifsc: e.target.value.toUpperCase().replace(/\s/g, "") }))} className={`${input} font-mono`} />
                    </div>
                    <div>
                      <label htmlFor="bk-name" className={label}>Bank name</label>
                      <input id="bk-name" value={bank.bankName} onChange={e => setBank(b => ({ ...b, bankName: e.target.value }))} className={input} />
                    </div>
                  </div>
                  <div className="border-t border-[#F3F4F6] pt-4">
                    <label htmlFor="bk-pw" className={label}>Your AXQEN password</label>
                    <input id="bk-pw" type="password" autoComplete="current-password" value={bank.currentPassword} onChange={e => setBank(b => ({ ...b, currentPassword: e.target.value }))} className={input} />
                    <p className="text-[11.5px] text-[#9CA3AF] mt-1">Needed to confirm it's really you. We'll email you and alert the AXQEN team about this change.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="submit" disabled={saving || !bank.currentPassword} className={saveBtn}>{saving && <Loader2 className="w-4 h-4 animate-spin" />} Save bank account</button>
                    {data.bankAccount && <button type="button" onClick={() => setEditingBank(false)} className="px-4 py-2.5 rounded-lg text-[13px] font-semibold text-[#6B7280] hover:bg-[#F3F4F6]">Cancel</button>}
                  </div>
                </form>
              )}
              <Link href="/seller/wallet" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#4361EE]">See your payouts <ExternalLink className="w-3.5 h-3.5" /></Link>
            </div>
          )}

          {tab === "plan" && (
            <div className="space-y-4">
              <h2 className="text-[16px] font-bold text-[#0C1220]">Plan</h2>
              {p.plan ? (
                <div className="rounded-xl border border-[#E8EDF6] divide-y divide-[#F3F4F6]">
                  {[
                    ["Plan", `${PLAN_NAME[p.plan]}${p.plan === "DROPSHIPPING" && p.tier ? ` · ${tierName(p.tier)}` : ""}`],
                    ["Price", p.price != null ? `₹${p.price.toLocaleString("en-IN")}${p.plan === "MARKETPLACE" ? " for 3 months" : ""}` : "—"],
                    ["Account", p.accountStatus === "ACTIVE" ? "Active" : p.accountStatus === "PENDING" ? "Waiting for activation" : "Suspended"],
                    ["Member since", new Date(p.memberSince).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between px-4 py-3 text-[13px]">
                      <span className="text-[#6B7280]">{k}</span>
                      <span className="font-semibold text-[#0C1220]">{v}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-3 text-[13px]">
                    <span className="text-[#6B7280]">Payment</span>
                    {billing && billing.periods.length > 0
                      ? billing.totals.pending > 0
                        ? <span className="font-semibold text-[#DC2626]">₹{Math.round(billing.totals.pending).toLocaleString("en-IN")} pending</span>
                        : <span className="font-semibold text-[#047857] flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Fully paid</span>
                      : p.paymentConfirmed
                        ? <span className="font-semibold text-[#047857] flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Received</span>
                        : <span className="font-semibold text-[#9CA3AF] flex items-center gap-1.5"><Clock className="w-4 h-4" /> Not recorded yet</span>}
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-[#6B7280]">No plan on your account yet.</p>
              )}
              <PlanDueNotice billing={billing} compact />
              <Link href="/seller/documents" className="inline-flex text-[12.5px] font-semibold text-[#4361EE]">See every payment in Documents &amp; Invoices →</Link>
              <a href={`${WA_LINK}?text=${encodeURIComponent("Hi AXQEN team, I have a question about my plan.")}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-bold text-white bg-[#16A34A]">
                <MessageCircle className="w-4 h-4" /> Renew, upgrade or ask about your plan
              </a>
            </div>
          )}

          {tab === "connections" && (
            <div className="space-y-4">
              <h2 className="text-[16px] font-bold text-[#0C1220]">Connections</h2>
              <ul className="rounded-xl border border-[#E8EDF6] divide-y divide-[#F3F4F6]">
                {[
                  {
                    icon: Store, color: "#16A34A", name: "Shopify",
                    status: data.connections.shopify ? (data.connections.shopify.problem ? "Connection problem" : `Connected · ${data.connections.shopify.name}`) : "Not connected",
                    tone: data.connections.shopify ? (data.connections.shopify.problem ? "warn" : "ok") : "off",
                    href: "/seller/shopify", cta: data.connections.shopify ? "Manage" : "Connect",
                  },
                  {
                    icon: ShoppingBag, color: "#EA580C", name: "Amazon",
                    status: data.connections.amazon ? "Connected" : "Not connected",
                    tone: data.connections.amazon ? "ok" : "off", href: "/seller/amazon", cta: data.connections.amazon ? "Manage" : "Learn more",
                  },
                  {
                    icon: Megaphone, color: "#4361EE", name: "Meta ads",
                    status: data.connections.meta ? "Managed by the AXQEN ads team" : "Linked by the AXQEN ads team when your ads start",
                    tone: data.connections.meta ? "ok" : "off", href: "/seller/meta-ads", cta: "Ad Spend",
                  },
                ].map(c => (
                  <li key={c.name} className="flex items-center gap-3 px-4 py-3.5">
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#F5F7FB]"><c.icon className="w-4 h-4" style={{ color: c.color }} /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-semibold text-[#0C1220]">{c.name}</p>
                      <p className="text-[12px] truncate" style={{ color: c.tone === "ok" ? "#047857" : c.tone === "warn" ? "#B45309" : "#9CA3AF" }}>{c.status}</p>
                    </div>
                    <Link href={c.href} className="px-3 py-1.5 rounded-lg text-[12.5px] font-semibold bg-white border border-[#E8EDF6] text-[#374151] hover:text-[#4361EE]">{c.cta}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === "password" && (
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); save("password", pw, () => setPw({ current: "", newPass: "", confirm: "" })); }}>
              <h2 className="text-[16px] font-bold text-[#0C1220]">Password</h2>
              {([["current", "Current password", "current-password"], ["newPass", "New password", "new-password"], ["confirm", "Confirm new password", "new-password"]] as const).map(([k, l, ac]) => (
                <div key={k}>
                  <label htmlFor={`pw-${k}`} className={label}>{l}</label>
                  <input id={`pw-${k}`} type="password" autoComplete={ac} value={pw[k]} onChange={e => setPw(x => ({ ...x, [k]: e.target.value }))} className={input} />
                </div>
              ))}
              <p className="text-[11.5px] text-[#9CA3AF]">At least 8 characters. A mix of letters, numbers and a symbol is safest.</p>
              <button type="submit" disabled={saving || !pw.current || !pw.newPass} className={saveBtn}>{saving && <Loader2 className="w-4 h-4 animate-spin" />} Change password</button>
            </form>
          )}

          {tab === "delete" && <DeleteAccountPanel email={data.email} />}
        </div>
      </div>
    </div>
  );
}
