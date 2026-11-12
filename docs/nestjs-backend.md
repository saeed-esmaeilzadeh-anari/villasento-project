# NestJS Backend (نسخه ۱ — دامنه اجاره روزانه) — مستندات

> ⚠️ **وضعیت:** این سرویس برای دامنه قبلی «ویلاسنتو» (اجاره روزانه با تقویم قیمت و رزرو) ساخته شده و **کامل و تست‌شده** است. پس از چرخش دامنه به «ویلاسنتو» (آگهی فروش/رهن/اجاره)، بک‌اند مرجع، **API داخلی Next.js** است (`src/app/api` + `src/server/services`). این سرویس NestJS بدون تغییر باقی مانده تا بعداً بر اساس دامنه جدید هم‌تراز شود (ابتدای کار: بازنویسی ماژول properties/booking به لیستینگ). سوییچ فرانت‌اند بین دو بک‌اند از فوتر سایت است.

بک‌اند جامع NestJS برای پلتفرم «ویلاسنتو» — مستقل از Next.js، قابل دیپلوی جداگانه، با تمام اتصالات لازم.

## ۱) نمای کلی

| موضوع | مقدار |
|---|---|
| مسیر | `mini-services/vilasa-backend/` |
| فریم‌ورک | NestJS 10 (Express adapter) + TypeScript 5 (strict) |
| ORM / دیتابیس | Prisma 6 → همان `db/custom.db` مشترک با Next.js (طراحی PostgreSQL-ready) |
| پورت | `3002` (متغیر `PORT` در `.env`) |
| احراز هویت | OTP + کوکی امضاشده HMAC-SHA256 (`vilasa_session`) — **مشترک با Next.js** |
| اعتبارسنجی | `class-validator` + `ValidationPipe` سراسری با پیام‌های فارسی |
| مستندات تعاملی | Swagger UI در `/docs` و OpenAPI JSON در `/docs-json` |
| Realtime | socket.io روی همان پورت (gateway با اتاقک `user:<id>`) |
| Cron | `@nestjs/schedule` — انقضای قفل پرداخت و تکمیل اقامت‌ها (هر ۶۰ ثانیه) |
| تست | `scripts/test-nest.mjs` — **۳۴ بررسی E2E** روی چرخه کامل |

## ۲) اجرا

```bash
cd mini-services/vilasa-backend
bun install            # یا npm install
bun run db:generate    # prisma generate (کلاینت اختصاصی این سرویس)
bun run dev            # کامپایل tsc + اجرا → http://localhost:3002/api
bun run dev:watch      # tsc -w + node --watch (اتورستارت)
bun run db:push        # همگام‌سازی اسکیما (فقط وقتی اسکیما تغییر کرده)
```

`.env`:
```ini
DATABASE_URL="file:../../db/custom.db"   # همان دیتابیس Next.js
AUTH_SECRET="vilasa-dev-secret-do-not-use-in-prod"  # باید با فرانت یکی باشد (SSO)
PORT=3002
```

## ۳) اتصالات برقرارشده (تمامی ارتباطات)

1. **دیتابیس مشترک:** `PrismaService` به همان فایل SQLite (یا همان PostgreSQL در تولید) وصل است؛ داده‌ها بین Next.js و NestJS یکسان است. حالت WAL روی دیتابیس فعال شده تا دو پروسه همزمان بنویسند/بخوانند.
2. **احراز هویت یکپارچه (SSO):** الگوریتم امضا/تأیید کوکی عیناً از `src/server/session.ts` پورت شده؛ توکن ساخته‌شده توسط هر دو سرور توسط دیگری پذیرفته می‌شود. ورود از UI سایت، روی هر دو بک‌اند معتبر است.
3. **Gateway هم‌مبدا (XTransformPort):** Caddy درخواست‌های دارای کوئری `?XTransformPort=3002` را به NestJS فوروارد می‌کند؛ فرانت‌اند در حالت Nest با همین مسیر تماس می‌گیرد (بدون CORS، بدون آدرس مطلق).
4. **سوییچ زمان اجرا در فرانت‌اند:** `src/lib/api.ts` با `localStorage.vilasa_api = "nest" | "next"` (و سlector فوتر سایت) مقصد API را عوض می‌کند — بدون تغییر کد سرویس‌ها.
5. **Realtime (socket.io):** handshake با همان کوکی احراز می‌شود؛ رویدادهای `notification`، `message` و `ping/pong`. از مرورگر: `io("/?XTransformPort=3002", { withCredentials: true })`.
6. **Cron داخلی:** `BookingsService.sweep()` هر ۶۰ ثانیه — انقضای `PENDING_PAYMENT`های گذشته از `expiresAt` + تکمیل خودکار اقامت‌های تمام‌شده (معادل sweeper لِزی Next.js).
7. **Swagger/OpenAPI:** قرارداد کامل API برای کلاینت‌های خارجی (اپ موبایل React Native، Postman).
8. **AuditLog و Notifications:** از همان جداول مشترک استفاده می‌کنند؛ `NotificationsService` هم رکورد می‌سازد هم socket push می‌کند.

## ۴) ساختار ماژول‌ها

```
src/
├── main.ts                      # bootstrap: CORS, cookie-parser, ValidationPipe, Swagger, prefix /api
├── app.module.ts                # ثبت همه ماژول‌ها + SessionMiddleware سراسری
├── prisma/                      # PrismaService (global)
├── common/
│   ├── api-error.ts             # ApiError + badRequest/unauthorized/forbidden/notFound (فارسی)
│   ├── all-exceptions.filter.ts # شکل خطای یکسان با Next.js: { error, code? }
│   ├── session.util.ts          # HMAC encode/decode — سازگار بایت‌به‌بایت با Next.js
│   ├── session.middleware.ts    # resolve کاربر از کوکی روی هر درخواست
│   ├── current-user.decorator.ts # @CurrentUser()
│   ├── user.util.ts             # requireUser / assertRole / adminGuard
│   ├── dates.util.ts            # رشته‌های YYYY-MM-DD، شب‌ها، آخر هفته ایران
│   ├── constants.ts             # PROPERTY_TYPES, BOOKING_STATUS, ACTIVE_STATUSES
│   ├── common.module.ts         # سرویس‌های سراسری (Settings/Audit/Sms/Notifications)
│   └── services/                # settings (کمیسیون/سیاست لغو), audit, sms (Adapter), notifications
├── events/                      # EventsGateway (socket.io) — @Global
└── modules/
    ├── auth/        # POST auth/request-otp|verify|logout|profile، GET auth/me
    ├── lookups/     # GET lookups (+ PublicService: cms)
    ├── cms/         # GET cms/:slug (و all)
    ├── properties/  # GET/POST properties، GET/PATCH/DELETE properties/:id
    ├── bookings/    # GET/POST bookings، GET/PATCH bookings/:id، POST coupons/validate، GET track
    ├── payments/    # GET payments?authority، POST payments (start|settle|refund) — درگاه Adapter
    ├── reviews/     # POST reviews، PATCH reviews (پاسخ میزبان)
    ├── favorites/   # GET/POST favorites (toggle)
    ├── messages/    # GET/POST messages (+ push socket)
    ├── notifications/ # GET/POST notifications
    ├── complaints/  # GET/POST complaints
    ├── host/        # GET host?view=dashboard|earnings|reviews|properties|calendar، PUT host/calendar
    ├── admin/       # GET/POST admin/:section — ۱۳ بخش (کاربران تا Audit)
    └── health/      # GET health (بررسی db)
```

## ۵) قرارداد پاسخ (پاریتی با Next.js)

- موفقیت: همان JSON همان endpoint داخلی Next.js (وضعیت `200` برای همه متدها).
- خطای کسب‌وکار: `{ "error": "پیام فارسی", "code?": "..." }` با وضعیت 400/401/403/404.
- خطای اعتبارسنجی: `{ "error": "اعتبارسنجی ناموفق: …", "issues": [...] }` با وضعیت 400.
- خطای غیرمنتظره: `{ "error": "خطای غیرمنتظره سرور. لطفاً دوباره تلاش کنید." }` با 500.
- کوپن نامعتبر در `coupons/validate`: مثل Next.js با `200 { valid:false, message }`.

## ۶) منطق‌های حیاتی (پورت‌شده بدون تغییر رفتار)

- **جلوگیری از رزرو دوبل:** `assertAvailable` درون `$transaction` — چک `CalendarDay.isBlocked` + هم‌پوشانی رزروهای ACTIVE.
- **قیمت‌گذاری:** قیمت روز اختصاصی ← آخر هفته (پنجشنبه/جمعه) ← پایه + نظافت − تخفیف کوپن؛ کمیسیون از `SystemSetting`.
- **چرخه رزرو:** PENDING_PAYMENT (قفل holdMinutes) → پرداخت (idempotent با authority) → PENDING_APPROVAL/CONFIRMED → تأیید/رد/لغو با جریمه پلکانی + خودکارسازی Refund.
- **درگاه پرداخت:** `PaymentGateway` Adapter — Mock پیش‌فرض؛ ثبت Zarinpal/… با `registerGateway()`.
- **OTP:** نرمال‌سازی ارقام فارسی/عربی، محدودیت ۳ کد در ۱۰ دقیقه، حالت نمایشی با `sms.demoMode`.

## ۷) تست E2E

```bash
node scripts/test-nest.mjs        # NEEDS سرور در حال اجرا روی 3002
```
۳۴ بررسی: health، lookups، جستجو، OTP، سشن، کوپن، ساخت رزرو، رد دوبل‌رزرو، پرداخت start/settle، تأیید مدیر/رفتار رزرو فوری، KPI و گزارش مدیر، تنظیمات، رهگیری عمومی، لغو با جریمه، علاقه‌مندی، شکایت، پیام، اعلان، پنل میزبان، RBAC (403)، شکل خطای اعتبارسنجی فارسی، socket.io و Swagger.

## ۸) دیپلوی تولید (نقشه راه)

- `DATABASE_URL` → PostgreSQL؛ `AUTH_SECRET` → مقدار قوی؛ `NODE_ENV=production` (کوکی secure).
- اجرا: `bun run build && bun run start` (یا Docker).
- جایگزینی `DemoSmsProvider` و `MockGateway` با سرویس واقعی (Kavenegar / Zarinpal) از طریق همان Interface ها.
- Caddy/Nginx: مسیر `/api` به 3002 (هم‌مبدا با فرانت) یا دامنه جدا با CORS credentials.
