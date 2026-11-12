import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";

/** Central system settings with sensible defaults (commission, penalties, OTP demo mode…). Port of src/server/settings.ts */
export const SETTING_DEFAULTS: Record<string, string> = {
  "commission.rate": "0.12", // 12% platform commission
  "booking.holdMinutes": "30", // temporary hold while paying
  "cancelPolicy.FLEXIBLE": JSON.stringify([
    { untilDays: 1, percent: 0 },
    { untilDays: 0, percent: 30 },
  ]),
  "cancelPolicy.MODERATE": JSON.stringify([
    { untilDays: 3, percent: 0 },
    { untilDays: 1, percent: 30 },
    { untilDays: 0, percent: 60 },
  ]),
  "cancelPolicy.STRICT": JSON.stringify([
    { untilDays: 7, percent: 0 },
    { untilDays: 2, percent: 50 },
    { untilDays: 0, percent: 100 },
  ]),
  "sms.demoMode": "true", // return OTP in API response instead of real SMS
  "site.name": "ویلاسا",
  "site.supportPhone": "۰۲۱-۹۱۰۰۰۰۰۰",
};

export type CancelTier = { untilDays: number; percent: number };

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getSetting(key: string): Promise<string | null> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    return row?.value ?? SETTING_DEFAULTS[key] ?? null;
  }

  async getSettingNumber(key: string, fallback = 0): Promise<number> {
    const v = await this.getSetting(key);
    const n = v == null ? NaN : Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  async setSetting(key: string, value: string) {
    await this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  async getAllSettings(): Promise<Record<string, string>> {
    const rows = await this.prisma.systemSetting.findMany();
    const out: Record<string, string> = { ...SETTING_DEFAULTS };
    for (const r of rows) out[r.key] = r.value;
    return out;
  }

  async getCancelPolicy(policy: string): Promise<CancelTier[]> {
    const raw = await this.getSetting(`cancelPolicy.${policy}`);
    try {
      const parsed = JSON.parse(raw || "[]") as CancelTier[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      /* fallthrough */
    }
    return [{ untilDays: 2, percent: 50 }];
  }
}
