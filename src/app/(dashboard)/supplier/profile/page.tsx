"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { User, Mail, Phone, Building2, FileText, CreditCard, Lock, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";

const TABS = [
  { id: "personal", label: "Personal Info",    icon: User },
  { id: "business", label: "Business Details", icon: Building2 },
  { id: "bank",     label: "Bank Details",     icon: CreditCard },
  { id: "password", label: "Password",         icon: Lock },
];

export default function SupplierProfilePage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState("personal");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [personal, setPersonal] = useState({ name: "", email: "", phone: "" });
  const [business, setBusiness] = useState({ brandName: "", gst: "" });
  const [bank, setBank] = useState({ accountHolder: "", accountNumber: "", ifsc: "", bankName: "" });
  const [passwords, setPasswords] = useState({ current: "", newPass: "", confirm: "" });

  useEffect(() => {
    fetch("/api/supplier/profile").then((r) => r.json()).then((d) => {
      if (d.user) {
        setPersonal({ name: d.user.name ?? "", email: d.user.email ?? "", phone: d.user.phone ?? "" });
        setBusiness({ brandName: d.user.brandName ?? "", gst: d.user.gstNumber ?? "" });
        setBank({ accountHolder: d.user.bankHolder ?? "", accountNumber: d.user.bankAccount ?? "", ifsc: d.user.bankIfsc ?? "", bankName: d.user.bankName ?? "" });
      }
    });
  }, []);

  async function handleSave() {
    setSaving(true); setError(""); setSaved(false);
    let body: Record<string, unknown> = {};
    if (activeTab === "personal") body = { type: "personal", ...personal };
    else if (activeTab === "business") body = { type: "business", ...business };
    else if (activeTab === "bank") body = { type: "bank", ...bank };
    else if (activeTab === "password") body = { type: "password", ...passwords };

    const res = await fetch("/api/supplier/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      setSaved(true);
      if (activeTab === "password") setPasswords({ current: "", newPass: "", confirm: "" });
      setTimeout(() => setSaved(false), 3000);
    } else {
      setError(data.error || "Failed to save");
    }
    setSaving(false);
  }

  const initial = (session?.user?.name?.[0] ?? "S").toUpperCase();

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page)" }}>
      <PageHero title="My Profile" subtitle="Manage your personal, business and bank details" />

      <div className="px-4 md:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Left — avatar + tabs */}
          <div className="space-y-4">
            <div className="card p-5 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-3xl font-bold mb-3"
                style={{ background: "var(--bg-sidebar)" }}>
                {initial}
              </div>
              <p className="font-semibold text-sm" style={{ color: "var(--text-900)" }}>{session?.user?.name}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-400)" }}>{session?.user?.email}</p>
              <span className="mt-2 px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: "#F0FDF4", color: "var(--green-500)" }}>Supplier</span>
            </div>

            <div className="card overflow-hidden">
              {TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <button key={t.id} onClick={() => { setActiveTab(t.id); setError(""); setSaved(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left"
                    style={{
                      background: activeTab === t.id ? "rgba(13,31,19,0.05)" : "transparent",
                      color: activeTab === t.id ? "var(--bg-sidebar)" : "var(--text-400)",
                      borderLeft: activeTab === t.id ? "3px solid var(--green-500)" : "3px solid transparent",
                    }}>
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right — form */}
          <div className="md:col-span-3 card p-6">
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm mb-4"
                style={{ background: "#FEF2F2", color: "#EF4444", border: "1px solid #FEE2E2" }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            {activeTab === "personal" && (
              <div className="space-y-5">
                <h2 className="text-base font-semibold" style={{ color: "var(--text-900)" }}>Personal Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field icon={User} label="Full Name" value={personal.name} onChange={v => setPersonal(p => ({ ...p, name: v }))} />
                  <Field icon={Mail} label="Email Address" value={personal.email} onChange={() => {}} type="email" disabled />
                  <Field icon={Phone} label="Phone Number" value={personal.phone} onChange={v => setPersonal(p => ({ ...p, phone: v }))} type="tel" />
                </div>
              </div>
            )}

            {activeTab === "business" && (
              <div className="space-y-5">
                <h2 className="text-base font-semibold" style={{ color: "var(--text-900)" }}>Business Details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field icon={Building2} label="Brand / Business Name" value={business.brandName} onChange={v => setBusiness(p => ({ ...p, brandName: v }))} />
                  <Field icon={FileText} label="GST Number (optional)" value={business.gst} onChange={v => setBusiness(p => ({ ...p, gst: v }))} />
                </div>
              </div>
            )}

            {activeTab === "bank" && (
              <div className="space-y-5">
                <h2 className="text-base font-semibold" style={{ color: "var(--text-900)" }}>Bank Details</h2>
                <p className="text-xs" style={{ color: "var(--text-400)" }}>Your bank details for remittances from AXQEN</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field icon={User} label="Account Holder Name" value={bank.accountHolder} onChange={v => setBank(p => ({ ...p, accountHolder: v }))} />
                  <Field icon={CreditCard} label="Account Number" value={bank.accountNumber} onChange={v => setBank(p => ({ ...p, accountNumber: v }))} />
                  <Field icon={Building2} label="IFSC Code" value={bank.ifsc} onChange={v => setBank(p => ({ ...p, ifsc: v }))} />
                  <Field icon={Building2} label="Bank Name" value={bank.bankName} onChange={v => setBank(p => ({ ...p, bankName: v }))} />
                </div>
              </div>
            )}

            {activeTab === "password" && (
              <div className="space-y-5">
                <h2 className="text-base font-semibold" style={{ color: "var(--text-900)" }}>Change Password</h2>
                <div className="grid grid-cols-1 gap-4 max-w-sm">
                  <Field icon={Lock} label="Current Password" value={passwords.current} onChange={v => setPasswords(p => ({ ...p, current: v }))} type="password" />
                  <Field icon={Lock} label="New Password" value={passwords.newPass} onChange={v => setPasswords(p => ({ ...p, newPass: v }))} type="password" />
                  <Field icon={Lock} label="Confirm New Password" value={passwords.confirm} onChange={v => setPasswords(p => ({ ...p, confirm: v }))} type="password" />
                </div>
              </div>
            )}

            <div className="mt-6 pt-5 flex items-center gap-3" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-60"
                style={{ background: saved ? "#16A34A" : "var(--green-500)" }}>
                {saved ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : saving ? "Saving..." : <><Save className="w-4 h-4" /> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, value, onChange, type = "text", disabled = false }: {
  icon: React.ElementType; label: string; value: string;
  onChange: (v: string) => void; type?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-600)" }}>{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-400)" }} />
        <input type={type} value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ border: "1px solid var(--border)", background: disabled ? "#F9FAFB" : "white", color: "var(--text-900)" }}
          onFocus={e => { if (!disabled) e.currentTarget.style.border = "1px solid var(--green-500)"; }}
          onBlur={e => { e.currentTarget.style.border = "1px solid var(--border)"; }}
        />
      </div>
    </div>
  );
}
