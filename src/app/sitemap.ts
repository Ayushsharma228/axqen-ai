
import type { MetadataRoute } from "next";

const baseUrl = "https://www.axqen.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const publicRoutes = [
    "",
    "/about",
    "/case-studies",
    "/catalogue",
    "/company",
  ];

  return publicRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
}
