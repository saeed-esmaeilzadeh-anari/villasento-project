import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { LANDINGS } from "@/lib/landings";
import { cityNameToSlug } from "@/server/services/properties";
import {
  indexableRegions,
  isIndexableArticle,
  isIndexableCmsPage,
  isValidSitemapSegment,
  landingInventoryCount,
  MIN_INDEXABLE_LISTINGS,
  publishedPropertyWhere,
} from "@/server/seoIndexability";
import { siteUrl } from "@/lib/seoJson";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [properties, articles, pages, cities, regions, landingCounts, cityCounts] = await Promise.all([
    db.property.findMany({
      where: publishedPropertyWhere(now),
      select: { slug: true, updatedAt: true },
      take: 50000,
      orderBy: { updatedAt: "desc" },
    }),
    db.article.findMany({
      where: { isPublished: true },
      select: { slug: true, content: true, updatedAt: true },
      take: 5000,
      orderBy: { updatedAt: "desc" },
    }),
    db.cmsPage.findMany({
      where: { isPublished: true },
      select: { slug: true, content: true, updatedAt: true },
      take: 1000,
      orderBy: { updatedAt: "desc" },
    }),
    db.city.findMany({
      where: { properties: { some: publishedPropertyWhere(now) } },
      select: { id: true, name: true },
      take: 2000,
      orderBy: { name: "asc" },
    }),
    indexableRegions(now),
    Promise.all(LANDINGS.map(async (landing) => ({
      slug: landing.slug,
      count: await landingInventoryCount(landing, now),
    }))),
    db.property.groupBy({
      by: ["cityId"],
      where: { ...publishedPropertyWhere(now), cityId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const indexableArticleCount = articles.filter((article) => isIndexableArticle(article.content)).length;
  const entries: MetadataRoute.Sitemap = [{ url: siteUrl("/") }];
  if (indexableArticleCount >= MIN_INDEXABLE_LISTINGS) entries.push({ url: siteUrl("/articles") });

  for (const landing of LANDINGS) {
    const count = landingCounts.find((entry) => entry.slug === landing.slug)?.count ?? 0;
    if (count >= MIN_INDEXABLE_LISTINGS && isValidSitemapSegment(landing.slug)) {
      entries.push({ url: siteUrl("/l/" + landing.slug) });
    }
  }

  const cityInventory = new Map<string, number>();
  for (const row of cityCounts) {
    if (row.cityId) cityInventory.set(row.cityId, row._count._all);
  }
  for (const city of cities) {
    const slug = cityNameToSlug(city.name);
    if ((cityInventory.get(city.id) ?? 0) >= MIN_INDEXABLE_LISTINGS && isValidSitemapSegment(slug)) {
      entries.push({ url: siteUrl("/city/" + slug) });
    }
  }

  for (const region of regions) {
    if (isValidSitemapSegment(region.nameEn)) {
      entries.push({ url: siteUrl("/region/" + region.nameEn), lastModified: region.updatedAt });
    }
  }

  for (const property of properties) {
    const segment = isValidSitemapSegment(property.slug) ? property.slug : null;
    if (segment) {
      entries.push({
        url: siteUrl("/property/" + encodeURIComponent(segment)),
        lastModified: property.updatedAt,
      });
    }
  }

  for (const article of articles) {
    if (isValidSitemapSegment(article.slug) && isIndexableArticle(article.content)) {
      entries.push({
        url: siteUrl("/article/" + encodeURIComponent(article.slug)),
        lastModified: article.updatedAt,
      });
    }
  }

  for (const page of pages) {
    if (isValidSitemapSegment(page.slug) && isIndexableCmsPage(page.content)) {
      entries.push({
        url: siteUrl("/page/" + encodeURIComponent(page.slug)),
        lastModified: page.updatedAt,
      });
    }
  }

  const unique = new Map<string, MetadataRoute.Sitemap[number]>();
  for (const entry of entries) unique.set(entry.url, entry);
  return [...unique.values()];
}
