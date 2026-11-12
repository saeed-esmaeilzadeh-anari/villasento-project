"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LISTING_STATUS_COLORS as PROPERTY_STATUS_COLORS,
  LISTING_STATUS_LABELS as PROPERTY_STATUS_LABELS,
  faNum,
} from "@/lib/fa";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PropertyStatusBadge({ status }: { status: string }) {
  return <Badge variant="outline" className={cn("border", PROPERTY_STATUS_COLORS[status])}>{PROPERTY_STATUS_LABELS[status] ?? status}</Badge>;
}

export function EmptyState({ icon, title, desc, action }: {
  icon?: React.ReactNode; title: string; desc?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-3 text-muted-foreground/60">{icon}</div>}
      <div className="font-bold text-foreground">{title}</div>
      {desc && <p className="mt-1 text-sm text-muted-foreground max-w-sm">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatCard({ title, value, icon, hint, tone = "default" }: {
  title: string; value: string | number; icon?: React.ReactNode; hint?: string;
  tone?: "default" | "primary" | "warning" | "danger";
}) {
  const tones: Record<string, string> = {
    default: "bg-muted text-foreground",
    primary: "bg-primary/10 text-primary",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-red-100 text-red-700",
  };
  return (
    <div className="rounded-2xl border bg-card p-4 flex items-start justify-between gap-2">
      <div>
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className="text-xl font-black mt-1 tabular-nums">{typeof value === "number" ? faNum(value.toLocaleString("en-US").replace(/,/g, "٬")) : value}</div>
        {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
      </div>
      {icon && <div className={cn("rounded-xl p-2.5", tones[tone])}>{icon}</div>}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
      </div>
    </div>
  );
}

export function RowSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-4">
      <Skeleton className="h-14 w-20 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

export function ImageGallery({ images, title }: { images: string[]; title: string }) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  if (!images?.length) {
    return <div className="aspect-[2/1] rounded-2xl bg-muted grid place-items-center text-muted-foreground">تصویری ثبت نشده</div>;
  }

  const next = () => setIdx((i) => (i + 1) % images.length);
  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);

  return (
    <>
      <div className="grid grid-cols-4 grid-rows-2 gap-2 h-64 md:h-96 rounded-2xl overflow-hidden">
        {images.slice(0, 5).map((src, i) => (
          <button
            key={i}
            onClick={() => { setIdx(i); setOpen(true); }}
            className={cn("relative overflow-hidden group", i === 0 ? "col-span-2 row-span-2" : "hidden md:block")}
            aria-label={`تصویر ${faNum(i + 1)}`}
          >
            { }
            <img src={src} alt={`${title} — تصویر ${faNum(i + 1)}`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            {i === 4 && images.length > 5 && (
              <span className="absolute inset-0 bg-black/55 text-white grid place-items-center text-sm font-bold">
                + {faNum(images.length - 5)} تصویر دیگر
              </span>
            )}
          </button>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl p-2" dir="rtl">
          <DialogTitle className="sr-only">گالری تصاویر {title}</DialogTitle>
          <div className="relative">
            { }
            <img src={images[idx]} alt={`${title} — تصویر ${faNum(idx + 1)}`} className="w-full max-h-[75vh] object-contain rounded-lg" />
            <Button size="icon" variant="secondary" className="absolute top-2 left-2" onClick={() => setOpen(false)} aria-label="بستن">
              <X className="h-4 w-4" />
            </Button>
            {images.length > 1 && (
              <>
                <Button size="icon" variant="secondary" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={prev} aria-label="قبلی">
                  <ChevronRight className="h-5 w-5" />
                </Button>
                <Button size="icon" variant="secondary" className="absolute left-2 top-1/2 -translate-y-1/2" onClick={next} aria-label="بعدی">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              </>
            )}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 text-white text-xs px-3 py-1">
              {faNum(idx + 1)} از {faNum(images.length)}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
