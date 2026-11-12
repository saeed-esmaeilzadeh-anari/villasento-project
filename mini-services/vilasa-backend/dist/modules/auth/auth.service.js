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
exports.AuthService = void 0;
exports.normalizePhone = normalizePhone;
exports.faDigitsToEn = faDigitsToEn;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const api_error_1 = require("../../common/api-error");
const audit_service_1 = require("../../common/services/audit.service");
const settings_service_1 = require("../../common/services/settings.service");
const sms_service_1 = require("../../common/services/sms.service");
const session_util_1 = require("../../common/session.util");
const OTP_TTL_MS = 3 * 60 * 1000;
/** Normalize Iranian mobile numbers to 09xxxxxxxxx */
function normalizePhone(raw) {
    const fa = "۰۱۲۳۴۵۶۷۸۹";
    let s = String(raw ?? "").trim();
    s = s.replace(/[۰-۹]/g, (ch) => String(fa.indexOf(ch)));
    s = s.replace(/[٠-٩]/g, (ch) => String("٠١٢٣٤٥٦٧٨٩".indexOf(ch)));
    s = s.replace(/\D/g, "");
    if (s.startsWith("98"))
        s = "0" + s.slice(2);
    if (s.startsWith("9") && s.length === 10)
        s = "0" + s;
    if (!/^09\d{9}$/.test(s))
        throw (0, api_error_1.badRequest)("شماره موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)");
    return s;
}
/** Convert Persian/Arabic-Indic digits to Latin digits */
function faDigitsToEn(s) {
    return s
        .replace(/[۰-۹]/g, (ch) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(ch)))
        .replace(/[٠-٩]/g, (ch) => String("٠١٢٣٤٥٦٧٨٩".indexOf(ch)));
}
let AuthService = class AuthService {
    prisma;
    auditSrv;
    settings;
    sms;
    constructor(prisma, auditSrv, settings, sms) {
        this.prisma = prisma;
        this.auditSrv = auditSrv;
        this.settings = settings;
        this.sms = sms;
    }
    toSafe(user) {
        return {
            id: user.id, phone: user.phone, fullName: user.fullName, email: user.email,
            role: user.role, isHostVerified: user.isHostVerified, isBlocked: user.isBlocked,
            avatarUrl: user.avatarUrl, nationalId: user.nationalId,
        };
    }
    async requestOtp(rawPhone) {
        const phone = normalizePhone(rawPhone);
        const user = await this.prisma.user.findUnique({ where: { phone } });
        if (user?.isBlocked)
            throw (0, api_error_1.badRequest)("حساب کاربری شما مسدود شده است");
        // Rate limit: max 3 codes per 10 minutes per phone
        const recent = await this.prisma.otpCode.count({
            where: { phone, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
        });
        if (recent >= 3)
            throw (0, api_error_1.badRequest)("تعداد درخواست کد بیش از حد مجاز است. کمی بعد تلاش کنید.");
        const code = String(Math.floor(10000 + Math.random() * 90000));
        await this.prisma.otpCode.create({
            data: { phone, code, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
        });
        const demo = (await this.settings.getSetting("sms.demoMode")) === "true";
        const res = await this.sms.get().sendOtp(phone, code);
        await this.auditSrv.audit({ actorPhone: phone, action: "AUTH_OTP_REQUEST", entity: "User" });
        return { ok: true, isNewUser: !user, demoCode: demo ? res.demoCode ?? code : undefined };
    }
    /** Returns the session token; the controller turns it into a cookie. */
    async verifyOtp(rawPhone, rawCode, fullName) {
        const phone = normalizePhone(rawPhone);
        const code = faDigitsToEn(String(rawCode ?? "")).replace(/\D/g, "");
        if (!code)
            throw (0, api_error_1.badRequest)("کد تأیید را وارد کنید");
        const otp = await this.prisma.otpCode.findFirst({
            where: { phone, consumed: false, expiresAt: { gte: new Date() } },
            orderBy: { createdAt: "desc" },
        });
        if (!otp || otp.code !== code)
            throw (0, api_error_1.badRequest)("کد تأیید نامعتبر یا منقضی‌شده است");
        await this.prisma.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });
        let user = await this.prisma.user.findUnique({ where: { phone } });
        if (!user) {
            user = await this.prisma.user.create({
                data: { phone, fullName: fullName?.trim() || null, role: "CUSTOMER" },
            });
        }
        if (user.isBlocked)
            throw (0, api_error_1.badRequest)("حساب کاربری شما مسدود شده است");
        const token = (0, session_util_1.createSessionToken)(user.id, user.role);
        await this.auditSrv.audit({
            actorId: user.id, actorPhone: phone, action: "AUTH_LOGIN", entity: "User", entityId: user.id,
        });
        return { ok: true, user: this.toSafe(user), token };
    }
    async me(viewer) {
        return viewer;
    }
    async updateProfile(user, data) {
        const updated = await this.prisma.user.update({
            where: { id: user.id },
            data: {
                fullName: data.fullName?.trim() || undefined,
                email: data.email?.trim() || undefined,
                nationalId: data.nationalId?.trim() || undefined,
            },
        });
        return { ok: true, user: this.toSafe(updated) };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        settings_service_1.SettingsService,
        sms_service_1.SmsService])
], AuthService);
//# sourceMappingURL=auth.service.js.map