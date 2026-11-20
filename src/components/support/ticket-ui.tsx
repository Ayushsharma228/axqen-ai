"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X, ThumbsUp, ThumbsDown } from "lucide-react";
import { MAX_ATTACHMENTS, parseMessage } from "@/lib/ticket-content";

/** Text, screenshot thumbnails and ratings inside a ticket message. */
export function MessageBody({ raw, onDark = false }: { raw: string; onDark?: boolean }) {
  const m = parseMessage(raw);
  if (m.rating) {
    const up = m.rating === "up";
    return (
      <div className="flex items-start gap-2">
        <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${up ? "bg-[#DCFCE7] text-[#047857]" : "bg-[#FEE2E2] text-[#B91C1C]"}`}>
          {up ? <ThumbsUp className="w-3.5 h-3.5" /> : <ThumbsDown className="w-3.5 h-3.5" />}
        </span>
        <div>
          <p className="text-[13px] font-semibold">{up ? "Rated: issue solved" : "Rated: not solved"}</p>
          {m.text && <p className="text-[13px] whitespace-pre-wrap break-words mt-0.5">{m.text}</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
      {m.images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {m.images.map(u => (
            <a key={u} href={u} target="_blank" rel="noopener noreferrer" className={`block w-24 h-24 rounded-xl overflow-hidden border ${onDark ? "border-white/30" : "border-[#E8EDF6]"} hover:opacity-90`} aria-label="Open screenshot full size">
              <img src={u} alt="Screenshot attached to the ticket" className="w-full h-full object-cover" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/** Screenshot picker: uploads on select, shows thumbnails, returns the uploaded URLs. */
export function useAttachments() {
  const [urls, setUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_ATTACHMENTS - urls.length;
    if (room <= 0) { setError(`Up to ${MAX_ATTACHMENTS} screenshots per message`); return; }
    const pick = Array.from(files).slice(0, room);
    setUploading(true); setError("");
    const fd = new FormData();
    pick.forEach(f => fd.append("images", f));
    const res = await fetch("/api/support/upload", { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) { setError(d.error ?? "Couldn't upload"); return; }
    setUrls(u => [...u, ...(d.urls ?? [])].slice(0, MAX_ATTACHMENTS));
    if (files.length > room) setError(`Only ${MAX_ATTACHMENTS} screenshots per message, so the extra ones were skipped`);
  }

  const reset = () => { setUrls([]); setError(""); };

  const picker = (id: string) => (
    <div className="space-y-2">
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map(u => (
            <div key={u} className="relative w-16 h-16 rounded-lg overflow-hidden border border-[#E8EDF6]">
              <img src={u} alt="Screenshot to attach" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setUrls(x => x.filter(y => y !== u))} aria-label="Remove screenshot" className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-white/90 flex items-center justify-center text-[#B91C1C]"><X className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading || urls.length >= MAX_ATTACHMENTS}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold border border-[#E8EDF6] text-[#374151] hover:border-[#BFD3FF] hover:text-[#1D5CFF] disabled:opacity-50">
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
          {uploading ? "Uploading…" : urls.length ? `Add screenshot (${urls.length}/${MAX_ATTACHMENTS})` : "Attach screenshot"}
        </button>
        <span className="text-[11.5px] text-[#9CA3AF]">JPG, PNG or WebP, up to 8 MB each</span>
        <input id={id} ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/heic" multiple className="hidden"
          onChange={e => { add(e.target.files); e.target.value = ""; }} />
      </div>
      {error && <p className="text-[12px] text-[#B91C1C]">{error}</p>}
    </div>
  );

  return { urls, uploading, reset, picker };
}
