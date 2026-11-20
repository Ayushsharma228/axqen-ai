"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Eye, Globe, EyeOff, Check, ImagePlus, X } from "lucide-react";
import { BlogEditor } from "@/components/admin/blog-editor";

interface Post {
  id: string; slug: string; title: string; summary: string; coverImage: string | null; category: string | null; authorName: string;
  contentHtml: string; seoTitle: string | null; seoDescription: string | null; keywords: string[]; status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null; updatedAt: string;
}
type Form = { title: string; slug: string; summary: string; coverImage: string | null; category: string; authorName: string; seoTitle: string; seoDescription: string; keywords: string; publishedAt: string };

const BLUE = "#1D5CFF";
const toForm = (p: Post): Form => ({
  title: p.title === "Untitled post" ? "" : p.title, slug: p.slug, summary: p.summary, coverImage: p.coverImage, category: p.category ?? "",
  authorName: p.authorName, seoTitle: p.seoTitle ?? "", seoDescription: p.seoDescription ?? "", keywords: p.keywords.join(", "),
  publishedAt: p.publishedAt ? new Date(new Date(p.publishedAt).getTime() + 5.5 * 3600000).toISOString().slice(0, 10) : "",
});

export default function BlogEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [post, setPost] = useState<Post | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [html, setHtml] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<null | "save" | "publish" | "unpublish">(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/admin/blog/${id}`).then(r => r.json()).then(d => {
      if (d.post) { setPost(d.post); setForm(toForm(d.post)); setHtml(d.post.contentHtml); setSlugTouched(d.post.status === "PUBLISHED"); }
      else setMsg({ ok: false, text: d.error ?? "Post not found" });
    });
  }, [id]);

  const set = (patch: Partial<Form>) => { setForm(f => (f ? { ...f, ...patch } : f)); setDirty(true); };

  const save = useCallback(async (action?: "publish" | "unpublish") => {
    if (!form) return;
    setSaving(action ?? "save"); setMsg(null);
    const res = await fetch(`/api/admin/blog/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title, slug: form.slug, summary: form.summary, coverImage: form.coverImage, category: form.category, authorName: form.authorName,
        seoTitle: form.seoTitle, seoDescription: form.seoDescription, keywords: form.keywords.split(",").map(k => k.trim()).filter(Boolean),
        publishedAt: form.publishedAt || undefined, contentHtml: html, ...(action ? { action } : {}),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(null);
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? "Couldn't save" }); return; }
    setPost(d.post); setDirty(false);
    setMsg({ ok: true, text: action === "publish" ? "Published. It's live on the blog now." : action === "unpublish" ? "Unpublished. The post is a draft again and off the site." : "Saved." });
  }, [form, html, id]);

  // Ctrl/Cmd + S saves
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);
  // Warn before leaving with unsaved changes
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  async function uploadCover(file: File) {
    setCoverBusy(true); setMsg(null);
    const fd = new FormData(); fd.append("image", file);
    const res = await fetch("/api/admin/blog/upload", { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    setCoverBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? "Cover upload failed" }); return; }
    set({ coverImage: d.url });
  }

  if (!form || !post) {
    return (
      <div className="px-4 py-5 md:p-8" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
        <Link href="/admin/blog" className="inline-flex items-center gap-1 text-[12.5px] font-semibold" style={{ color: BLUE }}><ArrowLeft className="w-3.5 h-3.5" /> Blog</Link>
        {msg ? <p className="py-24 text-center text-[13px] text-[#B91C1C]">{msg.text}</p> : <div className="py-24 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" style={{ color: BLUE }} /></div>}
      </div>
    );
  }

  const live = post.status === "PUBLISHED";
  const googleTitle = (form.seoTitle || form.title || "Post title").slice(0, 60);
  const googleDesc = (form.seoDescription || form.summary || "The summary of your post shows here in Google.").slice(0, 160);
  const input = "w-full px-3 py-2 text-[13px] rounded-lg border border-[#E8EDF6] bg-white outline-none focus:border-[#1D5CFF]";
  const label = "block text-[11.5px] font-semibold text-[#374151] mb-1";

  return (
    <div className="pb-10" style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
      <div className="sticky top-14 md:top-0 z-20 bg-white/95 backdrop-blur border-b border-[#E8EDF6] px-4 md:px-8 py-3 flex items-center gap-3 flex-wrap">
        <Link href="/admin/blog" className="inline-flex items-center gap-1 text-[12.5px] font-semibold" style={{ color: BLUE }}><ArrowLeft className="w-3.5 h-3.5" /> Blog</Link>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${live ? "bg-[#DCFCE7] text-[#047857]" : "bg-[#F3F4F6] text-[#6B7280]"}`}>{live ? "Published" : "Draft"}</span>
        <span className="text-[12px] text-[#9CA3AF]">{dirty ? "Unsaved changes" : `Saved ${new Date(post.updatedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`}</span>
        <div className="ml-auto flex items-center gap-2">
          <a href={`/blog/preview/${id}`} target="_blank" rel="noreferrer" onClick={() => { if (dirty) save(); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold border border-[#E8EDF6] text-[#374151] hover:border-[#BFD3FF]"><Eye className="w-3.5 h-3.5" /> Preview</a>
          {live && <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold border border-[#E8EDF6] text-[#374151] hover:border-[#BFD3FF]"><Globe className="w-3.5 h-3.5" /> View live</a>}
          <button onClick={() => save()} disabled={!!saving} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold border border-[#E8EDF6] text-[#374151] disabled:opacity-60">
            {saving === "save" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} {live ? "Save changes" : "Save draft"}
          </button>
          {live ? (
            <button onClick={() => { if (confirm("Take this post off the blog? It stays here as a draft.")) save("unpublish"); }} disabled={!!saving} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold text-[#B91C1C] hover:bg-[#FEF2F2] disabled:opacity-60">
              {saving === "unpublish" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <EyeOff className="w-3.5 h-3.5" />} Unpublish
            </button>
          ) : (
            <button onClick={() => save("publish")} disabled={!!saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12.5px] font-bold text-white disabled:opacity-60" style={{ background: BLUE }}>
              {saving === "publish" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />} Publish
            </button>
          )}
        </div>
      </div>

      {msg && <div className="mx-4 md:mx-8 mt-4 px-4 py-2.5 rounded-xl text-[13px]" style={{ background: msg.ok ? "#ECFDF5" : "#FEF2F2", color: msg.ok ? "#047857" : "#B91C1C" }}>{msg.text}</div>}

      <div className="px-4 md:px-8 pt-5 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        <div className="space-y-4 min-w-0">
          <textarea id="post-title" rows={1} value={form.title} placeholder="Post title"
            onChange={e => { const t = e.target.value; set({ title: t, ...(slugTouched ? {} : { slug: t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) }) }); e.target.style.height = "auto"; e.target.style.height = `${e.target.scrollHeight}px`; }}
            className="w-full resize-none bg-transparent text-[32px] font-bold leading-tight text-[#0C1220] outline-none placeholder:text-[#C4C9D4]" />
          <BlogEditor initialHtml={post.contentHtml} onChange={h => { setHtml(h); setDirty(true); }} />
          <p className="text-[11.5px] text-[#9CA3AF]">Tip: write in Google Docs and paste here; headings, bold, lists and links come along. Ctrl + S saves.</p>
        </div>

        <aside className="space-y-4">
          <section className="bg-white rounded-xl border border-[#E8EDF6] p-4 space-y-3">
            <p className="text-[13px] font-bold text-[#0C1220]">Post details</p>
            <div>
              <label htmlFor="post-slug" className={label}>URL</label>
              <div className="flex items-center rounded-lg border border-[#E8EDF6] focus-within:border-[#1D5CFF] bg-white overflow-hidden">
                <span className="pl-3 text-[12px] text-[#9CA3AF] whitespace-nowrap">/blog/</span>
                <input id="post-slug" value={form.slug} onChange={e => { setSlugTouched(true); set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") }); }} className="w-full px-1 py-2 text-[13px] outline-none" />
              </div>
              {live && <p className="text-[11px] text-[#B45309] mt-1">Changing the URL of a live post breaks links people already shared.</p>}
            </div>
            <div>
              <label htmlFor="post-summary" className={label}>Summary <span className="font-normal text-[#9CA3AF]">({form.summary.length}/300)</span></label>
              <textarea id="post-summary" rows={3} maxLength={300} value={form.summary} onChange={e => set({ summary: e.target.value })} placeholder="One or two sentences. Shows on the blog page and in Google." className={`${input} resize-none`} />
            </div>
            <div>
              <p className={label}>Cover image</p>
              {form.coverImage ? (
                <div className="relative rounded-lg overflow-hidden border border-[#E8EDF6]">
                  <img src={form.coverImage} alt="Cover" className="w-full aspect-[1200/630] object-cover" />
                  <button type="button" onClick={() => set({ coverImage: null })} aria-label="Remove cover image" className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center text-[#B91C1C]"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <button type="button" onClick={() => coverRef.current?.click()} disabled={coverBusy} className="w-full aspect-[1200/630] rounded-lg border-2 border-dashed border-[#D3DEF7] flex flex-col items-center justify-center gap-1 text-[12px] font-semibold text-[#6B7280] hover:border-[#1D5CFF] hover:text-[#1D5CFF]">
                  {coverBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />} {coverBusy ? "Uploading…" : "Upload cover (1200 × 630 works best)"}
                </button>
              )}
              <input ref={coverRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ""; }} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label htmlFor="post-cat" className={label}>Category</label><input id="post-cat" value={form.category} onChange={e => set({ category: e.target.value })} placeholder="e.g. Dropshipping" className={input} /></div>
              <div><label htmlFor="post-author" className={label}>Author</label><input id="post-author" value={form.authorName} onChange={e => set({ authorName: e.target.value })} className={input} /></div>
            </div>
            <div>
              <label htmlFor="post-date" className={label}>Publish date</label>
              <input id="post-date" type="date" value={form.publishedAt} onChange={e => set({ publishedAt: e.target.value })} className={input} />
              <p className="text-[11px] text-[#9CA3AF] mt-1">Empty = the day you publish. A future date keeps it hidden until then.</p>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-[#E8EDF6] p-4 space-y-3">
            <p className="text-[13px] font-bold text-[#0C1220]">Google (SEO)</p>
            <div className="rounded-lg border border-[#EEF1F8] p-3 bg-[#FAFBFF]">
              <p className="text-[11px] text-[#047857] truncate">axqen.app › blog › {form.slug || "your-post"}</p>
              <p className="text-[15px] text-[#1A0DAB] leading-snug mt-0.5 line-clamp-2">{googleTitle}</p>
              <p className="text-[12px] text-[#4D5156] mt-0.5 line-clamp-2">{googleDesc}</p>
            </div>
            <div>
              <label htmlFor="post-seot" className={label}>Google title <span className={`font-normal ${form.seoTitle.length > 60 ? "text-[#B45309]" : "text-[#9CA3AF]"}`}>({form.seoTitle.length}/60)</span></label>
              <input id="post-seot" maxLength={70} value={form.seoTitle} onChange={e => set({ seoTitle: e.target.value })} placeholder="Defaults to the post title" className={input} />
            </div>
            <div>
              <label htmlFor="post-seod" className={label}>Google description <span className={`font-normal ${form.seoDescription.length > 155 ? "text-[#B45309]" : "text-[#9CA3AF]"}`}>({form.seoDescription.length}/155)</span></label>
              <textarea id="post-seod" rows={3} maxLength={170} value={form.seoDescription} onChange={e => set({ seoDescription: e.target.value })} placeholder="Defaults to the summary" className={`${input} resize-none`} />
            </div>
            <div>
              <label htmlFor="post-kw" className={label}>Keywords <span className="font-normal text-[#9CA3AF]">(comma separated)</span></label>
              <input id="post-kw" value={form.keywords} onChange={e => set({ keywords: e.target.value })} placeholder="dropshipping india, cod orders, rto" className={input} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
