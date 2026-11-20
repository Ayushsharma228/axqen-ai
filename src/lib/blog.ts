import sanitizeHtml from "sanitize-html";
import { prisma } from "@/lib/prisma";

// Admin-written blog posts (BlogPost table). The code-based posts in src/app/blog/posts.ts keep working alongside.

/** Clean editor HTML: keep formatting, links and images; drop scripts, styles and inline handlers. */
export function cleanHtml(html: string): string {
  return sanitizeHtml(html ?? "", {
    allowedTags: ["h2", "h3", "h4", "p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "blockquote", "code", "pre", "hr", "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td"],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      th: ["colspan", "rowspan"], td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["https", "http", "mailto", "tel"],
    allowedSchemesByTag: { img: ["https"] },
    transformTags: {
      h1: "h2",
      a: (tagName, attribs) => {
        const external = /^https?:\/\//i.test(attribs.href ?? "") && !/axqen\.app/i.test(attribs.href ?? "");
        return { tagName, attribs: { href: attribs.href ?? "#", ...(external ? { target: "_blank", rel: "noopener noreferrer" } : {}) } };
      },
    },
    exclusiveFilter: frame => (frame.tag === "p" || frame.tag === "a") && !frame.text.trim() && !frame.mediaChildren?.length,
  });
}

export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export function readingMinutes(html: string): number {
  const words = (html ?? "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export type PublicPost = {
  slug: string; title: string; summary: string; coverImage: string | null; category: string | null;
  authorName: string; contentHtml: string; seoTitle: string | null; seoDescription: string | null;
  keywords: string[]; publishedAt: string; updatedAt: string; readingMinutes: number;
};

const toPublic = (p: { slug: string; title: string; summary: string; coverImage: string | null; category: string | null; authorName: string; contentHtml: string; seoTitle: string | null; seoDescription: string | null; keywords: string[]; publishedAt: Date | null; updatedAt: Date; createdAt: Date }): PublicPost => ({
  slug: p.slug, title: p.title, summary: p.summary, coverImage: p.coverImage, category: p.category, authorName: p.authorName,
  contentHtml: p.contentHtml, seoTitle: p.seoTitle, seoDescription: p.seoDescription, keywords: p.keywords,
  publishedAt: (p.publishedAt ?? p.createdAt).toISOString(), updatedAt: p.updatedAt.toISOString(), readingMinutes: readingMinutes(p.contentHtml),
});

/** Published posts, newest first. Never throws (the public blog must render even if the table is missing). */
export async function getPublishedPosts(): Promise<PublicPost[]> {
  try {
    const rows = await prisma.blogPost.findMany({ where: { status: "PUBLISHED", publishedAt: { lte: new Date() } }, orderBy: { publishedAt: "desc" }, take: 200 });
    return rows.map(toPublic);
  } catch { return []; }
}

export async function getPublishedPost(slug: string): Promise<PublicPost | null> {
  try {
    const p = await prisma.blogPost.findFirst({ where: { slug, status: "PUBLISHED", publishedAt: { lte: new Date() } } });
    return p ? toPublic(p) : null;
  } catch { return null; }
}

/** Any post by id, for the admin preview. */
export async function getPostForPreview(id: string): Promise<PublicPost | null> {
  const p = await prisma.blogPost.findUnique({ where: { id } });
  return p ? toPublic(p) : null;
}
