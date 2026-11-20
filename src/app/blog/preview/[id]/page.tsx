import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPostForPreview } from "@/lib/blog";
import { DbPostView } from "../../_components/DbPost";

// Draft preview for the AXQEN team (admins only, never indexed).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

export default async function BlogPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");
  if (session.user.role !== "ADMIN") notFound();
  const post = await getPostForPreview((await params).id);
  if (!post) notFound();
  return <DbPostView post={post} preview />;
}
