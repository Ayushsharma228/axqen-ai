"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold, Italic, Underline, Strikethrough, Heading2, Heading3, List, ListOrdered, Quote, Link2, Link2Off, ImagePlus, Minus, Undo2, Redo2, Loader2, Pilcrow,
} from "lucide-react";

/** Rich text editor for blog posts. Paste from Google Docs keeps headings, bold, lists and links. */
export function BlogEditor({ initialHtml, onChange }: { initialHtml: string; onChange: (html: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true, defaultProtocol: "https" } }),
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder: "Start writing, or paste your article from Google Docs…" }),
    ],
    content: initialHtml || "",
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: { attributes: { class: "focus:outline-none", "aria-label": "Article body" } },
  });

  useEffect(() => () => editor?.destroy(), [editor]);

  async function uploadImage(file: File) {
    setUploading(true); setErr("");
    const fd = new FormData();
    fd.append("image", file);
    const res = await fetch("/api/admin/blog/upload", { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) { setErr(d.error ?? "Image upload failed"); return; }
    const alt = prompt("Describe the image in a few words (helps Google and screen readers):", "") ?? "";
    editor?.chain().focus().setImage({ src: d.url, alt: alt.trim() || undefined }).run();
  }

  function setLink(e: Editor) {
    const prev = e.getAttributes("link").href as string | undefined;
    const url = prompt("Link address (https://…)", prev ?? "https://");
    if (url === null) return;
    if (!url.trim() || url.trim() === "https://") { e.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    e.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  if (!editor) return <div className="min-h-[480px] rounded-2xl border border-[#E8EDF6] bg-white flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#9CA3AF]" /></div>;

  const btn = (active: boolean) => `w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${active ? "bg-[#E6EEFF] text-[#1D5CFF]" : "text-[#4B5563] hover:bg-[#F3F6FF]"}`;
  const tools: { label: string; icon: React.ElementType; run: () => void; active?: boolean; disabled?: boolean }[] = [
    { label: "Normal text", icon: Pilcrow, run: () => editor.chain().focus().setParagraph().run(), active: editor.isActive("paragraph") },
    { label: "Heading", icon: Heading2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive("heading", { level: 2 }) },
    { label: "Subheading", icon: Heading3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive("heading", { level: 3 }) },
    { label: "Bold", icon: Bold, run: () => editor.chain().focus().toggleBold().run(), active: editor.isActive("bold") },
    { label: "Italic", icon: Italic, run: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive("italic") },
    { label: "Underline", icon: Underline, run: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive("underline") },
    { label: "Strikethrough", icon: Strikethrough, run: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive("strike") },
    { label: "Bullet list", icon: List, run: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive("bulletList") },
    { label: "Numbered list", icon: ListOrdered, run: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive("orderedList") },
    { label: "Quote", icon: Quote, run: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive("blockquote") },
    { label: "Add or edit link", icon: Link2, run: () => setLink(editor), active: editor.isActive("link") },
    { label: "Remove link", icon: Link2Off, run: () => editor.chain().focus().unsetLink().run(), disabled: !editor.isActive("link") },
    { label: "Divider", icon: Minus, run: () => editor.chain().focus().setHorizontalRule().run() },
  ];
  const externalImgs = (editor.getHTML().match(/<img[^>]+src="([^"]+)"/g) ?? []).filter(t => !/res\.cloudinary\.com/.test(t)).length;

  return (
    <div className="rounded-2xl border border-[#E8EDF6] bg-white overflow-hidden">
      <div className="sticky top-0 z-10 flex items-center gap-0.5 flex-wrap px-2 py-1.5 border-b border-[#F0F2F7] bg-white">
        {tools.map(t => (
          <button key={t.label} type="button" onClick={t.run} disabled={t.disabled} title={t.label} aria-label={t.label} aria-pressed={t.active} className={`${btn(!!t.active)} disabled:opacity-30`}>
            <t.icon className="w-4 h-4" />
          </button>
        ))}
        <span className="w-px h-5 bg-[#E8EDF6] mx-1" />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} title="Insert image" aria-label="Insert image" className={btn(false)}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
        </button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }} />
        <span className="ml-auto flex items-center gap-0.5">
          <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo" aria-label="Undo" className={`${btn(false)} disabled:opacity-30`}><Undo2 className="w-4 h-4" /></button>
          <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo" aria-label="Redo" className={`${btn(false)} disabled:opacity-30`}><Redo2 className="w-4 h-4" /></button>
        </span>
      </div>
      {(err || externalImgs > 0) && (
        <div className="px-4 py-2 text-[12px] border-b border-[#F0F2F7]" style={{ background: err ? "#FEF2F2" : "#FFFBEB", color: err ? "#B91C1C" : "#92400E" }}>
          {err || `${externalImgs} image${externalImgs > 1 ? "s" : ""} pasted from another site (for example Google Docs) may stop showing later. Delete ${externalImgs > 1 ? "them" : "it"} and add ${externalImgs > 1 ? "them" : "it"} again with the image button.`}
        </div>
      )}
      <div className="blog-editor px-5 sm:px-8 py-6">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
