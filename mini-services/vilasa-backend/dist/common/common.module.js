"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonModule = void 0;
const common_1 = require("@nestjs/common");
const events_module_1 = require("../events/events.module");
const audit_service_1 = require("./services/audit.service");
const notifications_service_1 = require("./services/notifications.service");
const settings_service_1 = require("./services/settings.service");
const sms_service_1 = require("./services/sms.service");
/**
 * Global cross-cutting services (settings, audit, sms, notifications).
 * Registered once — injectable in every feature module.
 */
let CommonModule = class CommonModule {
};
exports.CommonModule = CommonModule;
exports.CommonModule = CommonModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [events_module_1.EventsModule],
        providers: [audit_service_1.AuditService, settings_service_1.SettingsService, sms_service_1.SmsService, notifications_service_1.NotificationsService],
        exports: [audit_service_1.AuditService, settings_service_1.SettingsService, sms_service_1.SmsService, notifications_service_1.NotificationsService],
    })
], CommonModule);
//# sourceMappingURL=common.module.js.map