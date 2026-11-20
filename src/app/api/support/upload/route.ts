import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { MAX_ATTACHMENTS } from "@/lib/ticket-content";

// POST multipart "images" (1–4 files) → { urls } — screenshots for support tickets. Sellers and admins only.
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];

export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || !["SELLER", "ADMIN"].includes(session.user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const fd = await req.formData().catch(() => null);
  const files = (fd?.getAll("images") ?? []).filter((f): f is File => typeof f === "object" && "size" in f && f.size > 0);
  if (!files.length) return NextResponse.json({ error: "Choose a screenshot to attach" }, { status: 400 });
  if (files.length > MAX_ATTACHMENTS) return NextResponse.json({ error: `Attach up to ${MAX_ATTACHMENTS} screenshots at a time` }, { status: 400 });
  for (const f of files) {
    if (!TYPES.includes(f.type)) return NextResponse.json({ error: `${f.name} isn't an image. Use JPG, PNG or WebP.` }, { status: 400 });
    if (f.size > MAX_BYTES) return NextResponse.json({ error: `${f.name} is over 8 MB` }, { status: 400 });
  }
  try {
    const urls = await Promise.all(files.map(f => uploadImageToCloudinary(f, "vrinandya/support")));
    return NextResponse.json({ urls });
  } catch {
    return NextResponse.json({ error: "Couldn't upload the screenshot. Try again." }, { status: 502 });
  }
}
