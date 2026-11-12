"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PropertyCardT } from "@/lib/api";
import { SearchBox } from "@/components/site/SearchBox";
import { PropertyCard } from "@/components/site/PropertyCard";
import { useSeo, organizationJsonLd } from "@/lib/seo";
import { faNum, BRAND, TRANSACTION_TYPE_LABELS, PROPERTY_TYPE_LABELS } from "@/lib/fa";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Skeleton } from "@/components/ui/skeleton";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  TreePine, Building, Home as HomeIcon, ShieldCheck, FileCheck, Users, Search,
  Phone, ArrowLeft, Star, MapPin, Landmark, Newspaper, BadgeCheck, ChevronLeft,
} from "lucide-react";
import { Link } from "@/lib/router";

type HomeData = {
  latest: PropertyCardT[];
  featured: PropertyCardT[];
  mostViewed: PropertyCardT[];
  banners: { id: string; title: string; imageUrl: string; link: string | null; position: string }[];
  articles: { id: string; title: string; slug: string; excerpt: string; coverUrl: string | null; publishedAt: string | null; viewCount: number }[];
  faqs: { id: string; question: string; answer: string }[];
  byType: { type: string; count: number }[];
  byTransactionType: { tt: string; count: number }[];
  stats: Record<string, number>;
  social: { label: string; url: string }[];
  site: { name: string; tagline: string; supportPhone: string; email: string; address: string };
};

const TYPE_META: Record<string, { icon: typeof HomeIcon; desc: string }> = {
  GARDEN: { icon: TreePine, desc: "باغ‌های تفریحی و کشاورزی با سند معتبر" },
  VILLA: { icon: HomeIcon, desc: "ویلاهای مدرن و سنتی در بهترین مناطق" },
  GARDEN_VILLA: { icon: Building, desc: "ترکیب باغ و ویلا برای زندگی و سرمایه‌گذاری" },
  HOUSE: { icon: HomeIcon, desc: "خانه‌های ویلایی مسکونی" },
  APARTMENT: { icon: Building, desc: "آپارتمان‌های مسکونی رهن و اجاره" },
  LAND: { icon: Landmark, desc: "زمین و کلنگی با پتانسیل ساخت" },
};

const SERVICES = [
  { icon: ShieldCheck, title: "آگهی‌های تأییدشده", desc: "هر آگهی پیش از انتشار توسط کارشناسان بررسی می‌شود تا اطلاعات تماس، تصاویر و قیمت واقعی باشند." },
  { icon: FileCheck, title: "شفافیت سند", desc: "نوع سند، متراژ و سال ساخت در هر آگهی به‌صورت استاندارد درج می‌شود تا با خیال راحت مقایسه کنید." },
  { icon: Users, title: "مشاوران معتمد", desc: "مشاوران املاک دارای پروانه فعال با سابقه تأییدشده؛ درخواست بازدید شما به کارشناس مربوطه تخصیص می‌یابد." },
  { icon: Search, title: "جستجوی هوشمند", desc: "فیلترهای دقیق نوع معامله، قیمت، متراژ و امکانات — همه فیلترها سمت سرور اعمال می‌شوند." },
];

export function HomeView() {
  const { data, isLoading } = useQuery({
    queryKey: ["home"],
    queryFn: () => api.get<HomeData>("/api/home"),
  });

  useSeo({
    title: "ویلاسنتو | خرید، فروش، رهن و اجاره باغ، ویلا و باغ‌ویلا",
    description: "مرجع تخصصی املاک تفریحی و مسکونی؛ آگهی‌های تأییدشده فروش، رهن کامل، رهن و اجاره باغ، ویلا و باغ‌ویلا با مشاوران معتمد و درخواست بازدید آنلاین.",
    path: "/",
    jsonLd: organizationJsonLd(data?.site.supportPhone ?? "021-91000000", data?.site.address ?? "تهران"),
  });

  const banners = (position: string) => data?.banners.filter((b) => b.position === position) ?? [];
  const typeCount = (t: string) => data?.byType.find((x) => x.type === t)?.count ?? 0;
  const topBanner = banners("HOME_TOP")[0];

  return (
    <div className="min-h-0">
      {/* ── Hero + search ── */}
      <section className="relative bg-gradient-to-b from-primary/10 via-primary/5 to-background">
        <div className="mx-auto max-w-7xl px-4 pt-10 pb-8 md:pt-16">
          <div className="text-center max-w-2xl mx-auto">
            <Badge variant="outline" className="mb-3 border-primary/30 text-primary bg-background">
              <Star className="h-3 w-3" /> سامانه تخصصی املاک تفریحی و مسکونی
            </Badge>
            <h1 className="text-2xl md:text-4xl font-black leading-relaxed">
              خرید، فروش، رهن و اجاره <span className="text-primary">باغ، ویلا و باغ‌ویلا</span>
            </h1>
            <p className="text-muted-foreground mt-3 text-sm md:text-base">
              {data?.site.tagline ?? "آگهی‌های تأییدشده با مشخصات کامل سند؛ درخواست بازدید آنلاین و مشاوران معتمد."}
            </p>
          </div>
          <div className="mt-6 max-w-4xl mx-auto">
            <SearchBox />
          </div>

          {/* quick categories */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 max-w-4xl mx-auto">
            {(data?.byType ?? Object.keys(TYPE_META).map((t) => ({ type: t, count: 0 }))).slice(0, 6).map(({ type }) => {
              const meta = TYPE_META[type] ?? TYPE_META.VILLA;
              const Icon = meta.icon;
              return (
                <Link
                  key={type}
                  to={`/search?types=${type}`}
                  className="group flex flex-col items-center gap-1.5 rounded-2xl border bg-card p-3 hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <span className="rounded-xl bg-primary/10 text-primary p-2.5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-bold">{PROPERTY_TYPE_LABELS[type] ?? type}</span>
                  {data && <span className="text-[10px] text-muted-foreground">{faNum(typeCount(type))} آگهی</span>}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── top banner ── */}
      {topBanner && (
        <section className="mx-auto max-w-7xl px-4 mt-4">
          <a href={topBanner.link ?? "#"} className="block rounded-2xl overflow-hidden border group relative h-28 md:h-40">
            <img src={topBanner.imageUrl} alt={topBanner.title} className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
            <span className="absolute bottom-3 right-3 rounded-lg bg-black/55 text-white text-xs px-3 py-1.5">{topBanner.title}</span>
          </a>
        </section>
      )}

      <div className="mx-auto max-w-7xl px-4 py-8 space-y-12">
        {/* ── Featured ── */}
        <ListingRow
          title="املاک ویژه و پیشنهادی"
          icon={<Star className="h-5 w-5 text-amber-500" />}
          link="/search?featured=1"
          items={data?.featured}
          isLoading={isLoading}
        />

        {/* ── Latest ── */}
        <ListingRow
          title="جدیدترین آگهی‌ها"
          icon={<Newspaper className="h-5 w-5 text-primary" />}
          link="/search"
          items={data?.latest}
          isLoading={isLoading}
        />

        {/* ── mid banner ── */}
        {banners("HOME_MID").map((b) => (
          <a key={b.id} href={b.link ?? "#"} className="block rounded-2xl overflow-hidden border group h-24 md:h-36">
            <img src={b.imageUrl} alt={b.title} loading="lazy" className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
          </a>
        ))}

        {/* ── Most viewed ── */}
        <ListingRow
          title="املاک پربازدید"
          icon={<BadgeCheck className="h-5 w-5 text-teal-600" />}
          link="/search?sort=MOST_VIEWED"
          items={data?.mostViewed}
          isLoading={isLoading}
        />

        {/* ── Services ── */}
        <section>
          <SectionTitle title="خدمات ویلاسنتو" desc="چرا معامله در ویلاسنتو مطمئن‌تر است؟" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-5">
            {SERVICES.map((s) => (
              <Card key={s.title} className="border hover:border-primary/30 transition-colors">
                <CardContent className="p-5">
                  <span className="rounded-xl bg-primary/10 text-primary p-2.5 inline-grid place-items-center mb-3"><s.icon className="h-5 w-5" /></span>
                  <h3 className="font-bold text-sm">{s.title}</h3>
                  <p className="text-xs text-muted-foreground leading-6 mt-1.5">{s.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ── Agents ── */}
        <AgentsSection />

        {/* ── Articles ── */}
        <section>
          <SectionTitle title="مقالات و راهنمای خرید و اجاره" icon={<Newspaper className="h-5 w-5 text-primary" />} link="/articles" />
          <div className="grid gap-4 md:grid-cols-3 mt-5">
            {isLoading
              ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-2xl" />)
              : (data?.articles ?? []).map((a) => (
                  <Link key={a.id} to={`/article/${a.slug}`} className="group rounded-2xl border bg-card overflow-hidden hover:border-primary/30 hover:shadow-md transition-all">
                    <div className="aspect-[16/9] bg-muted overflow-hidden">
                      {a.coverUrl && <img src={a.coverUrl} alt={a.title} loading="lazy" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-sm leading-6 line-clamp-2 group-hover:text-primary transition-colors">{a.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5 leading-5">{a.excerpt}</p>
                    </div>
                  </Link>
                ))}
          </div>
        </section>

        {/* ── Stats ── */}
        <section className="rounded-3xl bg-primary text-primary-foreground p-8 md:p-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { label: "آگهی فعال", value: data?.stats.listings },
              { label: "مشاور و کارشناس", value: data?.stats.agents },
              { label: "شهر تحت پوشش", value: data?.stats.cities },
              { label: "معامله موفق", value: data?.stats.deals },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-2xl md:text-3xl font-black">{s.value != null ? `${faNum(Number(s.value) > 1000 ? Number(s.value).toLocaleString("en-US") : s.value).replace(/,/g, "٬")}+` : "—"}</div>
                <div className="text-xs opacity-80 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQs ── */}
        {!!data?.faqs.length && (
          <section className="max-w-3xl mx-auto">
            <SectionTitle title="سؤالات متداول" desc="پاسخ پرتکرارترین پرسش‌های شما" />
            <Accordion type="single" collapsible className="mt-5">
              {data.faqs.map((f) => (
                <AccordionItem key={f.id} value={f.id}>
                  <AccordionTrigger className="text-sm font-bold text-right">{f.question}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-7">{f.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        )}

        {/* ── Contact CTA ── */}
        <section className="rounded-3xl border bg-card p-8 flex flex-col md:flex-row items-center justify-between gap-5">
          <div>
            <h3 className="font-black text-lg">مشاوره رایگان معامله</h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-6">
              کارشناسان ویلاسنتو برای خرید، فروش، رهن و اجاره همراه شما هستند — شنبه تا پنجشنبه ۹ تا ۱۸
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="lg" asChild>
              <a href={`tel:${(data?.site.supportPhone ?? "02191000000").replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))}`}>
                <Phone className="h-4 w-4" /> {data?.site.supportPhone ?? "۰۲۱-۹۱۰۰۰۰۰۰"}
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/page/contact">تماس با ما</Link>
            </Button>
          </div>
        </section>

        {/* ── bottom banner ── */}
        {banners("HOME_BOTTOM").map((b) => (
          <a key={b.id} href={b.link ?? "#"} className="block rounded-2xl overflow-hidden border group h-24 md:h-36">
            <img src={b.imageUrl} alt={b.title} loading="lazy" className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
          </a>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ title, desc, icon, link }: { title: string; desc?: string; icon?: React.ReactNode; link?: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg md:text-xl font-black flex items-center gap-2">{icon} {title}</h2>
        {desc && <p className="text-xs text-muted-foreground mt-1">{desc}</p>}
      </div>
      {link && (
        <Link to={link} className="text-xs font-bold text-primary hover:underline flex items-center gap-1 shrink-0">
          مشاهده همه <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function ListingRow({ title, icon, link, items, isLoading }: {
  title: string; icon: React.ReactNode; link: string;
  items?: PropertyCardT[]; isLoading: boolean;
}) {
  return (
    <section>
      <SectionTitle title={title} icon={icon} link={link} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-5">
        {isLoading
          ? [1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl border bg-card overflow-hidden">
                <Skeleton className="aspect-[4/3] rounded-none" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
            ))
          : (items ?? []).map((p) => <PropertyCard key={p.id} p={p} />)}
      </div>
    </section>
  );
}

function AgentsSection() {
  const { data } = useQuery({
    queryKey: ["agents-home"],
    queryFn: () => api.get<{ items: { id: string; name: string; agencyName: string | null; bio: string | null; photoUrl: string | null; verified: boolean; listingsCount: number }[] }>("/api/agents"),
  });
  if (!data?.items.length) return null;
  return (
    <section>
      <SectionTitle title="مشاوران املاک ویلاسنتو" desc="با کارشناسان دارای پروانه فعال" icon={<Users className="h-5 w-5 text-primary" />} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-5">
        {data.items.slice(0, 3).map((a) => (
          <Card key={a.id} className="hover:border-primary/30 transition-colors">
            <CardContent className="p-5 flex items-start gap-3">
              <span className="w-12 h-12 rounded-full bg-primary/10 text-primary grid place-items-center font-black shrink-0 overflow-hidden">
                {a.photoUrl ? <img src={a.photoUrl} alt={a.name} className="h-full w-full object-cover" /> : a.name.slice(0, 1)}
              </span>
              <div className="min-w-0">
                <div className="font-bold text-sm flex items-center gap-1.5">
                  {a.name}
                  {a.verified && <BadgeCheck className="h-4 w-4 text-teal-600" />}
                </div>
                {a.agencyName && <div className="text-xs text-muted-foreground mt-0.5">{a.agencyName}</div>}
                {a.bio && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-5">{a.bio}</p>}
                <div className="text-[11px] text-primary font-bold mt-1.5 flex items-center gap-1">
                  <ChevronLeft className="h-3 w-3" /> {faNum(a.listingsCount)} آگهی فعال
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
