import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { articleBySlug } from "@/server/services/content";
import { ArticleClient } from "@/views/ArticleClient";
import type { ArticleDetailT } from "@/views/ArticlesView";
import { isIndexableArticle } from "@/server/seoIndexability";
import { breadcrumbJsonLd, serializeJsonLd, siteUrl } from "@/lib/seoJson";

type Props = { params: Promise<{ slug: string }> };

async function safeArticle(slug: string) {
  try {
    const a = await articleBySlug(slug, { countView: false });
    return JSON.parse(JSON.stringify(a)) as unknown as ArticleDetailT;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await safeArticle(slug);
  if (!a) return { title: "مقاله یافت نشد", robots: { index: false, follow: false } };
  const canonical = `/article/${slug}`;
  return {
    title: { absolute: `${a.title} | مجله ویلاسنتو` },
    description: a.excerpt || a.content.slice(0, 150),
    alternates: { canonical },
    robots: { index: isIndexableArticle(a.content), follow: true },
    openGraph: {
      title: a.title,
      description: a.excerpt,
      url: canonical,
      type: "article",
      images: a.coverUrl ? [{ url: a.coverUrl, alt: a.title }] : undefined,
      publishedTime: a.publishedAt ?? undefined,
      modifiedTime: a.updatedAt ? new Date(a.updatedAt).toISOString() : undefined,
    },
    twitter: { card: "summary_large_image", title: a.title, description: a.excerpt },
    keywords: a.tags ? a.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const a = await safeArticle(slug);
  if (!a) notFound();

  const breadcrumb = breadcrumbJsonLd([
    { name: "خانه", path: "/" },
    { name: "مقالات", path: "/articles" },
    ...(a.category ? [{ name: a.category.name, path: "/articles" }] : []),
    { name: a.title, path: `/article/${slug}` },
  ]);
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.excerpt,
    image: a.coverUrl ?? undefined,
    ...(a.publishedAt ? { datePublished: a.publishedAt } : {}),
    ...(a.updatedAt ? { dateModified: a.updatedAt } : {}),
    author: {
      "@type": a.authorName === "تحریریه ویلاسنتو" ? "Organization" : "Person",
      name: a.authorName,
    },
    publisher: { "@type": "Organization", name: "ویلاسنتو" },
    mainEntityOfPage: siteUrl(`/article/${slug}`),
  };

  return (
    <>
      <script
        id="vs-jsonld-article-ssr"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(articleLd) }}
      />
      <script
        id="vs-jsonld-breadcrumb-ssr"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumb) }}
      />
      <ArticleClient slug={slug} initialData={a} />
    </>
  );
}
