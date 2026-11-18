import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "ویلاسنتو | خرید، فروش، رهن و اجاره باغ، ویلا و باغ‌ویلا",
  description:
    "ویلاسنتو مرجع تخصصی املاک تفریحی و مسکونی؛ آگهی‌های تأییدشده خرید و فروش، رهن کامل، رهن و اجاره باغ، ویلا، باغ‌ویلا با مشاوران معتمد و درخواست بازدید آنلاین.",
  keywords: ["خرید ویلا", "فروش باغ", "رهن و اجاره", "باغ‌ویلا", "ویلاسنتو", "VillaSento", "املاک تفریحی", "اجاره ماهانه ویلا"],
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  alternates: { canonical: "/" },
  openGraph: {
    title: "ویلاسنتو | مرجع خرید، فروش، رهن و اجاره باغ و ویلا",
    description: "آگهی‌های تأییدشده املاک تفریحی و مسکونی با مشخصات کامل سند و مشاوران معتمد",
    type: "website",
    locale: "fa_IR",
    siteName: "ویلاسنتو",
  },
  twitter: { card: "summary_large_image", title: "ویلاسنتو", description: "مرجع املاک تفریحی و مسکونی" },
};

export const viewport: Viewport = {
  themeColor: "#0d5c46",
  width: "device-width",
  initialScale: 1,
};

/** Applies saved theme (mode/palette/fontsize/density/radius) BEFORE first paint — prevents FOUC */
const THEME_BOOTSTRAP = `(function(){try{var p=JSON.parse(localStorage.getItem("villasento-theme")||"null");if(p&&typeof p==="object"){var d=document.documentElement;var m=p.mode||"auto";var dark=m==="dark";if(m==="system"){dark=window.matchMedia("(prefers-color-scheme: dark)").matches}else if(m==="auto"){var ds=Number(p.dayStart==null?7:p.dayStart),de=Number(p.dayEnd==null?19:p.dayEnd),h=new Date().getHours();var day=ds<=de?(h>=ds&&h<de):(h>=ds||h<de);dark=!day}d.classList.toggle("dark",dark);if(p.palette)d.setAttribute("data-palette",String(p.palette));if(p.fontSize)d.setAttribute("data-fontsize",String(p.fontSize));if(p.density)d.setAttribute("data-density",String(p.density));if(p.radius)d.setAttribute("data-radius",String(p.radius));if(p.palette==="custom"&&p.customColor&&/^#[0-9a-fA-F]{6}$/.test(p.customColor)){d.style.setProperty("--custom-primary",p.customColor)}}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground font-sans min-h-screen">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        {children}
        <Toaster position="top-center" richColors closeButton dir="rtl" />
      </body>
    </html>
  );
}
