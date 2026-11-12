"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type Lookups } from "@/lib/api";
import { useSearch } from "@/lib/store";
import { navigate } from "@/lib/router";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { faNum, TRANSACTION_TYPE_LABELS, BRAND } from "@/lib/fa";
import { Search, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const TTS = ["SALE", "RAHN", "RAHN_RENT", "RENT"] as const;

/** Advanced property search box (hero): transaction type + province/city/area + keyword */
export function SearchBox({ compact = false }: { compact?: boolean }) {
  const { tt, typeId, provinceId, cityId, areaId, q, set, reset } = useSearch();
  const { data: lookups } = useQuery({
    queryKey: ["lookups"],
    queryFn: () => api.get<Lookups>("/api/lookups"),
    staleTime: 10 * 60 * 1000,
  });

  const province = lookups?.provinces.find((p) => p.id === provinceId);
  const city = province?.cities.find((c) => c.id === cityId);

  const go = () => {
    const sp = new URLSearchParams();
    if (tt) sp.set("tt", tt);
    if (typeId) sp.set("types", typeId);
    if (cityId) sp.set("cityId", cityId);
    else if (provinceId) sp.set("provinceId", provinceId);
    if (areaId) sp.set("areaId", areaId);
    if (q) sp.set("q", q);
    navigate("/search" + (sp.toString() ? `?${sp.toString()}` : ""));
  };

  return (
    <div className={cn("rounded-2xl border bg-card/95 backdrop-blur shadow-xl", compact ? "p-3" : "p-4 md:p-5")} dir="rtl">
      {/* transaction type */}
      <div className="flex flex-wrap gap-1.5 mb-3" role="tablist" aria-label="نوع معامله">
        {TTS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tt === t}
            onClick={() => set({ tt: tt === t ? "" : t })}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
              tt === t ? "bg-primary text-primary-foreground shadow" : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            )}
          >
            {TRANSACTION_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className={cn("grid gap-2", compact ? "grid-cols-2 md:grid-cols-5" : "md:grid-cols-5")}>
        <div className="space-y-1.5">
          <label className="text-[11px] text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> استان</label>
          <Select
            value={provinceId || "all"}
            onValueChange={(v) => set({ provinceId: v === "all" ? "" : v, cityId: "", areaId: "", provinceName: lookups?.provinces.find((p) => p.id === v)?.name ?? "" })}
          >
            <SelectTrigger size="sm" aria-label="انتخاب استان"><SelectValue placeholder="همه استان‌ها" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه استان‌ها</SelectItem>
              {lookups?.provinces.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] text-muted-foreground">شهر</label>
          <Select value={cityId || "all"} onValueChange={(v) => set({ cityId: v === "all" ? "" : v, areaId: "", cityName: province?.cities.find((c) => c.id === v)?.name ?? "" })} disabled={!provinceId}>
            <SelectTrigger size="sm" aria-label="انتخاب شهر"><SelectValue placeholder={provinceId ? "همه شهرها" : "ابتدا استان"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه شهرها</SelectItem>
              {province?.cities.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] text-muted-foreground">منطقه</label>
          <Select value={areaId || "all"} onValueChange={(v) => set({ areaId: v === "all" ? "" : v })} disabled={!cityId}>
            <SelectTrigger size="sm" aria-label="انتخاب منطقه"><SelectValue placeholder={cityId ? "همه مناطق" : "ابتدا شهر"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه مناطق</SelectItem>
              {city?.areas?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] text-muted-foreground">نوع ملک</label>
          <Select value={typeId || "all"} onValueChange={(v) => set({ typeId: v === "all" ? "" : v })}>
            <SelectTrigger size="sm" aria-label="انتخاب نوع ملک"><SelectValue placeholder="همه" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه</SelectItem>
              {lookups?.types.map((t) => <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] text-muted-foreground">جستجو</label>
          <div className="flex gap-1.5">
            <Input
              placeholder="عنوان، کد آگهی…" value={q}
              onChange={(e) => set({ q: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") go(); }}
              aria-label="عبارت جستجو"
            />
            <Button size="sm" className="px-3 shrink-0" onClick={go} aria-label="جستجو">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      {!compact && (
        <p className="text-[11px] text-muted-foreground mt-2.5">
          جستجو در {faNum(lookups?.provinces.length ?? 0)} استان · آگهی‌های تأییدشده {BRAND}
        </p>
      )}
    </div>
  );
}

