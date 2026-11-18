"use client";

import { create } from "zustand";
import { useEffect } from "react";
import { api } from "@/lib/api";

/**
 * VillaSento theme system.
 * - mode: light | dark | auto (by local clock, dayStart..dayEnd) | system (OS)
 * - palette: preset color or custom (color picker) — applied via CSS vars
 * - fontSize / density / radius — applied via html[data-*] attributes
 * - Guests: localStorage (zustand persist). Logged-in users: synced to
 *   User.themePrefs in the database via /api/me/theme (merge on change,
 *   restore on login). Theme changes never reload the page.
 * - FOUC: an inline script in layout.tsx applies saved attributes before
 *   first paint; this provider re-applies after mount and on every change.
 */

export type ThemeMode = "light" | "dark" | "auto" | "system";

/** Single localStorage key — bare prefs JSON; the FOUC script reads the same key */
export const THEME_LS_KEY = "villasento-theme";
export type Palette = "brand" | "blue" | "green" | "purple" | "teal" | "orange" | "red" | "slate" | "custom";

export type ThemePrefs = {
  mode: ThemeMode;
  palette: Palette;
  customColor: string | null;
  fontSize: "s" | "m" | "l";
  density: "compact" | "comfortable";
  radius: "s" | "m" | "l";
  dayStart: number; // hour (0-23) — auto mode: day begins
  dayEnd: number; // hour (0-23) — auto mode: night begins
};

export const DEFAULT_PREFS: ThemePrefs = {
  mode: "auto",
  palette: "brand",
  customColor: null,
  fontSize: "m",
  density: "comfortable",
  radius: "m",
  dayStart: 7,
  dayEnd: 19,
};

export const PALETTE_PRESETS: { key: Palette; label: string; color: string }[] = [
  { key: "brand", label: "سبز برند", color: "#0d5c46" },
  { key: "blue", label: "آبی", color: "#2563eb" },
  { key: "green", label: "سبز", color: "#16a34a" },
  { key: "purple", label: "بنفش", color: "#7c3aed" },
  { key: "teal", label: "فیروزه‌ای", color: "#0d9488" },
  { key: "orange", label: "نارنجی", color: "#ea580c" },
  { key: "red", label: "قرمز", color: "#dc2626" },
  { key: "slate", label: "خاکستری", color: "#475569" },
];

/** WCAG-ish relative luminance → pick a readable foreground for custom colors */
function fgForHex(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.55 ? "#1a1a1a" : "#ffffff";
}

type ThemeState = {
  prefs: ThemePrefs;
  resolved: "light" | "dark";
  set: (patch: Partial<ThemePrefs>) => void;
  applyNow: () => void;
};

function resolveMode(p: ThemePrefs, systemDark: boolean): "light" | "dark" {
  if (p.mode === "light") return "light";
  if (p.mode === "dark") return "dark";
  if (p.mode === "system") return systemDark ? "dark" : "light";
  // auto — by local clock: [dayStart, dayEnd) = day, otherwise night
  const h = new Date().getHours();
  const day = p.dayStart <= p.dayEnd
    ? h >= p.dayStart && h < p.dayEnd
    : h >= p.dayStart || h < p.dayEnd; // overnight window (e.g. 20→6)
  return day ? "light" : "dark";
}

function applyPrefs(p: ThemePrefs): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  const html = document.documentElement;
  const systemDark = typeof window !== "undefined"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
  const resolved = resolveMode(p, systemDark);

  html.classList.toggle("dark", resolved === "dark");
  html.dataset.palette = p.palette;
  html.dataset.fontsize = p.fontSize;
  html.dataset.density = p.density;
  html.dataset.radius = p.radius;
  if (p.palette === "custom" && p.customColor && /^#[0-9a-fA-F]{6}$/.test(p.customColor)) {
    html.style.setProperty("--custom-primary", p.customColor);
    html.style.setProperty("--custom-primary-fg", fgForHex(p.customColor));
    html.style.setProperty("--custom-primary-fg-dark", fgForHex(p.customColor));
  } else {
    html.style.removeProperty("--custom-primary");
    html.style.removeProperty("--custom-primary-fg");
    html.style.removeProperty("--custom-primary-fg-dark");
  }
  return resolved;
}

/** mirror to the key the FOUC inline script reads (same shape) */
function persistBare(p: ThemePrefs) {
  try {
    localStorage.setItem(THEME_LS_KEY, JSON.stringify(p));
  } catch { /* private mode */ }
}

// ── server sync (debounced, fire-and-forget, only while logged in) ──
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let serverSynced = false;

function saveToServer(patch: Partial<ThemePrefs>) {
  if (!serverSynced) return; // guest → localStorage only
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    api.post("/api/me/theme", patch).catch(() => {});
  }, 700);
}

async function restoreFromServer() {
  try {
    const saved = await api.get<Partial<ThemePrefs>>("/api/me/theme");
    const merged = { ...DEFAULT_PREFS, ...useTheme.getState().prefs, ...saved };
    const resolved = applyPrefs(merged);
    useTheme.setState({ prefs: merged, resolved });
    persistBare(merged);
    serverSynced = true;
  } catch {
    serverSynced = false; // 401 → guest
  }
}

/** Called by AppShell when auth state changes (login/logout) */
export function themeUserChanged(meId: string | null | undefined) {
  if (meId) void restoreFromServer();
  else serverSynced = false;
}

function loadBare(): ThemePrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(THEME_LS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<ThemePrefs>;
    return { ...DEFAULT_PREFS, ...p };
  } catch {
    return DEFAULT_PREFS;
  }
}

export const useTheme = create<ThemeState>((set, get) => ({
  prefs: loadBare(),
  resolved: "light",
  set: (patch) => {
    const prefs = { ...get().prefs, ...patch };
    const resolved = applyPrefs(prefs);
    set({ prefs, resolved });
    persistBare(prefs);
    saveToServer(patch);
  },
  applyNow: () => {
    const resolved = applyPrefs(get().prefs);
    set({ resolved });
  },
}));

/**
 * Mount once inside the client root. Handles: first apply after hydration,
 * auto-mode clock ticks, system-mode media queries.
 */
export function ThemeProvider() {
  const applyNow = useTheme((s) => s.applyNow);
  const mode = useTheme((s) => s.prefs.mode);
  const dayStart = useTheme((s) => s.prefs.dayStart);
  const dayEnd = useTheme((s) => s.prefs.dayEnd);

  useEffect(() => {
    applyNow();
  }, [applyNow, mode, dayStart, dayEnd]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyNow();
    mq.addEventListener("change", onChange);
    const t = setInterval(() => applyNow(), 60 * 1000); // auto mode clock tick
    return () => {
      mq.removeEventListener("change", onChange);
      clearInterval(t);
    };
  }, [applyNow, mode]);

  return null;
}
