/**
 * Generates a static public/sitemap.xml from the live database.
 * Run: bun scripts/sitemap.ts
 * (A dynamic version is also always available at GET /api/sitemap)
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import { join } from "path";

const db = new PrismaClient();

async function main() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const [props, articles, pages] = await Promise.all([
    db.property.findMany({ where: { status: "PUBLISHED" }, select: { id: true, updatedAt: true, createdAt: true }, take: 5000 }),
    db.article.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true }, take: 1000 }),
    db.cmsPage.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true }, take: 200 }),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const urls: { loc: string; lastmod: string; freq: string; pri: string }[] = [
    { loc: `${base}/`, lastmod: today, freq: "daily", pri: "1.0" },
    { loc: `${base}/#/search`, lastmod: today, freq: "daily", pri: "0.9" },
    { loc: `${base}/#/articles`, lastmod: today, freq: "weekly", pri: "0.6" },
    ...props.map((p) => ({
      loc: `${base}/#/property/${p.id}`,
      lastmod: (p.updatedAt ?? p.createdAt).toISOString().slice(0, 10),
      freq: "weekly", pri: "0.8",
    })),
    ...articles.map((a) => ({
      loc: `${base}/#/article/${a.slug}`,
      lastmod: a.updatedAt.toISOString().slice(0, 10),
      freq: "monthly", pri: "0.5",
    })),
    ...pages.map((c) => ({
      loc: `${base}/#/page/${c.slug}`,
      lastmod: c.updatedAt.toISOString().slice(0, 10),
      freq: "monthly", pri: "0.3",
    })),
  ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`).join("\n") +
    `\n</urlset>\n`;

  writeFileSync(join(process.cwd(), "public", "sitemap.xml"), xml);
  console.log(`✅ sitemap.xml written with ${urls.length} URLs (base: ${base})`);
}

main().finally(() => db.$disconnect());
