"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HostController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../../common/current-user.decorator");
const user_util_1 = require("../../common/user.util");
const api_error_1 = require("../../common/api-error");
const host_service_1 = require("./host.service");
const properties_service_1 = require("../properties/properties.service");
const properties_dto_1 = require("../properties/properties.dto");
let HostController = class HostController {
    host;
    props;
    constructor(host, props) {
        this.host = host;
        this.props = props;
    }
    async view(user, view = "dashboard", propertyId, from, to) {
        const u = (0, user_util_1.requireUser)(user);
        switch (view) {
            case "dashboard":
                return this.host.hostDashboard(u);
            case "earnings":
                return this.host.hostEarnings(u);
            case "reviews":
                return this.host.hostReviews(u);
            case "properties":
                return this.props.hostProperties(u);
            case "calendar": {
                if (!propertyId)
                    throw (0, api_error_1.badRequest)("propertyId الزامی است");
                if (!from || !to)
                    throw (0, api_error_1.badRequest)("from و to الزامی است");
                return this.props.hostCalendar(u, propertyId, from, to);
            }
            default:
                throw (0, api_error_1.badRequest)("view نامعتبر است");
        }
    }
    updateCalendar(user, dto) {
        return this.props.updateCalendarDays((0, user_util_1.requireUser)(user), dto.propertyId, dto.updates);
    }
};
exports.HostController = HostController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: "داشبورد/درآمد/نظرات/اقامتگاه‌ها/تقویم میزبان (?view=)" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)("view")),
    __param(2, (0, common_1.Query)("propertyId")),
    __param(3, (0, common_1.Query)("from")),
    __param(4, (0, common_1.Query)("to")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], HostController.prototype, "view", null);
__decorate([
    (0, common_1.Put)("calendar"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: "ویرایش گروهی روزهای تقویم (قیمت/مسدودسازی)" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, properties_dto_1.UpdateCalendarDto]),
    __metadata("design:returntype", void 0)
], HostController.prototype, "updateCalendar", null);
exports.HostController = HostController = __decorate([
    (0, swagger_1.ApiTags)("host"),
    (0, common_1.Controller)("host"),
    __metadata("design:paramtypes", [host_service_1.HostService,
        properties_service_1.PropertiesService])
], HostController);
//# sourceMappingURL=host.controller.js.map