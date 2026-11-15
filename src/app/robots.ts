import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/seller", "/supplier", "/sales", "/api/", "/onboarding", "/login", "/signup"],
    },
    sitemap: "https://www.axqen.app/sitemap.xml",
    host: "https://www.axqen.app",
  };
}
