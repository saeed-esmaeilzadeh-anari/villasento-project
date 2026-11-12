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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const api_error_1 = require("../../common/api-error");
const constants_1 = require("../../common/constants");
const audit_service_1 = require("../../common/services/audit.service");
const dates_util_1 = require("../../common/dates.util");
let ReviewsService = class ReviewsService {
    prisma;
    auditSrv;
    constructor(prisma, auditSrv) {
        this.prisma = prisma;
        this.auditSrv = auditSrv;
    }
    async createReview(user, bookingId, data) {
        const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { property: true } });
        if (!booking)
            throw (0, api_error_1.notFound)("رزرو یافت نشد");
        if (booking.userId !== user.id)
            throw (0, api_error_1.forbidden)();
        if (booking.status !== constants_1.BOOKING_STATUS.COMPLETED &&
            !(booking.status === constants_1.BOOKING_STATUS.CONFIRMED && booking.checkOut < (0, dates_util_1.todayStr)()))
            throw (0, api_error_1.badRequest)("پس از تکمیل اقامت می‌توانید نظر ثبت کنید");
        if (booking.checkOut >= (0, dates_util_1.todayStr)())
            throw (0, api_error_1.badRequest)("ثبت نظر پس از پایان اقامت امکان‌پذیر است");
        const existing = await this.prisma.review.findUnique({ where: { bookingId } });
        if (existing)
            throw (0, api_error_1.badRequest)("برای این رزرو قبلاً نظر ثبت شده است");
        if (data.rating < 1 || data.rating > 5)
            throw (0, api_error_1.badRequest)("امتیاز باید بین ۱ تا ۵ باشد");
        const review = await this.prisma.review.create({
            data: {
                propertyId: booking.propertyId,
                userId: user.id,
                bookingId,
                rating: data.rating,
                cleanliness: data.cleanliness,
                accuracy: data.accuracy,
                location: data.location,
                comment: data.comment,
                status: "APPROVED", // auto-approve; admin can reject later
            },
        });
        // Recalculate property rating
        const agg = await this.prisma.review.aggregate({
            where: { propertyId: booking.propertyId, status: "APPROVED" },
            _avg: { rating: true },
            _count: true,
        });
        await this.prisma.property.update({
            where: { id: booking.propertyId },
            data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, reviewCount: agg._count },
        });
        await this.auditSrv.audit({ actorId: user.id, action: "REVIEW_CREATE", entity: "Review", entityId: review.id });
        return review;
    }
    async replyReview(user, reviewId, reply) {
        const review = await this.prisma.review.findUnique({ where: { id: reviewId }, include: { property: true } });
        if (!review)
            throw (0, api_error_1.notFound)("نظر یافت نشد");
        if (review.property.hostId !== user.id && user.role !== "ADMIN")
            throw (0, api_error_1.notFound)("نظر یافت نشد");
        return this.prisma.review.update({ where: { id: reviewId }, data: { hostReply: reply } });
    }
};
exports.ReviewsService = ReviewsService;
exports.ReviewsService = ReviewsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], ReviewsService);
//# sourceMappingURL=reviews.service.js.map