import { handler, ok } from "@/server/http";
import { db } from "@/lib/db";
import * as Content from "@/server/services/content";
import { searchProperties } from "@/server/services/properties";
import { getAllSettings } from "@/server/settings";

/**
 * GET /api/home — one aggregated call for the homepage:
 * latest, featured, most-viewed, category counts, banners, articles, faqs, stats, settings
 */
export const GET = handler(async () => {
  const [latest, featured, mostViewed, banners, articles, faqs, settings, byType, byTT] = await Promise.all([
    searchProperties({ sort: "NEWEST", pageSize: 8 }),
    searchProperties({ featuredOnly: true, sort: "NEWEST", pageSize: 6 }),
    searchProperties({ sort: "MOST_VIEWED", pageSize: 6 }),
    Content.activeBanners(),
    Content.listArticles({ pageSize: 3 }),
    Content.activeFaqs(),
    getAllSettings(),
    db.$queryRaw<{ type: string; cnt: number }[]>`SELECT type as type, COUNT(*) as cnt FROM Property WHERE status = 'PUBLISHED' GROUP BY type`.catch(() => []),
    db.$queryRaw<{ transactionType: string; cnt: number }[]>`SELECT transactionType as transactionType, COUNT(*) as cnt FROM Property WHERE status = 'PUBLISHED' GROUP BY transactionType`.catch(() => []),
  ]);

  let social: { label: string; url: string }[] = [];
  try { social = JSON.parse(settings["site.social"] ?? "[]"); } catch { /* noop */ }
  let stats: Record<string, number> = {};
  try { stats = JSON.parse(settings["site.stats"] ?? "{}"); } catch { /* noop */ }

  return ok({
    latest: latest.items,
    featured: featured.items,
    mostViewed: mostViewed.items,
    banners,
    articles: articles.items,
    faqs,
    byType: byType.map((r) => ({ type: r.type, count: Number(r.cnt) })),
    byTransactionType: byTT.map((r) => ({ tt: r.transactionType, count: Number(r.cnt) })),
    stats,
    social,
    site: {
      name: settings["site.name"] ?? "ویلاسنتو",
      tagline: settings["site.tagline"] ?? "",
      supportPhone: settings["site.supportPhone"] ?? "",
      email: settings["site.email"] ?? "",
      address: settings["site.address"] ?? "",
    },
  });
});
