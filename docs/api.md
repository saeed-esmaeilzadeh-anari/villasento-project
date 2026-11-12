# API ویلاسنتو

همه endpoint ها JSON هستند، خطا با ساختار `{ "error": "پیام فارسی" }` و کد HTTP مناسب (400/401/403/404/429/500) برمی‌گردد. احراز هویت با کوکی امضاشده `villasento_session` (httpOnly). اعتبارسنجی همه ورودی‌ها با Zod سمت سرور.

## احراز هویت — `/api/auth/[action]`
| Action | متد | توضیح |
|---|---|---|
| `request-otp` | POST | ارسال کد (نمایشی: `demoCode`) — rate limit |
| `verify` | POST | ورود/ثبت‌نام با OTP |
| `password-login` | POST | ورود با موبایل + رمز |
| `set-password` | POST | تنظیم رمز اولیه (لاگین لازم) |
| `change-password` | POST | تغییر رمز (رمز فعلی لازم) |
| `reset-password` | POST | بازیابی رمز: موبایل + کد OTP + رمز جدید |
| `profile` | POST | ویرایش پروفایل |
| `me` | GET | کاربر جاری |
| `logout` | POST | خروج |

## املاک
| Endpoint | متد | توضیح |
|---|---|---|
| `/api/properties` | GET | **جستجوی سرور-ساید**: `q, provinceId, cityId, areaId, tt (لیست), types, minPrice/maxPrice, minLand/maxLand, minBuild/maxBuild, bedrooms, amenities, doc, negotiable, featured, bbox, sort (NEWEST/PRICE_ASC/PRICE_DESC/MOST_VIEWED), page, pageSize` + `ids` (fetch گروهی برای مقایسه/تاریخچه) → `{items, total, totalPages, pins}` |
| `/api/properties` | POST | ثبت آگهی (draft یا `submit:true` → PENDING) — نقش CUSTOMER خودکار به OWNER ارتقا می‌یابد |
| `/api/properties/[id]` | GET | جزئیات کامل + مالک/مشاور + مشابه + favorited |
| `/api/properties/[id]` | PATCH/DELETE | ویرایش/حذف (مالک، agent یا ادمین) |
| `/api/properties/[id]/submit` | POST | DRAFT/REJECTED → PENDING |
| `/api/properties/[id]/extend` | POST | تمدید آگهی (منقضی یا نزدیک انقضا) |
| `/api/properties/[id]/visit` | POST | درخواست بازدید (عمومی + rate limit) |
| `/api/properties/[id]/report` | POST | گزارش آگهی نامعتبر |
| `/api/me/listings` | GET | آگهی‌های من |

## تعاملات
`/api/visits` (GET mine|incoming · PATCH وضعیت) · `/api/contact` (POST عمومی) · `/api/favorites` (GET/POST toggle) · `/api/messages` (GET لیست/جزئیات · POST ارسال) · `/api/notifications` (GET · PATCH خواندن) · `/api/track` (POST ثبت بازدید با dedup) · `/api/me/activity` (GET تاریخچه) · `/api/upload` (POST multipart — jpg/png/webp ≤5MB → WebP) · `/api/files/[...path]` (GET سرو تصاویر) · `/api/lookups` (GET استان/شهر/منطقه/امکانات/enum ها) · `/api/home` (GET داده تجمیعی صفحه اصلی) · `/api/agents` (GET مشاوران عمومی) · `/api/articles` + `/api/articles/[slug]` (GET) · `/api/banners` · `/api/faqs` · `/api/cms/[slug]` · `/api/complaints` (POST پشتیبانی) · `/api/sitemap` (GET XML)

## مدیریت — `/api/admin/[section]` (نقش ADMIN/SUPER_ADMIN)

**GET:** `overview` (۱۲ KPI) · `charts?days` (بازدید/آگهی/کاربران روزانه + توزیع‌ها) · `recents` · `users?q&role` · `user?id` (جزئیات + فعالیت) · `properties?status&tt&q` · `visits?status` · `messages?status` · `complaints?type` · `agents` (عملکرد هر مشاور) · `articles` · `banners` · `faqs` · `cms` · `settings` · `audit?q` · `export?entity=listings|users|visits` (CSV با BOM)

**POST (action dispatch):**
- `properties`: `set-status {to, reason?}` با **اعتبارسنجی قوانین انتقال** · `approve` · `approve-private` · `reject {reason}` · `publish` · `unpublish` · `archive` · `toggle-featured` · `assign-agent {agentId}` · `delete`
- `users`: `toggle-block` · `set-role {role}` (نقش مدیریتی فقط توسط SUPER_ADMIN)
- `agents`: `upsert` · `toggle-active`
- `visits`: `update {status, assignedToId, adminNote}`
- `messages`: `update {status, adminNote}`
- `complaints`: `reply {reply, status}`
- `articles`: `upsert` · `delete` · `upsert-category`
- `banners` / `faqs` / `cms`: `upsert` · `delete`
- `settings`: `update {key: value}`

## سطوح دسترسی (سمت سرور اعمال می‌شود)
| نقش | دسترسی |
|---|---|
| SUPER_ADMIN | همه + اعطای نقش مدیریتی |
| ADMIN | همه بخش‌های مدیریت |
| AGENT | آگهی‌های تخصیصی + درخواست‌های تخصیصی |
| OWNER | CRUD آگهی‌های خودش + درخواست‌های دریافتی |
| CUSTOMER | علاقه‌مندی، پیام، درخواست بازدید، گزارش |

نمونه تست خودکار: `bash scripts/api-test.sh` (۵۵ سناریو از ورود تا انتشار، گزارش و خروجی CSV).
