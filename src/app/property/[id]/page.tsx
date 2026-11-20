import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { propertyDetail } from "@/server/services/properties";
import { listingJsonLd, breadcrumbJsonLd, siteUrl } from "@/lib/seoJson";
import { listingSeoTitle, listingSeoDescription } from "@/lib/seoTitles";
import { PropertyDetailClient } from "@/views/PropertyDetailClient";
import type { PropertyDetailT } from "@/lib/api";
import { SITE_NAME } from "@/lib/seoConstants";

type Props = { params: Promise<{ id: string }> };

/** Resolve by id OR slug; never throws (crawler-safe). View counting is skipped here — the client /api/track handles real views. */
async function safeDetail(id: string) {
  try {
    const d = await propertyDetail(id, null, { countView: false });
    // Dates → ISO strings for the client boundary (matches PropertyDetailT)
    return JSON.parse(JSON.stringify(d)) as PropertyDetailT;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await safeDetail(id);
  if (!p) {
    return { title: "آگهی یافت نشد", robots: { index: false, follow: false } };
  }
  const title = { absolute: `${listingSeoTitle(p)} | ${SITE_NAME}` };
  const description = listingSeoDescription(p);
  const canonical = `/property/${p.slug ?? p.id}`;
  const image = p.image ?? "/og-cover.png";

  if (p.status !== "PUBLISHED") {
    return {
      title,
      description,
      alternates: { canonical },
      robots: { index: false, follow: true },
      openGraph: { title, description, images: [image], type: "article" },
    };
  }

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true, googleBot: { "max-image-preview": "large" } },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "article",
      images: [{ url: image, alt: p.title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function PropertyDetailPage({ params }: Props) {
  const { id } = await params;
  const p = await safeDetail(id);
  if (!p) notFound();

  const canonicalPath = `/property/${p.slug ?? p.id}`;
  const breadcrumb = breadcrumbJsonLd([
    { name: "خانه", path: "/" },
    { name: "املاک", path: "/search" },
    { name: p.typeLabel, path: `/search?types=${p.type}` },
    { name: p.city, path: `/city/${encodeURIComponent(p.city)}` },
    { name: p.title, path: canonicalPath },
  ]);
  const listing = listingJsonLd({ ...p, slugOrId: p.slug ?? p.id });

  return (
    <>
      <script
        id="vs-jsonld-listing-ssr"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(listing) }}
      />
      <script
        id="vs-jsonld-breadcrumb-ssr"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <PropertyDetailClient id={p.id} initialData={p} />
    </>
  );
}
