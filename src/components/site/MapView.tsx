"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import "leaflet/dist/leaflet.css";
import { Crosshair, LocateFixed, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { faNum } from "@/lib/fa";

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  title?: string;
  image?: string | null;
  price?: string;
  /** property type (GARDEN | VILLA | GARDEN_VILLA | HOUSE | APARTMENT | LAND) for type-coded markers */
  ptype?: string;
  href?: string;
};

export type MapBBox = { minLat: number; maxLat: number; minLng: number; maxLng: number };

/**
 * محدوده پیش‌فرض نقشه = کادر محیطی مختصات واقعی و تأییدشدهٔ روستاهای هدف
 * (جاده سنتو / میان ولایت — OSM). ثابت نگه داشته می‌شود تا نقشه بدون دادهٔ
 * سرور هم روی محدوده فعالیت ویلاسنتو باز شود، نه روی کل ایران.
 */
export const SANTOO_FALLBACK_BBOX: MapBBox = {
  minLat: 36.4665, maxLat: 36.5763,
  minLng: 59.3368, maxLng: 59.4498,
};

// ── type-coded marker palette (consistent with the site's look) ──
const TYPE_STYLE: Record<string, { color: string; glyph: string; label: string }> = {
  GARDEN: { color: "#2e7d32", glyph: "M12 22V12M12 12a4 4 0 1 0-4-4M12 12a4 4 0 1 1 4-4", label: "باغ" },
  VILLA: { color: "#0d5c46", glyph: "M3 21h18M5 21V10l7-6 7 6v11M9 21v-6h6v6", label: "ویلا" },
  GARDEN_VILLA: { color: "#00695c", glyph: "M3 21h18M5 21V10l7-6 7 6v11M9 21v-6h6v6", label: "باغ‌ویلا" },
  HOUSE: { color: "#e07b39", glyph: "M3 21h18M5 21V10l7-6 7 6v11M9 21v-6h6v6", label: "خانه" },
  APARTMENT: { color: "#455a64", glyph: "M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1", label: "آپارتمان" },
  LAND: { color: "#8d6e63", glyph: "M12 22V12M12 12a4 4 0 1 0-4-4M12 12a4 4 0 1 1 4-4", label: "زمین" },
};
const DEFAULT_STYLE = { color: "#0d5c46", glyph: "M3 21h18M5 21V10l7-6 7 6v11M9 21v-6h6v6", label: "ملک" };

/**
 * Interactive Leaflet map (OpenStreetMap tiles — no API key needed).
 * Leaflet is loaded dynamically (it touches `window` at import time, so a
 * static import would break SSR). Two modes:
 *  - display: type-coded markers + clustering + info popup cards → onSelect(id)
 *  - picker: click on map sets a single marker → onPick({lat,lng})
 *
 * Stacking-context note (combobox-under-map bug): Leaflet's internal panes use
 * z-index 400–800 and — when no ancestor creates a stacking context — they
 * compete directly with document-level Radix portals (z-50), covering the
 * open dropdown. The wrapper therefore uses `isolation: isolate` so ALL
 * leaflet panes stay contained inside the map's own stacking context. That
 * fixes the root cause instead of z-index hacks.
 */
export function MapView({
  pins,
  center,
  zoom = 12,
  height = 380,
  picker,
  picked,
  onPick,
  onSelect,
  onBoundsChange,
  showSearchArea,
  initialBounds,
  enableRegionSearch = true,
  /** programmatic fly-to (e.g. after picking a region in the form) */
  focus,
}: {
  pins?: MapPin[];
  center?: [number, number];
  zoom?: number;
  height?: number;
  picker?: boolean;
  picked?: { lat: number; lng: number } | null;
  onPick?: (pos: { lat: number; lng: number }) => void;
  onSelect?: (id: string) => void;
  onBoundsChange?: (b: MapBBox) => void;
  showSearchArea?: boolean;
  /** initial geographic focus (verified region bounds) — wins over center */
  initialBounds?: MapBBox | null;
  enableRegionSearch?: boolean;
  focus?: { lat: number; lng: number; zoom?: number } | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const pickRef = useRef<any>(null);
  const lastFitRef = useRef<string>("");
  const [ready, setReady] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [regionQ, setRegionQ] = useState("");
  const [regionOpen, setRegionOpen] = useState(false);
  // keep latest callbacks without re-binding the map
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // region search from the map (real DB data, includes alternative names)
  const { data: regionHits, isFetching: regionFetching } = useQuery({
    queryKey: ["regions-map-search", regionQ],
    queryFn: () => api.get<{ items: { id: string; name: string; nameEn: string; typeLabel: string; path: string; lat: number | null; lng: number | null; geoStatus: string }[] }>(`/api/regions?q=${encodeURIComponent(regionQ)}`),
    enabled: enableRegionSearch && regionOpen && regionQ.trim().length >= 2,
  });

  // init map once
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    let cancelled = false;
    let map: any = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;
      LRef.current = L;

      // default marker icons for bundlers
      delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      map = L.map(ref.current, {
        center: center ?? [(SANTOO_FALLBACK_BBOX.minLat + SANTOO_FALLBACK_BBOX.maxLat) / 2, (SANTOO_FALLBACK_BBOX.minLng + SANTOO_FALLBACK_BBOX.maxLng) / 2],
        zoom,
        scrollWheelZoom: false,
      });
      const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      });
      let tileErrCount = 0;
      tiles.on("tileerror", () => { tileErrCount++; if (tileErrCount >= 4) setTileError(true); });
      tiles.addTo(map);
      map.on("load", () => setReady(true));

      // initial geographic focus: verified region bounds (server-provided) → fallback corridor
      const b = initialBounds ?? SANTOO_FALLBACK_BBOX;
      if (!center) {
        map.fitBounds([[b.minLat, b.minLng], [b.maxLat, b.maxLng]], { padding: [12, 12] });
      }

      if (showSearchArea && onBoundsChange) {
        const emit = () => {
          const bb = map.getBounds();
          onBoundsChange({ minLat: bb.getSouth(), maxLat: bb.getNorth(), minLng: bb.getWest(), maxLng: bb.getEast() });
        };
        map.on("moveend", emit);
        ref.current.addEventListener("vs-search-area", emit);
      }

      if (picker) {
        map.on("click", (e: any) => {
          const pos = { lat: e.latlng.lat, lng: e.latlng.lng };
          if (pickRef.current) pickRef.current.remove();
          pickRef.current = L.marker([pos.lat, pos.lng], { icon: markerIcon(L, "") }).addTo(map);
          onPickRef.current?.(pos);
        });
      }

      mapRef.current = map;
      // draw any pins that arrived before the map finished loading
      drawPins(L, map, pins ?? []);
      setTimeout(() => map.invalidateSize(), 150);
    })();

    return () => {
      cancelled = true;
      try { map?.remove(); } catch { /* noop */ }
      mapRef.current = null;
    };
  }, []);

  function markerIcon(L: any, price?: string, ptype?: string, selected = false) {
    const style = TYPE_STYLE[ptype ?? ""] ?? DEFAULT_STYLE;
    const scale = selected ? 1.15 : 1;
    const html = `
      <div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 6px rgba(0,0,0,.3))">
        <div style="display:flex;align-items:center;gap:5px;background:${style.color};color:#fff;border:${selected ? 2 : 1.5}px solid #fff;border-radius:12px;padding:4px 9px;font-size:11px;font-weight:800;white-space:nowrap;transform:scale(${scale})">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${style.glyph}"/></svg>
          <span>${price ?? style.label}</span>
        </div>
        <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${style.color}"></div>
      </div>`;
    return L.divIcon({ html, className: "vs-marker", iconSize: [0, 0] });
  }

  function popupHtml(p: MapPin): string {
    const style = TYPE_STYLE[p.ptype ?? ""] ?? DEFAULT_STYLE;
    const href = p.href ?? `#/property/${p.id}`;
    return `
      <div dir="rtl" style="font-family:inherit;min-width:190px">
        ${p.image ? `<a href="${href}"><img src="${p.image}" alt="" style="width:100%;height:110px;object-fit:cover;border-radius:8px;margin-bottom:6px" loading="lazy"></a>` : ""}
        <a href="${href}" style="display:block;font-size:12.5px;font-weight:800;color:#1a1a1a;text-decoration:none;line-height:1.7;margin-bottom:4px">${p.title ?? "آگهی ملک"}</a>
        ${p.price ? `<div style="font-size:12px;font-weight:800;color:${style.color}">${p.price}</div>` : ""}
        <a href="${href}" style="display:inline-block;margin-top:6px;font-size:11px;font-weight:800;color:#0d5c46;text-decoration:none;border:1px solid #0d5c46;border-radius:8px;padding:3px 10px">مشاهده آگهی</a>
      </div>`;
  }

  /** grid clustering: merge nearby pins per zoom level into count bubbles */
  function clusterPins(L: any, map: any, list: MapPin[]): { kind: "pin" | "cluster"; lat: number; lng: number; pin?: MapPin; items?: MapPin[] }[] {
    const z = map.getZoom();
    const cell = Math.max(360 / Math.pow(2, z + 2), 0.0008); // shrinks with zoom
    const buckets = new Map<string, MapPin[]>();
    for (const p of list) {
      const key = `${Math.round(p.lat / cell)}:${Math.round(p.lng / cell)}`;
      const arr = buckets.get(key) ?? [];
      arr.push(p);
      buckets.set(key, arr);
    }
    const out: { kind: "pin" | "cluster"; lat: number; lng: number; pin?: MapPin; items?: MapPin[] }[] = [];
    for (const arr of buckets.values()) {
      if (arr.length === 1) out.push({ kind: "pin", lat: arr[0].lat, lng: arr[0].lng, pin: arr[0] });
      else out.push({ kind: "cluster", lat: arr.reduce((s, p) => s + p.lat, 0) / arr.length, lng: arr.reduce((s, p) => s + p.lng, 0) / arr.length, items: arr });
    }
    return out;
  }

  function drawPins(L: any, map: any, list: MapPin[]) {
    if (layerRef.current) { layerRef.current.remove(); layerRef.current = null; }
    const group = L.layerGroup();

    if (!picker) {
      for (const c of clusterPins(L, map, list)) {
        if (c.kind === "pin" && c.pin) {
          const p = c.pin;
          const m = L.marker([p.lat, p.lng], { icon: markerIcon(L, p.price, p.ptype) });
          if (p.title) m.bindPopup(popupHtml(p), { maxWidth: 230 });
          if (onSelectRef.current && p.id) m.on("click", () => onSelectRef.current?.(p.id));
          group.addLayer(m);
        } else if (c.kind === "cluster" && c.items) {
          const n = c.items.length;
          const icon = L.divIcon({
            html: `<div style="transform:translate(-50%,-50%);width:34px;height:34px;border-radius:9999px;background:#0d5c46;color:#fff;display:grid;place-items:center;font-size:12px;font-weight:900;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);direction:ltr">${new Intl.NumberFormat("fa-IR").format(n)}</div>`,
            className: "vs-cluster",
            iconSize: [0, 0],
          });
          const cm = L.marker([c.lat, c.lng], { icon });
          const lats = c.items.map((x) => x.lat);
          const lngs = c.items.map((x) => x.lng);
          const bounds = L.latLngBounds([Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]);
          cm.on("click", () => map.fitBounds(bounds.pad(0.4), { maxZoom: 16 }));
          group.addLayer(cm);
        }
      }
    }

    if (list.length > 0) group.addTo(map);
    layerRef.current = group;
    if (picker) return; // picker mode never refits (user controls the view)
    if (list.length === 1) {
      map.setView([list[0].lat, list[0].lng], Math.max(zoom, 14));
    } else if (list.length > 1 && list.length <= 6) {
      const lats = list.map((x) => x.lat);
      const lngs = list.map((x) => x.lng);
      const sig = `${Math.min(...lats).toFixed(4)},${Math.max(...lats).toFixed(4)},${Math.min(...lngs).toFixed(4)},${Math.max(...lngs).toFixed(4)}`;
      // refit only when the extent actually changes — otherwise identical
      // fitBounds → moveend → onBoundsChange → re-render loops forever
      if (sig !== lastFitRef.current) {
        lastFitRef.current = sig;
        map.fitBounds(L.latLngBounds([Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]).pad(0.15));
      }
    }
  }

  // pins layer (after map ready) — re-cluster on zoom too
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    const redraw = () => drawPins(L, map, pins ?? []);
    redraw();
    map.on("zoomend", redraw);
    return () => { map.off("zoomend", redraw); };
  }, [pins, zoom]);

  // picked point (controlled)
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L || !picker) return;
    if (pickRef.current) { pickRef.current.remove(); pickRef.current = null; }
    if (picked) {
      pickRef.current = L.marker([picked.lat, picked.lng], { icon: markerIcon(L, "") }).addTo(map);
      map.setView([picked.lat, picked.lng], map.getZoom() || zoom);
    }
  }, [picked, picker, zoom]);

  // programmatic focus (fly to a region selected elsewhere in the UI)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.flyTo([focus.lat, focus.lng], focus.zoom ?? 13, { duration: 0.6 });
  }, [focus]);

  const backToProjectArea = () => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    const b = initialBounds ?? SANTOO_FALLBACK_BBOX;
    map.flyToBounds([[b.minLat, b.minLng], [b.maxLat, b.maxLng]], { padding: [12, 12], duration: 0.6 });
  };

  const locateMe = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 14);
    }, () => undefined, { timeout: 5000 });
  };

  const pickRegion = (r: { name: string; lat: number | null; lng: number | null; geoStatus: string }) => {
    const map = mapRef.current;
    if (!map) return;
    if (r.lat != null && r.lng != null) {
      map.flyTo([r.lat, r.lng], 14, { duration: 0.6 });
    } else {
      // unverified region: no fake marker — just inform the user
      setRegionOpen(false);
      setRegionQ("");
      return;
    }
    setRegionOpen(false);
    setRegionQ("");
  };

  const hits = useMemo(() => (regionQ.trim().length >= 2 ? (regionHits?.items ?? []) : []), [regionHits, regionQ]);

  return (
    <div className="relative rounded-2xl overflow-hidden border isolate bg-muted" style={{ height }} data-map-ready={ready}>
      <div ref={ref} style={{ height: "100%", width: "100%" }} aria-label="نقشه موقعیت" />

      {/* loading state */}
      {!ready && (
        <div className="absolute inset-0 grid place-items-center bg-muted z-[20]">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> در حال بارگذاری نقشه…
          </div>
        </div>
      )}

      {/* network/tile error — map keeps working, page must not break */}
      {tileError && (
        <div className="absolute top-2 inset-x-2 z-[510] rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-[11px] px-3 py-2 font-bold text-center">
          بارگذاری کاشی‌های نقشه با مشکل مواجه شد؛ اتصال اینترنت را بررسی کنید. نشانگرها همچنان فعال‌اند.
        </div>
      )}

      {/* controls */}
      <div className="absolute top-2 left-2 z-[500] flex flex-col gap-1.5">
        {showSearchArea && onBoundsChange && (
          <Button
            size="sm" variant="secondary" className="shadow-md text-xs font-bold"
            onClick={() => ref.current?.dispatchEvent(new Event("vs-search-area"))}
          >
            جستجو در این محدوده
          </Button>
        )}
        <Button size="icon" variant="secondary" className="shadow-md h-8 w-8" onClick={locateMe} aria-label="موقعیت من">
          <Crosshair className="h-4 w-4" />
        </Button>
        {!picker && (
          <Button size="icon" variant="secondary" className="shadow-md h-8 w-8" onClick={backToProjectArea} aria-label="بازگشت به محدوده ویلاسنتو" title="بازگشت به محدوده جاده سنتو">
            <LocateFixed className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* region search on the map (portal-safe: sits above leaflet inside the isolated wrapper) */}
      {enableRegionSearch && !picker && (
        <div className="absolute top-2 right-2 z-[500] w-56 md:w-64">
          <div className="relative">
            <Input
              value={regionQ}
              onChange={(e) => { setRegionQ(e.target.value); setRegionOpen(true); }}
              onFocus={() => setRegionOpen(true)}
              onBlur={() => setTimeout(() => setRegionOpen(false), 180)}
              placeholder="جستجوی منطقه روی نقشه…"
              className="h-8 text-xs bg-background/95 shadow-md"
              aria-label="جستجوی منطقه روی نقشه"
            />
            {regionOpen && regionQ.trim().length >= 2 && (
              <div className="absolute top-full mt-1 inset-x-0 rounded-xl border bg-popover shadow-lg max-h-56 overflow-y-auto z-[520]">
                {regionFetching && <div className="px-3 py-2 text-[11px] text-muted-foreground">در حال جستجو…</div>}
                {!regionFetching && hits.length === 0 && <div className="px-3 py-2 text-[11px] text-muted-foreground">منطقه‌ای یافت نشد</div>}
                {hits.map((r) => (
                  <button
                    key={r.id}
                    onMouseDown={(e) => { e.preventDefault(); pickRegion(r); }}
                    className="w-full text-right px-3 py-2 hover:bg-muted transition-colors border-b last:border-0"
                    type="button"
                  >
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      {r.name}
                      <span className="text-[10px] text-muted-foreground font-medium">{r.typeLabel}</span>
                      {r.geoStatus !== "VERIFIED" && <span className="text-[9px] text-amber-700 bg-amber-100 rounded px-1">نیازمند بررسی</span>}
                    </span>
                    {r.path && <span className="block text-[10px] text-muted-foreground truncate">{r.path}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {picker && (
        <div className="absolute bottom-2 inset-x-2 z-[500] rounded-lg bg-black/60 backdrop-blur text-white text-[11px] px-3 py-1.5 text-center pointer-events-none">
          برای تعیین موقعیت ملک روی نقشه کلیک کنید
        </div>
      )}
    </div>
  );
}
