"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link, navigate } from "@/lib/router";
import { useSeo } from "@/lib/seo";
import { faNum, faDate } from "@/lib/fa";
import { EmptyState } from "@/components/site/misc";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Newspaper, ChevronLeft, Eye, CalendarDays } from "lucide-react";
import { useState } from "react";

type ArticleListItem = {
  id: string; title: string; slug: string; excerpt: string; coverUrl: string | null;
  category: { name: string; slug: string } | null;
  author: string; viewCount: number; publishedAt: string | null;
};

export function ArticlesView() {
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["articles", q, categoryId, page],
    queryFn: () => api.get<{ items: ArticleListItem[]; total: number; totalPages: number; categories: { id: string; name: string; slug: string; _count: { articles: number } }[] }>(`/api/articles?q=${encodeURIComponent(q)}&categoryId=${categoryId}&page=${page}`),
  });

  useSeo({
    title: "مقالات و راهنمای خرید و اجاره املاک | ویلاسنتو",
    description: "راهنمای خرید باغ و ویلا، رهن و اجاره، بررسی اسناد و قوانین معاملات املاک تفریحی و مسکونی.",
    path: "/articles",
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-black flex items-center gap-2"><Newspaper className="h-5 w-5 text-primary" /> مقالات و راهنما</h1>
          <p className="text-xs text-muted-foreground mt-1.5">راهنمای خرید، فروش، رهن و اجاره املاک تفریحی و مسکونی</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pr-9" placeholder="جستجو در مقالات…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
      </div>

      {/* categories */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => { setCategoryId(""); setPage(1); }}
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${!categoryId ? "bg-primary text-primary-foreground" : "border hover:border-primary/40"}`}
        >
          همه
        </button>
        {(data?.categories ?? []).map((c) => (
          <button
            key={c.id}
            onClick={() => { setCategoryId(c.id); setPage(1); }}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${categoryId === c.id ? "bg-primary text-primary-foreground" : "border hover:border-primary/40"}`}
          >
            {c.name} <span className="opacity-60">({faNum(c._count.articles)})</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-5 md:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}</div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState icon={<Newspaper className="h-12 w-12" />} title="مقاله‌ای یافت نشد" />
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-3">
            {data!.items.map((a) => (
              <Link key={a.id} to={`/article/${a.slug}`} className="group rounded-2xl border bg-card overflow-hidden hover:border-primary/30 hover:shadow-md transition-all flex flex-col">
                <div className="aspect-[16/9] bg-muted overflow-hidden">
                  {a.coverUrl && <img src={a.coverUrl} alt={a.title} loading="lazy" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                </div>
                <div className="p-4 flex flex-col flex-1">
                  {a.category && <Badge variant="outline" className="text-[10px] w-fit mb-2">{a.category.name}</Badge>}
                  <h2 className="font-bold text-sm leading-6 line-clamp-2 group-hover:text-primary transition-colors">{a.title}</h2>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5 leading-5">{a.excerpt}</p>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-auto pt-3">
                    <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {a.publishedAt ? faDate(a.publishedAt.slice(0, 10)) : "—"}</span>
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {faNum(a.viewCount)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {(data!.totalPages ?? 1) > 1 && (
            <div className="flex justify-center gap-1.5 mt-8">
              {Array.from({ length: data!.totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-9 h-9 rounded-lg text-xs font-bold ${n === page ? "bg-primary text-primary-foreground" : "border hover:border-primary/40"}`}
                  aria-label={`صفحه ${faNum(n)}`}
                >
                  {faNum(n)}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function ArticleView({ slug }: { slug: string }) {
  const { data: a, isLoading, error } = useQuery({
    queryKey: ["article", slug],
    queryFn: () => api.get<{
      id: string; title: string; slug: string; excerpt: string; content: string;
      coverUrl: string | null; viewCount: number; publishedAt: string | null; updatedAt: string;
      authorName: string; tags: string;
      category: { name: string; slug: string } | null;
      related: { id: string; title: string; slug: string; excerpt: string; coverUrl: string | null; publishedAt: string | null }[];
    }>(`/api/articles/${slug}`),
  });

  useSeo({
    title: a ? `${a.title} | مجله ویلاسنتو` : "مقاله | ویلاسنتو",
    description: a?.excerpt,
    path: `/article/${slug}`,
    image: a?.coverUrl ?? null,
    noIndex: !!error,
    jsonLd: a ? {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: a.title,
      description: a.excerpt,
      image: a.coverUrl ?? undefined,
      datePublished: a.publishedAt ?? a.updatedAt,
      dateModified: a.updatedAt,
      author: { "@type": "Organization", name: "ویلاسنتو" },
      publisher: { "@type": "Organization", name: "ویلاسنتو" },
    } : null,
  });

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-10"><Skeleton className="h-64 rounded-2xl" /></div>;
  }
  if (error || !a) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <EmptyState icon={<Newspaper className="h-12 w-12" />} title="مقاله یافت نشد" action={<Button asChild><Link to="/articles">همه مقالات</Link></Button>} />
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <nav className="text-xs text-muted-foreground mb-4">
        <Link to="/" className="hover:text-primary">خانه</Link> / <Link to="/articles" className="hover:text-primary">مقالات</Link> / <span className="text-foreground">{a.title}</span>
      </nav>

      {a.coverUrl && (
        <img src={a.coverUrl} alt={a.title} className="w-full aspect-[16/8] object-cover rounded-2xl mb-5" />
      )}

      <h1 className="text-2xl font-black leading-relaxed">{a.title}</h1>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-3">
        {a.category && <Badge variant="outline">{a.category.name}</Badge>}
        <span>{a.authorName}</span>
        {a.publishedAt && <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {faDate(a.publishedAt.slice(0, 10))}</span>}
        <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {faNum(a.viewCount)} بازدید</span>
      </div>

      <div className="prose-fa mt-6 text-sm leading-9 whitespace-pre-line text-foreground/90">
        {a.content}
      </div>

      {a.tags && (
        <div className="flex flex-wrap gap-1.5 mt-6">
          {a.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
            <span key={t} className="text-[11px] rounded-full bg-muted px-2.5 py-1 text-muted-foreground">#{t}</span>
          ))}
        </div>
      )}

      {a.related.length > 0 && (
        <section className="mt-10">
          <h2 className="font-black text-sm mb-4">مقالات مرتبط</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {a.related.map((r) => (
              <Link key={r.id} to={`/article/${r.slug}`} className="group flex gap-3 rounded-2xl border bg-card p-3 hover:border-primary/30 transition-colors">
                <span className="w-20 h-16 rounded-lg bg-muted overflow-hidden shrink-0">
                  {r.coverUrl && <img src={r.coverUrl} alt={r.title} loading="lazy" className="h-full w-full object-cover" />}
                </span>
                <span className="min-w-0">
                  <span className="text-xs font-bold line-clamp-2 group-hover:text-primary transition-colors">{r.title}</span>
                  <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">ادامه مطلب <ChevronLeft className="h-3 w-3 inline" /></span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
