import type { MetadataRoute } from "next";

const baseUrl = "https://www.axqen.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const publicRoutes = [
    "",
    "/about",
    "/blog",
    "/case-studies",
    "/catalogue",
    "/company",
    "/legal/privacy",
    "/legal/terms-of-service",
  ];

  return publicRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "" ? 1 : route.startsWith("/legal") ? 0.3 : 0.7,
  }));
}
