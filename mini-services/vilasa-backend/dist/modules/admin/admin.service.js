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
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const api_error_1 = require("../../common/api-error");
const user_util_1 = require("../../common/user.util");
const constants_1 = require("../../common/constants");
const audit_service_1 = require("../../common/services/audit.service");
const settings_service_1 = require("../../common/services/settings.service");
const dates_util_1 = require("../../common/dates.util");
let AdminService = class AdminService {
    prisma;
    auditSrv;
    settings;
    constructor(prisma, auditSrv, settings) {
        this.prisma = prisma;
        this.auditSrv = auditSrv;
        this.settings = settings;
    }
    // ───────── Overview KPIs ─────────
    async overview(user) {
        (0, user_util_1.adminGuard)(user);
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const [usersCount, hostsCount, propsPublished, propsPending, bookingsActive, bookingsMonth, gmvAgg, commissionAgg, pendingRefunds, openComplaints, unpaidPayouts, pendingReviews,] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.user.count({ where: { role: "HOST" } }),
            this.prisma.property.count({ where: { status: "PUBLISHED" } }),
            this.prisma.property.count({ where: { status: "PENDING" } }),
            this.prisma.booking.count({
                where: { status: { in: [constants_1.BOOKING_STATUS.PENDING_APPROVAL, constants_1.BOOKING_STATUS.CONFIRMED] } },
            }),
            this.prisma.booking.count({ where: { createdAt: { gte: monthStart } } }),
            this.prisma.booking.aggregate({
                where: { status: { in: [constants_1.BOOKING_STATUS.CONFIRMED, constants_1.BOOKING_STATUS.COMPLETED] } },
                _sum: { totalAmount: true },
            }),
            this.prisma.booking.aggregate({
                where: { status: { in: [constants_1.BOOKING_STATUS.CONFIRMED, constants_1.BOOKING_STATUS.COMPLETED] } },
                _sum: { commissionAmount: true },
            }),
            this.prisma.refund.count({ where: { status: "PENDING" } }),
            this.prisma.complaint.count({ where: { status: { not: "RESOLVED" } } }),
            this.prisma.payout.aggregate({ where: { status: "PENDING" }, _sum: { amount: true } }),
            this.prisma.review.count({ where: { status: "PENDING" } }),
        ]);
        return {
            kpis: {
                users: usersCount,
                hosts: hostsCount,
                propertiesPublished: propsPublished,
                propertiesPending: propsPending,
                bookingsActive,
                bookingsMonth,
                gmv: gmvAgg._sum.totalAmount ?? 0,
                commission: commissionAgg._sum.commissionAmount ?? 0,
                pendingRefunds,
                openComplaints,
                pendingPayouts: unpaidPayouts._sum.amount ?? 0,
                pendingReviews,
            },
        };
    }
    // ───────── Reports (charts) ─────────
    async reports(user, days = 30) {
        (0, user_util_1.adminGuard)(user);
        const from = (0, dates_util_1.addDays)((0, dates_util_1.todayStr)(), -days);
        const [payments, bookings, cityRows, typeRows] = await Promise.all([
            this.prisma.payment.findMany({
                where: { status: "PAID", paidAt: { gte: new Date(from) } },
                select: { amount: true, paidAt: true },
            }),
            this.prisma.booking.findMany({
                where: { createdAt: { gte: new Date(from) } },
                select: { createdAt: true, status: true, totalAmount: true, propertyId: true },
            }),
            this.prisma.$queryRaw `
        SELECT c.name as name, COUNT(b.id) as cnt, COALESCE(SUM(b.totalAmount),0) as total
        FROM Booking b JOIN Property p ON p.id = b.propertyId JOIN City c ON c.id = p.cityId
        WHERE b.status IN ('CONFIRMED','COMPLETED')
        GROUP BY c.name ORDER BY total DESC LIMIT 8
      `.catch(() => []),
            this.prisma.$queryRaw `
        SELECT p.type as type, COUNT(*) as cnt FROM Property p GROUP BY p.type
      `.catch(() => []),
        ]);
        // revenue series by day
        const series = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = (0, dates_util_1.addDays)((0, dates_util_1.todayStr)(), -i);
            series.push({ date: d, revenue: 0, bookings: 0 });
        }
        const idx = new Map(series.map((s, i) => [s.date, i]));
        for (const p of payments) {
            const k = p.paidAt ? new Date(p.paidAt).toISOString().slice(0, 10) : "";
            const i = idx.get(k);
            if (i != null)
                series[i].revenue += p.amount;
        }
        for (const b of bookings) {
            const k = new Date(b.createdAt).toISOString().slice(0, 10);
            const i = idx.get(k);
            if (i != null)
                series[i].bookings += 1;
        }
        const topProps = await this.prisma
            .$queryRaw `
        SELECT p.title as title, COUNT(b.id) as cnt, COALESCE(SUM(b.totalAmount),0) as total
        FROM Booking b JOIN Property p ON p.id = b.propertyId
        WHERE b.status IN ('CONFIRMED','COMPLETED')
        GROUP BY p.id ORDER BY total DESC LIMIT 8
      `
            .catch(() => []);
        return {
            series,
            topCities: cityRows.map((r) => ({ name: r.name, count: Number(r.cnt), total: Number(r.total) })),
            topProperties: topProps.map((r) => ({ name: r.title, count: Number(r.cnt), total: Number(r.total) })),
            typesDistribution: typeRows.map((r) => ({
                type: r.type, label: constants_1.PROPERTY_TYPES[r.type] ?? r.type, count: Number(r.cnt),
            })),
        };
    }
    // ───────── Users ─────────
    async listUsers(user, q, role) {
        (0, user_util_1.adminGuard)(user);
        const where = {};
        if (role && role !== "ALL")
            where.role = role;
        if (q)
            where.OR = [{ fullName: { contains: q } }, { phone: { contains: q } }];
        const users = await this.prisma.user.findMany({
            where,
            include: { _count: { select: { bookings: true, properties: true } } },
            orderBy: { createdAt: "desc" },
            take: 100,
        });
        return users.map((u) => ({
            id: u.id, phone: u.phone, fullName: u.fullName, email: u.email, role: u.role,
            isBlocked: u.isBlocked, isHostVerified: u.isHostVerified, createdAt: u.createdAt,
            bookingsCount: u._count.bookings, propertiesCount: u._count.properties,
        }));
    }
    async toggleUserBlock(user, id) {
        (0, user_util_1.adminGuard)(user);
        const target = await this.prisma.user.findUnique({ where: { id } });
        if (!target)
            throw (0, api_error_1.notFound)("کاربر یافت نشد");
        if (target.role === "ADMIN")
            throw (0, api_error_1.badRequest)("حساب مدیر قابل مسدودسازی نیست");
        const updated = await this.prisma.user.update({
            where: { id },
            data: { isBlocked: !target.isBlocked },
        });
        await this.auditSrv.audit({
            actorId: user.id, action: updated.isBlocked ? "USER_BLOCK" : "USER_UNBLOCK", entity: "User", entityId: id,
        });
        return { ok: true, isBlocked: updated.isBlocked };
    }
    async setUserRole(user, id, role) {
        (0, user_util_1.adminGuard)(user);
        if (!["CUSTOMER", "HOST", "ADMIN"].includes(role))
            throw (0, api_error_1.badRequest)("نقش نامعتبر است");
        await this.prisma.user.update({ where: { id }, data: { role } });
        await this.auditSrv.audit({
            actorId: user.id, action: "USER_ROLE_CHANGE", entity: "User", entityId: id, meta: { role },
        });
        return { ok: true };
    }
    // ───────── Property verification ─────────
    async adminProperties(user, status) {
        (0, user_util_1.adminGuard)(user);
        const props = await this.prisma.property.findMany({
            where: status && status !== "ALL" ? { status } : {},
            include: {
                host: { select: { fullName: true, phone: true, isHostVerified: true } },
                city: { include: { province: true } },
                images: { orderBy: { sort: "asc" }, take: 1 },
                _count: { select: { bookings: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 120,
        });
        return props.map((p) => ({
            id: p.id, title: p.title, type: p.type, typeLabel: constants_1.PROPERTY_TYPES[p.type] ?? p.type,
            status: p.status, city: p.city.name, province: p.city.province.name,
            host: p.host, basePrice: p.basePrice, capacity: p.capacity,
            image: p.images[0]?.url ?? null, bookingsCount: p._count.bookings,
            rejectionReason: p.rejectionReason, createdAt: p.createdAt,
            isFeatured: p.isFeatured,
        }));
    }
    async verifyProperty(user, id, action, reason) {
        (0, user_util_1.adminGuard)(user);
        const prop = await this.prisma.property.findUnique({ where: { id } });
        if (!prop)
            throw (0, api_error_1.notFound)("اقامتگاه یافت نشد");
        if (action === "APPROVE") {
            await this.prisma.property.update({
                where: { id },
                data: { status: "PUBLISHED", rejectionReason: null },
            });
            await this.prisma.user
                .update({ where: { id: prop.hostId }, data: { role: "HOST", isHostVerified: true } })
                .catch(() => undefined);
        }
        else {
            if (!reason?.trim())
                throw (0, api_error_1.badRequest)("دلیل رد را وارد کنید");
            await this.prisma.property.update({
                where: { id },
                data: { status: "REJECTED", rejectionReason: reason },
            });
        }
        await this.auditSrv.audit({
            actorId: user.id, action: `PROPERTY_${action}`, entity: "Property", entityId: id, meta: { reason },
        });
        return { ok: true };
    }
    async toggleFeatured(user, id) {
        (0, user_util_1.adminGuard)(user);
        const prop = await this.prisma.property.findUnique({ where: { id } });
        if (!prop)
            throw (0, api_error_1.notFound)();
        await this.prisma.property.update({ where: { id }, data: { isFeatured: !prop.isFeatured } });
        return { ok: true, isFeatured: !prop.isFeatured };
    }
    async suspendProperty(user, id) {
        (0, user_util_1.adminGuard)(user);
        const prop = await this.prisma.property.findUnique({ where: { id } });
        if (!prop)
            throw (0, api_error_1.notFound)();
        const next = prop.status === "SUSPENDED" ? "PUBLISHED" : "SUSPENDED";
        await this.prisma.property.update({ where: { id }, data: { status: next } });
        await this.auditSrv.audit({
            actorId: user.id, action: "PROPERTY_SUSPEND_TOGGLE", entity: "Property", entityId: id, meta: { next },
        });
        return { ok: true, status: next };
    }
    // ───────── Bookings / Payments ─────────
    async adminBookings(user, status, q) {
        (0, user_util_1.adminGuard)(user);
        const where = {};
        if (status && status !== "ALL")
            where.status = status;
        if (q)
            where.OR = [{ code: { contains: q } }, { guestName: { contains: q } }, { guestPhone: { contains: q } }];
        return this.prisma.booking.findMany({
            where,
            include: {
                property: { select: { title: true } },
                user: { select: { fullName: true, phone: true } },
                payments: true,
            },
            orderBy: { createdAt: "desc" },
            take: 150,
        });
    }
    async adminPayments(user) {
        (0, user_util_1.adminGuard)(user);
        return this.prisma.payment.findMany({
            include: {
                booking: {
                    select: {
                        code: true, status: true, totalAmount: true, guestName: true,
                        user: { select: { fullName: true, phone: true } },
                    },
                },
                refunds: true,
            },
            orderBy: { createdAt: "desc" },
            take: 150,
        });
    }
    async adminRefunds(user) {
        (0, user_util_1.adminGuard)(user);
        return this.prisma.refund.findMany({
            include: { payment: { include: { booking: { select: { code: true, guestName: true } } } } },
            orderBy: { createdAt: "desc" },
            take: 100,
        });
    }
    async processRefund(user, refundId) {
        (0, user_util_1.adminGuard)(user);
        const refund = await this.prisma.refund.findUnique({ where: { id: refundId } });
        if (!refund)
            throw (0, api_error_1.notFound)("بازگشت وجه یافت نشد");
        if (refund.status === "DONE")
            throw (0, api_error_1.badRequest)("این بازگشت قبلاً پردازش شده است");
        await this.prisma.refund.update({
            where: { id: refundId },
            data: { status: "DONE", processedAt: new Date() },
        });
        await this.auditSrv.audit({
            actorId: user.id, action: "REFUND_DONE", entity: "Refund", entityId: refundId, meta: { amount: refund.amount },
        });
        return { ok: true };
    }
    // ───────── Payouts ─────────
    async adminPayouts(user) {
        (0, user_util_1.adminGuard)(user);
        const payouts = await this.prisma.payout.findMany({
            include: { host: { select: { fullName: true, phone: true } } },
            orderBy: { createdAt: "desc" },
        });
        // Suggest payouts: confirmed/completed bookings not yet in a paid payout
        const hosts = await this.prisma.user.findMany({
            where: { role: { in: ["HOST", "ADMIN"] } },
            select: { id: true, fullName: true, phone: true },
        });
        const suggestions = [];
        for (const h of hosts) {
            const agg = await this.prisma.booking.aggregate({
                where: { property: { hostId: h.id }, status: { in: [constants_1.BOOKING_STATUS.COMPLETED] } },
                _sum: { hostPayout: true },
                _count: true,
            });
            const paid = await this.prisma.payout.aggregate({
                where: { hostId: h.id, status: "PAID" },
                _sum: { amount: true },
            });
            const due = (agg._sum.hostPayout ?? 0) - (paid._sum.amount ?? 0);
            if (due > 0)
                suggestions.push({ hostId: h.id, hostName: h.fullName ?? h.phone, phone: h.phone, amount: due, count: agg._count });
        }
        return { payouts, suggestions };
    }
    async createPayout(user, hostId, amount, periodLabel) {
        (0, user_util_1.adminGuard)(user);
        if (amount <= 0)
            throw (0, api_error_1.badRequest)("مبلغ نامعتبر است");
        const payout = await this.prisma.payout.create({
            data: { hostId, amount, periodLabel, itemsCount: 0 },
        });
        await this.auditSrv.audit({
            actorId: user.id, action: "PAYOUT_CREATE", entity: "Payout", entityId: payout.id, meta: { amount },
        });
        return payout;
    }
    async markPayoutPaid(user, id) {
        (0, user_util_1.adminGuard)(user);
        const payout = await this.prisma.payout.findUnique({ where: { id } });
        if (!payout)
            throw (0, api_error_1.notFound)();
        if (payout.status === "PAID")
            throw (0, api_error_1.badRequest)("این تسویه قبلاً پرداخت شده است");
        await this.prisma.payout.update({ where: { id }, data: { status: "PAID", paidAt: new Date() } });
        await this.auditSrv.audit({
            actorId: user.id, action: "PAYOUT_PAID", entity: "Payout", entityId: id, meta: { amount: payout.amount },
        });
        return { ok: true };
    }
    // ───────── Coupons ─────────
    async adminCoupons(user) {
        (0, user_util_1.adminGuard)(user);
        return this.prisma.coupon.findMany({
            orderBy: { createdAt: "desc" },
            include: { _count: { select: { usages: true } } },
        });
    }
    async upsertCoupon(user, data) {
        (0, user_util_1.adminGuard)(user);
        const code = data.code.trim().toUpperCase();
        const payload = {
            code, title: data.title, type: data.type, value: data.value,
            maxDiscount: data.maxDiscount, minAmount: data.minAmount, usageLimit: data.usageLimit,
            validTo: new Date(data.validTo), isActive: data.isActive ?? true,
        };
        if (data.id) {
            await this.prisma.coupon.update({ where: { id: data.id }, data: payload });
        }
        else {
            const exists = await this.prisma.coupon.findUnique({ where: { code } });
            if (exists)
                throw (0, api_error_1.badRequest)("این کد قبلاً ثبت شده است");
            await this.prisma.coupon.create({ data: payload });
        }
        await this.auditSrv.audit({
            actorId: user.id, action: data.id ? "COUPON_UPDATE" : "COUPON_CREATE", entity: "Coupon", meta: { code },
        });
        return { ok: true };
    }
    async deleteCoupon(user, id) {
        (0, user_util_1.adminGuard)(user);
        const used = await this.prisma.couponUsage.count({ where: { couponId: id } });
        if (used > 0) {
            await this.prisma.coupon.update({ where: { id }, data: { isActive: false } });
            return { ok: true, deactivated: true };
        }
        await this.prisma.coupon.delete({ where: { id } });
        return { ok: true, deactivated: false };
    }
    // ───────── Complaints ─────────
    async adminComplaints(user) {
        (0, user_util_1.adminGuard)(user);
        return this.prisma.complaint.findMany({
            include: { user: { select: { fullName: true, phone: true } }, booking: { select: { code: true } } },
            orderBy: { createdAt: "desc" },
        });
    }
    async replyComplaint(user, id, reply, status) {
        (0, user_util_1.adminGuard)(user);
        await this.prisma.complaint.update({ where: { id }, data: { adminReply: reply, status } });
        await this.auditSrv.audit({ actorId: user.id, action: "COMPLAINT_REPLY", entity: "Complaint", entityId: id });
        return { ok: true };
    }
    // ───────── Reviews moderation ─────────
    async adminReviews(user, status) {
        (0, user_util_1.adminGuard)(user);
        return this.prisma.review.findMany({
            where: status && status !== "ALL" ? { status } : {},
            include: { property: { select: { title: true } }, user: { select: { fullName: true, phone: true } } },
            orderBy: { createdAt: "desc" },
            take: 100,
        });
    }
    async moderateReview(user, id, status) {
        (0, user_util_1.adminGuard)(user);
        const review = await this.prisma.review.findUnique({ where: { id } });
        if (!review)
            throw (0, api_error_1.notFound)();
        await this.prisma.review.update({ where: { id }, data: { status } });
        const agg = await this.prisma.review.aggregate({
            where: { propertyId: review.propertyId, status: "APPROVED" },
            _avg: { rating: true },
            _count: true,
        });
        await this.prisma.property.update({
            where: { id: review.propertyId },
            data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, reviewCount: agg._count },
        });
        await this.auditSrv.audit({
            actorId: user.id, action: "REVIEW_MODERATE", entity: "Review", entityId: id, meta: { status },
        });
        return { ok: true };
    }
    // ───────── Settings & Audit ─────────
    async getSettings(user) {
        (0, user_util_1.adminGuard)(user);
        return this.settings.getAllSettings();
    }
    async updateSettings(user, values) {
        (0, user_util_1.adminGuard)(user);
        for (const [k, v] of Object.entries(values)) {
            if (k in settings_service_1.SETTING_DEFAULTS || k.startsWith("cancelPolicy."))
                await this.settings.setSetting(k, String(v));
        }
        await this.auditSrv.audit({
            actorId: user.id, action: "SETTINGS_UPDATE", entity: "SystemSetting", meta: values,
        });
        return this.settings.getAllSettings();
    }
    async getAuditLogs(user) {
        (0, user_util_1.adminGuard)(user);
        return this.prisma.auditLog.findMany({
            include: { actor: { select: { fullName: true, phone: true } } },
            orderBy: { createdAt: "desc" },
            take: 200,
        });
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        settings_service_1.SettingsService])
], AdminService);
//# sourceMappingURL=admin.service.js.map