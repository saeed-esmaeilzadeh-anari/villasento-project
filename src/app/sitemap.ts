import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { LANDINGS } from "@/lib/landings";
import { cityNameToSlug } from "@/server/services/properties";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "";

/**
 * Dynamic XML sitemap with CLEAN (crawlable) URLs:
 * home, SEO landing pages, city pages, published listings (slug or id),
 * articles and CMS pages. Rebuilt at most once per hour.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_URL || "";
  const today = new Date();

  const [props, articles, pages, cities] = await Promise.all([
    db.property.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, slug: true, updatedAt: true, createdAt: true, city: { select: { name: true } } },
      take: 5000,
      orderBy: { updatedAt: "desc" },
    }),
    db.article.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true }, take: 1000 }),
    db.cmsPage.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true }, take: 200 }),
    db.city.findMany({
      where: { properties: { some: { status: "PUBLISHED" } } },
      select: { name: true },
      take: 300,
    }),
  ]);

  const urls: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1, lastModified: today },
  ];

  // SEO landing pages
  for (const l of LANDINGS) {
    urls.push({ url: `${base}/l/${l.slug}`, changeFrequency: "daily", priority: 0.9, lastModified: today });
  }

  // city pages
  for (const c of cities) {
    urls.push({ url: `${base}/city/${cityNameToSlug(c.name)}`, changeFrequency: "daily", priority: 0.8, lastModified: today });
  }

  // published listings — SEO slug when available
  for (const p of props) {
    urls.push({
      url: `${base}/property/${p.slug ?? p.id}`,
      changeFrequency: "weekly",
      priority: 0.8,
      lastModified: p.updatedAt ?? p.createdAt ?? today,
    });
  }

  // articles
  for (const a of articles) {
    urls.push({ url: `${base}/article/${a.slug}`, changeFrequency: "monthly", priority: 0.6, lastModified: a.updatedAt ?? today });
  }

  // CMS pages
  for (const c of pages) {
    urls.push({ url: `${base}/page/${c.slug}`, changeFrequency: "monthly", priority: 0.4, lastModified: c.updatedAt ?? today });
  }

  return urls;
}
