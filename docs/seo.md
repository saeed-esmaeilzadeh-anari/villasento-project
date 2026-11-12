# سئو و بهینه‌سازی ویلاسنتو

## پیاده‌سازی‌شده

| قابلیت | وضعیت | محل |
|---|---|---|
| عنوان اختصاصی هر صفحه | ✅ | `src/lib/seo.ts` (`useSeo` در همه Viewها) |
| Meta Description اختصاصی | ✅ | همان بالا؛ صفحه ملک: قیمت + موقعیت + متراژ |
| Sitemap پویا | ✅ | `GET /api/sitemap` — همه آگهی‌های منتشرشده + مقالات + صفحات |
| Sitemap استاتیک | ✅ | `bun scripts/sitemap.ts` → `public/sitemap.xml` (برای هاست بدون rewrite) |
| robots.txt | ✅ | `public/robots.txt` (مسیرهای admin/account/new-listing بلاک) |
| Canonical URL | ✅ | `useSeo` — هر روت + hash path |
| Open Graph + Twitter Card | ✅ | `useSeo` + metadata در `layout.tsx` |
| Structured Data | ✅ | `RealEstateListing` (صفحه ملک)، `Article` (مقاله)، `RealEstateAgent` (صفحه اصلی) |
| Alt تصاویر | ✅ | همه تصاویر `alt` دارند (`${title} — تصویر n`) |
| بهینه‌سازی تصاویر | ✅ | آپلود → sharp → WebP 82٪ حداکثر ۱۹۲۰px |
| noindex صفحات خصوصی | ✅ | پنل کاربری/مدیریت/فرم ثبت = noindex |
| فونت و RTL | ✅ | Vazirmatn، `dir=rtl` |

## محدودیت معماری (مستند و آگاهانه)

پروژه طبق معماری موجود یک **SPA با هش‌روتر** است (`#/property/ID`). URLهای هش برای ایندکس کامل گوگل ایده‌آل نیستند؛ اما:
1. هر آگهی **URL اختصاصی و قابل اشتراک** دارد (`…/#/property/ID` یا با کد).
2. متادیتای هر صفحه (title/description/OG/JSON-LD) به‌صورت پویا تزریق می‌شود.
3. **نقشه راه ارتقا برای Production:** ایجاد Routeهای واقعی Next.js (مثلاً `app/property/[id]/page.tsx` با `generateMetadata`) و انتقال تدریجی لینک‌های عمومی از `navigate()` به `Link` واقعی. ساختار سرویس‌لایر (فایل‌های `src/server/services/*`) عمداً مستقل از UI است تا این مهاجرت بدون تغییر بک‌اند ممکن باشد.
4. `NEXT_PUBLIC_SITE_URL` باید در Production تنظیم شود تا canonical/sitemap/OG آدرس مطلق درست بسازند.

## Core Web Vitals — اقدامات انجام‌شده
- تصاویر `loading="lazy"` + فرمت WebP
- یک endpoint تجمیعی برای صفحه اصلی (`/api/home`) به‌جای چند درخواست
- `keepPreviousData` در جستجو (بدون پرش layout در صفحه‌بندی)
- شمارنده بازدید آپلود async و دیباژشده (dedup روزانه per کاربر/IP در `/api/track`)
- کد-اسپلیت خودکار Next.js؛ Chart ها فقط در پنل ادمین لود می‌شوند
