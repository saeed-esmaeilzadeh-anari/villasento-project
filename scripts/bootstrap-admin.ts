/**
 * VillaSento — SUPER_ADMIN bootstrap (idempotent, env-driven).
 *
 * Creates or repairs the main system administrator account:
 *   - Phone:   INITIAL_ADMIN_PHONE  (default 09356966365)
 *   - Password: INITIAL_ADMIN_PASSWORD (REQUIRED from the environment — never in code)
 *   - Role:    SUPER_ADMIN, account Active
 *
 * Behavior:
 *   - If a user with that phone already exists: promotes to SUPER_ADMIN and
 *     (only if INITIAL_ADMIN_PASSWORD is set) resets the password — no duplicate rows.
 *   - Password is stored bcrypt-hashed; the plain value is NEVER printed/logged.
 *   - mustChangePassword is set true so the admin is forced to change the
 *     initial password on first login.
 *
 * Run: bun scripts/bootstrap-admin.ts        (reads .env / .env.local via bun)
 *  or: INITIAL_ADMIN_PASSWORD=... bun scripts/bootstrap-admin.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const phone = (process.env.INITIAL_ADMIN_PHONE || "09356966365").replace(/\D/g, "");
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!/^09\d{9}$/.test(phone)) {
    console.error("INITIAL_ADMIN_PHONE معتبر نیست (فرمت 09xxxxxxxxx)");
    process.exit(1);
  }
  if (!password || password.length < 6) {
    console.error(
      "INITIAL_ADMIN_PASSWORD از متغیر محیطی خوانده نشد.\n" +
      "اجرا نمونه:  INITIAL_ADMIN_PASSWORD='...' bun scripts/bootstrap-admin.ts"
    );
    process.exit(1);
  }

  const existing = await db.user.findUnique({ where: { phone } });

  if (existing) {
    await db.user.update({
      where: { id: existing.id },
      data: {
        role: "SUPER_ADMIN",
        isBlocked: false,
        mustChangePassword: true,
        passwordHash: bcrypt.hashSync(password, 12),
      },
    });
    console.log(`حساب موجود با شماره ${phone} به SUPER_ADMIN ارتقا/ترمیم شد (بدون ایجاد رکورد تکراری).`);
  } else {
    await db.user.create({
      data: {
        phone,
        role: "SUPER_ADMIN",
        isBlocked: false,
        mustChangePassword: true,
        passwordHash: bcrypt.hashSync(password, 12),
        fullName: "مدیر اصلی سیستم",
      },
    });
    console.log(`حساب SUPER_ADMIN با شماره ${phone} ایجاد شد.`);
  }
  console.log("وضعیت: Active | رمز اولیه هش‌شده ذخیره شد | تغییر رمز در اولین ورود اجباری است.");
  const total = await db.user.count({ where: { role: "SUPER_ADMIN" } });
  console.log(`تعداد SUPER_ADMIN در دیتابیس: ${total}`);
}

main()
  .catch((e) => {
    console.error("Bootstrap failed:", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
