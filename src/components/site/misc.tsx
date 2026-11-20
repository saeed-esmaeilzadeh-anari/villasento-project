"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LISTING_STATUS_COLORS as PROPERTY_STATUS_COLORS,
  LISTING_STATUS_LABELS as PROPERTY_STATUS_LABELS,
  faNum,
} from "@/lib/fa";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { SmartImage } from "@/components/site/SmartImage";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, ImageOff, ZoomIn, ZoomOut, Maximize2, Minimize2 } from "lucide-react";

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

/**
 * Professional listing gallery:
 *  large main stage + thumbnail strip + next/prev + lightbox (keyboard,
 *  fullscreen, zoom, swipe, counter) + skeleton + error fallback.
 * RTL-aware: «بعدی» (next) lives on the LEFT side with ChevronLeft.
 */
export function ImageGallery({ images, title }: { images: string[]; title: string }) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const list = (images ?? []).filter(Boolean);

  if (!list.length) {
    return (
      <div className="aspect-[16/10] rounded-2xl bg-muted grid place-items-center text-muted-foreground gap-1">
        <ImageOff className="h-8 w-8 opacity-50" />
        <span className="text-xs">تصویری برای این آگهی ثبت نشده است</span>
      </div>
    );
  }

  return (
    <>
      {/* ── main stage ── */}
      <GalleryStage list={list} title={title} idx={idx} setIdx={setIdx} onExpand={() => { setIdx(idx); setOpen(true); }} />

      {/* ── thumbnail strip ── */}
      {list.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-thin" role="tablist" aria-label="تصاویر آگهی">
          {list.map((src, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === idx}
              aria-label={`تصویر ${faNum(i + 1)}`}
              onClick={() => setIdx(i)}
              className={cn(
                "relative shrink-0 w-20 h-16 md:w-24 md:h-[4.5rem] rounded-xl overflow-hidden bg-muted transition-all",
                i === idx ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "opacity-70 hover:opacity-100"
              )}
            >
              <SmartImage src={src} alt={`${title} — تصویر ${faNum(i + 1)}`} />
            </button>
          ))}
        </div>
      )}

      {/* ── lightbox ── */}
      {open && (
        <Lightbox
          list={list}
          title={title}
          idx={idx}
          onClose={() => setOpen(false)}
          onNav={(i) => setIdx(((i % list.length) + list.length) % list.length)}
        />
      )}
    </>
  );
}

/** Main stage: big image + overlay arrows + counter + expand button */
function GalleryStage({ list, title, idx, setIdx, onExpand }: {
  list: string[]; title: string; idx: number;
  setIdx: (i: number) => void; onExpand: () => void;
}) {
  const many = list.length > 1;
  return (
    <div className="relative aspect-[16/10] md:aspect-[16/9] rounded-2xl overflow-hidden bg-muted group/stage">
      <SmartImage key={idx} src={list[idx]} alt={`${title} — تصویر ${faNum(idx + 1)}`} eager={idx === 0} />

      {many && (
        <>
          <NavBtn side="next" onClick={() => setIdx((idx + 1) % list.length)} />
          <NavBtn side="prev" onClick={() => setIdx((idx - 1 + list.length) % list.length)} />
        </>
      )}

      {/* counter */}
      <span className="absolute bottom-3 right-3 rounded-full bg-black/60 backdrop-blur text-white text-[11px] px-3 py-1 pointer-events-none">
        {faNum(idx + 1)} / {faNum(list.length)}
      </span>

      {/* expand */}
      <button
        onClick={onExpand}
        aria-label="نمایش تمام‌صفحه تصاویر"
        className="absolute top-3 left-3 rounded-full bg-black/55 backdrop-blur text-white p-2 opacity-0 group-hover/stage:opacity-100 focus-visible:opacity-100 transition-opacity"
      >
        <Maximize2 className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Circular overlay navigation button (RTL: next = left side) */
function NavBtn({ side, onClick }: { side: "next" | "prev"; onClick: () => void }) {
  const isNext = side === "next";
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={isNext ? "تصویر بعدی" : "تصویر قبلی"}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 rounded-full bg-black/55 backdrop-blur text-white p-2.5",
        "opacity-0 group-hover/stage:opacity-100 focus-visible:opacity-100 transition-all hover:bg-black/75 active:scale-95",
        isNext ? "left-3" : "right-3"
      )}
    >
      {isNext ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
    </button>
  );
}

/** Full lightbox: keyboard, fullscreen, zoom, swipe, counter, thumbnails */
function Lightbox({ list, title, idx, onClose, onNav }: {
  list: string[]; title: string; idx: number;
  onClose: () => void; onNav: (i: number) => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [fs, setFs] = useState(false);
  const [dir, setDir] = useState(1); // 1 = forward
  const shellRef = useRef<HTMLDivElement | null>(null);
  const touchX = useRef<number | null>(null);
  const many = list.length > 1;

  const go = useCallback((delta: number) => {
    setDir(delta > 0 ? 1 : -1);
    setZoomed(false);
    onNav(idx + delta);
  }, [idx, onNav]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await shellRef.current?.requestFullscreen();
        setFs(true);
      } else {
        await document.exitFullscreen();
        setFs(false);
      }
    } catch { /* denied */ }
  }, []);

  // keyboard navigation + scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") { if (many) go(1); }
      else if (e.key === "ArrowRight") { if (many) go(-1); }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [go, onClose, many]);

  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0]?.clientX ?? null; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null || !many) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); // swipe left → next (RTL image flow)
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={shellRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={`گالری تصاویر ${title}`}
        dir="rtl"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* top bar */}
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 text-white/90 shrink-0">
          <div className="text-xs sm:text-sm font-bold truncate">
            <span className="opacity-80">{title}</span>
            <span className="mx-2 opacity-50">|</span>
            <span className="tabular-nums">{faNum(idx + 1)} از {faNum(list.length)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setZoomed((z) => !z)}
              aria-label={zoomed ? "کوچک‌نمایی" : "بزرگ‌نمایی"}
              className="rounded-full p-2.5 hover:bg-white/10 transition-colors"
            >
              {zoomed ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
            </button>
            <button
              onClick={toggleFullscreen}
              aria-label={fs ? "خروج از تمام‌صفحه" : "نمایش تمام‌صفحه"}
              className="rounded-full p-2.5 hover:bg-white/10 transition-colors"
            >
              {fs ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
            <button onClick={onClose} aria-label="بستن" className="rounded-full p-2.5 hover:bg-white/10 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* stage */}
        <div className="relative flex-1 min-h-0 grid place-items-center px-3 pb-2">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: dir > 0 ? -40 : 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir > 0 ? 40 : -40 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className={cn(
                "max-w-full max-h-full w-auto h-full grid place-items-center",
                zoomed ? "cursor-zoom-out overflow-auto" : "cursor-zoom-in"
              )}
              onClick={() => setZoomed((z) => !z)}
            >
              <motion.img
                src={list[idx]}
                alt={`${title} — تصویر ${faNum(idx + 1)}`}
                draggable={false}
                animate={{ scale: zoomed ? 1.9 : 1 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={cn(
                  "max-w-full max-h-full object-contain rounded-lg select-none",
                  zoomed && "origin-center"
                )}
                onError={(e) => {
                  (e.target as HTMLImageElement).outerHTML =
                    '<div class="text-white/60 text-sm grid place-items-center gap-2 py-10" role="img">تصویر در دسترس نیست</div>';
                }}
              />
            </motion.div>
          </AnimatePresence>

          {many && (
            <>
              <button
                onClick={() => go(1)}
                aria-label="تصویر بعدی"
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 hover:bg-white/25 text-white p-3 backdrop-blur transition-colors active:scale-95"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={() => go(-1)}
                aria-label="تصویر قبلی"
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 hover:bg-white/25 text-white p-3 backdrop-blur transition-colors active:scale-95"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
        </div>

        {/* lightbox thumbnails */}
        {many && (
          <div className="shrink-0 flex gap-2 overflow-x-auto px-3 pb-3 scrollbar-thin">
            {list.map((src, i) => (
              <button
                key={i}
                aria-label={`تصویر ${faNum(i + 1)}`}
                aria-current={i === idx}
                onClick={() => { setDir(i > idx ? 1 : -1); setZoomed(false); onNav(i); }}
                className={cn(
                  "shrink-0 w-16 h-12 rounded-lg overflow-hidden bg-white/10 transition-all",
                  i === idx ? "ring-2 ring-white" : "opacity-60 hover:opacity-100"
                )}
              >
                { }
                <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
