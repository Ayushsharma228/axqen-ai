// Support ticket message content. Works on server and client (no Prisma).
// Screenshots and ratings are kept inside the message text so no schema change is needed:
//   [[img]]https://res.cloudinary.com/…      one line per attached image
//   [[rating]]up|down                         first line of a rating message, optional comment after it

const IMG = "[[img]]";
const RATING = "[[rating]]";
export const MAX_ATTACHMENTS = 4;

/** Only images we uploaded ourselves (Cloudinary over https) may be attached. */
export function isAllowedAttachment(url: unknown): url is string {
  return typeof url === "string" && /^https:\/\/res\.cloudinary\.com\/[\w-]+\/image\/upload\/[^\s"'<>]+$/i.test(url) && url.length < 600;
}

export function encodeMessage(text: string, attachments: string[] = []): string {
  const imgs = attachments.filter(isAllowedAttachment).slice(0, MAX_ATTACHMENTS);
  const body = text.trim();
  return [body, ...imgs.map(u => `${IMG}${u}`)].filter(Boolean).join("\n");
}

export function encodeRating(rating: "up" | "down", comment?: string): string {
  return `${RATING}${rating}${comment?.trim() ? `\n${comment.trim().slice(0, 500)}` : ""}`;
}

export interface ParsedMessage {
  text: string;
  images: string[];
  rating: "up" | "down" | null;
}

export function parseMessage(raw: string): ParsedMessage {
  const lines = (raw ?? "").split("\n");
  let rating: ParsedMessage["rating"] = null;
  if (lines[0]?.startsWith(RATING)) {
    const v = lines[0].slice(RATING.length).trim();
    rating = v === "down" ? "down" : "up";
    lines.shift();
  }
  const images: string[] = [];
  const text: string[] = [];
  for (const l of lines) {
    if (l.startsWith(IMG)) { const u = l.slice(IMG.length).trim(); if (isAllowedAttachment(u)) images.push(u); }
    else text.push(l);
  }
  return { text: text.join("\n").trim(), images, rating };
}

/** Plain-text preview (lists, emails, notifications). */
export function previewText(raw: string): string {
  const p = parseMessage(raw);
  if (p.rating) return `Rated ${p.rating === "up" ? "👍 solved" : "👎 not solved"}${p.text ? `: ${p.text}` : ""}`;
  return [p.text, p.images.length ? `📎 ${p.images.length} screenshot${p.images.length > 1 ? "s" : ""}` : ""].filter(Boolean).join(" ");
}
