import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";

import { PrismaModule } from "./prisma/prisma.module";
import { SessionMiddleware } from "./common/session.middleware";
import { CommonModule } from "./common/common.module";

import { AuthModule } from "./modules/auth/auth.module";
import { LookupsModule } from "./modules/lookups/lookups.module";
import { CmsModule } from "./modules/cms/cms.module";
import { PropertiesModule } from "./modules/properties/properties.module";
import { BookingsModule } from "./modules/bookings/bookings.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { FavoritesModule } from "./modules/favorites/favorites.module";
import { MessagesModule } from "./modules/messages/messages.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { ComplaintsModule } from "./modules/complaints/complaints.module";
import { HostModule } from "./modules/host/host.module";
import { AdminModule } from "./modules/admin/admin.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CommonModule,
    AuthModule,
    LookupsModule,
    CmsModule,
    PropertiesModule,
    BookingsModule,
    PaymentsModule,
    ReviewsModule,
    FavoritesModule,
    MessagesModule,
    NotificationsModule,
    ComplaintsModule,
    HostModule,
    AdminModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Resolves the shared signed-cookie session on EVERY request
    // (same cookie & HMAC secret as the Next.js app → SSO).
    consumer.apply(SessionMiddleware).forRoutes("*");
  }
}
