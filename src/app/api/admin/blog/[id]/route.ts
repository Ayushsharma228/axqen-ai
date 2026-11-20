import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { cleanHtml, slugify } from "@/lib/blog";
import { POSTS } from "@/app/blog/posts";

// GET → one post. PATCH { fields…, action?: "publish" | "unpublish" } → save (and publish / unpublish).
// No delete: unpublish takes a post off the site and keeps it as a draft.
async function admin(req: NextRequest) {
  const s = await getRouteSession(req);
  return s?.user.role === "ADMIN" ? s : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await admin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const post = await prisma.blogPost.findUnique({ where: { id: (await params).id } });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  return NextResponse.json({ post });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await admin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = (await params).id;
  const current = await prisma.blogPost.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;

  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
  const data: Record<string, unknown> = { updatedById: session.user.id };
  const title = str(b.title, 160); if (title !== undefined) data.title = title || "Untitled post";
  const summary = str(b.summary, 400); if (summary !== undefined) data.summary = summary;
  const category = str(b.category, 60); if (category !== undefined) data.category = category || null;
  const authorName = str(b.authorName, 80); if (authorName !== undefined) data.authorName = authorName || "AXQEN Team";
  const seoTitle = str(b.seoTitle, 70); if (seoTitle !== undefined) data.seoTitle = seoTitle || null;
  const seoDescription = str(b.seoDescription, 170); if (seoDescription !== undefined) data.seoDescription = seoDescription || null;
  if (Array.isArray(b.keywords)) data.keywords = b.keywords.map(k => String(k).trim()).filter(Boolean).slice(0, 12).map(k => k.slice(0, 60));
  if (typeof b.coverImage === "string" || b.coverImage === null) {
    const c = typeof b.coverImage === "string" ? b.coverImage.trim() : "";
    if (c && !/^https:\/\/res\.cloudinary\.com\//.test(c)) return NextResponse.json({ error: "Upload the cover image here so it stays available" }, { status: 400 });
    data.coverImage = c || null;
  }
  if (typeof b.contentHtml === "string") {
    if (b.contentHtml.length > 400_000) return NextResponse.json({ error: "The article is too long" }, { status: 400 });
    data.contentHtml = cleanHtml(b.contentHtml);
  }
  if (typeof b.slug === "string") {
    const slug = slugify(b.slug);
    if (!slug) return NextResponse.json({ error: "Add a URL for the post" }, { status: 400 });
    if (POSTS.some(p => p.slug === slug)) return NextResponse.json({ error: "That URL is already used by another post" }, { status: 400 });
    const clash = await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } });
    if (clash && clash.id !== id) return NextResponse.json({ error: "That URL is already used by another post" }, { status: 400 });
    data.slug = slug;
  }
  if (typeof b.publishedAt === "string" && b.publishedAt) {
    const d = new Date(b.publishedAt);
    if (isNaN(d.getTime())) return NextResponse.json({ error: "Pick a valid publish date" }, { status: 400 });
    data.publishedAt = d;
  }

  if (b.action === "publish") {
    const merged = { ...current, ...data } as typeof current;
    const words = String(merged.contentHtml ?? "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    if (!merged.title || merged.title === "Untitled post") return NextResponse.json({ error: "Add a title before publishing" }, { status: 400 });
    if (!merged.summary) return NextResponse.json({ error: "Add a short summary before publishing. It shows on the blog page and in Google." }, { status: 400 });
    if (words < 50) return NextResponse.json({ error: "The article is very short. Write at least a few paragraphs before publishing." }, { status: 400 });
    data.status = "PUBLISHED";
    if (!merged.publishedAt) data.publishedAt = new Date();
  } else if (b.action === "unpublish") {
    data.status = "DRAFT";
  }

  const post = await prisma.blogPost.update({ where: { id }, data });
  return NextResponse.json({ post });
}
