import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin", "/account", "/new-listing"],
      },
    ],
    sitemap: SITE_URL ? `${SITE_URL}/sitemap.xml` : "/sitemap.xml",
  };
}
