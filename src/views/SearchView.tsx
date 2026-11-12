"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api, type Lookups, type SearchResponseT, type PropertyCardT } from "@/lib/api";
import { PropertyCard } from "@/components/site/PropertyCard";
import { MapView, type MapPin } from "@/components/site/MapView";
import { useSeo } from "@/lib/seo";
import { faNum, TRANSACTION_TYPE_LABELS, PROPERTY_TYPE_LABELS, DOCUMENT_STATUS_LABELS, shortMoney } from "@/lib/fa";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { EmptyState, RowSkeleton } from "@/components/site/misc";
import { useSearch } from "@/lib/store";
import { Search, SlidersHorizontal, Map as MapIcon, List, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;

type Filters = {
  tt: string[]; types: string[]; provinceId: string; cityId: string; areaId: string;
  minPrice: number | null; maxPrice: number | null;
  minLand: number | null; maxLand: number | null;
  minBuild: number | null; maxBuild: number | null;
  bedrooms: number | null; amenities: string[]; doc: string;
  negotiable: boolean; featured: boolean; sort: string; q: string; page: number;
};

const EMPTY: Filters = {
  tt: [], types: [], provinceId: "", cityId: "", areaId: "",
  minPrice: null, maxPrice: null, minLand: null, maxLand: null,
  minBuild: null, maxBuild: null, bedrooms: null, amenities: [], doc: "",
  negotiable: false, featured: false, sort: "NEWEST", q: "", page: 1,
};

const PRICE_MAX = 20_000_000_000; // 20 میلیارد

function parseUrlToFilters(sp: URLSearchParams): Filters {
  const f = { ...EMPTY };
  if (sp.get("tt")) f.tt = sp.get("tt")!.split(",").filter(Boolean);
  if (sp.get("types")) f.types = sp.get("types")!.split(",").filter(Boolean);
  if (sp.get("provinceId")) f.provinceId = sp.get("provinceId")!;
  if (sp.get("cityId")) f.cityId = sp.get("cityId")!;
  if (sp.get("areaId")) f.areaId = sp.get("areaId")!;
  if (sp.get("q")) f.q = sp.get("q")!;
  if (sp.get("doc")) f.doc = sp.get("doc")!;
  if (sp.get("sort")) f.sort = sp.get("sort")!;
  if (sp.get("page")) f.page = Math.max(1, Number(sp.get("page")) || 1);
  if (sp.get("minPrice")) f.minPrice = Number(sp.get("minPrice")) || null;
  if (sp.get("maxPrice")) f.maxPrice = Number(sp.get("maxPrice")) || null;
  if (sp.get("minLand")) f.minLand = Number(sp.get("minLand")) || null;
  if (sp.get("maxLand")) f.maxLand = Number(sp.get("maxLand")) || null;
  if (sp.get("minBuild")) f.minBuild = Number(sp.get("minBuild")) || null;
  if (sp.get("maxBuild")) f.maxBuild = Number(sp.get("maxBuild")) || null;
  if (sp.get("bedrooms")) f.bedrooms = Number(sp.get("bedrooms")) || null;
  if (sp.get("amenities")) f.amenities = sp.get("amenities")!.split(",").filter(Boolean);
  f.negotiable = sp.get("negotiable") === "1";
  f.featured = sp.get("featured") === "1";
  return f;
}

function filtersToQuery(f: Filters, bbox?: string): string {
  const sp = new URLSearchParams();
  if (f.tt.length) sp.set("tt", f.tt.join(","));
  if (f.types.length) sp.set("types", f.types.join(","));
  if (f.provinceId) sp.set("provinceId", f.provinceId);
  if (f.cityId) sp.set("cityId", f.cityId);
  if (f.areaId) sp.set("areaId", f.areaId);
  if (f.q) sp.set("q", f.q);
  if (f.doc) sp.set("doc", f.doc);
  if (f.sort && f.sort !== "NEWEST") sp.set("sort", f.sort);
  if (f.page > 1) sp.set("page", String(f.page));
  if (f.minPrice != null) sp.set("minPrice", String(f.minPrice));
  if (f.maxPrice != null) sp.set("maxPrice", String(f.maxPrice));
  if (f.minLand != null) sp.set("minLand", String(f.minLand));
  if (f.maxLand != null) sp.set("maxLand", String(f.maxLand));
  if (f.minBuild != null) sp.set("minBuild", String(f.minBuild));
  if (f.maxBuild != null) sp.set("maxBuild", String(f.maxBuild));
  if (f.bedrooms != null) sp.set("bedrooms", String(f.bedrooms));
  if (f.amenities.length) sp.set("amenities", f.amenities.join(","));
  if (f.negotiable) sp.set("negotiable", "1");
  if (f.featured) sp.set("featured", "1");
  if (bbox) sp.set("bbox", bbox);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function SearchView() {
  const draft = useSearch();
  const [filters, setFilters] = useState<Filters>(() => {
    const f = parseUrlToFilters(new URLSearchParams(window.location.hash.split("?")[1] ?? ""));
    // merge the homepage SearchBox draft (external store read — runs once)
    const d = useSearch.getState();
    if (d.tt) f.tt = [d.tt];
    if (d.provinceId) f.provinceId = d.provinceId;
    if (d.cityId) f.cityId = d.cityId;
    if (d.areaId) f.areaId = d.areaId;
    if (d.typeId) f.types = [d.typeId];
    if (d.q) f.q = d.q;
    return f;
  });
  const [view, setView] = useState<"list" | "map">("list");
  const [bbox, setBbox] = useState<string | undefined>(undefined);
  const [bboxActive, setBboxActive] = useState(false);
  const [pendingBbox, setPendingBbox] = useState<{ minLat: number; maxLat: number; minLng: number; maxLng: number } | null>(null);

  const patch = (p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p, page: p.page ?? 1 }));

  // sync URL on filter change
  useEffect(() => {
    const q = filtersToQuery(filters, bboxActive ? bbox : undefined);
    const target = `#/search${q}`;
    if (window.location.hash !== target) {
      window.history.replaceState(null, "", window.location.pathname + target);
    }
  }, [filters, bbox, bboxActive]);

  // clear the consumed draft (external zustand store update — safe in effect)
  useEffect(() => { useSearch.getState().reset(); }, []);

  const { data: lookups } = useQuery({
    queryKey: ["lookups"],
    queryFn: () => api.get<Lookups>("/api/lookups"),
    staleTime: 10 * 60 * 1000,
  });

  const queryString = useMemo(() => filtersToQuery(filters, bboxActive ? bbox : undefined), [filters, bbox, bboxActive]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["search", queryString],
    queryFn: () => api.get<SearchResponseT>(`/api/properties${queryString}`),
    placeholderData: keepPreviousData,
  });

  useSeo({
    title: "جستجوی املاک | ویلاسنتو",
    description: "جستجو و فیلتر آگهی‌های فروش، رهن و اجاره باغ، ویلا، باغ‌ویلا و املاک مسکونی با فیلترهای قیمت، متراژ و امکانات.",
    path: "/search",
  });

  const province = lookups?.provinces.find((p) => p.id === filters.provinceId);
  const city = province?.cities.find((c) => c.id === filters.cityId);
  const pins: MapPin[] = (data?.items ?? [])
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({ id: p.id, lat: p.lat!, lng: p.lng!, title: p.title, image: p.image, price: priceLabel(p) }));

  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.tt.length) n++;
    if (filters.types.length) n++;
    if (filters.provinceId || filters.cityId || filters.areaId) n++;
    if (filters.minPrice != null || filters.maxPrice != null) n++;
    if (filters.minLand != null || filters.maxLand != null) n++;
    if (filters.minBuild != null || filters.maxBuild != null) n++;
    if (filters.bedrooms != null) n++;
    if (filters.amenities.length) n++;
    if (filters.doc) n++;
    if (filters.negotiable) n++;
    if (filters.featured) n++;
    if (filters.q) n++;
    return n;
  }, [filters]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-lg font-black">جستجوی املاک</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {data ? `${faNum(data.total)} ملک یافت شد` : "در حال جستجو…"}
            {isFetching && !isLoading && <span className="mr-2 text-primary">در حال به‌روزرسانی…</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filters.sort} onValueChange={(v) => patch({ sort: v })}>
            <SelectTrigger size="sm" className="w-40" aria-label="مرتب‌سازی">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NEWEST">جدیدترین</SelectItem>
              <SelectItem value="PRICE_ASC">ارزان‌ترین</SelectItem>
              <SelectItem value="PRICE_DESC">گران‌ترین</SelectItem>
              <SelectItem value="MOST_VIEWED">پربازدیدترین</SelectItem>
            </SelectContent>
          </Select>
          {/* mobile filter */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden">
                <SlidersHorizontal className="h-4 w-4" /> فیلترها {activeCount > 0 && `(${faNum(activeCount)})`}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 overflow-y-auto p-4">
              <FilterPanel filters={filters} patch={patch} reset={() => setFilters({ ...EMPTY })} lookups={lookups} />
            </SheetContent>
          </Sheet>
          <div className="flex rounded-lg border overflow-hidden">
            <button className={cn("px-2.5 py-2 flex items-center gap-1 text-xs font-bold", view === "list" ? "bg-primary text-primary-foreground" : "bg-background")} onClick={() => setView("list")} aria-label="نمایش لیست">
              <List className="h-4 w-4" /> لیست
            </button>
            <button className={cn("px-2.5 py-2 flex items-center gap-1 text-xs font-bold", view === "map" ? "bg-primary text-primary-foreground" : "bg-background")} onClick={() => setView("map")} aria-label="نمایش نقشه">
              <MapIcon className="h-4 w-4" /> نقشه
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-5">
        {/* sidebar filters (desktop) */}
        <aside className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-20 rounded-2xl border bg-card p-4 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin">
            <FilterPanel filters={filters} patch={patch} reset={() => setFilters({ ...EMPTY })} lookups={lookups} />
          </div>
        </aside>

        {/* results */}
        <div className="flex-1 min-w-0">
          {view === "map" ? (
            <div className="space-y-3">
              <MapView
                pins={pins}
                height={520}
                zoom={8}
                showSearchArea
                onBoundsChange={(b) => setPendingBbox(b)}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {pendingBbox ? "محدوده جدید آماده اعمال است" : "نقشه را جابه‌جا کنید و «جستجو در این محدوده» را بزنید"}
                </p>
                <div className="flex gap-2">
                  {bboxActive && (
                    <Button size="sm" variant="ghost" onClick={() => { setBboxActive(false); setBbox(undefined); }}>
                      حذف محدوده
                    </Button>
                  )}
                  <Button size="sm" disabled={!pendingBbox} onClick={() => { if (pendingBbox) { setBbox(`${pendingBbox.minLat},${pendingBbox.maxLat},${pendingBbox.minLng},${pendingBbox.maxLng}`); setBboxActive(true); } }}>
                    جستجو در این محدوده
                  </Button>
                </div>
              </div>
              {/* under the map: result cards of current page */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {(data?.items ?? []).filter((p) => p.lat != null).map((p) => <PropertyCard key={p.id} p={p} />)}
              </div>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <RowSkeleton key={i} />)}
            </div>
          ) : (data?.items.length ?? 0) === 0 ? (
            <EmptyState
              icon={<Search className="h-12 w-12" />}
              title="نتیجه‌ای یافت نشد"
              desc="با این فیلترها ملکی پیدا نشد. فیلترها را تغییر دهید یا حذف کنید."
              action={
                <Button variant="outline" onClick={() => setFilters({ ...EMPTY })}>
                  <RotateCcw className="h-4 w-4" /> حذف همه فیلترها
                </Button>
              }
            />
          ) : (
            <>
              {activeCount > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  {filters.tt.map((t) => <Chip key={t} label={TRANSACTION_TYPE_LABELS[t]} onX={() => patch({ tt: filters.tt.filter((x) => x !== t) })} />)}
                  {filters.types.map((t) => <Chip key={t} label={PROPERTY_TYPE_LABELS[t] ?? t} onX={() => patch({ types: filters.types.filter((x) => x !== t) })} />)}
                  {filters.q && <Chip label={`«${filters.q}»`} onX={() => patch({ q: "" })} />}
                  {filters.doc && <Chip label={DOCUMENT_STATUS_LABELS[filters.doc] ?? filters.doc} onX={() => patch({ doc: "" })} />}
                  {filters.bedrooms != null && <Chip label={`${faNum(filters.bedrooms)}+ خواب`} onX={() => patch({ bedrooms: null })} />}
                  {(filters.minPrice != null || filters.maxPrice != null) && (
                    <Chip label={`قیمت: ${filters.minPrice ? shortMoney(filters.minPrice) : "۰"} تا ${filters.maxPrice ? shortMoney(filters.maxPrice) : "بی‌نهایت"}`} onX={() => patch({ minPrice: null, maxPrice: null })} />
                  )}
                  {bboxActive && <Chip label="محدوده نقشه" onX={() => { setBboxActive(false); setBbox(undefined); }} />}
                  <button className="text-xs text-primary hover:underline mr-1" onClick={() => setFilters({ ...EMPTY })}>حذف همه</button>
                </div>
              )}
              <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", isFetching && "opacity-70 transition-opacity")}>
                {data!.items.map((p) => <PropertyCard key={p.id} p={p} />)}
              </div>
              {(data!.totalPages ?? 1) > 1 && (
                <div className="mt-8 flex justify-center">
                  <Pagination>
                    <PaginationContent>
                      {data!.page > 1 && (
                        <PaginationItem>
                          <PaginationPrevious onClick={() => patch({ page: data!.page - 1 })} href="#" />
                        </PaginationItem>
                      )}
                      {Array.from({ length: Math.min(5, data!.totalPages) }, (_, i) => {
                        const start = Math.max(1, Math.min(data!.page - 2, data!.totalPages - 4));
                        const n = start + i;
                        if (n > data!.totalPages) return null;
                        return (
                          <PaginationItem key={n}>
                            <PaginationLink href="#" isActive={n === data!.page} onClick={(e) => { e.preventDefault(); patch({ page: n }); }}>
                              {faNum(n)}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      {data!.page < data!.totalPages && (
                        <PaginationItem>
                          <PaginationNext onClick={() => patch({ page: data!.page + 1 })} href="#" />
                        </PaginationItem>
                      )}
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function priceLabel(p: PropertyCardT): string {
  if (p.transactionType === "SALE" && p.salePrice) return shortMoney(p.salePrice);
  if (p.transactionType === "RAHN" && p.rahnAmount) return `رهن ${shortMoney(p.rahnAmount)}`;
  if (p.rentAmount) return shortMoney(p.rentAmount);
  return "توافقی";
}

function Chip({ label, onX }: { label: string; onX: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2.5 py-1">
      {label}
      <button onClick={onX} aria-label={`حذف فیلتر ${label}`}><X className="h-3 w-3" /></button>
    </span>
  );
}

function FilterPanel({ filters, patch, reset, lookups }: {
  filters: Filters;
  patch: (p: Partial<Filters>) => void;
  reset: () => void;
  lookups?: Lookups;
}) {
  const province = lookups?.provinces.find((p) => p.id === filters.provinceId);
  const city = province?.cities.find((c) => c.id === filters.cityId);

  return (
    <div className="space-y-5 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-black">فیلترها</h2>
        <Button variant="ghost" size="sm" onClick={reset} className="text-xs text-primary">
          <RotateCcw className="h-3.5 w-3.5" /> حذف همه
        </Button>
      </div>

      {/* keyword */}
      <div className="space-y-1.5">
        <Label>جستجو</Label>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pr-9" placeholder="عنوان، توضیحات، کد آگهی…" value={filters.q} onChange={(e) => patch({ q: e.target.value })} />
        </div>
      </div>

      {/* transaction type */}
      <div className="space-y-2">
        <Label>نوع معامله</Label>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(TRANSACTION_TYPE_LABELS).map(([k, label]) => (
            <button
              key={k}
              onClick={() => patch({ tt: filters.tt.includes(k) ? filters.tt.filter((x) => x !== k) : [...filters.tt, k] })}
              className={cn("rounded-full border px-3 py-1.5 text-xs font-bold transition-colors", filters.tt.includes(k) ? "bg-primary text-primary-foreground border-primary" : "hover:border-primary/40")}
              aria-pressed={filters.tt.includes(k)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* property type */}
      <div className="space-y-2">
        <Label>نوع ملک</Label>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(PROPERTY_TYPE_LABELS).map(([k, label]) => (
            <button
              key={k}
              onClick={() => patch({ types: filters.types.includes(k) ? filters.types.filter((x) => x !== k) : [...filters.types, k] })}
              className={cn("rounded-full border px-3 py-1.5 text-xs font-bold transition-colors", filters.types.includes(k) ? "bg-primary text-primary-foreground border-primary" : "hover:border-primary/40")}
              aria-pressed={filters.types.includes(k)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* location */}
      <div className="space-y-1.5">
        <Label>استان</Label>
        <Select value={filters.provinceId || "all"} onValueChange={(v) => patch({ provinceId: v === "all" ? "" : v, cityId: "", areaId: "" })}>
          <SelectTrigger size="sm"><SelectValue placeholder="همه استان‌ها" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه استان‌ها</SelectItem>
            {lookups?.provinces.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>شهر</Label>
        <Select value={filters.cityId || "all"} onValueChange={(v) => patch({ cityId: v === "all" ? "" : v, areaId: "" })} disabled={!filters.provinceId}>
          <SelectTrigger size="sm"><SelectValue placeholder={filters.provinceId ? "همه شهرها" : "ابتدا استان را انتخاب کنید"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه شهرها</SelectItem>
            {province?.cities.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>منطقه / محله</Label>
        <Select value={filters.areaId || "all"} onValueChange={(v) => patch({ areaId: v === "all" ? "" : v })} disabled={!filters.cityId}>
          <SelectTrigger size="sm"><SelectValue placeholder={filters.cityId ? "همه مناطق" : "ابتدا شهر را انتخاب کنید"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه مناطق</SelectItem>
            {city?.areas?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* price */}
      <div className="space-y-2">
        <Label>محدوده قیمت (تومان)</Label>
        <Slider
          min={0} max={PRICE_MAX} step={100_000_000}
          value={[filters.minPrice ?? 0, filters.maxPrice ?? PRICE_MAX]}
          onValueChange={([min, max]) => patch({ minPrice: min > 0 ? min : null, maxPrice: max < PRICE_MAX ? max : null })}
          aria-label="محدوده قیمت"
        />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{filters.minPrice ? shortMoney(filters.minPrice) : "صفر"}</span>
          <span>{filters.maxPrice ? shortMoney(filters.maxPrice) : "بی‌نهایت"}</span>
        </div>
      </div>

      {/* land area */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label>متراژ زمین از</Label>
          <Input inputMode="numeric" dir="ltr" className="text-left" placeholder="مثلاً ۲۰۰" value={filters.minLand ?? ""} onChange={(e) => patch({ minLand: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null })} />
        </div>
        <div className="space-y-1.5">
          <Label>متراژ زمین تا</Label>
          <Input inputMode="numeric" dir="ltr" className="text-left" placeholder="بدون محدودیت" value={filters.maxLand ?? ""} onChange={(e) => patch({ maxLand: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null })} />
        </div>
      </div>

      {/* build area */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label>متراژ بنا از</Label>
          <Input inputMode="numeric" dir="ltr" className="text-left" placeholder="مثلاً ۱۰۰" value={filters.minBuild ?? ""} onChange={(e) => patch({ minBuild: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null })} />
        </div>
        <div className="space-y-1.5">
          <Label>متراژ بنا تا</Label>
          <Input inputMode="numeric" dir="ltr" className="text-left" placeholder="بدون محدودیت" value={filters.maxBuild ?? ""} onChange={(e) => patch({ maxBuild: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null })} />
        </div>
      </div>

      {/* bedrooms */}
      <div className="space-y-1.5">
        <Label>حداقل اتاق خواب</Label>
        <Select value={filters.bedrooms?.toString() ?? "all"} onValueChange={(v) => patch({ bedrooms: v === "all" ? null : Number(v) })}>
          <SelectTrigger size="sm"><SelectValue placeholder="بدون محدودیت" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">بدون محدودیت</SelectItem>
            {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{faNum(n)}+ خواب</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* document */}
      <div className="space-y-1.5">
        <Label>وضعیت سند</Label>
        <Select value={filters.doc || "all"} onValueChange={(v) => patch({ doc: v === "all" ? "" : v })}>
          <SelectTrigger size="sm"><SelectValue placeholder="همه" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه</SelectItem>
            {Object.entries(DOCUMENT_STATUS_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* amenities */}
      <div className="space-y-2">
        <Label>امکانات</Label>
        <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto scrollbar-thin">
          {lookups?.amenities.map((a) => (
            <label key={a.key} className="flex items-center gap-1.5 text-xs cursor-pointer rounded-lg border p-2 hover:border-primary/40">
              <Checkbox
                checked={filters.amenities.includes(a.key)}
                onCheckedChange={(v) => patch({ amenities: v ? [...filters.amenities, a.key] : filters.amenities.filter((x) => x !== a.key) })}
                aria-label={a.name}
              />
              <span className="truncate">{a.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* switches */}
      <label className="flex items-center justify-between rounded-lg border p-3 cursor-pointer">
        <span className="text-xs font-bold">امکان توافق قیمت</span>
        <Checkbox checked={filters.negotiable} onCheckedChange={(v) => patch({ negotiable: !!v })} aria-label="امکان توافق" />
      </label>
      <label className="flex items-center justify-between rounded-lg border p-3 cursor-pointer">
        <span className="text-xs font-bold">فقط آگهی‌های ویژه</span>
        <Checkbox checked={filters.featured} onCheckedChange={(v) => patch({ featured: !!v })} aria-label="فقط ویژه" />
      </label>
    </div>
  );
}
