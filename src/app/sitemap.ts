import type { MetadataRoute } from "next";
import { POSTS } from "./blog/posts";

const baseUrl = "https://www.axqen.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const publicRoutes = [
    "",
    "/about",
    "/blog",
    "/case-studies",
    "/dropshipping",
    "/catalogue",
    "/company",
    "/legal/privacy",
    "/legal/terms-of-service",
  ];

  const pages: MetadataRoute.Sitemap = publicRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "" ? 1 : route === "/dropshipping" ? 0.9 : route.startsWith("/legal") ? 0.3 : 0.7,
  }));

  const posts: MetadataRoute.Sitemap = POSTS.map((p) => ({
    url: `${baseUrl}/blog/${p.slug}`,
    lastModified: new Date(`${p.date}T00:00:00+05:30`),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [...pages, ...posts];
}
