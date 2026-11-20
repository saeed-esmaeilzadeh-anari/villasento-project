import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { searchProperties, citySlugToName, cityNameToSlug, type PropertyCardData } from "@/server/services/properties";
import { db } from "@/lib/db";
import { PropertyCard } from "@/components/site/PropertyCard";
import { breadcrumbJsonLd } from "@/lib/seoJson";
import { faNum, priceLine } from "@/lib/fa";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const name = citySlugToName(slug);
  const city = await db.city.findFirst({ where: { name }, include: { province: true } });
  if (!city) return { title: "شهر یافت نشد", robots: { index: false, follow: false } };

  const title = { absolute: `املاک ${city.name} | خرید، فروش، رهن و اجاره ${city.name} | ویلاسنتو` };
  const description = `فهرست آگهی‌های تأییدشده املاک ${city.name} در استان ${city.province.name}؛ خرید و فروش، رهن کامل و رهن و اجاره ویلا، باغ‌ویلا، خانه و آپارتمان با مشخصات کامل سند و تماس مستقیم با مالک یا مشاور.`;
  return {
    title,
    description,
    alternates: { canonical: `/city/${cityNameToSlug(city.name)}` },
    robots: { index: true, follow: true },
    openGraph: { title, description, url: `/city/${cityNameToSlug(city.name)}`, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CityPage({ params }: Props) {
  const { slug } = await params;
  const name = citySlugToName(slug);
  const city = await db.city.findFirst({ where: { name }, include: { province: true } });
  if (!city) notFound();

  const [res, areas, topCities] = await Promise.all([
    searchProperties({ cityId: city.id, pageSize: 12, sort: "NEWEST" }),
    db.area.findMany({ where: { cityId: city.id }, orderBy: { sort: "asc" }, take: 20 }),
    db.city.findMany({
      where: { properties: { some: { status: "PUBLISHED" } }, id: { not: city.id } },
      select: { name: true },
      take: 11,
    }),
  ]);

  const breadcrumb = breadcrumbJsonLd([
    { name: "خانه", path: "/" },
    { name: "املاک", path: "/search" },
    { name: `املاک ${city.name}`, path: `/city/${cityNameToSlug(city.name)}` },
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <script
        id="vs-jsonld-breadcrumb-ssr"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      <nav className="text-xs text-muted-foreground flex items-center gap-1 mb-4" aria-label="مسیر">
        <Link href="/" className="hover:text-primary">خانه</Link>
        <span>/</span>
        <Link href="/search" className="hover:text-primary">املاک</Link>
        <span>/</span>
        <span className="text-foreground">املاک {city.name}</span>
      </nav>

      <header className="max-w-3xl">
        <h1 className="text-2xl md:text-3xl font-black leading-relaxed">
          املاک {city.name}؛ خرید، فروش، رهن و اجاره
        </h1>
        <p className="text-sm leading-8 text-muted-foreground mt-4">
          فهرست آگهی‌های تأییدشده املاک {city.name} در استان {city.province.name}؛ {faNum(res.total)} آگهی فعال
          شامل ویلا، باغ‌ویلا، خانه و آپارتمان برای خرید و فروش، رهن کامل و رهن و اجاره. در هر آگهی متراژ، اتاق خواب،
          وضعیت سند و قیمت دقیق درج شده است و ارتباط با مالک یا مشاور بدون واسطه انجام می‌شود.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 mt-6">
        <a href={`/#/search?cityId=${city.id}`} className="rounded-xl bg-primary text-primary-foreground text-sm font-bold px-4 py-2.5 hover:opacity-90 transition-opacity">
          جستجوی پیشرفته در {city.name}
        </a>
        <a href="/#/new-listing" className="rounded-xl border text-sm font-bold px-4 py-2.5 hover:border-primary/40 transition-colors">
          ثبت آگهی در {city.name}
        </a>
      </div>

      {/* areas (internal linking) */}
      {areas.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-black mb-3">مناطق {city.name}</h2>
          <div className="flex flex-wrap gap-2">
            {areas.map((a) => (
              <a key={a.id} href={`/#/search?cityId=${city.id}&areaId=${a.id}`}
                className="rounded-full border px-3.5 py-1.5 text-xs font-bold text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                املاک {a.name}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* listings */}
      <section className="mt-10">
        <h2 className="text-lg font-black mb-4">جدیدترین آگهی‌های {city.name}</h2>
        {res.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            در حال حاضر آگهی فعالی برای {city.name} ثبت نشده است.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-4">
            {res.items.map((p) => <PropertyCard key={p.id} p={JSON.parse(JSON.stringify(p))} />)}
          </div>
        )}
      </section>

      {/* price overview */}
      {res.items.length > 0 && (
        <section className="mt-10 rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-black mb-3">نمای کلی قیمت‌ها در {city.name}</h2>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {res.items.slice(0, 4).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 px-3.5 py-2.5">
                <span className="text-xs text-muted-foreground truncate">{p.typeLabel} — {p.area ?? p.city}</span>
                <span className="font-bold text-primary text-xs shrink-0">{priceLine(p.transactionType, p.salePrice, p.rahnAmount, p.rentAmount)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* other cities (internal linking) */}
      {topCities.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-black mb-3">املاک در شهرهای دیگر</h2>
          <div className="flex flex-wrap gap-2">
            {topCities.map((c) => (
              <Link key={c.name} href={`/city/${cityNameToSlug(c.name)}`}
                className="rounded-full border px-3.5 py-1.5 text-xs font-bold text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                املاک {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
