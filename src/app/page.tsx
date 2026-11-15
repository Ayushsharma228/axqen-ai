import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import LandingPage from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "AXQEN AI | AI Commerce Operating System for Ecommerce",
  description:
    "AXQEN AI is an AI Commerce Operating System. Launch stores, manage products, automate operations, connect suppliers and track profit — all in one intelligent platform.",
  keywords: [
    "AXQEN AI",
    "AI Commerce Operating System",
    "ecommerce automation platform",
    "ecommerce operations software",
    "dropshipping platform India",
    "Shopify order management",
    "multi-channel ecommerce",
    "NDR RTO management",
    "ecommerce analytics India",
  ],
  openGraph: {
    title: "AXQEN AI | AI Commerce Operating System for Ecommerce",
    description:
      "One intelligent commerce platform to launch stores, manage products, automate operations, connect suppliers and track business performance.",
    url: "https://axqen.app",
    siteName: "AXQEN AI",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AXQEN AI | AI Commerce Operating System for Ecommerce",
    description: "Run, automate and grow your e-commerce business with AXQEN AI. Store setup, orders, shipping, RTO, wallet and analytics in one platform.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://axqen.app",
  },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://axqen.app/#organization",
      name: "AXQEN AI",
      url: "https://axqen.app",
      logo: "https://axqen.app/logo.png",
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+91-86799-93305",
        contactType: "customer service",
        availableLanguage: ["English", "Hindi"],
      },
      sameAs: [],
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is AXQEN AI?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "AXQEN AI is an AI Commerce Operating System. It brings store setup, products and suppliers, order processing, shipping, NDR and RTO handling, wallet and analytics into one platform.",
          },
        },
        {
          "@type": "Question",
          name: "Which platforms does AXQEN AI support?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "AXQEN AI connects with Shopify, Amazon, Flipkart, Meesho, Shiprocket, and Easebuzz.",
          },
        },
        {
          "@type": "Question",
          name: "How does pricing work?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "AXQEN AI uses one-time pricing — pay once and use the platform. Plans start at ₹9,999. No monthly subscription fees on base plans.",
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
