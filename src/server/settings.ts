import { db } from "@/lib/db";

/** Central system settings with sensible defaults (commission, penalties, OTP demo mode…) */
export const SETTING_DEFAULTS: Record<string, string> = {
  "commission.rate": "0.12", // 12% platform commission
  "booking.holdMinutes": "30", // temporary hold while paying
  "cancelPolicy.FLEXIBLE": JSON.stringify([
    { untilDays: 1, percent: 0 }, { untilDays: 0, percent: 30 },
  ]),
  "cancelPolicy.MODERATE": JSON.stringify([
    { untilDays: 3, percent: 0 }, { untilDays: 1, percent: 30 }, { untilDays: 0, percent: 60 },
  ]),
  "cancelPolicy.STRICT": JSON.stringify([
    { untilDays: 7, percent: 0 }, { untilDays: 2, percent: 50 }, { untilDays: 0, percent: 100 },
  ]),
  "sms.demoMode": "true", // return OTP in API response instead of real SMS
  "site.name": "ویلاسا",
  "site.supportPhone": "۰۲۱-۹۱۰۰۰۰۰۰",
};

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.systemSetting.findUnique({ where: { key } });
  return row?.value ?? SETTING_DEFAULTS[key] ?? null;
}

export async function getSettingNumber(key: string, fallback = 0): Promise<number> {
  const v = await getSetting(key);
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function setSetting(key: string, value: string) {
  await db.systemSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.systemSetting.findMany();
  const out: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export type CancelTier = { untilDays: number; percent: number };

export async function getCancelPolicy(policy: string): Promise<CancelTier[]> {
  const raw = await getSetting(`cancelPolicy.${policy}`);
  try {
    const parsed = JSON.parse(raw || "[]") as CancelTier[];
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch { /* fallthrough */ }
  return [{ untilDays: 2, percent: 50 }];
}
