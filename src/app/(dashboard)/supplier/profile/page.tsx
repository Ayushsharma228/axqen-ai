"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { User, Mail, Phone, Building2, FileText, CreditCard, Lock, Save, CheckCircle2, AlertCircle, Truck, Plus, Trash2, X, Loader2, ExternalLink, Info } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";

const TABS = [
  { id: "personal", label: "Personal Info",    icon: User },
  { id: "business", label: "Business Details", icon: Building2 },
  { id: "bank",     label: "Bank Details",     icon: CreditCard },
  { id: "shipping", label: "Shipping",         icon: Truck },
  { id: "password", label: "Password",         icon: Lock },
];

const PROVIDER_HELP: Record<string, {
  steps: string[];
  link: string;
  linkLabel: string;
  fields: { key: string; label: string; hint: string; type?: string }[];
}> = {
  SHIPROCKET: {
    steps: [
      "Log in to your Shiprocket account at app.shiprocket.in",
      "Use the same email and password you use to log in — no extra API key needed",
      "AXQEN will authenticate on your behalf each time a shipment is created",
    ],
    link: "https://app.shiprocket.in",
    linkLabel: "Open Shiprocket",
    fields: [
      { key: "apiKey",    label: "Email",    hint: "Your Shiprocket login email (e.g. you@company.com)", type: "text" },
      { key: "apiSecret", label: "Password", hint: "Your Shiprocket login password",                     type: "password" },
    ],
  },
  DELHIVERY: {
    steps: [
      "Log in to your Delhivery dashboard at one.delhivery.com",
      "Go to Settings → Warehouses → add a warehouse if not already added",
      "Copy the exact Warehouse Name (e.g. 'Main Warehouse') — you'll need it below",
      "Go to Settings → API Integration and copy your API Token",
    ],
    link: "https://one.delhivery.com",
    linkLabel: "Open Delhivery",
    fields: [
      { key: "apiKey",  label: "API Token",             hint: "Found in Delhivery → Settings → API Integration",                              type: "text" },
      { key: "baseUrl", label: "Pickup Location Name",  hint: "Exact warehouse name from Delhivery → Settings → Warehouses (e.g. Main Warehouse)", type: "text" },
    ],
  },
  CUSTOM: {
    steps: [
      "Get the API key (Bearer token) from your shipping panel's developer/API settings",
      "Get the POST endpoint URL that accepts shipment creation requests",
      "Your API must return a JSON response containing an 'awb' field (e.g. { awb: '12345' })",
    ],
    link: "",
    linkLabel: "",
    fields: [
      { key: "apiKey",  label: "API Key",           hint: "Bearer token / API key from your shipping panel's developer settings", type: "text" },
      { key: "baseUrl", label: "API Endpoint URL",  hint: "Full POST URL — e.g. https://api.yourshipping.com/v1/create-shipment",  type: "text" },
    ],
  },
};

const PROVIDERS = [
  { value: "SHIPROCKET", label: "Shiprocket" },
  { value: "CUSTOM",     label: "Custom API" },
];

type ShippingProvider = { id: string; provider: string; label: string; apiKey: string | null; baseUrl: string | null; isActive: boolean };

function ShippingTab() {
  const [providers, setProviders]   = useState<ShippingProvider[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showAdd, setShowAdd]       = useState(false);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [toggling, setToggling]     = useState<string | null>(null);
  const [addError, setAddError]     = useState("");
  const [adding, setAdding]         = useState(false);
  const [form, setForm]             = useState({ provider: "SHIPROCKET", label: "", apiKey: "", apiSecret: "", baseUrl: "" });

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/supplier/shipping-providers");
    const d = await res.json();
    setProviders(d.providers ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(""); setAdding(true);
    const res = await fetch("/api/supplier/shipping-providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    if (!res.ok) { setAddError(d.error || "Failed"); setAdding(false); return; }
    setShowAdd(false);
    setForm({ provider: "SHIPROCKET", label: "", apiKey: "", apiSecret: "", baseUrl: "" });
    await fetchProviders();
    setAdding(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this shipping provider?")) return;
    setDeleting(id);
    await fetch("/api/supplier/shipping-providers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    await fetchProviders();
    setDeleting(null);
  }

  async function handleToggle(p: ShippingProvider) {
    setToggling(p.id);
    await fetch("/api/supplier/shipping-providers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, isActive: !p.isActive }) });
    await fetchProviders();
    setToggling(null);
  }

  const selectedProviderDef = PROVIDERS.find((p) => p.value === form.provider);
  const selectedHelp = PROVIDER_HELP[form.provider];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-900)" }}>Connected Shipping Accounts</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-400)" }}>When dispatching, AXQEN will call your shipping provider's API to auto-create the shipment and fetch the AWB.</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "var(--green-500)" }}>
          <Plus className="w-4 h-4" /> Add Provider
        </button>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-300)" }} /></div>
      ) : providers.length === 0 ? (
        <div className="border-2 border-dashed rounded-2xl py-12 flex flex-col items-center gap-3 text-center px-6"
          style={{ borderColor: "var(--border)" }}>
          <Truck className="w-10 h-10" style={{ color: "var(--border)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-600)" }}>No shipping accounts connected</p>
          <p className="text-xs" style={{ color: "var(--text-400)" }}>Add Shiprocket, Delhivery, or your own shipping API to auto-generate AWBs when dispatching.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-5 py-4 rounded-2xl"
              style={{ border: "1px solid var(--border)", background: p.isActive ? "white" : "#FAFAFA" }}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: p.isActive ? "#F0FDF4" : "#F3F4F6" }}>
                  <Truck className="w-5 h-5" style={{ color: p.isActive ? "#16A34A" : "#9CA3AF" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-900)" }}>{p.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-400)" }}>
                    {p.provider}{p.apiKey ? ` · Key: ${p.apiKey}` : ""}
                    {p.baseUrl ? ` · ${p.baseUrl}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleToggle(p)} disabled={toggling === p.id}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: p.isActive ? "#FFF7ED" : "#F0FDF4", color: p.isActive ? "#D97706" : "#16A34A" }}>
                  {toggling === p.id ? "..." : p.isActive ? "Disable" : "Enable"}
                </button>
                <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                  className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                  {deleting === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Provider Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 flex items-center justify-between border-b">
              <h3 className="font-semibold text-gray-900">Add Shipping Provider</h3>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleAdd} className="px-6 py-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {addError && <div className="px-4 py-3 rounded-xl text-sm bg-red-50 text-red-600 border border-red-100">{addError}</div>}

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Provider Type</label>
                <select value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value, apiKey: "", apiSecret: "", baseUrl: "", label: "" }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 bg-white">
                  {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>

              {/* How to get credentials — help box */}
              {selectedHelp && (
                <div className="p-4 rounded-xl space-y-2.5" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                  <div className="flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-green-700 flex-shrink-0" />
                    <p className="text-xs font-semibold text-green-800">Where to find your credentials</p>
                  </div>
                  <ol className="space-y-1 pl-1">
                    {selectedHelp.steps.map((step, i) => (
                      <li key={i} className="flex gap-2 text-xs text-green-800">
                        <span className="font-bold flex-shrink-0">{i + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                  {selectedHelp.link && (
                    <a href={selectedHelp.link} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 underline mt-1">
                      {selectedHelp.linkLabel} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Display Name</label>
                <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} required
                  placeholder={`e.g. My ${selectedProviderDef?.label} Account`}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400" />
                <p className="text-xs text-gray-400 mt-1">A name to identify this account in AXQEN (only visible to you)</p>
              </div>

              {selectedHelp?.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">{field.label}</label>
                  <input
                    type={field.type ?? "text"}
                    value={form[field.key as keyof typeof form]}
                    onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                    placeholder={field.label}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                  <p className="text-xs text-gray-400 mt-1">{field.hint}</p>
                </div>
              ))}

              {form.provider === "CUSTOM" && (
                <div className="p-3 rounded-xl text-xs text-gray-500 space-y-1" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                  <p className="font-semibold text-gray-600">Expected response format from your API:</p>
                  <code className="block bg-gray-100 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 whitespace-pre">{`{ "awb": "TRACK123456" }`}</code>
                  <p>Optional fields: <code className="bg-gray-100 px-1 rounded">courier</code>, <code className="bg-gray-100 px-1 rounded">tracking_url</code></p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdd(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={adding}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
                  style={{ background: "var(--green-500)" }}>
                  {adding ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Plus className="w-4 h-4" /> Connect</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

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

            {activeTab === "shipping" && <ShippingTab />}

            {activeTab !== "shipping" && (
              <div className="mt-6 pt-5 flex items-center gap-3" style={{ borderTop: "1px solid var(--border)" }}>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-60"
                  style={{ background: saved ? "#16A34A" : "var(--green-500)" }}>
                  {saved ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : saving ? "Saving..." : <><Save className="w-4 h-4" /> Save Changes</>}
                </button>
              </div>
            )}
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
