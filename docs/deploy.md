# راهنمای استقرار (Deploy) ویلاسنتو

## ۱) متغیرهای محیطی (`.env`)

از الگوی `.env.example` شروع کنید:

```env
DATABASE_URL="file:/var/www/villasento/db/custom.db"      # SQLite
# یا پس از تغییر provider در prisma/schema.prisma به postgresql:
# DATABASE_URL="postgresql://user:pass@host:5432/villasento"
AUTH_SECRET="<openssl rand -hex 32>"                       # الزامی در Production (در بک‌اند هم عیناً همین مقدار)
SESSION_COOKIE_NAME="villasento_session"                   # در بک‌اند هم عیناً همین مقدار (SSO)
CORS_ORIGIN="https://YOUR-DOMAIN.com"                      # فقط بک‌اند NestJS — محدود به دامنه واقعی
NEXT_PUBLIC_SITE_URL="https://YOUR-DOMAIN.com"             # برای sitemap/canonical/OG
NODE_ENV=production
```

> هرگز مقادیر واقعی را در مخزن commit نکنید؛ `.env.example` را مرجع قرار دهید. مرجع کامل همه متغیرها: `docs/env-guide.md`.

## ۲) مهاجرت دیتابیس

```bash
# ابتدا DATABASE_URL را بررسی و از دیتابیس فعلی backup بگیرید.
# سپس ساختار دیتابیس را بدون اجازه حذف داده‌ها با schema هماهنگ کنید:
bun run db:push              # معادل: npm run db:push
bun run db:generate          # ساخت Prisma Client

# فقط بار اول / محیط دمو:
bun run db:seed
```

**رفع خطای `P2022` مانند `The column main.User.themePrefs does not exist`:** این خطا یعنی دیتابیس قدیمی‌تر از `prisma/schema.prisma` است. پس از تأیید `DATABASE_URL` و تهیه backup، در ریشه پروژه اجرا کنید:

```bash
npm run db:push
npm run db:generate
```

یا در محیط دارای Bun، `bun run db:push` و سپس `bun run db:generate`. این دستورها schema فعلی را با دیتابیس همگام می‌کنند؛ آن‌ها را روی همان فایل SQLiteای اجرا کنید که برنامه واقعاً استفاده می‌کند. از `--accept-data-loss` استفاده نکنید. پس از موفقیت، سرور Next.js را restart کنید.

طرح اسکیما PostgreSQL-ready است؛ برای مهاجرت: `provider = "postgresql"` در `prisma/schema.prisma` + `DATABASE_URL` جدید + `migrate deploy`. ستون‌های قیمت از نوع Float (محدوده دقیق تا ۹۰۰۰ تریلیون تومان) و هیچ جدولی حذف‌شدنی نیست.

## ۳) Build، انتشار و اجرای Production

در این Repository، GitHub Actions فقط TypeScript و Build را بررسی می‌کند؛ Workflow انتشار خودکار روی cPanel تعریف نشده است. بنابراین بعد از Merge باید نسخه جدید را روی هاست Deploy و برنامه Node.js را Restart کنید؛ مگر اینکه جداگانه Git Deployment یا Hook انتشار خودکار در cPanel راه‌اندازی کرده باشید.

### روش مستقیم روی cPanel (Git Version Control)

1. قبل از انتشار، از دیتابیس SQLite و پوشه `uploads/` نسخه پشتیبان بگیرید.
2. سورس شاخه `main` را در Application Root به Commit نهایی به‌روزرسانی کنید.
3. در فایل `.env` هاست مقدار زیر را تنظیم کنید:

```env
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://www.vilasento.ir
```

4. اگر `package-lock.json` تغییر کرده است، وابستگی‌ها را با `npm ci` نصب کنید.
5. فرمان `npm run build` را اجرا کنید. این فرمان Prisma Client و Next.js را Build می‌کند و خروجی standalone را در Application Root آماده می‌کند.
6. در cPanel → **Setup Node.js App** برنامه را Restart کنید و لاگ شروع سرور را بررسی کنید.

### روش Build محلی و آپلود

اگر Build را روی کامپیوتر انجام می‌دهید، پس از دریافت آخرین `main` و اجرای `npm ci`، مقدار `NEXT_PUBLIC_SITE_URL` را روی دامنه Production قرار دهید و `npm run build` را اجرا کنید. خروجی standalone و فایل‌های استاتیک را طبق ساختار Application Root هاست منتقل کنید.

فایل‌های پایدار هاست را با خروجی Build جایگزین نکنید: `.env`، دیتابیس `db/`، تصاویر آپلودشده `uploads/` و `tmp/` باید حفظ شوند. پوشه Application Root باید خارج از دسترسی مستقیم عمومی `public_html` باشد. فایل `.env` و دیتابیس را داخل مخزن Git یا فضای عمومی وب قرار ندهید.

```bash
npm run build
# سپس Node.js Application را از cPanel راه‌اندازی مجدد کنید.
```

اجرای Production از خروجی standalone و روی پورت تنظیم‌شده توسط cPanel انجام می‌شود.

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

پس از Restart، این مسیرها را در دامنه Production بررسی کنید:

- `GET /api/home` → باید 200 برگرداند و دسترسی API/دیتابیس را تأیید کند.
- `GET /robots.txt` → باید 200 و متن Robots تولیدشده توسط Next.js را برگرداند.
- `GET /sitemap.xml` → باید 200 و XML معتبر با ریشه `<urlset>` برگرداند.
- `GET /api/sitemap` → مسیر قدیمی است و باید با 308 به `/sitemap.xml` منتقل شود؛ منبع اصلی Sitemap نیست.
- لاگ سرور Node.js را در cPanel بررسی کنید.
- Audit Log ادمین (`/#/admin/audit`) عملیات حساس را ثبت می‌کند.

## ۷) چک‌لیست امنیتی Production

- [ ] `AUTH_SECRET` قوی (حداقل ۳۲ نویسه تصادفی) تنظیم شده (openssl rand -hex 32؛ بدون fallback در Production)
- [ ] `NEXT_PUBLIC_SITE_URL` روی دامنه واقعی
- [ ] HTTPS (کوکی نشست `secure` در production خودکار فعال است)
- [ ] رمز حساب‌های مدیر تغییر کرده (اولین ورود با رمز دمو ممنوع)
- [ ] `sms.demoMode=false` پس از اتصال درگاه پیامک واقعی
- [ ] بکاپ دوره‌ای `db/` و `uploads/`؛ دیتابیس و فایل‌های واقعی در مخزن عمومی commit نمی‌شوند
- [ ] محدودیت دسترسی فایل‌سیستم به دایرکتوری‌های `db/` و `uploads/`
- [ ] اجرای `bun run lint` و `bunx tsc --noEmit` در CI

## ۸) حساب مدیر اولیه

1. `bun run db:seed` → کاربر مدیر ارشد `09120000001` با رمز `123456`
2. **بلافاصله** وارد `/#/account/profile` شوید و رمز را عوض کنید
3. یا حساب دمو را حذف و از پنل ادمین → کاربران، نقش SUPER_ADMIN به حساب واقعی بدهید

## ۹) تنظیمات دامنه و SEO

- دامنه اصلی Canonical برابر `https://www.vilasento.ir` است؛ نسخه بدون www باید به نسخه www ریدایرکت شود.
- متغیر `NEXT_PUBLIC_SITE_URL` در محیط Production باید دقیقاً `https://www.vilasento.ir` باشد.
- فایل‌های `src/app/robots.ts` و `src/app/sitemap.ts` منبع تولید `/robots.txt` و `/sitemap.xml` هستند.
- فایل ثابت `public/robots.txt` یا `public/sitemap.xml` نسازید؛ ممکن است خروجی پویا را بپوشاند.
- دستور Robots به‌صورت خودکار این آدرس را معرفی می‌کند: `Sitemap: https://www.vilasento.ir/sitemap.xml`.
- پس از Deploy، `https://www.vilasento.ir/sitemap.xml` را در Google Search Console ثبت کنید و چند URL را با URL Inspection بررسی کنید.
- جزئیات انتخاب صفحات Indexable در `docs/seo.md` ثبت شده است.
