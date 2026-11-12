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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground font-sans min-h-screen">
        {children}
        <Toaster position="top-center" richColors closeButton dir="rtl" />
      </body>
    </html>
  );
}
