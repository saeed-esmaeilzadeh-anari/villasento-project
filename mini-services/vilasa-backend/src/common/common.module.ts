import { Global, Module } from "@nestjs/common";

import { EventsModule } from "../events/events.module";
import { AuditService } from "./services/audit.service";
import { NotificationsService } from "./services/notifications.service";
import { SettingsService } from "./services/settings.service";
import { SmsService } from "./services/sms.service";

/**
 * Global cross-cutting services (settings, audit, sms, notifications).
 * Registered once — injectable in every feature module.
 */
@Global()
@Module({
  imports: [EventsModule],
  providers: [AuditService, SettingsService, SmsService, NotificationsService],
  exports: [AuditService, SettingsService, SmsService, NotificationsService],
})
export class CommonModule {}
