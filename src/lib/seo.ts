"use client";

import { useEffect } from "react";
import {
  siteUrl,
  organizationJsonLd,
  websiteJsonLd,
  breadcrumbJsonLd,
  faqJsonLd,
  listingJsonLd,
  JSONLD_IDS,
} from "./seoJson";

// Re-export pure builders so client components can import everything from "@/lib/seo"
export { siteUrl, organizationJsonLd, websiteJsonLd, breadcrumbJsonLd, faqJsonLd, listingJsonLd, JSONLD_IDS };

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
  /** Clean SSR path of this content, e.g. "/property/villa-tehran-300m-vs1234" */
  path?: string;
  image?: string | null;
  jsonLd?: unknown | null;
  jsonLdExtra?: { id: string; data: unknown | null }[];
  noIndex?: boolean;
};

/**
 * Client-side per-route SEO: <title>, meta description, OG/Twitter, canonical
 * + JSON-LD. Canonical points at the CLEAN SSR URL (never the #fragment) so
 * crawl signals consolidate on the server-rendered URL.
 */
export function useSeo({ title, description, path, image, jsonLd, jsonLdExtra, noIndex }: SeoInput) {
  useEffect(() => {
    document.title = title;
    if (description) {
      upsertMeta("name", "description", description);
    }
    const url = siteUrl(path ?? "/");
    if (noIndex) {
      upsertMeta("name", "robots", "noindex, follow");
    } else {
      upsertMeta("name", "robots", "index, follow, max-image-preview:large");
    }
    upsertCanonical(url);
    upsertMeta("property", "og:title", title);
    if (description) upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", "ویلاسنتو | VillaSento");
    upsertMeta("property", "og:locale", "fa_IR");
    if (image) upsertMeta("property", "og:image", image.startsWith("http") ? image : siteUrl(image));
    upsertMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
    upsertMeta("name", "twitter:title", title);
    if (description) upsertMeta("name", "twitter:description", description);
    upsertJsonLd("vs-jsonld", jsonLd ?? null);
    for (const extra of jsonLdExtra ?? []) upsertJsonLd(extra.id, extra.data);
    return () => {
      upsertJsonLd("vs-jsonld", null);
      for (const extra of jsonLdExtra ?? []) upsertJsonLd(extra.id, null);
    };
  }, [title, description, path, image, jsonLd, noIndex, jsonLdExtra]);
}

// ───────────────────────── JSON-LD builders ─────────────────────────
