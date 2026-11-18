# راهنمای متغیرهای محیطی (Environment Variables) — ویلاسنتو

این سند مرجع کامل متغیرهای محیطی هر دو بخش پروژه است:

| بخش | مسیر | فایل محیطی |
|---|---|---|
| فرانت‌اند (Next.js) | ریشه پروژه | `.env.local` (توسعه) — الگو: `.env.example` |
| بک‌اند (NestJS) | `mini-services/vilasa-backend` | `.env` — الگو: `.env.example` |

> **قانون طلایی:** فایل‌های واقعی `.env*` هرگز commit نمی‌شوند (`.gitignore` شامل الگوی `.env*` است). فقط `.env.example` در مخزن نگه داشته می‌شود.

---

## ۱) متغیرهای فرانت‌اند (Next.js — ریشه پروژه)

| متغیر | ضروری؟ | مقدار پیش‌فرض کد | توضیح |
|---|---|---|---|
| `DATABASE_URL` | ✅ بله | — | رشته اتصال Prisma. در توسعه SQLite مشترک با بک‌اند؛ در production می‌تواند PostgreSQL باشد |
| `AUTH_SECRET` | ✅ بله (در Production) | `vilasa-dev-secret-do-not-use-in-prod` | کلید امضای کوکی نشست (HMAC-SHA256). **باید دقیقاً با بک‌اند یکسان باشد** |
| `SESSION_COOKIE_NAME` | اختیاری | `villasento_session` | نام کوکی نشست. **باید با بک‌اند یکسان باشد** (SSO) |
| `NEXT_PUBLIC_SITE_URL` | اختیاری | `origin` همین درخواست | آدرس عمومی سایت برای `sitemap.xml` و canonical و تگ‌های OG؛ بدون اسلش انتها |
| `NEST_URL` | اختیاری | `http://localhost:3002` | آدرس بک‌اند NestJS؛ فقط توسط `scripts/test-nest.mjs` استفاده می‌شود |
| `NODE_ENV` | ❌ نیاز نیست | توسط Next.js تعیین می‌شود | Next.js بر اساس دستور اجرا (`next dev` / `next build`) خودش تعیین می‌کند؛ در فایل env ننویسید |

### نکته مهم درباره `NEXT_PUBLIC_*`
متغیرهایی که با `NEXT_PUBLIC_` شروع می‌شوند در زمان **build** داخل باندل جای‌گذاری می‌شوند؛ پس از تغییر آن‌ها باید پروژه را دوباره build کنید تا تغییر اعمال شود.

---

## ۲) متغیرهای بک‌اند (NestJS — `mini-services/vilasa-backend`)

| متغیر | ضروری؟ | مقدار پیش‌فرض کد | توضیح |
|---|---|---|---|
| `PORT` | اختیاری | `3002` | پورت اجرای API بک‌اند (`http://localhost:3002/api`، Swagger: `/docs`) |
| `NODE_ENV` | توصیه‌شده | — | در Production حتماً `production` بگذارید تا کوکی نشست با پرچم `secure` صادر شود |
| `DATABASE_URL` | ✅ بله | — | **باید همان فایل/دیتابیسی باشد که فرانت‌اند استفاده می‌کند** (دیتابیس مشترک) |
| `AUTH_SECRET` | ✅ بله (در Production) | `vilasa-dev-secret-do-not-use-in-prod` | همان کلید فرانت‌اند — **دقیقاً یکسان** |
| `SESSION_COOKIE_NAME` | اختیاری | `villasento_session` | همان نام کوکی فرانت‌اند — **دقیقاً یکسان** |
| `CORS_ORIGIN` | توصیه‌شده (Production) | بازتاب هر مبدأ | لیست مبداهای مجاز با کاما، مثلاً `https://villasento.example,https://www.villasento.example` |

---

## ۳) قواعد جفت‌شدن فرانت‌اند و بک‌اند (SSO)

هر دو سرور یک نشست مشترک (کوکی امضاشده HMAC-SHA256) دارند؛ برای اینکه ورود در یکی، دیگری را هم معتبر کند:

1. `AUTH_SECRET` در هر دو فایل باید **بایت‌به‌بایت یکسان** باشد.
2. `SESSION_COOKIE_NAME` در هر دو فایل باید **یکسان** باشد (پیش‌فرض هر دو: `villasento_session`).
3. `DATABASE_URL` در هر دو باید به **یک دیتابیس** اشاره کند (در توسعه: یک فایل `db/custom.db`).

اگر هر کدام یکسان نباشد، کاربر در یک سرور لاگین می‌شود اما سرور دیگر او را ناشناس می‌بیند.

---

## ۴) تولید `AUTH_SECRET` امن

**لینوکس / macOS / Git Bash (روی ویندوز):**
```bash
openssl rand -hex 32
```

**Windows PowerShell (بدون نصب چیزی):**
```powershell
-join ((48..57)+(97..122)+(65..90) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

خروجی را در **هر دو** فایل (فرانت‌اند و بک‌اند) عیناً کپی کنید.

---

## ۵) فرمت‌های `DATABASE_URL`

| محیط | مقدار نمونه |
|---|---|
| ویندوز (مسیر مطلق — فعلی) | `file:///H:/Data_Drive_D_1404_10_16/Project_Web/villasento-project/db/custom.db` |
| لینوکس (Production) | `file:/var/www/villasento/db/custom.db` |
| قابل‌حمل — فرانت‌اند | `file:../db/custom.db` (نسبت به پوشه `prisma/` فرانت‌اند) |
| قابل‌حمل — بک‌اند | `file:../../../db/custom.db` (نسبت به پوشه `prisma/` بک‌اند) |
| PostgreSQL | `postgresql://user:password@host:5432/villasento` |

نکته: مسیرهای **نسبی** SQLite نسبت به محل فایل `prisma/schema.prisma` حل می‌شوند؛ به همین دلیل تعداد `../` در فرانت‌اند و بک‌اند متفاوت است.

**مهاجرت به PostgreSQL:** در هر دو `prisma/schema.prisma` مقدار `provider = "postgresql"` را بگذارید، `DATABASE_URL` جدید بدهید و سپس:
```bash
npx prisma generate && npx prisma migrate deploy
```
طرح اسکیما از ابتدا PostgreSQL-ready نوشته شده و هیچ کد تغییری لازم نیست.

---

## ۶) متغیرهای رزروشده (فعلاً در کد استفاده نمی‌شوند)

این متغیرها برای یکپارچه‌سازی‌های آینده در فایل‌ها به‌صورت کامنت نگه داشته شده‌اند؛ **فعلاً هیچ سرویس واقعی پشت آن‌ها نیست** و پیامک/پرداخت در حالت Demo/Mock کار می‌کنند (کد OTP در لاگ نمایش داده می‌شود و درگاه پرداخت Mock است):

| گروه | متغیرها | وضعیت فعلی |
|---|---|---|
| پیامک | `SMS_PROVIDER` · `SMS_API_KEY` · `SMS_OTP_SENDER` | Demo — اتصال Kavenegar/SMS.ir در `src/server/sms.ts` و `src/common/services/sms.service.ts` (بک‌اند) در آینده |
| پرداخت | `PAYMENT_GATEWAY` · `PAYMENT_MERCHANT_ID` · `PAYMENT_CALLBACK_URL` | Mock — اتصال Zarinpal/Zibal از طریق Adapter موجود در سرویس payments |
| نقشه | `MAP_API_KEY` | رزروشده |

> طبق سیاست پروژه، تا وقتی کلید واقعی تنظیم نشده، هیچ پیام موفقیت جعلی به کاربر نمایش داده نمی‌شود.

---

## ۷) چک‌لیست Production

- [ ] `AUTH_SECRET` قوی و یکسان در هر دو فایل (بند ۴)
- [ ] `SESSION_COOKIE_NAME` یکسان در هر دو فایل
- [ ] `NODE_ENV=production` در بک‌اند (کوکی secure)
- [ ] `NEXT_PUBLIC_SITE_URL` برابر دامنه واقعی (بدون اسلش انتها) + rebuild فرانت‌اند
- [ ] `CORS_ORIGIN` در بک‌اند محدود به دامنه(های) واقعی
- [ ] `DATABASE_URL` production (SQLite مسیر مطلق لینوکس یا PostgreSQL)
- [ ] متغیرهای رزروشده فقط در صورت اتصال سرویس واقعی فعال شوند
- [ ] فایل‌های `.env*` واقعی در مخزن commit نشده باشند
