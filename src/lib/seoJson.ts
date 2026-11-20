/**
 * Pure SEO helpers (JSON-LD builders + canonical URLs).
 * NO "use client" — safe to call from server components AND client components.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "";

/** Canonical public URL for a clean (SSR) path — hash-SPA routes canonicalize to it */
export function siteUrl(path = "/"): string {
  return SITE_URL + (path.startsWith("/") ? path : "/" + path);
}

// ───────────────────────── JSON-LD builders ─────────────────────────

export const JSONLD_IDS = {
  org: "vs-jsonld-org",
  website: "vs-jsonld-website",
  breadcrumb: "vs-jsonld-breadcrumb",
  faq: "vs-jsonld-faq",
} as const;

/** Organization / RealEstateAgent JSON-LD for the whole site (server-rendered too) */
export function organizationJsonLd(phone: string, address: string, siteUrlOverride?: string) {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: "ویلاسنتو",
    alternateName: "VillaSento",
    url: siteUrlOverride ?? siteUrl("/"),
    telephone: phone,
    address: { "@type": "PostalAddress", addressCountry: "IR", streetAddress: address },
    areaServed: "IR",
  };
}

/** WebSite + SearchAction (sitelinks searchbox) */
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ویلاسنتو",
    alternateName: "VillaSento",
    url: siteUrl("/"),
    inLanguage: "fa-IR",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl("/search")}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** BreadcrumbList */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: siteUrl(it.path),
    })),
  };
}

/** FAQPage */
export function faqJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

/** RealEstateListing JSON-LD for the property page */
export function listingJsonLd(p: {
  title: string; description: string; image: string | null;
  city: string; province: string; lat: number | null; lng: number | null;
  transactionType: string; salePrice?: number | null; rentAmount?: number | null;
  code: string; updatedAt?: string | Date | null;
  slugOrId?: string;
}) {
  const offers: Record<string, unknown> = {
    "@type": "Offer",
    availability: "https://schema.org/InStock",
    businessFunction: p.transactionType === "SALE" ? "https://schema.org/Sell" : "https://schema.org/LeaseOut",
  };
  if (p.salePrice) offers.price = p.salePrice;
  else if (p.rentAmount) offers.price = p.rentAmount;
  if (offers.price) offers.priceCurrency = "IRR";
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: p.title,
    description: p.description.slice(0, 300),
    url: p.slugOrId ? siteUrl(`/property/${p.slugOrId}`) : `${siteUrl("/")}/#/property/${p.code}`,
    image: p.image ?? undefined,
    datePosted: p.updatedAt ?? undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: p.city,
      addressRegion: p.province,
      addressCountry: "IR",
    },
    ...(p.lat && p.lng
      ? { geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lng } }
      : {}),
    offers,
  };
}
