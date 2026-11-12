"use client";

import { Link } from "@/lib/router";
import { faNum, priceLine, TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_COLORS } from "@/lib/fa";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Landmark, BedDouble, Ruler, Eye, Star, Building, TreePine, Home, MapPin } from "lucide-react";
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
  return (
    <Link
      to={`/property/${p.id}`}
      className={cn(
        "group rounded-2xl border bg-card overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-300 flex flex-col",
        className
      )}
      aria-label={`آگهی ${p.title}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {p.image ? (
          <img
            src={p.image}
            alt={`${p.title} — ${p.city}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="h-full grid place-items-center text-muted-foreground"><TypeIcon className="h-10 w-10 opacity-40" /></div>
        )}
        <div className="absolute top-2 right-2 flex flex-wrap gap-1.5">
          <Badge className={cn("border font-bold shadow-sm", TRANSACTION_TYPE_COLORS[p.transactionType])}>
            {TRANSACTION_TYPE_LABELS[p.transactionType] ?? p.ttLabel}
          </Badge>
          {p.isFeatured && <Badge className="bg-amber-500 text-white border-amber-500 shadow-sm font-bold">⭐ ویژه</Badge>}
        </div>
        <div className="absolute bottom-2 left-2 rounded-full bg-black/55 backdrop-blur text-white text-[11px] px-2.5 py-1 flex items-center gap-1">
          <Eye className="h-3 w-3" /> {faNum(p.viewCount)}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-sm leading-6 line-clamp-2 group-hover:text-primary transition-colors">{p.title}</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{p.province}، {p.city}{p.area ? `، ${p.area}` : ""}</span>
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
      </div>
    </Link>
  );
}
