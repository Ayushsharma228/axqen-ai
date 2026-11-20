"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, FileText, ExternalLink, Code2 } from "lucide-react";

interface Post { id: string; title: string; slug: string; status: "DRAFT" | "PUBLISHED"; category: string | null; authorName: string; coverImage: string | null; publishedAt: string | null; updatedAt: string; summary: string }
interface CodePost { slug: string; title: string; date: string; author: string }

const fmt = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function AdminBlogPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [codePosts, setCodePosts] = useState<CodePost[]>([]);
  const [tab, setTab] = useState<"all" | "PUBLISHED" | "DRAFT">("all");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { fetch("/api/admin/blog").then(r => r.json()).then(d => { setPosts(d.posts ?? []); setCodePosts(d.codePosts ?? []); }).catch(() => setPosts([])); }, []);

  async function create() {
    setCreating(true); setErr("");
    const res = await fetch("/api/admin/blog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "" }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setCreating(false); setErr(d.error ?? "Couldn't create a post"); return; }
    router.push(`/admin/blog/${d.id}`);
  }

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (posts ?? []).filter(p => (tab === "all" || p.status === tab) && (!s || p.title.toLowerCase().includes(s) || (p.category ?? "").toLowerCase().includes(s)));
  }, [posts, tab, q]);
  const counts = { all: posts?.length ?? 0, PUBLISHED: posts?.filter(p => p.status === "PUBLISHED").length ?? 0, DRAFT: posts?.filter(p => p.status === "DRAFT").length ?? 0 };

  return (
    <div className="px-4 py-5 md:p-8 space-y-5" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-black text-[#0C1220]">Blog</h1>
          <p className="text-[12.5px] text-[#6B7280] mt-1">Write and publish articles for <a href="/blog" target="_blank" rel="noreferrer" className="text-[#1D5CFF] font-semibold">axqen.app/blog</a>. Published posts are added to Google&apos;s sitemap automatically.</p>
        </div>
        <button onClick={create} disabled={creating} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-bold text-white bg-[#1D5CFF] disabled:opacity-60">
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} New post
        </button>
      </div>
      {err && <p className="text-[12.5px] text-[#B91C1C] bg-[#FEF2F2] rounded-lg px-3 py-2">{err}</p>}

      <div className="bg-white rounded-xl border border-[#E8EDF6] overflow-hidden">
        <div className="flex items-center gap-2 flex-wrap px-4 py-3 bg-[#FAFBFF] border-b border-[#F3F4F6]">
          {([["all", "All"], ["PUBLISHED", "Published"], ["DRAFT", "Drafts"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5 ${tab === k ? "bg-[#E6EEFF] text-[#1D5CFF]" : "text-[#6B7280] hover:bg-[#F0F5FF]"}`}>
              {l}<span className="text-[10.5px] px-1.5 rounded-full bg-[#F3F4F6] text-[#6B7280] tabular-nums">{counts[k]}</span>
            </button>
          ))}
          <div className="relative ml-auto w-full sm:w-[260px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
            <input id="blog-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search posts" className="pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#1D5CFF] w-full" />
          </div>
        </div>
        {!posts ? <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#9CA3AF]" /></div>
          : list.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-2 text-[13px] text-[#9CA3AF]">
              <FileText className="w-8 h-8 text-[#D3DEF7]" /> {posts.length ? "No posts here." : "No posts yet. Click New post to write the first one."}
            </div>
          ) : (
            <div className="divide-y divide-[#F3F4F6]">
              {list.map(p => (
                <Link key={p.id} href={`/admin/blog/${p.id}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-[#FAFBFF]">
                  <div className="w-20 h-14 rounded-lg bg-[#F3F6FF] overflow-hidden flex-shrink-0">
                    {p.coverImage ? <img src={p.coverImage} alt="" className="w-full h-full object-cover" /> : <FileText className="w-5 h-5 m-auto mt-4 text-[#C7D5F5]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#0C1220] truncate">{p.title}</p>
                    <p className="text-[12px] text-[#9CA3AF] truncate">/blog/{p.slug}{p.category ? ` · ${p.category}` : ""} · {p.authorName}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${p.status === "PUBLISHED" ? "bg-[#DCFCE7] text-[#047857]" : "bg-[#F3F4F6] text-[#6B7280]"}`}>{p.status === "PUBLISHED" ? "Published" : "Draft"}</span>
                    <p className="text-[11px] text-[#9CA3AF] mt-1">{p.status === "PUBLISHED" && p.publishedAt ? `Live ${fmt(p.publishedAt)}` : `Edited ${fmt(p.updatedAt)}`}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
      </div>

      {codePosts.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E8EDF6] p-4">
          <p className="text-[13px] font-semibold text-[#0C1220] flex items-center gap-1.5"><Code2 className="w-4 h-4 text-[#9CA3AF]" /> Earlier posts (built into the website)</p>
          <p className="text-[12px] text-[#9CA3AF] mt-0.5 mb-2">These stay live as they are. Ask your developer to change them.</p>
          <div className="divide-y divide-[#F3F4F6]">
            {codePosts.map(c => (
              <a key={c.slug} href={`/blog/${c.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-2 text-[13px] hover:text-[#1D5CFF]">
                <span className="flex-1 truncate text-[#374151]">{c.title}</span>
                <span className="text-[11.5px] text-[#9CA3AF]">{fmt(c.date)}</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#9CA3AF]" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
