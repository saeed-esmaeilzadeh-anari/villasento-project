# یادداشت‌های ارتقا — نسخه حرفه‌ای VillaSento

> تاریخ: ۱۴۰۵/۰۹/۰۱ (2026-11-20) — این سند خلاصه تغییرات این نسخه و مراحل راه‌اندازی است.

## ۱) تصویر و گالری

- کامپوننت جدید `src/components/site/SmartImage.tsx` — استاندارد واحد نمایش تصویر:
  - Skeleton هنگام لود، Fade-in پس از بارگذاری، Fallback اختصاصی برای تصویر خراب/ناموجود
  - جلوگیری از Layout Shift (باکس نسبت ثابت + `object-cover`)
- بازنویسی کامل گالری (`ImageGallery` در `misc.tsx`):
  - تصویر اصلی بزرگ + نوار Thumbnail + دکمه‌های بعدی/قبلی + شمارنده
  - Lightbox جدید: کنترل با کیبورد (فلش‌ها/Esc)، تمام‌صفحه (Fullscreen API)، Zoom، Swipe موبایل، انیمیشن Framer Motion
  - Loading Skeleton و Error Fallback برای تک‌تک تصاویر
- کارت آگهی (`PropertyCard.tsx`): دکمه علاقه‌مندی و اشتراک‌گذاری روی کارت، شمارنده تصاویر، تصویر با fallback امن، CTA هاور

## ۲) ویرایش آگهی

- فرم ویرایش (از قبل موجود) حفظ شد؛ افزودن: **تأییدیه حذف تصویر** (AlertDialog) قبل از حذف
- Authorization سمت سرور (`assertOwnership`: مالک / مشاورِ assigned / مدیر) بدون تغییر

## ۳) SEO

- **URLهای تمیز SSR**: `/property/{slug}` (نمونه: `/property/villa-tehran-lavasan-300m-vs3i82je`)، `/article/{slug}`، `/page/{slug}`، `/city/{slug}` (نمونه: `/city/tehran`)، صفحات لندینگ `/l/{slug}` (خرید ویلا، فروش ویلا، رهن و اجاره ویلا، رهن ویلا، خرید باغ، خرید خانه، اجاره خانه، خرید زمین، ویلا شمال)
- فیلد `Property.slug` اضافه شد (additive؛ برای آگهی‌های قدیمی در اولین بازدید به‌صورت خودکار ساخته می‌شود)
- `generateMetadata` برای همه صفحات SSR: Title داینامیک («خرید ویلای ۴۰۰ متری در نمک‌آبرود چالوس | ویلاسنتو»)، Description واقعی از داده آگهی، Canonical، OG/Twitter، robots
- JSON-LD سمت سرور: `RealEstateAgent` + `WebSite` (لایه‌وت)، `RealEstateListing` + `BreadcrumbList` (آگهی)، `Article` (مقاله)، `FAQPage` (خانه و لندینگ‌ها)
- `app/robots.txt` + `app/sitemap.xml` داینامیک با URLهای تمیز (حذف نسخه‌های قدیمی hash-دار)
- `not-found.tsx` و `error.tsx` اختصاصی
- صفحه جستجو `noindex` (لندینگ‌ها و شهرها نقش ایندکس را دارند) — بدون Doorway/Keyword Stuffing؛ همه لندینگ‌ها آگهی واقعی از دیتابیس نمایش می‌دهند

## ۴) تنظیمات (پنل مدیریت → تنظیمات سامانه)

گروه‌های جدید: عمومی/برند، سئو (Google Verification، OG Image، Keywords…)، تماس و شبکه‌های اجتماعی، آگهی‌ها (تأیید پیش از انتشار، نمایش شماره تماس، تعداد در صفحه…)، اعلان‌ها، امنیت (طول عمر نشست، حداقل طول رمز)، آپلود، حالت نمایشی

## ۵) حساب‌های آزمایشی و OTP

- **کد OTP دیگر هرگز به UI ارسال/نمایش داده نمی‌شود** (فقط در لاگ سرور در حالت demo پیامک ثبت می‌شود)
- راهنمای حساب‌های دمو فقط با `DEMO_MODE=true` (یا در non-production) نمایش داده می‌شود
- ورود همه حساب‌های دمو با رمز `123456` (تب «ورود»)
  - مدیر: 09120000001 — مشاور: 09120000002 — مالک: 09120000005 — کاربر: 09123456789

## ۶) شماره رسمی پشتیبانی

- `09356966365` به‌عنوان تلفن رسمی در تنظیمات (`site.supportPhone`)، هدر (click-to-call)، فوتر و CTA صفحه اصلی قرار گرفت.

## ۷) امنیت و عملکرد

- هدرهای امنیتی (`nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) در `next.config.ts`
- طول عمر نشست و حداقل طول رمز از تنظیمات خوانده می‌شود
- Cache یک‌ساله `immutable` برای فایل‌های آپلودی؛ `revalidate` صفحات لندینگ/شهر/مقاله (۵ دقیقه) و sitemap (۱ ساعت)
- رفع باگ `scripts/copy-standalone.mjs` (خطای `dbDir is not defined` که build را در انتها می‌شکست)

## ۸) راه‌اندازی این نسخه

```bash
npm install        # یا bun install
npm run db:push    # اضافه‌شدن ستون slug (بدون از دست رفتن داده)
npm run dev        # توسعه — یا:
npm run build && npm run start   # production
```

> در Production حتماً `NEXT_PUBLIC_SITE_URL` را در `.env.local` ست کنید تا sitemap و canonical آدرس مطلق بگیرند، و `DEMO_MODE=false` بگذارید.
