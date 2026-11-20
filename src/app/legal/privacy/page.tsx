import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — AXQEN",
  description: "How AXQEN, operated by Vrinandya Ventures Private Limited, collects, uses and protects your data.",
};

const EMAIL = "connect@vrinandyaventures.in";
const Mail = () => <a href={`mailto:${EMAIL}`} className="text-blue-600 underline">{EMAIL}</a>;

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: November 20, 2026</p>

        <section className="space-y-8 text-gray-700 text-sm leading-7">

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Who We Are</h2>
            <p>AXQEN (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is an e-commerce operations platform at <strong>axqen.app</strong> that provides order management, fulfilment, shipping, COD remittance and payout services to online sellers in India. AXQEN is owned and operated by:</p>
            <p className="mt-2 bg-gray-50 border border-gray-200 rounded-xl p-4">
              <strong>Vrinandya Ventures Private Limited</strong><br />
              Registered office: 4/210 Unt Gali, Kacheri Ghat, Taj Nagari, Agra – 282004, Uttar Pradesh, India<br />
              CIN: U63112UP2025PTC239392 · GSTIN: 09AALCV7054P1ZD<br />
              Email: <Mail /> · Phone: +91 70604 01016
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account information:</strong> name, email address, phone number and business details you give us at signup.</li>
              <li><strong>Seller verification (KYC):</strong> identity details needed to verify you before payouts, such as your name, date of birth, address, PAN, GSTIN and payout bank account. See section 4.</li>
              <li><strong>Order data:</strong> your customers&apos; names, delivery addresses, phone numbers, order values and product details synced from your connected stores, used only to fulfil and track those orders.</li>
              <li><strong>Payment data:</strong> transaction records, remittance history and wallet balances. We do not store card numbers.</li>
              <li><strong>Advertising data:</strong> if you connect Meta Ads, your ad spend data, using permissions you grant.</li>
              <li><strong>Usage data:</strong> pages visited, actions taken, browser type and IP address, for security and to improve the platform.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To run the platform: process orders, book shipments, track deliveries and settle remittances and payouts.</li>
              <li>To verify sellers (KYC) before releasing payouts.</li>
              <li>To show your sales, ad spend and profit on your dashboard.</li>
              <li>To send emails and WhatsApp messages about your orders, tickets and account.</li>
              <li>To meet legal, tax and accounting obligations.</li>
            </ul>
          </div>

          <div id="kyc">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Seller Verification, Aadhaar and DigiLocker</h2>
            <p>Before a seller can receive payouts, we verify their identity. With your explicit consent, we may fetch your Aadhaar (e-Aadhaar) and PAN from <strong>DigiLocker</strong>, the Government of India&apos;s digital document platform. You sign in to DigiLocker yourself and choose to share; we never see your DigiLocker password or OTP.</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>What we keep:</strong> your verified name, date of birth, gender, address, photo, the <strong>last 4 digits</strong> of your Aadhaar number, your PAN details, and a record of your consent and when verification happened.</li>
              <li><strong>What we do not keep:</strong> your full Aadhaar number or copies of your Aadhaar or DigiLocker documents.</li>
              <li><strong>How we use it:</strong> only to verify your identity, match it with your bank account and GST details, and meet payout compliance. It is not used for marketing, not sold and not shared with anyone except as required by law.</li>
              <li><strong>Your choice:</strong> verification is needed to receive payouts. You can withdraw consent by closing your account (section 9).</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Amazon Seller Central Integration</h2>
            <p>If you connect your Amazon Seller Central account, we access your seller data via the <strong>Amazon Selling Partner API (SP-API)</strong> using OAuth 2.0 authorization that you explicitly grant. The data we access includes:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Orders:</strong> order IDs, statuses, item details and fulfilment information, used to display and manage your orders on the AXQEN dashboard.</li>
              <li><strong>Listings:</strong> product SKUs, ASINs, titles, prices, quantities and inventory status, used to display your Amazon catalogue and provide AI-powered listing health analysis.</li>
              <li><strong>Reports:</strong> merchant listing reports, used solely to retrieve listing data in bulk.</li>
            </ul>
            <p className="mt-2">We store only your encrypted OAuth refresh token and Selling Partner ID. We do not store order-level customer PII (names, addresses, phone numbers) beyond what is necessary to fulfil and display orders within your account.</p>
            <p className="mt-2">We do not share your Amazon data with any third party, use it to train AI models, or access any data beyond what the features above need.</p>
            <p className="mt-2">You can disconnect your Amazon account at any time from <strong>Dashboard → Amazon Seller Central → Disconnect</strong>. On disconnection we immediately delete your stored refresh token and stop all SP-API calls.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Shopify and Meta Ads Integrations</h2>
            <p><strong>Shopify:</strong> when you connect your store, we read orders and manage products, inventory and fulfilments you push through AXQEN. Access tokens are encrypted. If you uninstall the app, we delete the store connection.</p>
            <p className="mt-2"><strong>Meta Ads:</strong> we request the <strong>ads_read</strong> permission only to show your advertising costs on your dashboard. We do not create, edit or delete ads, and we do not share your Meta data. Disconnecting deletes your stored access token immediately.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Data Sharing</h2>
            <p>We do not sell your personal data. We share it only as needed to provide the service:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Courier and logistics partners</strong> (such as Delhivery and Shipdaak): delivery details needed to ship orders.</li>
              <li><strong>Suppliers and fulfilment partners:</strong> order and delivery details needed to fulfil shipments.</li>
              <li><strong>Communication providers:</strong> to send order and account emails and WhatsApp messages.</li>
              <li><strong>Payment processors:</strong> for online payments where used. We do not store card details.</li>
              <li><strong>Infrastructure providers:</strong> secure cloud hosting and database services that run the platform.</li>
              <li><strong>Government authorities:</strong> when required by law.</li>
            </ul>
            <p className="mt-2">Seller KYC data from DigiLocker is never shared with these partners.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Data Retention</h2>
            <p>We keep your data while your account is active. When your account is closed, we delete your personal data, including KYC details, bank details and store connections, except orders, tax invoices and payment records, which Indian tax law requires us to keep for up to 8 years. Retained records are used for nothing else.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Your Rights and Account Deletion</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access the personal data we hold about you.</li>
              <li>Correct inaccurate data.</li>
              <li>Withdraw consent for any connected integration at any time.</li>
              <li>Delete your account: log in → Profile &amp; Settings → <a href="/seller/profile?tab=delete" className="text-blue-600 underline">Delete account</a>, or see our <a href="/data-deletion" className="text-blue-600 underline">data deletion page</a>. We settle pending payouts and close the account within 7 working days.</li>
            </ul>
            <p className="mt-2">To exercise any of these rights, email <Mail />.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Security</h2>
            <p>All data is sent over HTTPS/TLS. Access tokens, API credentials and sensitive account details are encrypted at rest. Access to seller data is limited to authorised team members who need it for their work, and we review our security regularly.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">11. Cookies</h2>
            <p>We use essential cookies to keep you signed in. Our marketing website uses the Meta Pixel to measure page views. You can disable cookies in your browser settings.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">12. Grievance Officer</h2>
            <p>In line with the Information Technology Act, 2000 and its rules, and the Digital Personal Data Protection Act, 2023, you can contact our Grievance Officer about any privacy concern or complaint:</p>
            <p className="mt-2 bg-gray-50 border border-gray-200 rounded-xl p-4">
              <strong>Ayush Sharma</strong>, Director<br />
              Vrinandya Ventures Private Limited, 4/210 Unt Gali, Kacheri Ghat, Taj Nagari, Agra – 282004, Uttar Pradesh<br />
              Email: <Mail /> · Phone: +91 70604 01016<br />
              We acknowledge complaints within 48 hours and resolve them within 30 days.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">13. Changes to This Policy</h2>
            <p>We may update this policy from time to time and will email you about material changes. The date at the top shows the latest version.</p>
          </div>

        </section>
      </div>
    </div>
  );
}
