import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { C } from "@/components/landing/constants";
import { AXQ_ROOT } from "@/components/landing/theme";
import { POSTS, getPost, postUrl, formatDate, SITE } from "../posts";
import { BODIES } from "../_posts";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return {};
  const url = postUrl(post.slug);
  return {
    title: { absolute: post.seoTitle },
    description: post.description,
    keywords: post.keywords,
    authors: [{ name: post.author }],
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: post.seoTitle,
      description: post.description,
      siteName: "AXQEN AI",
      locale: "en_IN",
      publishedTime: post.date,
      authors: [post.author],
    },
    twitter: { card: "summary_large_image", title: post.seoTitle, description: post.description },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  const Body = BODIES[slug];
  if (!post || !Body) notFound();

  const url = postUrl(post.slug);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: post.title,
        description: post.description,
        datePublished: post.date,
        dateModified: post.date,
        author: { "@type": "Person", name: post.author },
        publisher: { "@type": "Organization", name: "AXQEN AI", logo: { "@type": "ImageObject", url: `${SITE}/axqen-icon.png` } },
        mainEntityOfPage: url,
        image: `${url}/opengraph-image`,
        keywords: post.keywords.join(", "),
      },
      ...(post.faqs?.length
        ? [{
            "@type": "FAQPage",
            mainEntity: post.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          }]
        : []),
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog` },
          { "@type": "ListItem", position: 3, name: post.title, item: url },
        ],
      },
    ],
  };

  return (
    <div className={AXQ_ROOT} style={{ minHeight: "100vh" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50 }}>
        <Navbar />
      </header>

      <main>
        <section className="axq-hero pt-32 md:pt-40 pb-14 md:pb-20 px-5 md:px-6">
          <div className="max-w-[760px] mx-auto">
            <nav aria-label="Breadcrumb" className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.8)" }}>
              <a href="/blog" className="hover:text-white underline-offset-4 hover:underline">Blog</a>
            </nav>
            <h1 className="text-white mb-6" style={{ fontSize: "clamp(2rem, 1.3rem + 3vw, 3.4rem)", lineHeight: 1.08, textWrap: "balance" }}>
              {post.title}
            </h1>
            <p className="text-[15px]" style={{ color: "rgba(255,255,255,0.85)" }}>
              By {post.author} · <time dateTime={post.date}>{formatDate(post.date)}</time> · {post.readingMinutes} min read
            </p>
          </div>
        </section>

        <article className="axq-prose max-w-[760px] mx-auto px-5 md:px-6 py-14 md:py-20">
          <Body />
        </article>

        <section className="px-5 md:px-6 pb-20" style={{ background: C.navy }}>
          <div className="max-w-[760px] mx-auto pt-10" style={{ borderTop: `1px solid ${C.border}` }}>
            <a href="/blog" className="text-[15px] font-semibold" style={{ color: C.action }}>← All articles</a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
