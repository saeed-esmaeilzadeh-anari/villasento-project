"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SmartImage — standard building-block for every listing/property image.
 *
 * Contract:
 *  - The PARENT owns the layout: give it an aspect-* box (or fixed h/w) so the
 *    page never shifts while the file loads (zero CLS by construction).
 *  - Shows a skeleton shimmer until the file is decoded, then fades in.
 *  - Broken / missing files collapse into a neutral fallback panel instead of
 *    the browser's broken-image icon.
 *  - `eager` + `fetchPriority` for the LCP hero image; everything else lazy.
 */
export function SmartImage({
  src,
  alt,
  className,
  eager = false,
  objectFit = "cover",
  fallbackLabel = "تصویر در دسترس نیست",
  fallbackIcon,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  eager?: boolean;
  objectFit?: "cover" | "contain";
  fallbackLabel?: string;
  fallbackIcon?: React.ReactNode;
}) {
  const [state, setState] = useState<"loading" | "loaded" | "error">(() => (src ? "loading" : "error"));

  /**
   * Callback ref — covers the SSR/hydration case where the image finished
   * loading BEFORE React attached onLoad (the load event never re-fires).
   * Runs on mount and whenever the node changes, outside of render.
   */
  const attachImg = (node: HTMLImageElement | null) => {
    if (node && node.complete && node.naturalWidth > 0) {
      setState((s) => (s === "loaded" ? s : "loaded"));
    }
  };

  if (!src || state === "error") {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "w-full h-full grid place-items-center bg-muted text-muted-foreground/70 gap-1 select-none",
          className
        )}
      >
        {fallbackIcon ?? <ImageOff className="h-7 w-7 opacity-60" />}
        <span className="text-[11px] leading-4 px-2 text-center">{fallbackLabel}</span>
      </div>
    );
  }

  return (
    <span className="relative block w-full h-full overflow-hidden">
      {state === "loading" && (
        <span className="absolute inset-0 bg-muted animate-pulse" aria-hidden="true" />
      )}
      <img
        ref={attachImg}
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
        draggable={false}
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
        className={cn(
          "w-full h-full transition-opacity duration-300",
          objectFit === "cover" ? "object-cover" : "object-contain",
          state === "loaded" ? "opacity-100" : "opacity-0",
          className
        )}
      />
    </span>
  );
}
