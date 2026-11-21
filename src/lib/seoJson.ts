/**
 * Pure SEO helpers (JSON-LD builders + canonical URLs).
 * NO "use client" — safe to call from server components AND client components.
 */

const PRODUCTION_SITE_URL = "https://www.vilasento.ir";

function configuredSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return process.env.NODE_ENV === "production" ? PRODUCTION_SITE_URL : "http://localhost:3000";

  try {
    const parsed = new URL(configured);
    const localHost = ["localhost", "127.0.0.1", "0.0.0.0"].includes(parsed.hostname);
    if (process.env.NODE_ENV === "production" && localHost) return PRODUCTION_SITE_URL;
    return parsed.origin;
  } catch {
    return PRODUCTION_SITE_URL;
  }
}

const SITE_URL = configuredSiteUrl();

export function siteUrl(path = "/"): string {
  return new URL(path.startsWith("/") ? path : "/" + path, SITE_URL + "/").toString();
}

/** Safe JSON-LD serialization for text originating in the database or user input. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export const JSONLD_IDS = {
  org: "vs-jsonld-org",
  website: "vs-jsonld-website",
  breadcrumb: "vs-jsonld-breadcrumb",
  faq: "vs-jsonld-faq",
} as const;

export function organizationJsonLd(phone?: string, address?: string, siteUrlOverride?: string) {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: "ویلاسنتو",
    alternateName: "VillaSento",
    url: siteUrlOverride ?? siteUrl("/"),
    ...(phone?.trim() ? { telephone: phone.trim() } : {}),
    ...(address?.trim() ? { address: { "@type": "PostalAddress", addressCountry: "IR", streetAddress: address.trim() } } : {}),
    areaServed: "IR",
  };
}

/** SearchAction is omitted until the SPA search has a clean, query-addressable URL. */
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ویلاسنتو",
    alternateName: "VillaSento",
    url: siteUrl("/"),
    inLanguage: "fa-IR",
  };
}

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

export function listingJsonLd(p: {
  title: string; description: string; image: string | null;
  city?: string | null; province?: string | null; lat: number | null; lng: number | null;
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
    ...(p.slugOrId ? { url: siteUrl("/property/" + encodeURIComponent(p.slugOrId)) } : {}),
    image: p.image ?? undefined,
    datePosted: p.updatedAt ?? undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: p.city ?? undefined,
      addressRegion: p.province ?? undefined,
      addressCountry: "IR",
    },
    ...(p.lat != null && p.lng != null
      ? { geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lng } }
      : {}),
    offers,
  };
}
