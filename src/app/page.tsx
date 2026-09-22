import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import LandingPage from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "AXQEN – Done-For-You COD Dropshipping Platform India | Start Without Inventory",
  description:
    "AXQEN automates your Shopify COD dropshipping business in India. Verified suppliers, Delhivery fulfilment, weekly payouts, and a dedicated account manager — all in one platform.",
  keywords: [
    "COD dropshipping India",
    "dropshipping platform India",
    "Shopify dropshipping India",
    "done for you dropshipping",
    "cash on delivery dropshipping",
    "Indian dropshipping suppliers",
    "weekly payout dropshipping",
  ],
  openGraph: {
    title: "AXQEN – Done-For-You COD Dropshipping Platform India",
    description:
      "Connect your Shopify store, pick verified products, and let our team handle fulfilment, tracking, RTOs, and weekly payouts. You focus on ads.",
    url: "https://axqen.app",
    siteName: "AXQEN",
    locale: "en_IN",
    type: "website",
    // TODO: add real OG image — 1200×630px
    // images: [{ url: "https://axqen.app/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AXQEN – Done-For-You COD Dropshipping Platform India",
    description: "Automate your Shopify COD dropshipping. Verified suppliers, weekly payouts, live tracking — with a human on WhatsApp when you need one.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "https://axqen.app" },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://axqen.app/#organization",
      name: "AXQEN",
      url: "https://axqen.app",
      logo: "https://axqen.app/logo.png", // TODO: add real logo URL
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+91-85339-49379",
        contactType: "customer service",
        availableLanguage: ["English", "Hindi"],
      },
      sameAs: [], // TODO: add social profile URLs
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is COD dropshipping?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "COD dropshipping means you sell products online without holding inventory. When a customer orders and pays cash on delivery, the supplier ships directly to them. Your profit is the difference between your selling price and the supplier cost. AXQEN automates the entire chain.",
          },
        },
        {
          "@type": "Question",
          name: "How is AXQEN different from other dropshipping platforms?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "AXQEN is done-for-you: our team sets up your Shopify store, connects the app, and lists your first products. We also provide a dedicated account manager on WhatsApp and fully transparent payout remittances — every rupee itemised.",
          },
        },
        {
          "@type": "Question",
          name: "Do I need inventory or GST to start dropshipping with AXQEN?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No inventory required — suppliers ship directly to your customers. GST is required for payouts; our team guides you through registration if you don't have one.",
          },
        },
        {
          "@type": "Question",
          name: "How and when do I get paid?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Your margin is credited to your AXQEN wallet after each successful delivery. Every Monday, earnings are transferred to your registered bank account with a full line-by-line payout breakdown.",
          },
        },
        {
          "@type": "Question",
          name: "Can I connect my existing Shopify store to AXQEN?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Connecting your existing Shopify store takes under 5 minutes on your onboarding call. Your existing products and orders are untouched.",
          },
        },
      ],
    },
  ],
};

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    if (session.user.role === "ADMIN")    redirect("/admin");
    if (session.user.role === "SUPPLIER") redirect("/supplier");
    if (session.user.role === "SELLER") {
      if (!session.user.plan) redirect("/onboarding");
      redirect("/seller");
    }
    redirect("/login");
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <LandingPage />
    </>
  );
}
