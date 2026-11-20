import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { C } from "@/components/landing/constants";
import { AXQ_ROOT } from "@/components/landing/theme";
import { cleanHtml, type PublicPost } from "@/lib/blog";
import { formatDate, postUrl, SITE } from "../posts";

/** A blog post written in the admin editor, rendered with the same look as the built-in posts. */
export function DbPostView({ post, preview = false }: { post: PublicPost; preview?: boolean }) {
  const url = postUrl(post.slug);
  const date = post.publishedAt.slice(0, 10);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: post.title,
        description: post.seoDescription || post.summary,
        datePublished: post.publishedAt,
        dateModified: post.updatedAt,
        author: { "@type": "Person", name: post.authorName },
        publisher: { "@type": "Organization", name: "AXQEN AI", logo: { "@type": "ImageObject", url: `${SITE}/axqen-icon.png` } },
        mainEntityOfPage: url,
        image: post.coverImage ?? `${url}/opengraph-image`,
        ...(post.keywords.length ? { keywords: post.keywords.join(", ") } : {}),
      },
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
      {!preview && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      {preview && (
        <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 60, background: "#0F1623", color: "#fff", padding: "10px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600 }}>
          Preview · only your team can see this
        </div>
      )}
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50 }}>
        <Navbar />
      </header>
      <main>
        <section className="axq-hero pt-32 md:pt-40 pb-14 md:pb-20 px-5 md:px-6">
          <div className="max-w-[760px] mx-auto">
            <nav aria-label="Breadcrumb" className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.8)" }}>
              <a href="/blog" className="hover:text-white underline-offset-4 hover:underline">Blog</a>
              {post.category && <span> · {post.category}</span>}
            </nav>
            <h1 className="text-white mb-6" style={{ fontSize: "clamp(2rem, 1.3rem + 3vw, 3.4rem)", lineHeight: 1.08, textWrap: "balance" }}>{post.title}</h1>
            <p className="text-[15px]" style={{ color: "rgba(255,255,255,0.85)" }}>
              By {post.authorName} · <time dateTime={date}>{formatDate(date)}</time> · {post.readingMinutes} min read
            </p>
          </div>
        </section>

        {post.coverImage && (
          <div className="max-w-[860px] mx-auto px-5 md:px-6 -mt-8 md:-mt-12 relative">
            <img src={post.coverImage} alt={post.title} className="w-full rounded-2xl aspect-[1200/630] object-cover" />
          </div>
        )}

        {/* Content is cleaned on save and again here before it reaches the page */}
        <article className="axq-prose max-w-[760px] mx-auto px-5 md:px-6 py-14 md:py-20" dangerouslySetInnerHTML={{ __html: cleanHtml(post.contentHtml) }} />

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
