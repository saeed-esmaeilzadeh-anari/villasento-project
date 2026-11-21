import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cityNameToSlug, propertyDetail } from "@/server/services/properties";
import { listingJsonLd, breadcrumbJsonLd, serializeJsonLd } from "@/lib/seoJson";
import { listingSeoTitle, listingSeoDescription } from "@/lib/seoTitles";
import { PropertyDetailClient } from "@/views/PropertyDetailClient";
import type { PropertyDetailT } from "@/lib/api";
import { SITE_NAME } from "@/lib/seoConstants";
import Link from "next/link";

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
  if (p.slug && p.slug !== id) permanentRedirect("/property/" + encodeURIComponent(p.slug));

  const canonicalPath = `/property/${p.slug ?? p.id}`;
  const landingPath = p.transactionType === "SALE"
    ? p.type === "GARDEN" ? "/l/buy-garden" : p.type === "LAND" ? "/l/buy-land" : p.type === "HOUSE" || p.type === "APARTMENT" ? "/l/buy-house" : "/l/buy-villa"
    : p.type === "HOUSE" || p.type === "APARTMENT" ? "/l/rent-house" : "/l/rent-villa";
  const breadcrumb = breadcrumbJsonLd([
    { name: "خانه", path: "/" },
    { name: p.typeLabel, path: landingPath },
    ...(p.city ? [{ name: p.city, path: `/city/${cityNameToSlug(p.city)}` }] : p.region ? [{ name: p.region.name, path: `/region/${p.region.nameEn}` }] : []),
    { name: p.title, path: canonicalPath },
  ]);
  const listing = listingJsonLd({ ...p, slugOrId: p.slug ?? p.id });

  return (
    <>
      <script
        id="vs-jsonld-listing-ssr"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(listing) }}
      />
      <script
        id="vs-jsonld-breadcrumb-ssr"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumb) }}
      />
      <main className="mx-auto max-w-7xl px-4 pt-5">
        <nav className="text-xs text-muted-foreground flex flex-wrap items-center gap-1 mb-4" aria-label="مسیر">
          <Link href="/" className="hover:text-primary">خانه</Link>
          <span>/</span>
          <Link href={landingPath} className="hover:text-primary">{p.typeLabel}</Link>
          {p.city ? (
            <>
              <span>/</span>
              <Link href={"/city/" + cityNameToSlug(p.city)} className="hover:text-primary">{p.city}</Link>
            </>
          ) : p.region ? (
            <>
              <span>/</span>
              <Link href={"/region/" + p.region.nameEn} className="hover:text-primary">{p.region.name}</Link>
            </>
          ) : null}
          <span>/</span>
          <span className="text-foreground line-clamp-1">{p.title}</span>
        </nav>
      </main>
      <PropertyDetailClient id={p.id} initialData={p} />
    </>
  );
}
