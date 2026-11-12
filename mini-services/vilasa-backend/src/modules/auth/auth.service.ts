import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { badRequest } from "../../common/api-error";
import { AuditService } from "../../common/services/audit.service";
import { SettingsService } from "../../common/services/settings.service";
import { SmsService } from "../../common/services/sms.service";
import { createSessionToken } from "../../common/session.util";
import type { SafeUser } from "../../common/session.middleware";

const OTP_TTL_MS = 3 * 60 * 1000;

/** Normalize Iranian mobile numbers to 09xxxxxxxxx */
export function normalizePhone(raw: string): string {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  let s = String(raw ?? "").trim();
  s = s.replace(/[۰-۹]/g, (ch) => String(fa.indexOf(ch)));
  s = s.replace(/[٠-٩]/g, (ch) => String("٠١٢٣٤٥٦٧٨٩".indexOf(ch)));
  s = s.replace(/\D/g, "");
  if (s.startsWith("98")) s = "0" + s.slice(2);
  if (s.startsWith("9") && s.length === 10) s = "0" + s;
  if (!/^09\d{9}$/.test(s)) throw badRequest("شماره موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)");
  return s;
}

/** Convert Persian/Arabic-Indic digits to Latin digits */
export function faDigitsToEn(s: string): string {
  return s
    .replace(/[۰-۹]/g, (ch) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(ch)))
    .replace(/[٠-٩]/g, (ch) => String("٠١٢٣٤٥٦٧٨٩".indexOf(ch)));
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private auditSrv: AuditService,
    private settings: SettingsService,
    private sms: SmsService,
  ) {}

  private toSafe(user: {
    id: string; phone: string; fullName: string | null; email: string | null;
    role: string; isHostVerified: boolean; isBlocked: boolean; avatarUrl: string | null;
    nationalId: string | null;
  }) {
    return {
      id: user.id, phone: user.phone, fullName: user.fullName, email: user.email,
      role: user.role, isHostVerified: user.isHostVerified, isBlocked: user.isBlocked,
      avatarUrl: user.avatarUrl, nationalId: user.nationalId,
    };
  }

  async requestOtp(rawPhone: string) {
    const phone = normalizePhone(rawPhone);
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (user?.isBlocked) throw badRequest("حساب کاربری شما مسدود شده است");

    // Rate limit: max 3 codes per 10 minutes per phone
    const recent = await this.prisma.otpCode.count({
      where: { phone, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
    });
    if (recent >= 3) throw badRequest("تعداد درخواست کد بیش از حد مجاز است. کمی بعد تلاش کنید.");

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
  async verifyOtp(rawPhone: string, rawCode: string, fullName?: string) {
    const phone = normalizePhone(rawPhone);
    const code = faDigitsToEn(String(rawCode ?? "")).replace(/\D/g, "");
    if (!code) throw badRequest("کد تأیید را وارد کنید");

    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, consumed: false, expiresAt: { gte: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!otp || otp.code !== code) throw badRequest("کد تأیید نامعتبر یا منقضی‌شده است");

    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });

    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { phone, fullName: fullName?.trim() || null, role: "CUSTOMER" },
      });
    }
    if (user.isBlocked) throw badRequest("حساب کاربری شما مسدود شده است");

    const token = createSessionToken(user.id, user.role);
    await this.auditSrv.audit({
      actorId: user.id, actorPhone: phone, action: "AUTH_LOGIN", entity: "User", entityId: user.id,
    });

    return { ok: true, user: this.toSafe(user), token };
  }

  async me(viewer: SafeUser | null) {
    return viewer;
  }

  async updateProfile(user: SafeUser, data: { fullName?: string; email?: string; nationalId?: string }) {
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
}
