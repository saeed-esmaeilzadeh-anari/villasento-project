"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const app_module_1 = require("./app.module");
const all_exceptions_filter_1 = require("./common/all-exceptions.filter");
/**
 * Vilasa backend — standalone NestJS API (mini-service).
 *
 * Connections:
 *  - Same SQLite/Prisma database as the Next.js app (see .env DATABASE_URL)
 *  - Same HMAC signed-cookie session (`vilasa_session`) → SSO with the frontend
 *  - Reachable from the browser through the Caddy gateway: /api/<path>?XTransformPort=3002
 *  - Swagger UI: /docs   (OpenAPI JSON: /docs-json)
 *  - Realtime: socket.io on the same port (namespace "/", rooms per user)
 */
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        cors: { origin: true, credentials: true },
        logger: ["log", "warn", "error"],
    });
    app.use((0, cookie_parser_1.default)());
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        stopAtFirstError: true,
    }));
    app.useGlobalFilters(new all_exceptions_filter_1.AllExceptionsFilter());
    const config = new swagger_1.DocumentBuilder()
        .setTitle("Vilasa API (NestJS)")
        .setDescription("API سامانه رزرو و اجاره باغ‌ویلا و اقامتگاه «ویلاسا». " +
        "احراز هویت OTP با کوکی نشست امضاشده (HMAC-SHA256) مشترک با فرانت‌اند Next.js.")
        .setVersion("1.0.0")
        .addCookieAuth("vilasa_session")
        .addTag("auth")
        .addTag("public")
        .addTag("properties")
        .addTag("bookings")
        .addTag("payments")
        .addTag("social")
        .addTag("host")
        .addTag("admin")
        .addTag("health")
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup("docs", app, document);
    const port = Number(process.env.PORT || 3002);
    await app.listen(port, "0.0.0.0");
    new common_1.Logger("Bootstrap").log(`Vilasa NestJS API ready → http://localhost:${port}/api  | Swagger: /docs | socket.io: /`);
}
void bootstrap();
//# sourceMappingURL=main.js.map