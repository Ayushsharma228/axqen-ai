import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Deletion — AXQEN",
  description: "Request deletion of your data from AXQEN.",
};

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Deletion Request</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: August 7, 2026</p>

        <div className="space-y-6 text-gray-700 text-sm leading-7">

          {/* Whole account (App Store / Play Store requirement) */}
          <div id="account" className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3">
            <h2 className="text-base font-semibold text-gray-900">Delete your AXQEN account</h2>
            <p><strong>In the app or on the website:</strong> log in → Profile &amp; Settings → <a href="/seller/profile?tab=delete" className="text-blue-600 underline">Delete account</a>. Confirm with your password and type DELETE.</p>
            <p><strong>By email:</strong> write to <a href="mailto:connect@vrinandyaventures.in" className="text-blue-600 underline">connect@vrinandyaventures.in</a> from your registered email with the subject <strong>&quot;Account Deletion Request&quot;</strong>.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>We settle any pending payouts, then close the account within 7 working days and email you when it&apos;s done.</li>
              <li>Deleted: your login, profile, bank details, KYC documents, store connections and access tokens.</li>
              <li>Kept: orders, tax invoices and payment records, for as long as Indian tax law requires (up to 8 years). They are not used for anything else.</li>
            </ul>
          </div>

          <p>If you have connected your Amazon Seller Central or Meta Ads account to AXQEN and would like us to delete only that data, use the options below.</p>

          {/* Amazon */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3">
            <h2 className="text-base font-semibold text-gray-900">Amazon Seller Central — data we hold</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your encrypted OAuth refresh token (used to call Amazon SP-API on your behalf)</li>
              <li>Your Amazon Selling Partner ID</li>
              <li>Order and listing data synced from your Amazon account (displayed in your dashboard only)</li>
            </ul>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3">
            <h2 className="text-base font-semibold text-gray-900">How to delete Amazon data</h2>
            <p><strong>Option 1 — From your dashboard (instant):</strong><br />
            Log in to <a href="https://axqen.app" className="text-blue-600 underline">axqen.app</a> → Amazon Seller Central → Disconnect. This immediately deletes your refresh token and stops all SP-API calls.
            </p>
            <p><strong>Option 2 — Revoke from Amazon directly:</strong><br />
            Log in to Seller Central → Apps &amp; Services → Manage Your Apps → find AXQEN → Revoke access. Amazon will also notify us to stop using the token.
            </p>
            <p><strong>Option 3 — Email us:</strong><br />
            Send an email to <a href="mailto:connect@vrinandyaventures.in" className="text-blue-600 underline">connect@vrinandyaventures.in</a> with subject <strong>&quot;Amazon Data Deletion Request&quot;</strong> and your registered email. We will process within 7 business days.
            </p>
          </div>

          {/* Meta */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3">
            <h2 className="text-base font-semibold text-gray-900">Meta Ads — data we hold</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your Meta access token (used to fetch ad spend data)</li>
              <li>Your Meta Ad Account ID</li>
              <li>Ad spend records synced from your Meta account</li>
            </ul>
            <p><strong>To delete:</strong> Dashboard → Settings → Connected Accounts → Disconnect Meta Ads (instant), or email us as above with subject <strong>&quot;Meta Data Deletion Request&quot;</strong>.</p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-2">What happens after deletion</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your access tokens are permanently deleted from our systems.</li>
              <li>Synced data associated with the disconnected account is removed.</li>
              <li>We send a confirmation email once deletion is complete.</li>
              <li>Deletion is irreversible — reconnect your account to resume syncing.</li>
            </ul>
          </div>

          <p className="text-xs text-gray-400">
            For general account deletion or other data requests, see our <a href="/legal/privacy" className="text-blue-600 underline">Privacy Policy</a>.
          </p>

        </div>
      </div>
    </div>
  );
}
