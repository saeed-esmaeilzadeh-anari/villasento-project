import { db } from "@/lib/db";
import { badRequest, unauthorized } from "../http";
import { smsProvider } from "../sms";
import { audit } from "../audit";
import { getSetting } from "../settings";
import { createSession, destroySession, getCurrentUser, requireUser } from "../session";
import { hashPassword, verifyPassword, passwordPolicyError } from "./password";

const OTP_TTL_MS = 3 * 60 * 1000;

/** Normalize Iranian mobile numbers to 09xxxxxxxxx */
export function normalizePhone(raw: string): string {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const en = "0123456789";
  let s = String(raw ?? "").trim();
  s = s.replace(/[۰-۹]/g, (ch) => String(fa.indexOf(ch)));
  s = s.replace(/[٠-٩]/g, (ch) => String("٠١٢٣٤٥٦٧٨٩".indexOf(ch)));
  s = s.replace(/\D/g, "");
  if (s.startsWith("98")) s = "0" + s.slice(2);
  if (s.startsWith("9") && s.length === 10) s = "0" + s;
  if (!/^09\d{9}$/.test(s)) throw badRequest("شماره موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)");
  return s;
}

export async function requestOtp(rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  const user = await db.user.findUnique({ where: { phone } });
  if (user?.isBlocked) throw forbiddenBlocked();

  // Rate limit: max 3 codes per 10 minutes per phone
  const recent = await db.otpCode.count({
    where: { phone, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
  });
  if (recent >= 3) throw badRequest("تعداد درخواست کد بیش از حد مجاز است. کمی بعد تلاش کنید.");

  const code = String(Math.floor(10000 + Math.random() * 90000));
  await db.otpCode.create({
    data: { phone, code, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });

  const demo = (await getSetting("sms.demoMode")) === "true";
  const res = await smsProvider().sendOtp(phone, code);
  await audit({ actorPhone: phone, action: "AUTH_OTP_REQUEST", entity: "User" });

  return {
    ok: true,
    isNewUser: !user,
    demoCode: demo ? (res.demoCode ?? code) : undefined,
  };
}

function forbiddenBlocked() {
  return Object.assign(new Error("حساب کاربری شما مسدود شده است"), { status: 403 });
}

/** Convert Persian/Arabic-Indic digits to Latin digits */
export function faDigitsToEn(s: string): string {
  return s
    .replace(/[۰-۹]/g, (ch) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(ch)))
    .replace(/[٠-٩]/g, (ch) => String("٠١٢٣٤٥٦٧٨٩".indexOf(ch)));
}

export async function verifyOtp(rawPhone: string, rawCode: string, fullName?: string) {
  const phone = normalizePhone(rawPhone);
  const code = faDigitsToEn(String(rawCode ?? "")).replace(/\D/g, "");
  if (!code) throw badRequest("کد تأیید را وارد کنید");

  const otp = await db.otpCode.findFirst({
    where: { phone, consumed: false, expiresAt: { gte: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.code !== code) throw badRequest("کد تأیید نامعتبر یا منقضی‌شده است");

  await db.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });

  let user = await db.user.findUnique({ where: { phone } });
  if (!user) {
    user = await db.user.create({
      data: { phone, fullName: fullName?.trim() || null, role: "CUSTOMER" },
    });
  }
  if (user.isBlocked) throw forbiddenBlocked();

  await createSession(user.id, user.role);
  await audit({ actorId: user.id, actorPhone: phone, action: "AUTH_LOGIN", entity: "User", entityId: user.id });

  return {
    ok: true,
    user: {
      id: user.id, phone: user.phone, fullName: user.fullName, email: user.email,
      role: user.role, isHostVerified: user.isHostVerified, isBlocked: user.isBlocked,
      avatarUrl: user.avatarUrl, nationalId: user.nationalId,
    },
  };
}

export async function me() {
  return (await getCurrentUser()) ?? null;
}

export async function logout() {
  await destroySession();
  return { ok: true };
}

export async function updateProfile(data: { fullName?: string; email?: string; nationalId?: string }) {
  const user = await requireUser();
  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      fullName: data.fullName?.trim() || undefined,
      email: data.email?.trim() || undefined,
      nationalId: data.nationalId?.trim() || undefined,
    },
  });
  return {
    ok: true,
    user: {
      id: updated.id, phone: updated.phone, fullName: updated.fullName, email: updated.email,
      role: updated.role, isHostVerified: updated.isHostVerified, isBlocked: updated.isBlocked,
      avatarUrl: updated.avatarUrl, nationalId: updated.nationalId,
    },
  };
}

// ───────────────── Password auth ─────────────────

function safeUser(u: { id: string; phone: string; fullName: string | null; email: string | null; role: string; isHostVerified: boolean; isBlocked: boolean; avatarUrl: string | null; nationalId: string | null; hasPassword?: boolean }) {
  return {
    id: u.id, phone: u.phone, fullName: u.fullName, email: u.email,
    role: u.role, isHostVerified: u.isHostVerified, isBlocked: u.isBlocked,
    avatarUrl: u.avatarUrl, nationalId: u.nationalId, hasPassword: u.hasPassword ?? false,
  };
}

/** Login with phone + password (users who set a password) */
export async function loginWithPassword(rawPhone: string, password: string) {
  const phone = normalizePhone(rawPhone);
  if (!password) throw badRequest("رمز عبور را وارد کنید");
  const user = await db.user.findUnique({ where: { phone } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw unauthorized("شماره موبایل یا رمز عبور اشتباه است");
  }
  if (user.isBlocked) throw Object.assign(new Error("حساب کاربری شما مسدود شده است"), { status: 403 });
  await createSession(user.id, user.role);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});
  await audit({ actorId: user.id, actorPhone: phone, action: "AUTH_LOGIN_PASSWORD", entity: "User", entityId: user.id });
  return { ok: true, user: safeUser({ ...user, hasPassword: true }) };
}

/** Set initial password while logged in (or overwrite if allowed) */
export async function setPassword(newPassword: string) {
  const user = await requireUser();
  const err = passwordPolicyError(newPassword);
  if (err) throw badRequest(err);
  const full = await db.user.findUnique({ where: { id: user.id } });
  if (full?.passwordHash) throw badRequest("برای این حساب قبلاً رمز عبور تنظیم شده است؛ از تغییر رمز استفاده کنید");
  await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword) } });
  await audit({ actorId: user.id, action: "PASSWORD_SET", entity: "User", entityId: user.id });
  return { ok: true };
}

/** Change password (requires current password) */
export async function changePassword(currentPassword: string, newPassword: string) {
  const user = await requireUser();
  const err = passwordPolicyError(newPassword);
  if (err) throw badRequest(err);
  const full = await db.user.findUnique({ where: { id: user.id } });
  if (!full?.passwordHash) throw badRequest("ابتدا رمز عبور تنظیم کنید");
  if (!verifyPassword(currentPassword, full.passwordHash)) throw badRequest("رمز عبور فعلی اشتباه است");
  await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword) } });
  await audit({ actorId: user.id, action: "PASSWORD_CHANGE", entity: "User", entityId: user.id });
  return { ok: true };
}

/** Reset password via OTP: request-otp → verify code → set new password (one call) */
export async function resetPassword(rawPhone: string, code: string, newPassword: string) {
  const phone = normalizePhone(rawPhone);
  const err = passwordPolicyError(newPassword);
  if (err) throw badRequest(err);
  const cleanCode = faDigitsToEn(String(code ?? "")).replace(/\D/g, "");
  const otp = await db.otpCode.findFirst({
    where: { phone, consumed: false, expiresAt: { gte: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.code !== cleanCode) throw badRequest("کد تأیید نامعتبر یا منقضی‌شده است");
  const user = await db.user.findUnique({ where: { phone } });
  if (!user) throw badRequest("کاربری با این شماره یافت نشد");
  await db.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });
  await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword) } });
  await audit({ actorId: user.id, actorPhone: phone, action: "PASSWORD_RESET", entity: "User", entityId: user.id });
  return { ok: true };
}

export { unauthorized };
