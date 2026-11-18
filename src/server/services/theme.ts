import { db } from "@/lib/db";
import { badRequest } from "../http";
import type { SafeUser } from "./properties";

/**
 * Per-user theme preferences — persisted in User.themePrefs (JSON string).
 * Guests keep theirs in localStorage (see ThemeProvider); on login the saved
 * prefs are fetched and applied. Shape is validated server-side and capped
 * at 2KB so it can never become a free-form data sink.
 */

export type ThemePrefs = {
  mode?: "light" | "dark" | "auto" | "system";
  palette?: string;
  customColor?: string;
  fontSize?: "s" | "m" | "l";
  density?: "compact" | "comfortable";
  radius?: "s" | "m" | "l";
  dayStart?: number; // hour 0-23 — auto mode day start
  dayEnd?: number; // hour 0-23 — auto mode night start
};

const ALLOWED: Record<string, string[]> = {
  mode: ["light", "dark", "auto", "system"],
  palette: ["brand", "blue", "green", "purple", "teal", "orange", "red", "slate", "custom"],
  fontSize: ["s", "m", "l"],
  density: ["compact", "comfortable"],
};

function clampHour(v: unknown): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(23, Math.max(0, Math.round(n)));
}

export function validateThemePrefs(raw: unknown): ThemePrefs {
  if (typeof raw !== "object" || raw === null) throw badRequest("بدنه تنظیمات نامعتبر است");
  const input = raw as Record<string, unknown>;
  const out: ThemePrefs = {};
  if (input.mode !== undefined) {
    if (!ALLOWED.mode.includes(String(input.mode))) throw badRequest("حالت نمایش نامعتبر است");
    out.mode = input.mode as ThemePrefs["mode"];
  }
  if (input.palette !== undefined) {
    if (!ALLOWED.palette.includes(String(input.palette))) throw badRequest("پالت رنگ نامعتبر است");
    out.palette = input.palette as string;
  }
  if (input.customColor !== undefined) {
    const c = String(input.customColor);
    if (!/^#[0-9a-fA-F]{6}$/.test(c)) throw badRequest("رنگ دلخواه نامعتبر است");
    out.customColor = c;
  }
  if (input.fontSize !== undefined) {
    if (!ALLOWED.fontSize.includes(String(input.fontSize))) throw badRequest("اندازه فونت نامعتبر است");
    out.fontSize = input.fontSize as ThemePrefs["fontSize"];
  }
  if (input.density !== undefined) {
    if (!ALLOWED.density.includes(String(input.density))) throw badRequest("تراکم نمایش نامعتبر است");
    out.density = input.density as ThemePrefs["density"];
  }
  if (input.radius !== undefined) {
    if (!ALLOWED.fontSize.includes(String(input.radius))) throw badRequest("گردی گوشه‌ها نامعتبر است");
    out.radius = input.radius as ThemePrefs["radius"];
  }
  if (input.dayStart !== undefined) out.dayStart = clampHour(input.dayStart);
  if (input.dayEnd !== undefined) out.dayEnd = clampHour(input.dayEnd);
  return out;
}

export async function getThemePrefs(user: SafeUser): Promise<ThemePrefs> {
  const full = await db.user.findUnique({ where: { id: user.id }, select: { themePrefs: true } });
  if (!full?.themePrefs) return {};
  try {
    return JSON.parse(full.themePrefs) as ThemePrefs;
  } catch {
    return {};
  }
}

export async function updateThemePrefs(user: SafeUser, prefs: ThemePrefs): Promise<ThemePrefs> {
  // merge with existing so partial updates work
  const current = await getThemePrefs(user);
  const merged = { ...current, ...prefs };
  const json = JSON.stringify(merged);
  if (json.length > 2048) throw badRequest("حجم تنظیمات بیش از حد مجاز است");
  await db.user.update({ where: { id: user.id }, data: { themePrefs: json } });
  return merged;
}
