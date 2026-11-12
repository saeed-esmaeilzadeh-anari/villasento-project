import "reflect-metadata";
import { ValidationPipe, Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";

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
  const app = await NestFactory.create(AppModule, {
    cors: { origin: true, credentials: true },
    logger: ["log", "warn", "error"],
  });

  app.use(cookieParser());
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      stopAtFirstError: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const config = new DocumentBuilder()
    .setTitle("Vilasa API (NestJS)")
    .setDescription(
      "API سامانه رزرو و اجاره باغ‌ویلا و اقامتگاه «ویلاسا». " +
        "احراز هویت OTP با کوکی نشست امضاشده (HMAC-SHA256) مشترک با فرانت‌اند Next.js.",
    )
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
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  const port = Number(process.env.PORT || 3002);
  await app.listen(port, "0.0.0.0");
  new Logger("Bootstrap").log(
    `Vilasa NestJS API ready → http://localhost:${port}/api  | Swagger: /docs | socket.io: /`,
  );
}

void bootstrap();
