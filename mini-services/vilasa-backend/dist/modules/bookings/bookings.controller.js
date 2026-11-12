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
exports.BookingsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../../common/current-user.decorator");
const user_util_1 = require("../../common/user.util");
const api_error_1 = require("../../common/api-error");
const bookings_service_1 = require("./bookings.service");
const bookings_dto_1 = require("./bookings.dto");
let BookingsController = class BookingsController {
    bookings;
    constructor(bookings) {
        this.bookings = bookings;
    }
    list(user, role, tab, status) {
        const u = (0, user_util_1.requireUser)(user);
        if (role === "host")
            return this.bookings.hostBookings(u, status ?? "ALL");
        return this.bookings.myBookings(u, tab ?? "ALL");
    }
    create(user, dto) {
        return this.bookings.createBooking((0, user_util_1.requireUser)(user), dto);
    }
    detail(user, id) {
        return this.bookings.findOwnedBooking(id, (0, user_util_1.requireUser)(user));
    }
    action(user, id, dto) {
        const u = (0, user_util_1.requireUser)(user);
        switch (dto.action) {
            case "approve":
                return this.bookings.approveBooking(u, id);
            case "reject":
                return this.bookings.rejectBooking(u, id, dto.reason);
            case "complete":
                return this.bookings.completeBooking(u, id);
            case "cancel":
                return this.bookings.cancelBooking(u, id, dto.reason);
        }
    }
    validateCoupon(user, dto) {
        (0, user_util_1.requireUser)(user);
        return this.bookings
            .validateCoupon(dto.code, dto.amount)
            .then((res) => ({ valid: true, ...res }))
            .catch((e) => {
            if (e instanceof Error)
                return { valid: false, message: e.message };
            throw (0, api_error_1.badRequest)("کد تخفیف نامعتبر است");
        });
    }
    track(code) {
        if (!code)
            throw (0, api_error_1.badRequest)("کد رهگیری را وارد کنید");
        return this.bookings.trackByCode(code);
    }
};
exports.BookingsController = BookingsController;
__decorate([
    (0, common_1.Get)("bookings"),
    (0, swagger_1.ApiOperation)({ summary: "رزروهای من (role=host → رزروهای اقامتگاه‌های میزبان)" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)("role")),
    __param(2, (0, common_1.Query)("tab")),
    __param(3, (0, common_1.Query)("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)("bookings"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: "ثبت رزرو — کنترل دو‌بار‌رزرو شدن در تراکنش دیتابیس" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, bookings_dto_1.CreateBookingDto]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)("bookings/:id"),
    (0, swagger_1.ApiOperation)({ summary: "جزئیات یک رزرو (مهمان/میزبان/مدیر)" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "detail", null);
__decorate([
    (0, common_1.Patch)("bookings/:id"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: "اقدام روی رزرو: cancel | approve | reject | complete" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, bookings_dto_1.BookingActionDto]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "action", null);
__decorate([
    (0, common_1.Post)("coupons/validate"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: "اعتبارسنجی کد تخفیف و پیش‌نمایش تخفیف" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, bookings_dto_1.ValidateCouponDto]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "validateCoupon", null);
__decorate([
    (0, common_1.Get)("track"),
    (0, swagger_1.ApiOperation)({ summary: "رهگیری عمومی رزرو با کد (بدون ورود)" }),
    __param(0, (0, common_1.Query)("code")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "track", null);
exports.BookingsController = BookingsController = __decorate([
    (0, swagger_1.ApiTags)("bookings"),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [bookings_service_1.BookingsService])
], BookingsController);
//# sourceMappingURL=bookings.controller.js.map