import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { regionBySlug, REGION_TYPES } from "@/server/services/regions";
import { searchProperties } from "@/server/services/properties";
import { PropertyCard } from "@/components/site/PropertyCard";
import { breadcrumbJsonLd, serializeJsonLd } from "@/lib/seoJson";
import { faNum, priceLine } from "@/lib/fa";
import { MIN_INDEXABLE_LISTINGS, MIN_REGION_DESCRIPTION_LENGTH, plainTextLength, regionInventoryCount } from "@/server/seoIndexability";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 300;

/**
 * SSR region landing pages (SEO): one indexable page per active Region,
 * driven entirely by real database rows — real listing counts, real listings,
 * no fabricated numbers. UNVERIFIED regions get noindex + a "نیازمند بررسی"
 * notice and are never shown as a confirmed location.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const region = await regionBySlug(slug);
  if (!region) return { title: "منطقه یافت نشد", robots: { index: false, follow: false } };

  const [inventoryCount] = await Promise.all([regionInventoryCount(region.nameEn)]);
  const indexable =
    region.geoStatus === "VERIFIED" &&
    plainTextLength(region.description) >= MIN_REGION_DESCRIPTION_LENGTH &&
    inventoryCount >= MIN_INDEXABLE_LISTINGS;

  const typeFa = REGION_TYPES[region.type] ?? "منطقه";
  const title = { absolute: `املاک ${region.name} | خرید، فروش، رهن و اجاره در ${region.name} | ویلاسنتو` };
  const description = `آگهی‌های املاک ${region.name}؛ ${typeFa} در ${region.ancestors[0]?.name ?? "محدوده پیرامونی"} با مشخصات واقعی آگهی‌ها و اطلاعات ثبت‌شده در ویلاسنتو.`;
  return {
    title,
    description,
    alternates: { canonical: `/region/${region.nameEn}` },
    robots: { index: indexable, follow: true },
    openGraph: { title, description, url: `/region/${region.nameEn}`, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function RegionPage({ params }: Props) {
  const { slug } = await params;
  const region = await regionBySlug(slug);
  if (!region) notFound();

  const [res, corridorCount] = await Promise.all([
    searchProperties({ regions: [region.nameEn], pageSize: 12, sort: "NEWEST" }),
    // real context number: active listings across the whole platform
    db.property.count({ where: { status: "PUBLISHED" } }),
  ]);

  const isVerified = region.geoStatus === "VERIFIED";
  const breadcrumb = breadcrumbJsonLd([
    { name: "خانه", path: "/" },
    ...(region.ancestors.map((a) => ({ name: a.name, path: `/region/${a.nameEn}` })) as { name: string; path: string }[]),
    { name: `املاک ${region.name}`, path: `/region/${region.nameEn}` },
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <script
        id="vs-jsonld-breadcrumb-ssr-region"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumb) }}
      />

      <nav className="text-xs text-muted-foreground flex flex-wrap items-center gap-1 mb-4" aria-label="مسیر">
        <Link href="/" className="hover:text-primary">خانه</Link>
        <span>/</span>
        <Link href="/#/search" className="hover:text-primary">املاک</Link>
        {region.ancestors.map((a) => (
          <span key={a.nameEn} className="flex items-center gap-1">
            <span>/</span>
            <Link href={`/region/${a.nameEn}`} className="hover:text-primary">{a.name}</Link>
          </span>
        ))}
        <span>/</span>
        <span className="text-foreground">{region.name}</span>
      </nav>

      <header className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-[10px] font-bold rounded-full bg-primary/10 text-primary px-2.5 py-1">{region.typeLabel}</span>
          {isVerified ? (
            <span className="text-[10px] font-bold rounded-full bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-1">
              موقعیت تأییدشده
            </span>
          ) : (
            <span className="text-[10px] font-bold rounded-full bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-1">
              موقعیت نیازمند بررسی
            </span>
          )}
        </div>
        <h1 className="text-2xl md:text-3xl font-black leading-relaxed">
          املاک {region.name}؛ خرید، فروش، رهن و اجاره
        </h1>
        <p className="text-sm leading-8 text-muted-foreground mt-4">
          {region.description || `${region.typeLabel} در محدوده فعالیت ویلاسنتو.`}
          {isVerified && region.lat != null && (
            <span className="block mt-2 text-xs">
              موقعیت جغرافیایی تأییدشده: <b dir="ltr">{region.lat.toFixed(4)}, {region.lng?.toFixed(4)}</b>
            </span>
          )}
          {!isVerified && (
            <span className="block mt-2 text-xs text-amber-800">
              این محدوده تا تأیید نهایی موقعیت، بدون مختصات ثبت شده است و روی نقشه نشان داده نمی‌شود.
            </span>
          )}
        </p>
        <p className="text-sm text-muted-foreground mt-3 leading-7">
          در این صفحه {faNum(res.total)} آگهی فعال واقعی از دیتابیس ویلاسنتو فهرست شده است
          {res.total > 0 ? "؛ قیمت و مشخصات هر آگهی عیناً از آگهی اصلی گرفته شده است." : "؛ به‌محض ثبت آگهی جدید در این محدوده، همین صفحه به‌روزرسانی می‌شود."}
        </p>
      </header>

      <div className="flex flex-wrap gap-2 mt-6">
        <a href={`/#/search?regions=${region.nameEn}`} className="rounded-xl bg-primary text-primary-foreground text-sm font-bold px-4 py-2.5 hover:opacity-90 transition-opacity">
          جستجوی پیشرفته در {region.name}
        </a>
        <a href="/#/new-listing" className="rounded-xl border text-sm font-bold px-4 py-2.5 hover:border-primary/40 transition-colors">
          ثبت آگهی در {region.name}
        </a>
        {res.items.length > 0 && (
          <a href={`/#/search?regions=${region.nameEn}&sort=PRICE_ASC`} className="rounded-xl border text-sm font-bold px-4 py-2.5 hover:border-primary/40 transition-colors">
            ارزان‌ترین آگهی‌های {region.name}
          </a>
        )}
      </div>

      {/* villages / children (internal linking, real regions only) */}
      {region.children.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-black mb-3">زیرمجموعه‌های {region.name}</h2>
          <div className="flex flex-wrap gap-2">
            {region.children.map((c) => (
              <Link key={c.id} href={`/region/${c.nameEn}`}
                className="rounded-full border px-3.5 py-1.5 text-xs font-bold text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                املاک {c.name}
                {c._count.properties > 0 && <span className="opacity-60"> ({faNum(c._count.properties)})</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* listings */}
      <section className="mt-10">
        <h2 className="text-lg font-black mb-4">جدیدترین آگهی‌های {region.name}</h2>
        {res.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            در حال حاضر آگهی فعالی برای {region.name} ثبت نشده است.
            {corridorCount > 0 && (
              <span className="block mt-2">
                می‌توانید <a className="text-primary font-bold hover:underline" href="/#/search">همه آگهی‌های ویلاسنتو</a> را ببینید.
              </span>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-4">
            {res.items.map((p) => <PropertyCard key={p.id} p={JSON.parse(JSON.stringify(p))} />)}
          </div>
        )}
      </section>

      {/* price overview — only real rows from the actual listings above */}
      {res.items.length > 0 && (
        <section className="mt-10 rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-black mb-3">نمای کلی قیمت‌ها در {region.name}</h2>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {res.items.slice(0, 4).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 px-3.5 py-2.5">
                <span className="text-xs text-muted-foreground truncate">{p.typeLabel} — {p.locationLabel || p.city}</span>
                <span className="font-bold text-primary text-xs shrink-0">{priceLine(p.transactionType, p.salePrice, p.rahnAmount, p.rentAmount)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* nearby verified regions (internal linking) */}
      {region.nearby.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-black mb-3">مناطق نزدیک {region.name}</h2>
          <div className="flex flex-wrap gap-2">
            {region.nearby.map((n) => (
              <Link key={n.id} href={`/region/${n.nameEn}`}
                className="rounded-full border px-3.5 py-1.5 text-xs font-bold text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                املاک {n.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
