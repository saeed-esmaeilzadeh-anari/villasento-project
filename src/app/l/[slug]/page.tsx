import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchProperties, type PropertyCardData } from "@/server/services/properties";
import { db } from "@/lib/db";
import { getLanding, LANDINGS } from "@/lib/landings";
import { PropertyCard } from "@/components/site/PropertyCard";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/seoJson";
import { PlusCircle, ChevronLeft } from "lucide-react";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 300;

export async function generateStaticParams() {
  return LANDINGS.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const l = getLanding(slug);
  if (!l) return { title: "صفحه یافت نشد", robots: { index: false, follow: false } };
  return {
    title: { absolute: l.title },
    description: l.description,
    alternates: { canonical: `/l/${l.slug}` },
    robots: { index: true, follow: true },
    openGraph: { title: l.title, description: l.description, url: `/l/${l.slug}`, type: "website" },
    twitter: { card: "summary_large_image", title: l.title, description: l.description },
  };
}

export default async function LandingPage({ params }: Props) {
  const { slug } = await params;
  const l = getLanding(slug);
  if (!l) notFound();

  let items: PropertyCardData[] = [];

  if (l.provinces?.length) {
    const provs = await db.province.findMany({ where: { name: { in: l.provinces } }, select: { id: true } });
    const results = await Promise.all(
      provs.map((p) =>
        searchProperties({ transactionTypes: l.tt, types: l.types, provinceId: p.id, pageSize: 8, sort: "NEWEST" })
      )
    );
    items = JSON.parse(JSON.stringify(results.flatMap((r) => r.items))).slice(0, 12);
  } else {
    const res = await searchProperties({
      transactionTypes: l.tt,
      types: l.types,
      pageSize: 12,
      sort: "NEWEST",
    });
    items = JSON.parse(JSON.stringify(res.items));
  }

  const searchParams = new URLSearchParams();
  if (l.tt.length) searchParams.set("tt", l.tt.join(","));
  if (l.types.length) searchParams.set("types", l.types.join(","));
  const searchHref = `/#/search?${searchParams.toString()}`;

  const breadcrumb = breadcrumbJsonLd([
    { name: "خانه", path: "/" },
    { name: l.h1, path: `/l/${l.slug}` },
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <script
        id="vs-jsonld-faq-ssr"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(l.faq.map((f) => ({ question: f.q, answer: f.a })))) }}
      />
      <script
        id="vs-jsonld-breadcrumb-ssr"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      {/* breadcrumb */}
      <nav className="text-xs text-muted-foreground flex items-center gap-1 mb-4" aria-label="مسیر">
        <Link href="/" className="hover:text-primary">خانه</Link>
        <span>/</span>
        <span className="text-foreground">{l.h1}</span>
      </nav>

      <header className="max-w-3xl">
        <h1 className="text-2xl md:text-3xl font-black leading-relaxed">{l.h1}</h1>
        {l.intro.map((p, i) => (
          <p key={i} className="text-sm leading-8 text-muted-foreground mt-4">{p}</p>
        ))}
      </header>

      <div className="flex flex-wrap gap-2 mt-6">
        <a href={searchHref} className="rounded-xl bg-primary text-primary-foreground text-sm font-bold px-4 py-2.5 hover:opacity-90 transition-opacity">
          مشاهده همه در جستجوی پیشرفته
        </a>
        <a href="/#/new-listing" className="rounded-xl border text-sm font-bold px-4 py-2.5 hover:border-primary/40 transition-colors flex items-center gap-1.5">
          <PlusCircle className="h-4 w-4 text-primary" /> ثبت آگهی رایگان
        </a>
      </div>

      {/* real listings */}
      <section className="mt-10">
        <h2 className="text-lg font-black mb-4">آخرین آگهی‌های مرتبط</h2>
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            در حال حاضر آگهی مرتبطی منتشر نشده است — با <a className="text-primary hover:underline" href={searchHref}>جستجوی پیشرفته</a> همه آگهی‌ها را ببینید.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-4">
            {items.map((p) => <PropertyCard key={p.id} p={p} />)}
          </div>
        )}
      </section>

      {/* FAQ (semantic details — crawlable without JS) */}
      <section className="mt-12 max-w-3xl">
        <h2 className="text-lg font-black mb-4">سؤالات متداول</h2>
        <div className="space-y-2">
          {l.faq.map((f) => (
            <details key={f.q} className="rounded-2xl border bg-card px-4 py-3">
              <summary className="text-sm font-bold cursor-pointer">{f.q}</summary>
              <p className="text-sm leading-7 text-muted-foreground mt-2">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* internal links */}
      <section className="mt-10">
        <h2 className="text-sm font-black mb-3">مسیرهای مرتبط</h2>
        <div className="flex flex-wrap gap-2">
          {l.related.map((r) => (
            <a key={r.href + r.label} href={r.href}
              className="rounded-full border px-3.5 py-1.5 text-xs font-bold text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors flex items-center gap-1">
              {r.label} <ChevronLeft className="h-3 w-3" />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
