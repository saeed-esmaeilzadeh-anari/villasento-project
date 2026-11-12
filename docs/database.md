# دیتابیس ویلاسنتو (Prisma + SQLite — PostgreSQL-ready)

۳۵ جدول. نمودار روابط و جزئیات هر مدل در `prisma/schema.prisma`.

## دامنه املاک (جدید)

| جدول | نقش |
|---|---|
| `User` | نقش‌ها: SUPER_ADMIN / ADMIN / AGENT / OWNER / CUSTOMER (+legacy HOST) · رمز عبور scrypt · lastLoginAt |
| `Property` | آگهی: `code` یکتا (VS-XXXXXX) · `transactionType` (SALE/RAHN/RAHN_RENT/RENT) · قیمت‌ها Float (salePrice/rahnAmount/rentAmount — دقیق تا ۹e15 تومان) · مشخصات (landArea, buildArea, bedrooms, bathrooms, floors, buildYear, documentStatus) · `status` با قوانین انتقال · `agentId` (تخصیص مشاور) · contact info · video/tour |
| `PropertyImage` | تصاویر آگهی با sort (اولین = کاور) |
| `PropertyAmenity` + `Amenity` | امکانات چندبه‌چند |
| `Area` | منطقه/محله هر شهر (cityId + name یکتا) |
| `PropertyView` | بازدید واقعی هر آگهی با dedup روزانه (userId/ip + day) |
| `VisitRequest` + `VisitRequestEvent` | درخواست بازدید: وضعیت NEW/IN_PROGRESS/DONE/CANCELLED · تخصیص مشاور · **تاریخچه پیگیری** |
| `ContactMessage` | پیام‌های فرم تماس (عمومی) |
| `AgentProfile` | پروفایل مشاور (آژانس، پروانه، بیو، عکس، isActive) |
| `Article` + `ArticleCategory` | مقالات مجله با slug یکتا |
| `Banner` | بنرهای مدیریت‌شده (HOME_TOP/HOME_MID/HOME_BOTTOM/SIDEBAR) |
| `Faq` | سؤالات متداول |
| `Complaint` | پشتیبانی + **گزارش آگهی نامعتبر** (`type=LISTING_REPORT` + propertyId) |

## سیستم‌های عمومی

`OtpCode` (احراز هویت پیامکی با TTL و مصرف یک‌بار) · `Favorite` · `Conversation/Message` (پیام مالک-متقاضی) · `Notification` · `CmsPage` (صفحات ثابت) · `AuditLog` (تمام عملیات حساس) · `SystemSetting` (تنظیمات: برند، سئو، ساعات اعتبار آگهی، پیامک، نقشه، آپلود، منو، شبکه‌های اجتماعی)

## جداول legacy (دست‌نخورده برای مهاجرت امن)

`Booking`، `BookingEvent`، `CalendarDay`، `Payment`، `Refund`، `Coupon`، `CouponUsage`، `Payout`، `Review` — از نسخه قبلی (اجاره روزانه) هستند؛ در UI استفاده نمی‌شوند، APIهای آن‌ها همچنان کار می‌کند و حذف آن‌ها نیازمند برنامه مهاجرت جداگانه است.

## ایندکس‌های مهم

- `Property(status, cityId)` · `Property(transactionType, status)` · `Property(isFeatured, status)` · `Property(hostId)`
- `PropertyView(propertyId, day)` + `(day)` — نمودار بازدید
- `VisitRequest(propertyId | status | userId)` · `Article(isPublished)` · `Banner(position, isActive)`
- یکتاها: `User.phone`, `Property.code`, `Area(cityId,name)`, `Article.slug`, `Conversation(propertyId,customerId)`

## قوانین انتقال وضعیت آگهی (سمت سرور اعمال می‌شود)

```
DRAFT → PENDING              (ثبت/ارسال برای تأیید)
PENDING → PUBLISHED          (تأیید و انتشار؛ publishedAt + expiresAt=+۶۰ روز)
PENDING → APPROVED           (تأیید بدون انتشار)
PENDING → REJECTED           (با دلیل اجباری)
PUBLISHED → APPROVED         (لغو انتشار)
PUBLISHED → EXPIRED          (گذشت expiresAt؛ sweep خودکار lazy)
EXPIRED → PUBLISHED          (تمدید؛ expiresAt جدید)
REJECTED → PENDING           (ویرایش و ارسال مجدد)
ARCHIVED → PUBLISHED/PENDING (بازگشت)
```

## مهاجرت‌های انجام‌شده در این نسخه (بدون از دست رفتن داده)

1. افزودن همه جداول/ستون‌های جدید (nullable یا default)
2. ستون `Property.code` در ۳ مرحله ایمن: nullable → backfill → required
3. تغییر نوع ستون‌های قیمت به Float (به دلیل محدوده INT در SQLite)
