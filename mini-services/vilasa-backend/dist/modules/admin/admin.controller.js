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
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../../common/current-user.decorator");
const user_util_1 = require("../../common/user.util");
const api_error_1 = require("../../common/api-error");
const admin_service_1 = require("./admin.service");
const bookings_dto_1 = require("../bookings/bookings.dto");
let AdminController = class AdminController {
    admin;
    constructor(admin) {
        this.admin = admin;
    }
    /**
     * GET /api/admin/[section]
     * sections: overview | reports | users | properties | bookings | payments |
     *           refunds | payouts | coupons | complaints | reviews | settings | audit
     */
    async section(user, section, days, q, role, status) {
        const u = (0, user_util_1.requireUser)(user);
        switch (section) {
            case "overview":
                return this.admin.overview(u);
            case "reports":
                return this.admin.reports(u, Number(days ?? 30));
            case "users":
                return this.admin.listUsers(u, q ?? undefined, role ?? undefined);
            case "properties":
                return this.admin.adminProperties(u, status ?? "ALL");
            case "bookings":
                return this.admin.adminBookings(u, status ?? "ALL", q ?? undefined);
            case "payments":
                return this.admin.adminPayments(u);
            case "refunds":
                return this.admin.adminRefunds(u);
            case "payouts":
                return this.admin.adminPayouts(u);
            case "coupons":
                return this.admin.adminCoupons(u);
            case "complaints":
                return this.admin.adminComplaints(u);
            case "reviews":
                return this.admin.adminReviews(u, status ?? "ALL");
            case "settings":
                return this.admin.getSettings(u);
            case "audit":
                return this.admin.getAuditLogs(u);
            default:
                throw (0, api_error_1.badRequest)("بخش نامعتبر است");
        }
    }
    /** POST /api/admin/[section] — action dispatch */
    async action(user, section, body) {
        const u = (0, user_util_1.requireUser)(user);
        const id = body.id;
        switch (section) {
            case "users": {
                if (body.action === "toggle-block")
                    return this.admin.toggleUserBlock(u, id);
                if (body.action === "set-role")
                    return this.admin.setUserRole(u, id, body.role);
                break;
            }
            case "properties": {
                if (body.action === "approve")
                    return this.admin.verifyProperty(u, id, "APPROVE");
                if (body.action === "reject")
                    return this.admin.verifyProperty(u, id, "REJECT", body.reason);
                if (body.action === "toggle-featured")
                    return this.admin.toggleFeatured(u, id);
                if (body.action === "toggle-suspend")
                    return this.admin.suspendProperty(u, id);
                break;
            }
            case "refunds": {
                if (body.action === "process")
                    return this.admin.processRefund(u, id);
                break;
            }
            case "payouts": {
                if (body.action === "create")
                    return this.admin.createPayout(u, body.hostId, body.amount, body.periodLabel ?? "تسویه دوره‌ای");
                if (body.action === "mark-paid")
                    return this.admin.markPayoutPaid(u, id);
                break;
            }
            case "coupons": {
                if (body.action === "upsert")
                    return this.admin.upsertCoupon(u, body.data);
                if (body.action === "delete")
                    return this.admin.deleteCoupon(u, id);
                break;
            }
            case "complaints": {
                if (body.action === "reply")
                    return this.admin.replyComplaint(u, id, body.reply ?? "", body.status ?? "RESOLVED");
                break;
            }
            case "reviews": {
                if (body.action === "moderate")
                    return this.admin.moderateReview(u, id, body.status ?? "APPROVED");
                break;
            }
            case "settings": {
                if (body.action === "update")
                    return this.admin.updateSettings(u, body.data);
                break;
            }
        }
        throw (0, api_error_1.badRequest)("عملیات ناشناخته");
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)(":section"),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("section")),
    __param(2, (0, common_1.Query)("days")),
    __param(3, (0, common_1.Query)("q")),
    __param(4, (0, common_1.Query)("role")),
    __param(5, (0, common_1.Query)("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "section", null);
__decorate([
    (0, common_1.Post)(":section"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("section")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, bookings_dto_1.AdminActionDto]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "action", null);
exports.AdminController = AdminController = __decorate([
    (0, swagger_1.ApiTags)("admin"),
    (0, common_1.Controller)("admin"),
    __metadata("design:paramtypes", [admin_service_1.AdminService])
], AdminController);
//# sourceMappingURL=admin.controller.js.map