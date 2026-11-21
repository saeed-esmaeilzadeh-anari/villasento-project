# SEO و ایندکس‌پذیری ویلاسنتو

## معماری واقعی پروژه
- برنامه از Next.js App Router و React 19 استفاده می‌کند.
- Routeهای عمومی سروری شامل صفحه اصلی، /l/[slug]، /property/[id]، /article/[slug]، /city/[slug]، /region/[slug] و /page/[slug] هستند.
- بخشی از جستجو و پنل‌های کاربری/مدیریت در SPA مبتنی بر hash باقی مانده‌اند. Fragmentهایی مانند /#/search و /#/admin مسیر HTTP مجزا نیستند و نباید در Sitemap یا robots به‌عنوان مسیر مستقل ثبت شوند.
- کارت‌های آگهی اکنون به URL تمیز /property/{slug-or-id} لینک می‌دهند. لینک‌های قدیمی hash برای آگهی، مقاله و صفحه CMS به Route متناظر تمیز منتقل می‌شوند.

## Sitemap و robots
- src/app/sitemap.ts منبع پویا و اصلی /sitemap.xml است. فایل استاتیک تکراری در public نباید ایجاد شود.
- src/app/robots.ts خروجی /robots.txt را تولید می‌کند و Sitemap مطلق https://www.vilasento.ir/sitemap.xml را معرفی می‌کند.
- مسیر قدیمی /api/sitemap با HTTP 308 به /sitemap.xml هدایت می‌شود.
- Sitemap فقط URLهای canonical عمومی را فهرست می‌کند: آگهی‌های منتشرشده و منقضی‌نشده، مقاله/صفحه با متن کافی، و شهر/منطقه/لندینگ دارای موجودی واقعی. نامک‌های لاتین و فارسی، از جمله نیم‌فاصله فارسی، پشتیبانی می‌شوند و هنگام تولید XML به URL-encoded تبدیل می‌شوند.
- آستانه‌های محافظه‌کارانه: حداقل ۳ آگهی فعال برای لندینگ، شهر و منطقه؛ حداقل ۳۰۰ نویسه متن برای مقاله؛ ۱۲۰ نویسه برای صفحه CMS؛ توضیح حداقل ۸۰ نویسه برای منطقه تأییدشده.
- lastmod فقط از updatedAt واقعی رکوردها تولید می‌شود؛ برای صفحه اصلی، شهرها و لندینگ ثابت تاریخ ساختگی درج نمی‌شود.

## Canonical و metadata
- NEXT_PUBLIC_SITE_URL در Production و CI روی https://www.vilasento.ir تنظیم می‌شود.
- تابع مرکزی siteUrl() URL مطلق می‌سازد و در Production مقدار localhost را به دامنه اصلی تبدیل می‌کند.
- Root metadata شامل metadataBase، canonical، Open Graph، Twitter Card، نویسنده و ناشر است.
- JSON-LD با serializer امن تولید می‌شود تا محتوای دیتابیس نتواند تگ script را ببندد.
- SearchAction اضافه نشده است؛ جستجوی فعلی در hash SPA است و هنوز URL تمیز و query-addressable ندارد.

## سیاست Indexability
| نوع صفحه | سیاست |
|---|---|
| صفحه اصلی | Index |
| صفحات لندینگ | Index فقط با حداقل ۳ آگهی فعال منطبق |
| شهر | Index فقط با حداقل ۳ آگهی فعال |
| منطقه | Index فقط اگر فعال، VERIFIED، توضیح معنادار و حداقل ۳ آگهی در خود/زیرمجموعه‌ها داشته باشد |
| آگهی | Index فقط در وضعیت PUBLISHED و قبل از expiresAt |
| مقاله | Index فقط با متن معنادار (حداقل ۳۰۰ نویسه) |
| CMS | Index فقط با متن معنادار (حداقل ۱۲۰ نویسه) |
| جستجو و فیلترهای SPA | در Sitemap قرار نمی‌گیرند |
| پنل‌ها و ثبت آگهی | Fragmentها قابل مسدودسازی با robots نیستند؛ کنترل دسترسی سمت سرور و noindex کلاینتی باید حفظ شود |

## عملیات
- bun run sitemap فقط Sitemap پویا را از نظر URL تکراری، دامنه، Fragment، Query و مسیرهای undefined/null بررسی می‌کند و فایل استاتیک در public نمی‌سازد. برای اجرای محلی می‌توان `NEXT_PUBLIC_SITE_URL=http://localhost:3000` و برای Production مقدار دامنه اصلی را تنظیم کرد.
- پس از Deploy، در Search Console آدرس https://www.vilasento.ir/sitemap.xml را ثبت و چند URL نمونه را با URL Inspection بررسی کنید.
- اصلاحات فنی تضمین‌کننده Index فوری یا رتبه مشخص نیست؛ تصمیم نهایی Crawl، Index و Ranking با Google است.
