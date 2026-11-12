# راهنمای استقرار (Deploy) ویلاسنتو

## ۱) متغیرهای محیطی (`.env`)

از الگوی `.env.example` شروع کنید:

```env
DATABASE_URL="file:/var/www/villasento/db/custom.db"      # SQLite
# یا پس از تغییر provider در prisma/schema.prisma به postgresql:
# DATABASE_URL="postgresql://user:pass@host:5432/villasento"
AUTH_SECRET="<openssl rand -hex 32>"                       # الزامی در Production
NEXT_PUBLIC_SITE_URL="https://YOUR-DOMAIN.com"             # برای sitemap/canonical/OG
NODE_ENV=production
```

> هرگز مقادیر واقعی را در مخزن commit نکنید؛ `.env.example` را مرجع قرار دهید.

## ۲) مهاجرت دیتابیس

```bash
bun run db:generate          # ساخت Prisma Client
npx prisma db push           # Development
# یا در Production با Migration:
# npx prisma migrate deploy
bun run db:seed              # فقط بار اول / محیط دمو
```

طرح اسکیما PostgreSQL-ready است؛ برای مهاجرت: `provider = "postgresql"` در `prisma/schema.prisma` + `DATABASE_URL` جدید + `migrate deploy`. ستون‌های قیمت از نوع Float (محدوده دقیق تا ۹۰۰۰ تریلیون تومان) و هیچ جدولی حذف‌شدنی نیست.

## ۳) Build و اجرا

```bash
bun run build     # خروجی standalone در .next/standalone
bun run start     # اجرای Production (پورت 3000)
```

## ۴) ذخیره‌سازی تصاویر

- آپلودها در `uploads/YYYY-MM/*.webp` ذخیره و از `/api/files/...` سرو می‌شوند (سرو **نیاز به دسترسی عمودی دایرکتوری ندارد**؛ مسیر با normalize امن شده).
- برای هاست چندسروره: دایرکتوری `uploads/` را روی Volume مشترک/S3 قرار دهید و در `src/server/upload.ts` مسیر را تغییر دهید (فقط این یک فایل).
- محدودیت‌ها در تنظیمات (`upload.maxSizeMB`) و اعتبارسنجی MIME با sharp است.

## ۵) سرویس‌های خارجی (بدون کلید = حالت نمایشی، بدون موفقیت ساختگی)

| سرویس | وضعیت | نحوه اتصال |
|---|---|---|
| پیامک (OTP) | حالت نمایشی — کد در پاسخ API | پنل ادمین → تنظیمات → `sms.provider` (kavenegar/smsir) و `sms.apiKey`؛ پیاده‌سازی adapter در `src/server/sms.ts` |
| ایمیل | غیرفعال (`email.smtpConfigured=false`) | SMTP را در سرویس ایمیل خود تنظیم کنید؛ نقطه اتصال: اعلان‌های `Notification` |
| درگاه پرداخت | در دامنه فعلی (آگهی/بازدید) کاربرد ندارد؛ سیستم اشتراک ویژه → NOT_IMPLEMENTED | در صورت نیاز: Zarinpal/Zibal merchant در `.env` |
| نقشه | Leaflet + OpenStreetMap — **بدون نیاز به کلید** | برای Neshan/Google فقط کامپوننت `MapView` را عوض کنید |

## ۶) Health Check و پایش

- `GET /api/home` → 200 یعنی DB + اپ سالم
- `GET /api/sitemap` → 200 با XML
- لاگ سرور: `bun run start` خروجی را به `server.log` tee می‌کند؛ در dev به `dev.log`
- Audit Log ادمین (`/#/admin/audit`) عملیات حساس را ثبت می‌کند

## ۷) چک‌لیست امنیتی Production

- [ ] `AUTH_SECRET` قوی تنظیم شده (openssl rand -hex 32)
- [ ] `NEXT_PUBLIC_SITE_URL` روی دامنه واقعی
- [ ] HTTPS (کوکی نشست `secure` در production خودکار فعال است)
- [ ] رمز حساب‌های مدیر تغییر کرده (اولین ورود با رمز دمو ممنوع)
- [ ] `sms.demoMode=false` پس از اتصال درگاه پیامک واقعی
- [ ] بکاپ دوره‌ای `db/` و `uploads/`
- [ ] محدودیت دسترسی فایل‌سیستم به دایرکتوری‌های `db/` و `uploads/`
- [ ] اجرای `bun run lint` و `bunx tsc --noEmit` در CI

## ۸) حساب مدیر اولیه

1. `bun run db:seed` → کاربر مدیر ارشد `09120000001` با رمز `123456`
2. **بلافاصله** وارد `/#/account/profile` شوید و رمز را عوض کنید
3. یا حساب دمو را حذف و از پنل ادمین → کاربران، نقش SUPER_ADMIN به حساب واقعی بدهید

## ۹) تنظیمات دامنه

- Caddy/Nginx → پروکسی به پورت 3000
- `public/robots.txt` → خط `Sitemap:` را به `https://YOUR-DOMAIN/api/sitemap` تغییر دهید
- برای ایندکس کامل بهتر، نقشه راه SSR در `docs/seo.md` آمده است
