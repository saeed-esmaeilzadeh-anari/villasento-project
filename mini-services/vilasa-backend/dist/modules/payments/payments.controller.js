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
exports.PaymentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../../common/current-user.decorator");
const user_util_1 = require("../../common/user.util");
const api_error_1 = require("../../common/api-error");
const payments_service_1 = require("./payments.service");
const payments_dto_1 = require("./payments.dto");
let PaymentsController = class PaymentsController {
    payments;
    constructor(payments) {
        this.payments = payments;
    }
    status(user, authority) {
        if (!authority)
            throw (0, api_error_1.badRequest)("authority الزامی است");
        return this.payments.getByAuthority(authority, user);
    }
    action(user, dto) {
        const u = (0, user_util_1.requireUser)(user);
        if (dto.action === "start") {
            if (!dto.bookingId)
                throw (0, api_error_1.badRequest)("شناسه رزرو الزامی است");
            return this.payments.startPayment(u, dto.bookingId);
        }
        if (dto.action === "settle") {
            if (!dto.authority || !dto.result)
                throw (0, api_error_1.badRequest)("پارامترهای تسویه ناقص است");
            return this.payments.settlePayment(dto.authority, dto.result, u);
        }
        // refund (admin)
        if (!dto.paymentId || !dto.amount)
            throw (0, api_error_1.badRequest)("پارامترهای بازگشت وجه ناقص است");
        return this.payments.createRefund(u, dto.paymentId, dto.amount, dto.reason ?? "بازگشت وجه توسط پشتیبانی");
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: "وضعیت تراکنش بر اساس authority" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)("authority")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "status", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: "start (ایجاد پرداخت) | settle (تأیید درگاه) | refund (بازگشت وجه مدیر)" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, payments_dto_1.PaymentActionDto]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "action", null);
exports.PaymentsController = PaymentsController = __decorate([
    (0, swagger_1.ApiTags)("payments"),
    (0, common_1.Controller)("payments"),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService])
], PaymentsController);
//# sourceMappingURL=payments.controller.js.map