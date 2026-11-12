# معماری سامانه ویلاسنتو (VillaSento)

## نمای کلی

```
┌──────────────────────────────────────────────────────────────┐
│                     کلاینت (SPA / PWA)                        │
│   Next.js App Router + React 19 + Tailwind 4 + shadcn/ui      │
│   روتر hash داخلی · TanStack Query (state سرور) · Zustand     │
└───────────────▲──────────────────────────────────────────────┘
                │ fetch JSON (same-origin, credentials)
┌───────────────┴──────────────────────────────────────────────┐
│                   لایه API (Controller — نازک)                │
│   src/app/api/*  →  اعتبارسنجی Zod + dispatch به سرویس‌ها      │
├──────────────────────────────────────────────────────────────┤
│                   لایه Service (منطق کسب‌وکار)                │
│   auth · properties · bookings · payments · host · social     │
│   admin · public   +   session · settings · sms · audit       │
├──────────────────────────────────────────────────────────────┤
│        Prisma ORM  ──►  دیتابیس رابطه‌ای (SQLite/Postgres)     │
└──────────────────────────────────────────────────────────────┘
```

## اصول

1. **Controller نازک**: Route Handler فقط ورودی را با Zod اعتبارسنجی و به سرویس می‌سپارد؛ هیچ منطق کسب‌وکاری در آن نیست.
2. **سرویس‌های مستقل**: هر سرویس در `src/server/services` معادل یک Module در معماری NestJS است (AuthModule, PropertiesModule, BookingsModule, PaymentsModule, …) و به تنهایی قابل انتقال.
3. **خطای یکسان**: `ApiError` + `handler()` همه خطاها را به پاسخ `{ error }` با کد HTTP درست و پیام فارسی تبدیل می‌کند.
4. **Adapter Pattern** برای وابستگی‌های بیرونی: `PaymentGateway` (درگاه پرداخت)، `SmsProvider` (پیامک) — جایگزینی بدون تغییر منطق.
5. **پول و تاریخ**: مبالغ صحیح تومان (بدون اعشار)، تاریخ‌ها `YYYY-MM-DD` (مقایسه لغوی امن در SQLite)؛ آخر هفته ایران پنجشنبه/جمعه.

## جریان رزرو (Gold Path)

```
انتخاب تاریخ در تقویم شمسی (کلاینت، فقط نمایش)
   └─► POST /api/bookings        ← تراکنش دیتابیس:
         گارد مسدودی روزها + همپوشانی رزروهای فعال + حداقل شب + ظرفیت
         محاسبه قیمت شب‌به‌شب + کد تخفیف + کمیسیون
         ایجاد Booking(PENDING_PAYMENT, expiresAt=+30min) + BookingEvent
   └─► POST /api/payments {start}     → Payment(PENDING, authority)
   └─► صفحه درگاه (نمایشی/واقعی)
   └─► POST /api/payments {settle}    ← تأیید فقط سمت سرور + idempotent
         PAID → booking: PENDING_APPROVAL (یا CONFIRMED در رزرو فوری)
   └─► میزبان: PATCH /api/bookings/{id} {approve|reject}
   └─► پاک‌ساز خودکار: انقضای holdها + تکمیل اقامت‌های گذشته
```

## مهاجرت به معماری هدف (NestJS)

| مؤلفه فعلی | هدف |
|---|---|
| `src/server/services/*.ts` | Providers در NestJS Modules (همان امضای توابع) |
| `src/app/api/*/route.ts` | Controllers با DTO‌های Zod→class-validator |
| `session.ts` (کوکی HMAC) | JwtStrategy + Refresh Token Rotation |
| پاک‌ساز داخلی | `@nestjs/schedule` یا BullMQ روی Redis |
| `api/docs` (OpenAPI دستی) | `@nestjs/swagger` (خودکار از DTO) |
| `db` (Prisma/SQLite) | همان Prisma با PostgreSQL + Migrationها |

## مقیاس‌پذیری

- READ مسیرها (جستجو/جزئیات) کش‌پذیر در سطح درخواست/CDN؛ با Redis کش نتایج جستجو بر اساس کلید فیلترها.
- جستجوی جغرافیایی در عملیات با PostGIS (`ST_DWithin`) جایگزین فیلتر شهر می‌شود.
- آپلود تصویر به S3 + تامبنیل؛ URLها در `PropertyImage` (ساختار آماده است).
- چت و اعلان لحظه‌ای روی WebSocket (ساختار `Message`/`Notification` آماده مصرف است).
