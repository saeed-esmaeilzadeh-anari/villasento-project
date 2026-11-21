import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { getAllSettings } from "@/server/settings";
import { organizationJsonLd, serializeJsonLd, siteUrl, websiteJsonLd } from "@/lib/seoJson";



const FALLBACK = {
  title: "ویلاسنتو | خرید، فروش، رهن و اجاره باغ، ویلا و باغ‌ویلا",
  description:
    "ویلاسنتو مرجع تخصصی املاک تفریحی و مسکونی؛ آگهی‌های تأییدشده خرید و فروش، رهن کامل، رهن و اجاره باغ، ویلا، باغ‌ویلا با مشاوران معتمد و درخواست بازدید آنلاین.",
};

/** Settings-driven metadata (falls back to safe defaults when DB is unavailable) */
export async function generateMetadata(): Promise<Metadata> {
  let siteName = "ویلاسنتو";
  let title = FALLBACK.title;
  let description = FALLBACK.description;
  let keywords: string[] = [
    "ویلاسنتو", "VillaSento", "خرید ویلا", "فروش ویلا", "اجاره ویلا", "خرید باغ", "خرید زمین", "املاک تفریحی",
  ];
  let googleVerification: string | undefined;
  let ogImage: string | undefined;

  try {
    const s = await getAllSettings();
    if (s["site.name"]) siteName = s["site.name"];
    if (s["seo.defaultTitle"]) title = s["seo.defaultTitle"];
    if (s["seo.defaultDescription"]) description = s["seo.defaultDescription"];
    if (s["seo.keywords"]) keywords = s["seo.keywords"].split(",").map((k) => k.trim()).filter(Boolean);
    if (s["seo.googleVerification"]) googleVerification = s["seo.googleVerification"];
    if (s["seo.ogImage"]) ogImage = s["seo.ogImage"];
  } catch {
    /* DB not reachable (e.g. build sandbox) — use defaults */
  }

  return {
    metadataBase: new URL(siteUrl("/")),
    title: { default: title, template: `%s | ${siteName}` },
    description,
    keywords,
    applicationName: siteName,
    authors: [{ name: siteName, url: siteUrl("/") }],
    creator: siteName,
    publisher: siteName,
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    },
    manifest: "/manifest.webmanifest",
    icons: { icon: "/icon.svg", apple: "/icon.svg" },
    alternates: { canonical: siteUrl("/") },
    ...(googleVerification ? { verification: { google: googleVerification } } : {}),
    openGraph: {
      title,
      description,
      type: "website",
      locale: "fa_IR",
      siteName,
      url: siteUrl("/"),
      images: [{ url: ogImage ?? "/og-cover.png", width: 1200, height: 630, alt: siteName }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage ?? "/og-cover.png"],
    },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#0d5c46",
  width: "device-width",
  initialScale: 1,
};

/** Applies saved theme (mode/palette/fontsize/density/radius) BEFORE first paint — prevents FOUC */
const THEME_BOOTSTRAP = `(function(){try{var p=JSON.parse(localStorage.getItem("villasento-theme")||"null");if(p&&typeof p==="object"){var d=document.documentElement;var m=p.mode||"auto";var dark=m==="dark";if(m==="system"){dark=window.matchMedia("(prefers-color-scheme: dark)").matches}else if(m==="auto"){var ds=Number(p.dayStart==null?7:p.dayStart),de=Number(p.dayEnd==null?19:p.dayEnd),h=new Date().getHours();var day=ds<=de?(h>=ds&&h<de):(h>=ds||h<de);dark=!day}d.classList.toggle("dark",dark);if(p.palette)d.setAttribute("data-palette",String(p.palette));if(p.fontSize)d.setAttribute("data-fontsize",String(p.fontSize));if(p.density)d.setAttribute("data-density",String(p.density));if(p.radius)d.setAttribute("data-radius",String(p.radius));if(p.palette==="custom"&&p.customColor&&/^#[0-9a-fA-F]{6}$/.test(p.customColor)){d.style.setProperty("--custom-primary",p.customColor)}}}catch(e){}})();`;

/** Server-rendered JSON-LD so crawlers see it without executing JS */
async function SiteJsonLd() {
  let phone: string | undefined;
  let address: string | undefined;
  try {
    const s = await getAllSettings();
    if (s["site.supportPhone"]) phone = s["site.supportPhone"];
    if (s["site.address"]) address = s["site.address"];
  } catch { /* defaults */ }
  const org = organizationJsonLd(phone, address, siteUrl("/"));
  const website = websiteJsonLd();
  return (
    <>
      <script
        type="application/ld+json"
        id="vs-jsonld-org"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(org) }}
      />
      <script
        type="application/ld+json"
        id="vs-jsonld-website"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(website) }}
      />
    </>
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <SiteJsonLd />
      </head>
      <body className="antialiased bg-background text-foreground font-sans min-h-screen">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        {children}
        <Toaster position="top-center" richColors closeButton dir="rtl" />
      </body>
    </html>
  );
}
