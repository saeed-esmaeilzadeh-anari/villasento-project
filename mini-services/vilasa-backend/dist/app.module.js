"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const prisma_module_1 = require("./prisma/prisma.module");
const session_middleware_1 = require("./common/session.middleware");
const common_module_1 = require("./common/common.module");
const auth_module_1 = require("./modules/auth/auth.module");
const lookups_module_1 = require("./modules/lookups/lookups.module");
const cms_module_1 = require("./modules/cms/cms.module");
const properties_module_1 = require("./modules/properties/properties.module");
const bookings_module_1 = require("./modules/bookings/bookings.module");
const payments_module_1 = require("./modules/payments/payments.module");
const reviews_module_1 = require("./modules/reviews/reviews.module");
const favorites_module_1 = require("./modules/favorites/favorites.module");
const messages_module_1 = require("./modules/messages/messages.module");
const notifications_module_1 = require("./modules/notifications/notifications.module");
const complaints_module_1 = require("./modules/complaints/complaints.module");
const host_module_1 = require("./modules/host/host.module");
const admin_module_1 = require("./modules/admin/admin.module");
const health_module_1 = require("./modules/health/health.module");
let AppModule = class AppModule {
    configure(consumer) {
        // Resolves the shared signed-cookie session on EVERY request
        // (same cookie & HMAC secret as the Next.js app → SSO).
        consumer.apply(session_middleware_1.SessionMiddleware).forRoutes("*");
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            schedule_1.ScheduleModule.forRoot(),
            prisma_module_1.PrismaModule,
            common_module_1.CommonModule,
            auth_module_1.AuthModule,
            lookups_module_1.LookupsModule,
            cms_module_1.CmsModule,
            properties_module_1.PropertiesModule,
            bookings_module_1.BookingsModule,
            payments_module_1.PaymentsModule,
            reviews_module_1.ReviewsModule,
            favorites_module_1.FavoritesModule,
            messages_module_1.MessagesModule,
            notifications_module_1.NotificationsModule,
            complaints_module_1.ComplaintsModule,
            host_module_1.HostModule,
            admin_module_1.AdminModule,
            health_module_1.HealthModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map