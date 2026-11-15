import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import LandingPage from "@/components/landing/LandingPage";
import { SEO, FAQS, CONTACT, SOCIALS } from "@/components/landing/content";

export const metadata: Metadata = {
  title: SEO.title,
  description: SEO.description,
  keywords: SEO.keywords,
  openGraph: {
    title: SEO.title,
    description: SEO.description,
    url: "https://axqen.app/",
    siteName: "AXQEN AI",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SEO.title,
    description: SEO.description,
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://www.axqen.app/",
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
        email: CONTACT.email,
        contactType: "customer service",
        availableLanguage: ["English", "Hindi"],
      },
      sameAs: SOCIALS.map((s) => s.href),
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
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
