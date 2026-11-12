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
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../../prisma/prisma.service");
const api_error_1 = require("../../common/api-error");
const constants_1 = require("../../common/constants");
const audit_service_1 = require("../../common/services/audit.service");
const notifications_service_1 = require("../../common/services/notifications.service");
class MockGateway {
    key = "MOCK_GATEWAY";
    async start(_bookingId, _amount) {
        const authority = "MCK-" + (0, crypto_1.randomUUID)().slice(0, 18).toUpperCase();
        return { authority, redirectUrl: `/pay/${authority}` };
    }
    async verify(_authority) {
        // The sandbox gateway page posts an explicit success/fail intent;
        // default to success for direct API calls.
        return {
            ok: true,
            refId: String(Math.floor(100000000 + Math.random() * 899999999)),
            cardMask: "6104-****-****-3791",
        };
    }
}
let PaymentsService = class PaymentsService {
    prisma;
    auditSrv;
    notifySrv;
    gateways = { MOCK_GATEWAY: new MockGateway() };
    constructor(prisma, auditSrv, notifySrv) {
        this.prisma = prisma;
        this.auditSrv = auditSrv;
        this.notifySrv = notifySrv;
    }
    /** Register a real PSP (Zarinpal, IDPay, …) at bootstrap time. */
    registerGateway(g) {
        this.gateways[g.key] = g;
    }
    getGateway(key = "MOCK_GATEWAY") {
        const gw = this.gateways[key];
        if (!gw)
            throw (0, api_error_1.badRequest)("درگاه پرداخت پشتیبانی نمی‌شود");
        return gw;
    }
    /** GET /api/payments?authority=… — poll payment status */
    async getByAuthority(authority, viewer) {
        const payment = await this.prisma.payment.findUnique({
            where: { authority },
            include: {
                booking: {
                    select: {
                        id: true, code: true, status: true, totalAmount: true, userId: true,
                        property: { select: { title: true } },
                    },
                },
            },
        });
        if (!payment)
            throw (0, api_error_1.badRequest)("تراکنش یافت نشد");
        if (viewer && payment.booking.userId !== viewer.id && viewer.role !== "ADMIN")
            throw (0, api_error_1.badRequest)("دسترسی مجاز نیست");
        return payment;
    }
    /** Create a payment intent for a pending booking */
    async startPayment(user, bookingId) {
        const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
        if (!booking)
            throw (0, api_error_1.notFound)("رزرو یافت نشد");
        if (booking.userId !== user.id)
            throw (0, api_error_1.forbidden)();
        if (booking.status !== constants_1.BOOKING_STATUS.PENDING_PAYMENT)
            throw (0, api_error_1.badRequest)("این رزرو در وضعیت قابل پرداخت نیست");
        const gw = this.getGateway("MOCK_GATEWAY");
        const started = await gw.start(booking.id, booking.totalAmount, "/api/payments?x=callback");
        const payment = await this.prisma.payment.create({
            data: {
                bookingId: booking.id,
                amount: booking.totalAmount,
                status: "PENDING",
                gateway: gw.key,
                authority: started.authority,
            },
        });
        await this.auditSrv.audit({
            actorId: user.id, action: "PAYMENT_START", entity: "Payment", entityId: payment.id,
            meta: { amount: booking.totalAmount },
        });
        return { paymentId: payment.id, authority: started.authority, redirectUrl: started.redirectUrl, amount: booking.totalAmount };
    }
    /** Gateway callback (mock page → server). Server-side verification only. */
    async settlePayment(authority, result, user) {
        const payment = await this.prisma.payment.findUnique({
            where: { authority },
            include: { booking: { include: { property: true } } },
        });
        if (!payment)
            throw (0, api_error_1.notFound)("تراکنش یافت نشد");
        if (payment.status === "PAID")
            return { payment, booking: payment.booking, alreadyPaid: true };
        const gw = this.getGateway(payment.gateway);
        if (result === "fail") {
            const updated = await this.prisma.payment.update({
                where: { id: payment.id },
                data: { status: "FAILED", failureReason: "انصراف کاربر از پرداخت" },
            });
            await this.auditSrv.audit({
                actorId: user?.id, action: "PAYMENT_FAIL", entity: "Payment", entityId: payment.id,
            });
            return { payment: updated, booking: payment.booking, alreadyPaid: false };
        }
        const verified = await gw.verify(authority);
        if (!verified.ok) {
            const updated = await this.prisma.payment.update({
                where: { id: payment.id },
                data: { status: "FAILED", failureReason: verified.reason ?? "تأیید درگاه ناموفق بود" },
            });
            return { payment: updated, booking: payment.booking, alreadyPaid: false };
        }
        // Idempotency: only settle once
        const updated = await this.prisma.$transaction(async (tx) => {
            const p = await tx.payment.update({
                where: { id: payment.id },
                data: { status: "PAID", refId: verified.refId, cardMask: verified.cardMask, paidAt: new Date() },
            });
            const nextStatus = payment.booking.property.instantBooking
                ? constants_1.BOOKING_STATUS.CONFIRMED
                : constants_1.BOOKING_STATUS.PENDING_APPROVAL;
            const b = await tx.booking.update({
                where: { id: payment.bookingId },
                data: { status: nextStatus },
            });
            await tx.bookingEvent.create({
                data: {
                    bookingId: b.id,
                    type: "STATUS_CHANGED",
                    fromStatus: constants_1.BOOKING_STATUS.PENDING_PAYMENT,
                    toStatus: nextStatus,
                    actorId: user?.id,
                },
            });
            return { payment: p, booking: b };
        });
        await this.notifySrv.notify(payment.booking.property.hostId, "PAYMENT", "پرداخت موفق", `پرداخت رزرو ${payment.booking.code} با موفقیت انجام شد.`, "/host/bookings");
        await this.notifySrv.notify(payment.booking.userId, "PAYMENT", "پرداخت موفق", `پرداخت شما برای رزرو ${payment.booking.code} ثبت شد.`, "/account?tab=bookings");
        await this.auditSrv.audit({
            actorId: user?.id, action: "PAYMENT_SUCCESS", entity: "Payment", entityId: payment.id,
            meta: { refId: verified.refId, amount: payment.amount },
        });
        return { ...updated, alreadyPaid: false };
    }
    /** Admin refund workflow */
    async createRefund(admin, paymentId, amount, reason, autoDone = true) {
        if (admin.role !== "ADMIN")
            throw (0, api_error_1.forbidden)();
        const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
        if (!payment)
            throw (0, api_error_1.notFound)("تراکنش یافت نشد");
        if (payment.status !== "PAID" && payment.status !== "REFUNDED")
            throw (0, api_error_1.badRequest)("فقط تراکنش‌های موفق قابل بازگشت هستند");
        const refundAmount = Math.min(amount, payment.amount);
        const refund = await this.prisma.refund.create({
            data: {
                paymentId,
                bookingId: payment.bookingId,
                amount: refundAmount,
                reason,
                status: autoDone ? "DONE" : "PENDING",
                processedAt: autoDone ? new Date() : null,
            },
        });
        await this.prisma.payment.update({ where: { id: paymentId }, data: { status: "REFUNDED" } });
        await this.auditSrv.audit({
            actorId: admin.id, action: "REFUND_CREATE", entity: "Refund", entityId: refund.id,
            meta: { amount: refundAmount, reason },
        });
        return refund;
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        notifications_service_1.NotificationsService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map