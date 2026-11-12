import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/sitemap — dynamic XML sitemap of all published listings + articles + pages.
 * Point robots.txt to this endpoint (or pre-render public/sitemap.xml via `bun scripts/sitemap.ts`).
 */
export async function GET(req: Request) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const [props, articles, pages] = await Promise.all([
    db.property.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, updatedAt: true, createdAt: true },
      take: 5000,
    }),
    db.article.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true }, take: 1000 }),
    db.cmsPage.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true }, take: 200 }),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const urls: { loc: string; changefreq: string; priority: string; lastmod: string }[] = [
    { loc: `${base}/`, changefreq: "daily", priority: "1.0", lastmod: today },
    { loc: `${base}/#/search`, changefreq: "daily", priority: "0.9", lastmod: today },
    { loc: `${base}/#/articles`, changefreq: "weekly", priority: "0.6", lastmod: today },
  ];
  for (const p of props) {
    urls.push({
      loc: `${base}/#/property/${p.id}`,
      changefreq: "weekly",
      priority: "0.8",
      lastmod: (p.updatedAt ?? p.createdAt).toISOString().slice(0, 10),
    });
  }
  for (const a of articles) {
    urls.push({ loc: `${base}/#/article/${a.slug}`, changefreq: "monthly", priority: "0.5", lastmod: a.updatedAt.toISOString().slice(0, 10) });
  }
  for (const c of pages) {
    urls.push({ loc: `${base}/#/page/${c.slug}`, changefreq: "monthly", priority: "0.3", lastmod: c.updatedAt.toISOString().slice(0, 10) });
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
      )
      .join("\n") +
    `\n</urlset>\n`;

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
