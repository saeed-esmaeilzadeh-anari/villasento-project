# گزارش نهایی پروژه ویلاسنتو (VillaSento)

تاریخ گزارش: ۱۴۰۵/۰۸/۲۰ (2026-11-11) — نسخه ۱.۰

این گزارش، جمع‌بندی ۱۲ مرحلهٔ تعریف‌شده در دستور کار تبدیل سورس قبلی (پلتفرم اجاره روزانه) به **ویلاسنتو — پلتفرم تخصصی خرید، فروش، رهن و اجارهٔ باغ، ویلا و باغ‌ویلا** است. هر بخش با یکی از وضعیت‌های زیر مشخص شده است:

- **COMPLETED** — پیاده‌سازی‌شده و با آزمون/بازبینی واقعی تأیید شده
- **IMPLEMENTED_NOT_VERIFIED** — پیاده‌سازی‌شده اما تأیید انسانی مستقل نیازمند محیط production (دامنه/کلید واقعی)
- **BLOCKED** — وابسته به اطلاعات/کلید بیرونی که در سندیشن مشخص شده
- **NOT_IMPLEMENTED** — در دامنهٔ فعلی ساخته نشده (با دلیل)

---

## ۱) جمع‌بندی وضعیت مراحل

| # | مرحله | وضعیت |
|---|---|---|
| 1 | تحلیل سورس موجود | **COMPLETED** |
| 2 | فرانت عمومی (خانه) | **COMPLETED** |
| 3 | صفحه جستجو با فیلتر سمت سرور | **COMPLETED** |
| 4 | صفحه جزئیات ملک | **COMPLETED** |
| 5 | فرم ۶ مرحله‌ای ثبت آگهی | **COMPLETED** |
| 6 | سیستم کاربری و نقش‌ها | **COMPLETED** |
| 7 | پنل مدیریت | **COMPLETED** |
| 8 | اتصال کامل فرانت به بک‌اند | **COMPLETED** |
| 9 | دیتابیس و موجودیت‌ها | **COMPLETED** |
| 10 | امکانات پیشرفته | **COMPLETED** (با دو استثنا — بند ۹) |
| 11 | امنیت | **COMPLETED** |
| 12 | سئو | **COMPLETED** (با محدودیت معماری مستند — بند ۱۰) |
| 13 | تست (build + API + دسترسی) | **COMPLETED** |
| 14 | آماده‌سازی production | **COMPLETED** |
| 15 | گزارش نهایی | **COMPLETED** (همین سند) |

**نتیجه آزمون‌ها:** ۵۵/۵۵ تست API موفق روی بیلد production · `next build` بدون خطا · `tsc --noEmit` صفر خطا در `src/` و `scripts/` · بازبینی بصری صفحات کلیدی با مرورگر headless انجام شد.

---

## ۲) چه چیزهایی از قبل موجود بود و چه چیزهایی از صفر ساخته شد

### از سورس قبلی حفظ شد (بدون بازنویسی کل پروژه)
- معماری کلی: Next.js App Router + SPA هش‌روتر + Tailwind 4 + shadcn/ui + TanStack Query + Zustand + Prisma
- لایهٔ Controller نازک (`handler` + `ApiError` + Zod) و الگوی Service
- جداول legacy اجارهٔ روزانه (`Booking`, `Payment`, `Coupon`, `Review`, …) — **دست‌نخورده**، API آن‌ها هنوز کار می‌کند
- آپلود تصویر (sharp → WebP) و سرو `/api/files`
- بخشی از کامپوننت‌های عمومی (Header/Footer/PropertyCard/MapView/AuthDialog)

### از صفر پیاده‌سازی شد
- **مدل دامنه:** `transactionType` (فروش/رهن کامل/رهن و اجاره/اجاره)، سند، متراژ زمین/بنا، سن بنا، طبقات، قیمت‌های Float، کد یکتای آگهی `VS-XXXXXX`، ماشین وضعیت ۷ حالته
- **سرویس‌ها:** `properties.ts` (جستجوی ۲۰+ پارامتری، ماشین وضعیت، تمدید، گزارش، بازدید dedup)، `visits.ts`، `contact.ts`، `content.ts` (مقالات/بنر/FAQ/CMS)، `stats.ts` (داشبورد)، `users.ts` (کاربران/مشاوران/خروجی CSV)، `admin.ts` (مدیریت وضعیت/ویژه/تنظیمات/لاگ)، `password.ts` (scrypt)
- **اعتبارسنجی رمز عبور** و لاگین با رمز + OTP (هر دو مسیر واقعی)
- **دیتابیس:** `Area`, `PropertyView`, `VisitRequest(+Event)`, `ContactMessage`, `AgentProfile`, `Article(+Category)`, `Banner`, `Faq` + ستون‌های جدید Property (۱۸ ستون) + ایندکس‌ها
- **پنل مدیریت کامل** با ۷ بخش و داشبورد نموداری
- **فرم ۶ مرحله‌ای** با فیلدهای مالی پویا، آپلود چندتصویری با پیشرفت، نقشهٔ انتخاب موقعیت
- **Seed واقع‌گرایانه:** ۱۰ کاربر (۵ نقش)، ۷ استان، ۱۴ آگهی در وضعیت‌های مختلف، ۳۰ روز دادهٔ بازدید، مقالات/بنر/FAQ/CMS/تنظیمات

---

## ۳) APIهای متصل‌شده (هیچ دکمه/فرمی فقط ظاهری نیست)

| گروه | Endpoint‌ها | متصل به UI |
|---|---|---|
| احراز هویت | `/api/auth/request-otp`, `verify`, `password-login`, `set-password`, `change-password`, `reset-password`, `profile`, `me`, `logout` | AuthDialog، پروفایل، بازیابی رمز |
| املاک | `/api/properties` (GET جستجو + POST ثبت) · `/api/properties/[id]` (GET/PATCH/DELETE) · `submit` · `extend` · `visit` · `report` | جستجو، خانه، جزئیات، فرم ۶ مرحله‌ای، پنل کاربری |
| تعاملات | `/api/favorites` · `/api/messages` · `/api/notifications` · `/api/visits` (mine/incoming + PATCH) · `/api/contact` · `/api/complaints` · `/api/track` · `/api/me/activity` · `/api/me/listings` | کارت‌ها، جزئیات، پنل کاربری، تماس |
| عمومی | `/api/home` · `/api/lookups` · `/api/agents` · `/api/articles(+[slug])` · `/api/banners` · `/api/faqs` · `/api/cms/[slug]` · `/api/sitemap` · `/api/robots.txt` | خانه، مقالات، صفحات ثابت، سئو |
| فایل | `/api/upload` (نیازمند ورود، MIME با sharp، ≤۵MB) · `/api/files/[...path]` | فرم ثبت، آواتار |
| مدیریت | `/api/admin/overview` · `charts` · `recents` · `properties` · `users` · `user` · `agents` · `visits` · `messages` · `complaints` · `articles` · `banners` · `faqs` · `cms` · `settings` · `audit` · `export?entity=…` + ۱۸ action در POST | تمام بخش‌های پنل مدیریت |

---

## ۴) تغییرات دیتابیس

- **۳۵ جدول** (SQLite → PostgreSQL-ready). هیچ جدولی حذف نشد.
- `Property`: ۱۸ ستون جدید دامنه املاک + `code` یکتا + `status` ماشین وضعیت + `agentId` + قیمت‌های **Float** (رفع محدودیت ~۲.۱ میلیارد تومان در Int)
- مدل‌های جدید: `Area`, `PropertyView` (با ایندکس `propertyId+day`), `VisitRequest`, `VisitRequestEvent`, `ContactMessage`, `AgentProfile`, `Article`, `ArticleCategory`, `Banner`, `Faq`
- `User`: `passwordHash` (scrypt) + `lastLoginAt` + روابط agent/visit/article
- ایندکس‌های جستجو روی `(status, cityId)`, `(transactionType, status)`, `(isFeatured, status)` و…
- جزئیات کامل: `docs/database.md`

## ۵) پنل مدیریت — بخش‌های تکمیل‌شده

1. **داشبورد:** ۱۲+ KPI واقعی، نمودار خطی ۳۰ روزه (بازدید/آگهی/کاربر)، نمودار دونات وضعیت، توزیع نوع ملک/معامله، پربازدیدترین‌ها، آخرین رویدادها — همه از `/api/admin/charts` (SQL تجمعی واقعی)
2. **مدیریت آگهی‌ها:** فیلتر وضعیت/معامله/جستجو، اکشن‌های ماشین وضعیت (تأیید و انتشار / تأیید بدون انتشار / رد با الزام دلیل / لغو انتشار / آرشیو)، ویژه‌سازی، تخصیص مشاور، حذف
3. **کاربران:** جستجو/فیلتر نقش، جزئیات با تاریخچه فعالیت، بلاک/آزادسازی، تغییر نقش (تغییر نقش مدیریتی فقط SUPER_ADMIN)، خروجی CSV
4. **مشاوران:** لیست با عملکرد (تخصیص/منتشرشده/بازدید/درخواست)، افزودن/ویرایش، فعال/غیرفعال، تخصیص آگهی
5. **درخواست‌ها و پیام‌ها:** بازدیدها (تغییر وضعیت، تخصیص مشاور، یادداشت، تاریخچه رویداد)، پیام‌های تماس، گزارش‌های آگهی
6. **مدیریت محتوا:** مقالات + دسته‌بندی، بنر (۴ جایگاه)، FAQ، صفحات ثابت — CRUD کامل
7. **تنظیمات:** هویت برند، سئو، منو، شبکه‌های اجتماعی، اعتبار آگهی، آپلود، پیامک، نقشه + **لاگ فعالیت‌ها**

## ۶) خطاهای برطرف‌شده در این مرحله

1. **`/api/upload` وجود نداشت** (فقط سرویسش بود) → Route ساخته شد؛ تست آپلود معتبر/نامعتبر سبز شد
2. **robots.txt استاتیک با Sitemap نسبی** (ناقض پروتکل) → `/robots.txt` پویا با URL مطلق از Host/`NEXT_PUBLIC_SITE_URL`
3. **sitemap با آدرس `0.0.0.0`** پشت پروکسی → اولویت `x-forwarded-proto/host` سپس env سپس origin
4. **دیالوگ ورود هنگام redirect از مسیر محافظت‌شده باز نمی‌شد** (effect فقط روی mount) → وابستگی به `route.params`
5. **مرجع `/host` منسوخ** در page.tsx → حذف
6. (مراحل قبل) Int overflow قیمت‌ها → Float؛ backfill کد آگهی؛ تایپ‌های seed؛ import مسیرها

## ۷) مهم‌ترین فایل‌ها

| مسیر | نقش |
|---|---|
| `prisma/schema.prisma` | مدل کامل دامنه (۳۵ جدول) |
| `scripts/seed.ts` | دادهٔ دمو واقع‌گرایانه |
| `scripts/api-test.sh` | ۵۵ تست چرخهٔ عمر API |
| `src/server/services/properties.ts` | جستجو + ماشین وضعیت + تمدید/گزارش/بازدید |
| `src/server/services/{users,stats,content,visits,contact,admin}.ts` | لایهٔ سرویس پنل مدیریت |
| `src/server/{session,upload,rateLimit,sms,password}.ts` | زیرساخت امنیت/فایل/پیامک |
| `src/app/api/**` | ۳۵+ Route Handler نازک با Zod |
| `src/views/{HomeView,SearchView,PropertyView,ListingForm,AccountView,AdminView,…}.tsx` | صفحات SPA |
| `src/views/admin/*.tsx` | ۷ بخش پنل مدیریت |
| `src/lib/{api,router,store,seo,fa}.ts` | کلاینت API تایپ‌دار، روتر هش، state، سئو |
| `docs/{api,database,architecture,deploy,seo}.md` + `.env.example` | مستندات و استقرار |

## ۸) نتیجه تست

| آزمون | نتیجه |
|---|---|
| `next build` (production) | **COMPLETED** — موفق، standalone آماده |
| `tsc --noEmit` (src + scripts) | **COMPLETED** — صفر خطا |
| تست API چرخهٔ عمر (۵۵ مورد: ورود رمز/OTP، CRUD آگهی، ماشین وضعیت، دسترسی ۴۰۱/۴۰۳، بازدید، علاقه‌مندی، پیام، تماس، گزارش، آپلود معتبر/نامعتبر، CSV، sitemap، rate-limit، تمدید) | **COMPLETED** — ۵۵/۵۵ روی بیلد production |
| نقش‌ها و دسترسی (کاربر عادی → ۴۰۳ پنل؛ بدون ورود → ۴۰۱؛ CUSTOMER→OWNER خودکار) | **COMPLETED** |
| جریان کامل UI با مرورگر واقعی (خانه → جستجو+فیلتر → جزئیات → ورود → فرم ۶ مرحله‌ای + آپلود تصویر → ثبت → پنل کاربری → پنل مدیریت) | **COMPLETED** — همهٔ داده‌ها از API واقعی |
| موبایل (layout ریسپانسیو Tailwind، منوی Sheet) | **IMPLEMENTED_NOT_VERIFIED** (ساختار ریسپانسیو پیاده شده؛ تست دستگاه فیزیکی با کاربر) |

## ۹) امکانات پیشرفته — وضعیت دقیق

| قابلیت | وضعیت |
|---|---|
| جستجوی نقشه‌ای (bbox + پین‌ها) | **COMPLETED** (API + UI نقشه در جستجو) |
| ویژه (Featured) | **COMPLETED** |
| علاقه‌مندی / مقایسه / تاریخچه بازدید | **COMPLETED** |
| گزارش آگهی نامعتبر / اعلان‌ها / تمدید | **COMPLETED** |
| گزارش عملکرد مشاوران | **COMPLETED** |
| خروجی Excel/CSV (BOM+CRLF) | **COMPLETED** |
| **درگاه پرداخت** | **NOT_IMPLEMENTED** — در دامنهٔ فعلی کاربرد عملیاتی ندارد (فعالیت ویژه رایگان است)؛ نقطهٔ اتصال Adapter در `payments.ts` آماده است |
| **SMS واقعی** | **BLOCKED** — نیازمند کلید Kavenegar/SMS.ir؛ در حالت نمایشی کد در پاسخ API برمی‌گردد و UI صریحاً «حالت نمایشی» نشان می‌دهد؛ **هیچ موفقیت ساختگی نمایش داده نمی‌شود** (`docs/deploy.md` بند ۵) |
| **ایمیل** | **BLOCKED** — همین وضعیت؛ نقطهٔ اتصال Notification |
| PWA (manifest + آفلاین کامل) | **IMPLEMENTED_NOT_VERIFIED** (manifest موجود؛ service worker آفلاین در دامنهٔ نسخهٔ بعد) |

## ۱۰) سئو — وضعیت دقیق

**COMPLETED:** title/description اختصاصی هر صفحه، canonical، OG/Twitter، JSON-LD (`RealEstateListing`/`Article`/`RealEstateAgent`)، alt تصاویر، sitemap پویا + استاتیک، robots پویا با Sitemap مطلق، noindex پنل‌ها، WebP+lazy، یک endpoint تجمیعی خانه.

**محدودیت مستند و آگاهانه:** معماری SPA هش‌روتر (`#/property/ID`) برای ایندکس کامل گوگل ایده‌آل نیست. هر آگهی URL اختصاصی/قابل اشتراک دارد و متادیتای داینامیک تزریق می‌شود؛ نقشهٔ راه مهاجرت به SSR (بدون تغییر بک‌اند) در `docs/seo.md` نوشته شده است.

## ۱۱) پیکربندی هاست (خلاصه — شرح کامل در `docs/deploy.md`)

1. **متغیرها:** `DATABASE_URL`, `AUTH_SECRET` (اجباری در production — `openssl rand -hex 32`), `NEXT_PUBLIC_SITE_URL`
2. **دیتابیس:** `bun run db:generate && npx prisma db push` (یا `migrate deploy`) + `bun run db:seed` فقط برای دمو
3. **اجرا:** `bun run build` → `bun run start` (پورت ۳۰۰۰، standalone)
4. **پروکسی:** Caddy/Nginx → 3000؛ HTTPS فعال (کوکی `secure` خودکار)
5. **فایل‌ها:** دایرکتوری `uploads/` روی Volume مشترک/S3 در استقرار چندسروره
6. **پایش:** `GET /api/home` و `GET /api/sitemap` به‌عنوان health-check؛ لاگ در `server.log`
7. **چک‌لیست امنیتی production:** بند ۷ `docs/deploy.md` (تغییر رمز مدیر دمو، بستن `db/` و `uploads/`، بکاپ دوره‌ای)

## ۱۲) حساب‌های دمو (پس از seed)

| نقش | موبایل | رمز |
|---|---|---|
| مدیر ارشد | `09120000001` | `123456` |
| مدیر | `09120000006` | `123456` |
| مشاور | `09120000002` | `123456` |
| مالک | `09120000005` | `123456` |
| کاربر | `09123456789` | `123456` (یا OTP نمایشی) |

> در production این حساب‌ها را حذف/تغییر رمز کنید (بند ۸ `docs/deploy.md`).
