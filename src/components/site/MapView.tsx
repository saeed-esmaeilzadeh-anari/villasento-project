"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";

export type MapPin = { id: string; lat: number; lng: number; title?: string; image?: string | null; price?: string };

/**
 * Interactive Leaflet map (OpenStreetMap tiles — no API key needed).
 * Leaflet is loaded dynamically (it touches `window` at import time, so a
 * static import would break SSR). Two modes:
 *  - display: pins + popups → onSelect(id)
 *  - picker: click on map sets a single marker → onPick({lat,lng})
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
}: {
  pins?: MapPin[];
  center?: [number, number];
  zoom?: number;
  height?: number;
  picker?: boolean;
  picked?: { lat: number; lng: number } | null;
  onPick?: (pos: { lat: number; lng: number }) => void;
  onSelect?: (id: string) => void;
  onBoundsChange?: (b: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => void;
  showSearchArea?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const pickRef = useRef<any>(null);
  // keep latest callbacks without re-binding the map
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

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

      map = L.map(ref.current, { center: center ?? [36.2, 52.3], zoom, scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      if (showSearchArea && onBoundsChange) {
        const emit = () => {
          const b = map.getBounds();
          onBoundsChange({ minLat: b.getSouth(), maxLat: b.getNorth(), minLng: b.getWest(), maxLng: b.getEast() });
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

  function markerIcon(L: any, price?: string) {
    const html = `
      <div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center">
        <div style="background:#0d5c46;color:#fff;border-radius:10px;padding:4px 10px;font-size:11px;font-weight:800;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.25)">${price ?? ""}</div>
        <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #0d5c46"></div>
      </div>`;
    return L.divIcon({ html, className: "vs-marker", iconSize: [0, 0] });
  }

  function drawPins(L: any, map: any, list: MapPin[]) {
    if (layerRef.current) { layerRef.current.remove(); layerRef.current = null; }
    const group = L.layerGroup();
    for (const p of list) {
      const m = L.marker([p.lat, p.lng], { icon: markerIcon(L, p.price) });
      if (p.title) {
        m.bindPopup(`<b style="font-size:12px">${p.title}</b>${p.image ? `<br><img src="${p.image}" style="width:160px;border-radius:6px;margin-top:4px">` : ""}`);
      }
      if (onSelectRef.current && p.id) m.on("click", () => onSelectRef.current?.(p.id));
      group.addLayer(m);
    }
    if (list.length > 0) group.addTo(map);
    layerRef.current = group;
    if (list.length === 1) map.setView([list[0].lat, list[0].lng], Math.max(zoom, 14));
    else if (list.length > 1) {
      const lats = list.map((x) => x.lat);
      const lngs = list.map((x) => x.lng);
      map.fitBounds(L.latLngBounds([Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]).pad(0.15));
    }
  }

  // pins layer (after map ready)
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    drawPins(L, map, pins ?? []);
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

  const locateMe = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 14);
    }, () => undefined, { timeout: 5000 });
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border" style={{ height }}>
      <div ref={ref} style={{ height: "100%", width: "100%" }} aria-label="نقشه موقعیت" />
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
      </div>
      {picker && (
        <div className="absolute bottom-2 inset-x-2 z-[500] rounded-lg bg-black/60 backdrop-blur text-white text-[11px] px-3 py-1.5 text-center pointer-events-none">
          برای تعیین موقعیت ملک روی نقشه کلیک کنید
        </div>
      )}
    </div>
  );
}
