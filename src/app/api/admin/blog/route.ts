import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/blog";
import { POSTS } from "@/app/blog/posts";

// GET → all admin-written posts (drafts and published). POST { title } → new draft, returns its id.
async function admin(req: NextRequest) {
  const s = await getRouteSession(req);
  return s?.user.role === "ADMIN" ? s : null;
}

export async function GET(req: NextRequest) {
  if (!(await admin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const posts = await prisma.blogPost.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, slug: true, status: true, category: true, authorName: true, coverImage: true, publishedAt: true, updatedAt: true, summary: true },
  });
  return NextResponse.json({ posts, codePosts: POSTS.map(p => ({ slug: p.slug, title: p.title, date: p.date, author: p.author })) });
}

export async function POST(req: NextRequest) {
  const session = await admin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { title } = await req.json().catch(() => ({})) as { title?: string };
  const t = String(title ?? "").trim() || "Untitled post";
  const base = slugify(t) || "post";
  let slug = base, n = 2;
  const taken = new Set(POSTS.map(p => p.slug));
  while (taken.has(slug) || await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } })) slug = `${base}-${n++}`;
  const post = await prisma.blogPost.create({
    data: { title: t, slug, authorName: session.user.name ?? "AXQEN Team", createdById: session.user.id, updatedById: session.user.id },
    select: { id: true },
  });
  return NextResponse.json({ id: post.id }, { status: 201 });
}
