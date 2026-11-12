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
exports.BookingsService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../../prisma/prisma.service");
const api_error_1 = require("../../common/api-error");
const constants_1 = require("../../common/constants");
const audit_service_1 = require("../../common/services/audit.service");
const notifications_service_1 = require("../../common/services/notifications.service");
const settings_service_1 = require("../../common/services/settings.service");
const dates_util_1 = require("../../common/dates.util");
let BookingsService = class BookingsService {
    prisma;
    auditSrv;
    settings;
    notifySrv;
    constructor(prisma, auditSrv, settings, notifySrv) {
        this.prisma = prisma;
        this.auditSrv = auditSrv;
        this.settings = settings;
        this.notifySrv = notifySrv;
    }
    async quoteStay(propertyId, checkIn, checkOut, couponCode) {
        const prop = await this.prisma.property.findUnique({
            where: { id: propertyId },
            include: { city: { include: { province: true } } },
        });
        if (!prop)
            throw (0, api_error_1.notFound)("اقامتگاه یافت نشد");
        const nights = (0, dates_util_1.nightsOf)(checkIn, checkOut);
        if (!nights.length)
            throw (0, api_error_1.badRequest)("بازه تاریخ نامعتبر است");
        if (nights.length < prop.minNights)
            throw (0, api_error_1.badRequest)(`حداقل مدت اقامت در این اقامتگاه ${prop.minNights} شب است`);
        const days = await this.prisma.calendarDay.findMany({
            where: { propertyId, date: { in: nights } },
        });
        const dayMap = new Map(days.map((d) => [d.date, d]));
        const nightly = nights.map((date) => {
            const custom = dayMap.get(date);
            const price = custom?.price ?? ((0, dates_util_1.isWeekend)(date) ? prop.weekendPrice : prop.basePrice);
            return { date, price, isWeekend: (0, dates_util_1.isWeekend)(date), custom: custom?.price != null };
        });
        const baseAmount = nightly.reduce((s, n) => s + n.price, 0);
        const cleaningFee = prop.cleaningFee;
        let discountAmount = 0;
        if (couponCode) {
            const res = await this.validateCoupon(couponCode, baseAmount + cleaningFee);
            discountAmount = res.discountAmount;
        }
        const totalAmount = Math.max(0, baseAmount + cleaningFee - discountAmount);
        const commissionRate = await this.settings.getSettingNumber("commission.rate", 0.12);
        const commissionAmount = Math.round(totalAmount * commissionRate);
        return {
            nights: nightly.length,
            nightly,
            baseAmount,
            cleaningFee,
            discountAmount,
            totalAmount,
            commissionRate,
            commissionAmount,
            hostPayout: totalAmount - commissionAmount,
        };
    }
    // ───────────────────────── Coupon validation ─────────────────────────
    async validateCoupon(code, amount) {
        const coupon = await this.prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
        if (!coupon || !coupon.isActive)
            throw (0, api_error_1.badRequest)("کد تخفیف نامعتبر است");
        const now = new Date();
        if (now < coupon.validFrom || now > coupon.validTo)
            throw (0, api_error_1.badRequest)("کد تخفیف منقضی شده است");
        if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit)
            throw (0, api_error_1.badRequest)("ظرفیت استفاده از این کد تکمیل شده است");
        if (coupon.minAmount && amount < coupon.minAmount)
            throw (0, api_error_1.badRequest)(`حداقل مبلغ سفارش برای این کد ${coupon.minAmount.toLocaleString("fa-IR")} تومان است`);
        let discount = coupon.type === "PERCENT" ? Math.round((amount * coupon.value) / 100) : coupon.value;
        if (coupon.maxDiscount)
            discount = Math.min(discount, coupon.maxDiscount);
        discount = Math.min(discount, amount);
        return { couponId: coupon.id, discountAmount: discount, title: coupon.title };
    }
    // ───────────────────────── Availability check ─────────────────────────
    /** Hard server-side guard against double booking (frontend checks are cosmetic only). */
    async assertAvailable(propertyId, checkIn, checkOut, tx) {
        const blocked = await tx.calendarDay.findFirst({
            where: { propertyId, date: { gte: checkIn, lt: checkOut }, isBlocked: true },
        });
        if (blocked)
            throw (0, api_error_1.badRequest)("برخی از شب‌های انتخابی شما توسط میزبان مسدود شده است");
        const conflict = await tx.booking.findFirst({
            where: {
                propertyId,
                status: { in: constants_1.ACTIVE_STATUSES },
                checkIn: { lt: checkOut },
                checkOut: { gt: checkIn },
            },
        });
        if (conflict)
            throw (0, api_error_1.badRequest)("این بازه متأسفانه همین الان رزرو شد. لطفاً تاریخ دیگری انتخاب کنید.");
    }
    // ───────────────────────── Create booking ─────────────────────────
    async createBooking(user, input) {
        if (!(0, dates_util_1.isValidDateStr)(input.checkIn) || !(0, dates_util_1.isValidDateStr)(input.checkOut))
            throw (0, api_error_1.badRequest)("تاریخ ورود یا خروج نامعتبر است");
        if (input.checkIn < (0, dates_util_1.todayStr)())
            throw (0, api_error_1.badRequest)("تاریخ ورود نمی‌تواند در گذشته باشد");
        if (input.checkOut <= input.checkIn)
            throw (0, api_error_1.badRequest)("تاریخ خروج باید بعد از تاریخ ورود باشد");
        const prop = await this.prisma.property.findUnique({ where: { id: input.propertyId } });
        if (!prop || prop.status !== "PUBLISHED")
            throw (0, api_error_1.notFound)("این اقامتگاه در حال حاضر قابل رزرو نیست");
        if (prop.hostId === user.id)
            throw (0, api_error_1.badRequest)("رزرو اقامتگاه خودتان امکان‌پذیر نیست");
        const guests = (input.adults || 0) + (input.children || 0);
        if (guests < 1)
            throw (0, api_error_1.badRequest)("تعداد مهمان را مشخص کنید");
        if (guests > prop.capacity)
            throw (0, api_error_1.badRequest)(`ظرفیت این اقامتگاه حداکثر ${prop.capacity} نفر است`);
        const holdMinutes = await this.settings.getSettingNumber("booking.holdMinutes", 30);
        const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000);
        const created = await this.prisma.$transaction(async (tx) => {
            await this.assertAvailable(input.propertyId, input.checkIn, input.checkOut, tx);
            const q = await this.quoteStay(input.propertyId, input.checkIn, input.checkOut, input.couponCode);
            const code = "VLS-" + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 90 + 10);
            const booking = await tx.booking.create({
                data: {
                    code,
                    propertyId: input.propertyId,
                    userId: user.id,
                    checkIn: input.checkIn,
                    checkOut: input.checkOut,
                    nights: q.nights,
                    adults: input.adults,
                    children: input.children,
                    guestName: input.guestName || user.fullName || "مهمان",
                    guestPhone: input.guestPhone || user.phone,
                    note: input.note,
                    baseAmount: q.baseAmount,
                    cleaningFee: q.cleaningFee,
                    discountAmount: q.discountAmount,
                    totalAmount: q.totalAmount,
                    commissionRate: q.commissionRate,
                    commissionAmount: q.commissionAmount,
                    hostPayout: q.hostPayout,
                    status: constants_1.BOOKING_STATUS.PENDING_PAYMENT,
                    expiresAt,
                },
            });
            if (input.couponCode && q.discountAmount > 0) {
                const coupon = await tx.coupon.findUnique({
                    where: { code: input.couponCode.trim().toUpperCase() },
                });
                if (coupon) {
                    await tx.booking.update({ where: { id: booking.id }, data: { couponId: coupon.id } });
                    await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
                    await tx.couponUsage.create({ data: { couponId: coupon.id, userId: user.id, bookingId: booking.id } });
                }
            }
            await tx.bookingEvent.create({
                data: {
                    bookingId: booking.id,
                    type: "CREATED",
                    toStatus: constants_1.BOOKING_STATUS.PENDING_PAYMENT,
                    actorId: user.id,
                },
            });
            return booking;
        });
        await this.auditSrv.audit({
            actorId: user.id, action: "BOOKING_CREATE", entity: "Booking", entityId: created.id, meta: { code: created.code },
        });
        await this.notifySrv.notify(prop.hostId, "BOOKING", "درخواست رزرو جدید", `رزرو ${created.code} برای «${prop.title}» ثبت شد و در انتظار پرداخت است.`, "/host/bookings");
        return created;
    }
    // ───────────────────────── Background sweeper ─────────────────────────
    /**
     * Idempotent lifecycle sweeper:
     *  1) Expire payment holds (PENDING_PAYMENT past expiresAt)
     *  2) Auto-complete confirmed stays whose checkOut has passed
     * Runs via @nestjs/schedule every 60s here (cron in the target architecture).
     */
    async expireStaleHolds() {
        const expired = await this.prisma.booking.updateMany({
            where: { status: constants_1.BOOKING_STATUS.PENDING_PAYMENT, expiresAt: { lt: new Date() } },
            data: { status: constants_1.BOOKING_STATUS.EXPIRED },
        });
        const today = (0, dates_util_1.todayStr)();
        const staleConfirmed = await this.prisma.booking.findMany({
            where: { status: constants_1.BOOKING_STATUS.CONFIRMED, checkOut: { lt: today } },
            select: { id: true, userId: true, propertyId: true, code: true },
            take: 50,
        });
        for (const b of staleConfirmed) {
            await this.prisma.booking.update({ where: { id: b.id }, data: { status: constants_1.BOOKING_STATUS.COMPLETED } });
            await this.prisma.bookingEvent.create({
                data: {
                    bookingId: b.id,
                    type: "STATUS_CHANGED",
                    fromStatus: constants_1.BOOKING_STATUS.CONFIRMED,
                    toStatus: constants_1.BOOKING_STATUS.COMPLETED,
                },
            });
            await this.notifySrv.notify(b.userId, "BOOKING", "اقامت شما تکمیل شد", `رزرو ${b.code} تکمیل شد؛ تجربه‌تان را با ثبت نظر به اشتراک بگذارید.`, "/account?tab=bookings");
        }
        return expired.count + staleConfirmed.length;
    }
    async sweep() {
        try {
            await this.expireStaleHolds();
        }
        catch (e) {
            console.error("[SWEEP_FAILED]", e);
        }
    }
    // ───────────────────────── Lifecycle actions ─────────────────────────
    async loadBookingFor(id, user) {
        const booking = await this.prisma.booking.findUnique({ where: { id }, include: { property: true } });
        if (!booking)
            throw (0, api_error_1.notFound)("رزرو یافت نشد");
        const isOwner = booking.userId === user.id;
        const isHost = booking.property.hostId === user.id;
        const isAdmin = user.role === "ADMIN";
        if (!isOwner && !isHost && !isAdmin)
            throw (0, api_error_1.forbidden)();
        return { booking, isOwner, isHost, isAdmin };
    }
    async addEvent(bookingId, type, fromStatus, toStatus, actorId, message) {
        await this.prisma.bookingEvent.create({
            data: { bookingId, type, fromStatus, toStatus, actorId, message },
        });
    }
    async approveBooking(user, id) {
        const { booking, isHost, isAdmin } = await this.loadBookingFor(id, user);
        if (!isHost && !isAdmin)
            throw (0, api_error_1.forbidden)("فقط میزبان می‌تواند رزرو را تأیید کند");
        if (booking.status !== constants_1.BOOKING_STATUS.PENDING_APPROVAL)
            throw (0, api_error_1.badRequest)("این رزرو در وضعیت قابل تأیید نیست");
        const updated = await this.prisma.booking.update({
            where: { id },
            data: { status: constants_1.BOOKING_STATUS.CONFIRMED },
        });
        await this.addEvent(id, "STATUS_CHANGED", booking.status, constants_1.BOOKING_STATUS.CONFIRMED, user.id);
        await this.notifySrv.notify(booking.userId, "BOOKING", "رزرو شما تأیید شد", `رزرو ${booking.code} توسط میزبان تأیید شد.`, "/account?tab=bookings");
        await this.auditSrv.audit({ actorId: user.id, action: "BOOKING_APPROVE", entity: "Booking", entityId: id });
        return updated;
    }
    async rejectBooking(user, id, reason) {
        const { booking, isHost, isAdmin } = await this.loadBookingFor(id, user);
        if (!isHost && !isAdmin)
            throw (0, api_error_1.forbidden)("فقط میزبان می‌تواند رزرو را رد کند");
        if (booking.status !== constants_1.BOOKING_STATUS.PENDING_APPROVAL)
            throw (0, api_error_1.badRequest)("این رزرو در وضعیت قابل رد نیست");
        const updated = await this.prisma.booking.update({
            where: { id },
            data: { status: constants_1.BOOKING_STATUS.REJECTED, cancelReason: reason, cancelledAt: new Date() },
        });
        await this.addEvent(id, "STATUS_CHANGED", booking.status, constants_1.BOOKING_STATUS.REJECTED, user.id, reason);
        await this.notifySrv.notify(booking.userId, "BOOKING", "رزرو شما رد شد", `رزرو ${booking.code} توسط میزبان رد شد. مبلغ پرداختی بازگشت داده می‌شود.`, "/account?tab=bookings");
        await this.auditSrv.audit({
            actorId: user.id, action: "BOOKING_REJECT", entity: "Booking", entityId: id, meta: { reason },
        });
        return updated;
    }
    async cancelBooking(user, id, reason) {
        const { booking, isOwner, isHost } = await this.loadBookingFor(id, user);
        if (!isOwner && !isHost)
            throw (0, api_error_1.forbidden)();
        const cancellable = [constants_1.BOOKING_STATUS.PENDING_PAYMENT, constants_1.BOOKING_STATUS.PENDING_APPROVAL, constants_1.BOOKING_STATUS.CONFIRMED];
        if (!cancellable.includes(booking.status))
            throw (0, api_error_1.badRequest)("این رزرو در وضعیت فعلی قابل لغو نیست");
        const policy = booking.property.cancelPolicy;
        const daysToCheckIn = (0, dates_util_1.diffDays)((0, dates_util_1.todayStr)(), booking.checkIn);
        const tiers = await this.settings.getCancelPolicy(policy);
        // first tier whose untilDays >= daysToCheckIn → percent
        let penaltyPercent = 0;
        for (const t of tiers) {
            if (daysToCheckIn >= t.untilDays) {
                penaltyPercent = t.percent;
                break;
            }
        }
        const penalty = booking.status === constants_1.BOOKING_STATUS.CONFIRMED
            ? Math.round((booking.totalAmount * penaltyPercent) / 100)
            : 0; // unpaid/pending-approval cancellations carry no charge
        const updated = await this.prisma.booking.update({
            where: { id },
            data: {
                status: constants_1.BOOKING_STATUS.CANCELLED,
                cancelledAt: new Date(),
                cancelReason: reason ?? null,
                penaltyAmount: penalty,
            },
        });
        await this.addEvent(id, "STATUS_CHANGED", booking.status, constants_1.BOOKING_STATUS.CANCELLED, user.id, `${reason ?? ""} | جریمه: ${penalty}%`.trim());
        // If a payment exists and it was CONFIRMED → request refund of (total - penalty)
        if (penalty < booking.totalAmount && booking.status === constants_1.BOOKING_STATUS.CONFIRMED) {
            const paid = await this.prisma.payment.findFirst({ where: { bookingId: id, status: "PAID" } });
            if (paid) {
                await this.prisma.refund.create({
                    data: {
                        paymentId: paid.id,
                        bookingId: id,
                        amount: booking.totalAmount - penalty,
                        reason: `لغو رزرو ${booking.code} (جریمه ${penaltyPercent}٪)`,
                    },
                });
                await this.prisma.payment.update({ where: { id: paid.id }, data: { status: "REFUNDED" } });
            }
        }
        await this.notifySrv.notify(booking.property.hostId, "BOOKING", "رزرو لغو شد", `رزرو ${booking.code} ${isOwner ? "توسط مهمان" : "توسط میزبان"} لغو شد.`, "/host/bookings");
        await this.notifySrv.notify(booking.userId, "BOOKING", "رزرو لغو شد", `رزرو ${booking.code} لغو شد.`, "/account?tab=bookings");
        await this.auditSrv.audit({
            actorId: user.id, action: "BOOKING_CANCEL", entity: "Booking", entityId: id, meta: { penaltyPercent, penalty },
        });
        return updated;
    }
    /** Host/admin marks a past confirmed stay as completed (auto-sweeper also exists) */
    async completeBooking(user, id) {
        const { booking } = await this.loadBookingFor(id, user);
        if (booking.status !== constants_1.BOOKING_STATUS.CONFIRMED)
            throw (0, api_error_1.badRequest)("فقط رزروهای تأییدشده تکمیل می‌شوند");
        if (booking.checkOut > (0, dates_util_1.todayStr)())
            throw (0, api_error_1.badRequest)("تاریخ خروج هنوز نرسیده است");
        const updated = await this.prisma.booking.update({
            where: { id },
            data: { status: constants_1.BOOKING_STATUS.COMPLETED },
        });
        await this.addEvent(id, "STATUS_CHANGED", booking.status, constants_1.BOOKING_STATUS.COMPLETED, user.id);
        await this.notifySrv.notify(booking.userId, "BOOKING", "اقامت شما تکمیل شد", "تجربه‌تان از این اقامتگاه را با ثبت نظر به اشتراک بگذارید.", "/account?tab=bookings");
        return updated;
    }
    // ───────────────────────── Lists & tracking ─────────────────────────
    async myBookings(user, tab) {
        await this.expireStaleHolds();
        const where = tab === "UPCOMING"
            ? {
                userId: user.id,
                status: { in: [constants_1.BOOKING_STATUS.PENDING_PAYMENT, constants_1.BOOKING_STATUS.PENDING_APPROVAL, constants_1.BOOKING_STATUS.CONFIRMED] },
                checkOut: { gte: (0, dates_util_1.todayStr)() },
            }
            : tab === "PAST"
                ? {
                    userId: user.id,
                    status: { in: [constants_1.BOOKING_STATUS.COMPLETED, constants_1.BOOKING_STATUS.CANCELLED, constants_1.BOOKING_STATUS.REJECTED, constants_1.BOOKING_STATUS.EXPIRED] },
                }
                : { userId: user.id };
        return this.prisma.booking.findMany({
            where,
            include: {
                property: { include: { city: true, images: { orderBy: { sort: "asc" }, take: 1 } } },
                payments: true,
                review: { select: { id: true } },
            },
            orderBy: { createdAt: "desc" },
        });
    }
    async hostBookings(user, status) {
        await this.expireStaleHolds();
        const props = await this.prisma.property.findMany({ where: { hostId: user.id }, select: { id: true } });
        return this.prisma.booking.findMany({
            where: {
                propertyId: { in: props.map((p) => p.id) },
                ...(status && status !== "ALL" ? { status } : {}),
            },
            include: {
                property: { select: { title: true } },
                user: { select: { fullName: true, phone: true } },
                payments: true,
            },
            orderBy: { createdAt: "desc" },
        });
    }
    async trackByCode(code) {
        await this.expireStaleHolds();
        const booking = await this.prisma.booking.findUnique({
            where: { code: code.trim().toUpperCase() },
            include: {
                property: { select: { title: true, city: { select: { name: true } } } },
                events: { orderBy: { createdAt: "asc" } },
                payments: { select: { status: true, amount: true, refId: true, createdAt: true } },
            },
        });
        if (!booking)
            throw (0, api_error_1.notFound)("رزروی با این کد یافت نشد");
        return booking;
    }
    async findOwnedBooking(id, user) {
        const booking = await this.prisma.booking.findUnique({
            where: { id },
            include: {
                property: { include: { city: true, images: { orderBy: { sort: "asc" }, take: 1 } } },
                events: { orderBy: { createdAt: "asc" } },
                payments: true,
                user: { select: { fullName: true, phone: true } },
            },
        });
        if (!booking)
            throw (0, api_error_1.badRequest)("رزرو یافت نشد");
        const isAllowed = booking.userId === user.id || booking.property.hostId === user.id || user.role === "ADMIN";
        if (!isAllowed)
            throw (0, api_error_1.badRequest)("دسترسی مجاز نیست");
        return booking;
    }
};
exports.BookingsService = BookingsService;
__decorate([
    (0, schedule_1.Interval)(60_000),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BookingsService.prototype, "sweep", null);
exports.BookingsService = BookingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        settings_service_1.SettingsService,
        notifications_service_1.NotificationsService])
], BookingsService);
//# sourceMappingURL=bookings.service.js.map