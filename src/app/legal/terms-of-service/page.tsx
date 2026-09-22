import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — AXQEN",
  description: "Terms and conditions for using the AXQEN platform.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: July 22, 2026</p>

        <section className="space-y-8 text-gray-700 text-sm leading-7">

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Acceptance of Terms</h2>
            <p>By accessing or using the AXQEN platform (&quot;Service&quot;) at <strong>axqen.app</strong>, you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Description of Service</h2>
            <p>AXQEN provides a dropshipping SaaS platform connecting sellers with suppliers. The platform includes order management, inventory, delivery tracking, wallet and remittance management, and advertising performance tools.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Eligibility</h2>
            <p>You must be at least 18 years old and capable of entering into a legally binding contract to use this Service. By using the Service, you represent that you meet these requirements.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Account Responsibilities</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
              <li>You must notify us immediately of any unauthorized use of your account.</li>
              <li>You may not share your account credentials with any third party.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Subscription and Payments</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access to the platform requires an active paid subscription.</li>
              <li>Subscription fees are charged in advance and are non-refundable unless required by law.</li>
              <li>We reserve the right to modify pricing with 30 days notice.</li>
              <li>Failure to pay may result in suspension or termination of your account.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Seller Obligations</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You must only list and sell products that are legal in India.</li>
              <li>You are responsible for accurate product descriptions and pricing on your storefront.</li>
              <li>You must not engage in fraudulent orders, returns abuse, or misrepresentation.</li>
              <li>You are responsible for customer-facing communications on your own Shopify store.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Meta Ads Integration</h2>
            <p>When you connect your Meta Ads account, you authorize AXQEN to access your ad spend data via the Meta Marketing API. This access is read-only. You can revoke this access at any time from your account settings or directly from your Meta Business settings.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Intellectual Property</h2>
            <p>All content, branding, and software on the platform is the property of AXQEN. You may not copy, reproduce, or distribute any part of the platform without written permission.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, AXQEN is not liable for any indirect, incidental, or consequential damages arising from your use of the Service. Our total liability to you shall not exceed the fees paid by you in the last 3 months.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Termination</h2>
            <p>We reserve the right to suspend or terminate your account at any time for violation of these terms or for any other reason with reasonable notice. You may cancel your account at any time by contacting us.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">11. Governing Law</h2>
            <p>These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts of India.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">12. Contact</h2>
            <p>For any questions about these Terms, contact us at:<br />
            <strong>AXQEN</strong><br />
            Email: <a href="mailto:vrinandyaventures@gmail.com" className="text-blue-600 underline">vrinandyaventures@gmail.com</a>
            </p>
          </div>

        </section>
      </div>
    </div>
  );
}
