import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seoJson";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/files/"],
        disallow: ["/api/"],
      },
    ],
    sitemap: siteUrl("/sitemap.xml"),
  };
}
