import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cmsPage } from "@/server/services/public";
import { CmsPageClient } from "@/views/CmsPageClient";
import type { CmsPageT } from "@/views/CmsPageView";

type Props = { params: Promise<{ slug: string }> };

async function safePage(slug: string) {
  try {
    const p = await cmsPage(slug);
    return p ? (JSON.parse(JSON.stringify(p)) as unknown as CmsPageT) : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await safePage(slug);
  if (!page) return { title: "صفحه یافت نشد", robots: { index: false, follow: false } };
  return {
    title: { absolute: `${page.title} | ویلاسنتو` },
    description: page.content.replace(/\s+/g, " ").slice(0, 160),
    alternates: { canonical: `/page/${slug}` },
    robots: { index: true, follow: true },
    openGraph: { title: page.title, description: page.content.slice(0, 160), url: `/page/${slug}`, type: "article" },
  };
}

export default async function StaticCmsPage({ params }: Props) {
  const { slug } = await params;
  const page = await safePage(slug);
  if (!page) notFound();
  return <CmsPageClient slug={slug} initialData={page} />;
}
