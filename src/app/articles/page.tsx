import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { breadcrumbJsonLd, serializeJsonLd, siteUrl } from "@/lib/seoJson";
import { isIndexableArticle, MIN_INDEXABLE_LISTINGS } from "@/server/seoIndexability";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const published = await db.article.findMany({
    where: { isPublished: true },
    select: { content: true },
    take: 500,
  });
  const indexable = published.filter((article) => isIndexableArticle(article.content)).length >= MIN_INDEXABLE_LISTINGS;
  return {
    title: { absolute: "مجله ویلاسنتو | راهنمای خرید و فروش ویلا، باغ و املاک" },
    description: "مقاله‌ها و راهنماهای کاربردی ویلاسنتو درباره خرید و فروش ویلا، باغ، زمین، مدارک معامله و نکات بررسی ملک.",
    alternates: { canonical: "/articles" },
    robots: { index: indexable, follow: true },
    openGraph: {
      title: "مجله ویلاسنتو",
      description: "راهنماهای کاربردی خرید، فروش و اجاره ویلا و املاک",
      url: siteUrl("/articles"),
      type: "website",
    },
  };
}

export default async function ArticlesIndexPage() {
  const articles = await db.article.findMany({
    where: { isPublished: true },
    select: { title: true, slug: true, excerpt: true, coverUrl: true, publishedAt: true, content: true },
    orderBy: { publishedAt: "desc" },
    take: 36,
  });
  const indexableArticles = articles.filter((article) => isIndexableArticle(article.content));
  const breadcrumb = breadcrumbJsonLd([
    { name: "خانه", path: "/" },
    { name: "مجله ویلاسنتو", path: "/articles" },
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <script
        id="vs-jsonld-articles-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumb) }}
      />
      <header className="max-w-3xl mb-8">
        <nav className="text-xs text-muted-foreground mb-4" aria-label="مسیر">
          <Link href="/" className="hover:text-primary">خانه</Link>
          <span className="mx-2">/</span>
          <span>مجله ویلاسنتو</span>
        </nav>
        <h1 className="text-2xl md:text-3xl font-black">مجله ویلاسنتو؛ راهنمای خرید، فروش و اجاره ملک</h1>
        <p className="text-sm text-muted-foreground leading-8 mt-3">
          راهنماهای منتشرشده درباره بررسی سند، خرید ویلا و باغ، اجاره ملک و نکات کاربردی معامله را در این بخش بخوانید.
        </p>
      </header>

      {indexableArticles.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
          هنوز مقاله‌ای برای نمایش در این بخش منتشر نشده است.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {indexableArticles.map((article) => (
            <article key={article.slug} className="overflow-hidden rounded-2xl border bg-card">
              <Link href={"/article/" + encodeURIComponent(article.slug)} className="block">
                {article.coverUrl ? (
                  <img src={article.coverUrl} alt={article.title} loading="lazy" width={640} height={420} className="aspect-[3/2] w-full object-cover" />
                ) : null}
                <div className="p-4">
                  <h2 className="font-bold leading-7">{article.title}</h2>
                  {article.excerpt ? <p className="mt-2 text-sm leading-7 text-muted-foreground line-clamp-3">{article.excerpt}</p> : null}
                  {article.publishedAt ? (
                    <time dateTime={article.publishedAt.toISOString()} className="mt-3 block text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" }).format(article.publishedAt)}
                    </time>
                  ) : null}
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
