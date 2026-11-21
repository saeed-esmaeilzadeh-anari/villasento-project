"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { faNum, priceLine, TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_COLORS } from "@/lib/fa";
import { Badge } from "@/components/ui/badge";
import { SmartImage } from "@/components/site/SmartImage";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Landmark, BedDouble, Ruler, Eye, Star, Building, TreePine, Home, MapPin,
  Heart, Share2, ChevronLeft,
} from "lucide-react";
import type { PropertyCardT } from "@/lib/api";

const TYPE_ICONS: Record<string, typeof Home> = {
  GARDEN: TreePine,
  VILLA: Home,
  GARDEN_VILLA: Building,
  HOUSE: Home,
  APARTMENT: Building,
  LAND: Landmark,
};

export function PropertyCard({ p, className }: { p: PropertyCardT; className?: string }) {
  const TypeIcon = TYPE_ICONS[p.type] ?? Home;
  const { me, openAuth } = useAuth();
  const [fav, setFav] = useState<boolean | null>(null);
  const [favBusy, setFavBusy] = useState(false);
  const isFav = fav ?? false;

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!me) { openAuth("برای افزودن به علاقه‌مندی‌ها وارد حساب شوید"); return; }
    if (favBusy) return;
    setFavBusy(true);
    // optimistic
    setFav(!isFav);
    try {
      const res = await api.post<{ favorited: boolean }>("/api/favorites", { propertyId: p.id });
      setFav(res.favorited);
      toast.success(res.favorited ? "به علاقه‌مندی‌ها اضافه شد" : "از علاقه‌مندی‌ها حذف شد", { duration: 1500 });
    } catch (err) {
      setFav(isFav); // revert
      toast.error((err as Error).message);
    } finally {
      setFavBusy(false);
    }
  };

  const share = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/property/${encodeURIComponent(p.slug || p.id)}`;
    const text = `${p.title} — ${priceLine(p.transactionType, p.salePrice, p.rahnAmount, p.rentAmount)}`;
    try {
      if (navigator.share) await navigator.share({ title: p.title, text, url });
      else { await navigator.clipboard.writeText(url); toast.success("لینک آگهی کپی شد", { duration: 1500 }); }
    } catch { /* cancelled */ }
  };

  return (
    <article
      className={cn(
        "group relative rounded-2xl border bg-card overflow-hidden hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-300 flex flex-col",
        className
      )}
      aria-label={`آگهی ${p.title}`}
    >
      {/* full-card link overlay (kept behind the action buttons) */}
      <Link href={`/property/${encodeURIComponent(p.slug || p.id)}`} prefetch={false} className="absolute inset-0 z-[1]" aria-label={`مشاهده آگهی ${p.title}`}>
        <span className="sr-only">مشاهده جزئیات {p.title}</span>
      </Link>

      {/* ── standard image (aspect-locked: zero layout shift) ── */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <SmartImage
          src={p.image}
          alt={`${p.title} — ${p.locationLabel || p.city || ""}`}
          eager={false}
          className="transition-transform duration-500 group-hover:scale-105"
          fallbackLabel={`${p.typeLabel} — ${p.locationLabel || p.city || "ملک"}`}
          fallbackIcon={<TypeIcon className="h-10 w-10 opacity-40" />}
        />

        {/* badges */}
        <div className="absolute top-2 right-2 z-[2] flex flex-wrap gap-1.5 pointer-events-none">
          <Badge className={cn("border font-bold shadow-sm", TRANSACTION_TYPE_COLORS[p.transactionType])}>
            {TRANSACTION_TYPE_LABELS[p.transactionType] ?? p.ttLabel}
          </Badge>
          {p.isFeatured && (
            <Badge className="bg-amber-500 text-white border-amber-500 shadow-sm font-bold gap-1">
              <Star className="h-3 w-3 fill-current" /> ویژه
            </Badge>
          )}
        </div>

        {/* image counter */}
        {p.imageCount > 1 && (
          <span className="absolute bottom-2 right-2 z-[2] rounded-full bg-black/55 backdrop-blur text-white text-[10px] px-2 py-0.5 pointer-events-none">
            {faNum(p.imageCount)} تصویر
          </span>
        )}

        {/* view count */}
        <span className="absolute bottom-2 left-2 z-[2] rounded-full bg-black/55 backdrop-blur text-white text-[11px] px-2.5 py-1 flex items-center gap-1 pointer-events-none">
          <Eye className="h-3 w-3" /> {faNum(p.viewCount)}
        </span>

        {/* actions (above the link overlay) */}
        <div className="absolute top-2 left-2 z-[2] flex flex-col gap-1.5">
          <button
            onClick={toggleFavorite}
            disabled={favBusy}
            aria-label={isFav ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
            aria-pressed={isFav}
            className={cn(
              "rounded-full p-2 shadow-sm backdrop-blur transition-all active:scale-90",
              isFav ? "bg-red-500 text-white" : "bg-white/90 text-foreground hover:bg-white"
            )}
          >
            <Heart className={cn("h-4 w-4", isFav && "fill-current")} />
          </button>
          <button
            onClick={share}
            aria-label="اشتراک‌گذاری آگهی"
            className="rounded-full p-2 bg-white/90 shadow-sm backdrop-blur text-foreground hover:bg-white transition-all active:scale-90"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── body ── */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="font-bold text-sm leading-6 line-clamp-2 group-hover:text-primary transition-colors">{p.title}</h3>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{p.region?.name ?? p.locationLabel ?? `${p.province ?? ""}${p.province ? "، " : ""}${p.city ?? ""}`}</span>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto">
          {p.buildArea != null && (
            <span className="flex items-center gap-1"><Ruler className="h-3.5 w-3.5" /> {faNum(p.buildArea)} متر</span>
          )}
          {p.landArea != null && (
            <span className="flex items-center gap-1"><TreePine className="h-3.5 w-3.5" /> {faNum(p.landArea)} م زمین</span>
          )}
          {p.bedrooms > 0 && (
            <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {faNum(p.bedrooms)} خواب</span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t">
          <span className="font-black text-primary text-sm leading-6">{priceLine(p.transactionType, p.salePrice, p.rahnAmount, p.rentAmount)}</span>
          {p.negotiable && <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">قابل توافق</span>}
        </div>

        {/* hover CTA */}
        <span className="hidden md:flex items-center justify-center gap-1 text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity h-0 group-hover:h-6 overflow-hidden">
          مشاهده جزئیات آگهی <ChevronLeft className="h-3.5 w-3.5" />
        </span>
      </div>
    </article>
  );
}
