import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

// POST multipart "image" → { url } — blog cover and in-article images. Admins only.
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const fd = await req.formData().catch(() => null);
  const f = fd?.get("image");
  if (!f || typeof f !== "object" || !("size" in f) || !f.size) return NextResponse.json({ error: "Choose an image" }, { status: 400 });
  if (!TYPES.includes(f.type)) return NextResponse.json({ error: "Use a JPG, PNG, WebP or GIF image" }, { status: 400 });
  if (f.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Images should be under 8 MB" }, { status: 400 });
  try {
    return NextResponse.json({ url: await uploadImageToCloudinary(f as File, "vrinandya/blog") });
  } catch {
    return NextResponse.json({ error: "Image upload failed. Try again." }, { status: 502 });
  }
}
