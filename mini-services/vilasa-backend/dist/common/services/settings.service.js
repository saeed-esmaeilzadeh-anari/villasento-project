"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = exports.SETTING_DEFAULTS = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
/** Central system settings with sensible defaults (commission, penalties, OTP demo mode…). Port of src/server/settings.ts */
exports.SETTING_DEFAULTS = {
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
let SettingsService = class SettingsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getSetting(key) {
        const row = await this.prisma.systemSetting.findUnique({ where: { key } });
        return row?.value ?? exports.SETTING_DEFAULTS[key] ?? null;
    }
    async getSettingNumber(key, fallback = 0) {
        const v = await this.getSetting(key);
        const n = v == null ? NaN : Number(v);
        return Number.isFinite(n) ? n : fallback;
    }
    async setSetting(key, value) {
        await this.prisma.systemSetting.upsert({
            where: { key },
            create: { key, value },
            update: { value },
        });
    }
    async getAllSettings() {
        const rows = await this.prisma.systemSetting.findMany();
        const out = { ...exports.SETTING_DEFAULTS };
        for (const r of rows)
            out[r.key] = r.value;
        return out;
    }
    async getCancelPolicy(policy) {
        const raw = await this.getSetting(`cancelPolicy.${policy}`);
        try {
            const parsed = JSON.parse(raw || "[]");
            if (Array.isArray(parsed) && parsed.length)
                return parsed;
        }
        catch {
            /* fallthrough */
        }
        return [{ untilDays: 2, percent: 50 }];
    }
};
exports.SettingsService = SettingsService;
exports.SettingsService = SettingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SettingsService);
//# sourceMappingURL=settings.service.js.map