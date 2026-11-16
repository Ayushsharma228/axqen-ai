import { ImageResponse } from "next/og";
import { POSTS, getPost } from "../posts";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AXQEN AI blog";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const post = getPost((await params).slug);
  const title = post?.title ?? "AXQEN AI Blog";
  const flow = post?.flow ?? [];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "64px 72px", color: "#fff",
          background: "linear-gradient(135deg, #2A73FF 0%, #155EEF 45%, #0B2A80 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 700 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: "#fff", color: "#155EEF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800 }}>A</div>
          AXQEN AI · Blog
        </div>

        <div style={{ display: "flex", fontSize: 64, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.02em", maxWidth: 1000 }}>
          {title}
        </div>

        {flow.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 20, padding: "18px 22px", alignSelf: "flex-start" }}>
            {flow.map((step, i) => (
              <div key={step} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ display: "flex", background: i === flow.length - 1 ? "#CFE3FF" : "#fff", color: "#0B2A80", borderRadius: 12, padding: "10px 20px", fontSize: 26, fontWeight: 700 }}>
                  {step}
                </div>
                {i < flow.length - 1 && <div style={{ display: "flex", fontSize: 28, color: "#CFE3FF" }}>→</div>}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex" }} />
        )}
      </div>
    ),
    size
  );
}
