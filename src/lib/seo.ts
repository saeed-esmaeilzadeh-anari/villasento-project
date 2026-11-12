"use client";

import { useEffect } from "react";

const SITE_URL = typeof window !== "undefined" ? window.location.origin : "";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function upsertJsonLd(id: string, data: unknown | null) {
  let el = document.getElementById(id);
  if (!data) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    (el as HTMLScriptElement).type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export type SeoInput = {
  title: string;
  description?: string;
  path?: string; // hash path e.g. "/property/xyz"
  image?: string | null;
  jsonLd?: unknown | null;
  noIndex?: boolean;
};

/** Client-side per-route SEO: <title>, meta description, OG tags, canonical + optional JSON-LD */
export function useSeo({ title, description, path, image, jsonLd, noIndex }: SeoInput) {
  useEffect(() => {
    document.title = title;
    if (description) {
      upsertMeta("name", "description", description);
    }
    const url = SITE_URL + (path ? "/#" + path : "/");
    if (noIndex) {
      upsertMeta("name", "robots", "noindex, follow");
    } else {
      upsertMeta("name", "robots", "index, follow");
    }
    upsertCanonical(url);
    upsertMeta("property", "og:title", title);
    if (description) upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", "ویلاسنتو | VillaSento");
    upsertMeta("property", "og:locale", "fa_IR");
    if (image) upsertMeta("property", "og:image", image.startsWith("http") ? image : SITE_URL + image);
    upsertMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
    upsertJsonLd("vs-jsonld", jsonLd ?? null);
    return () => upsertJsonLd("vs-jsonld", null);
  }, [title, description, path, image, jsonLd, noIndex]);
}

/** Organization JSON-LD for the homepage */
export function organizationJsonLd(phone: string, address: string) {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: "ویلاسنتو",
    alternateName: "VillaSento",
    url: SITE_URL,
    telephone: phone,
    address: { "@type": "PostalAddress", addressCountry: "IR", streetAddress: address },
  };
}

/** RealEstateListing JSON-LD for the property page */
export function listingJsonLd(p: {
  title: string; description: string; image: string | null;
  city: string; province: string; lat: number | null; lng: number | null;
  transactionType: string; salePrice?: number | null; rentAmount?: number | null;
  code: string; updatedAt?: string | null;
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
    url: `${SITE_URL}/#/property/${p.code}`,
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
