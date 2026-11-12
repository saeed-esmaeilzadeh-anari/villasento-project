# Vilasa Backend (NestJS)

بک‌اند مستقل NestJS برای پلتفرم ویلاسا — روی پورت `3002`، متصل به همان دیتابیس و همان سیستم نشست Next.js.

```bash
bun install && bun run db:generate
bun run dev            # → http://localhost:3002/api  |  Swagger: /docs
bun run dev:watch      # حالت watch
```

- قرارداد کامل، ماژول‌ها و اتصالات: [`docs/nestjs-backend.md`](../../docs/nestjs-backend.md) (ریشه پروژه)
- تست E2E کامل: `node scripts/test-nest.mjs` از ریشه پروژه (۳۴ بررسی)
- سوییچ فرانت‌اند به این بک‌اند: فوتر سایت → «NestJS (پورت ۳۰۰۲)» یا `localStorage.vilasa_api = "nest"`
