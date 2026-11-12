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
exports.HostService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const constants_1 = require("../../common/constants");
const constants_2 = require("../../common/constants");
const dates_util_1 = require("../../common/dates.util");
let HostService = class HostService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async hostDashboard(user) {
        const props = await this.prisma.property.findMany({
            where: { hostId: user.id },
            include: {
                city: true,
                images: { orderBy: { sort: "asc" }, take: 1 },
                _count: { select: { bookings: true, reviews: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        const propIds = props.map((p) => p.id);
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const [pending, confirmed, monthAgg, upcoming, recentReviews, monthlyRows] = await Promise.all([
            this.prisma.booking.count({
                where: { propertyId: { in: propIds }, status: constants_1.BOOKING_STATUS.PENDING_APPROVAL },
            }),
            this.prisma.booking.count({
                where: { propertyId: { in: propIds }, status: constants_1.BOOKING_STATUS.CONFIRMED },
            }),
            this.prisma.booking.aggregate({
                where: {
                    propertyId: { in: propIds },
                    status: { in: [constants_1.BOOKING_STATUS.CONFIRMED, constants_1.BOOKING_STATUS.COMPLETED] },
                    createdAt: { gte: monthStart },
                },
                _sum: { totalAmount: true, hostPayout: true, commissionAmount: true },
                _count: true,
            }),
            this.prisma.booking.findMany({
                where: {
                    propertyId: { in: propIds },
                    status: { in: [constants_1.BOOKING_STATUS.PENDING_APPROVAL, constants_1.BOOKING_STATUS.CONFIRMED] },
                    checkOut: { gte: (0, dates_util_1.todayStr)() },
                },
                include: { property: { select: { title: true } } },
                orderBy: { checkIn: "asc" },
                take: 6,
            }),
            this.prisma.review.findMany({
                where: { property: { hostId: user.id } },
                include: { property: { select: { title: true } }, user: { select: { fullName: true } } },
                orderBy: { createdAt: "desc" },
                take: 5,
            }),
            // last 6 months revenue (confirmed+completed) — computed in JS (SQLite-safe)
            this.prisma.booking.findMany({
                where: {
                    propertyId: { in: propIds },
                    status: { in: [constants_1.BOOKING_STATUS.CONFIRMED, constants_1.BOOKING_STATUS.COMPLETED] },
                },
                select: { checkIn: true, totalAmount: true, hostPayout: true },
            }),
        ]);
        const monthlyMap = new Map();
        for (const r of monthlyRows) {
            const ym = r.checkIn.slice(0, 7);
            const cur = monthlyMap.get(ym) ?? { ym, total: 0, payout: 0, cnt: 0 };
            cur.total += r.totalAmount;
            cur.payout += r.hostPayout;
            cur.cnt += 1;
            monthlyMap.set(ym, cur);
        }
        const monthly = [...monthlyMap.values()]
            .sort((a, b) => b.ym.localeCompare(a.ym, "en"))
            .slice(0, 6)
            .reverse();
        // occupancy next 30 days
        let bookedNights = 0;
        if (propIds.length) {
            const bks = await this.prisma.booking.findMany({
                where: {
                    propertyId: { in: propIds },
                    status: { in: [constants_1.BOOKING_STATUS.CONFIRMED] },
                    checkOut: { gte: (0, dates_util_1.todayStr)() },
                    checkIn: { lte: (0, dates_util_1.addDays)((0, dates_util_1.todayStr)(), 30) },
                },
                select: { checkIn: true, checkOut: true },
            });
            for (const b of bks) {
                const s = b.checkIn > (0, dates_util_1.todayStr)() ? b.checkIn : (0, dates_util_1.todayStr)();
                const e = b.checkOut < (0, dates_util_1.addDays)((0, dates_util_1.todayStr)(), 30) ? b.checkOut : (0, dates_util_1.addDays)((0, dates_util_1.todayStr)(), 30);
                if (e > s)
                    bookedNights += (0, dates_util_1.diffDays)(s, e);
            }
        }
        return {
            properties: props.map((p) => ({
                id: p.id, title: p.title, typeLabel: constants_2.PROPERTY_TYPES[p.type] ?? p.type,
                city: p.city.name, status: p.status, basePrice: p.basePrice,
                image: p.images[0]?.url ?? null,
                rating: p.ratingAvg, reviewCount: p._count.reviews,
            })),
            stats: {
                propertiesTotal: props.length,
                published: props.filter((p) => p.status === "PUBLISHED").length,
                pendingApprovals: pending,
                confirmedBookings: confirmed,
                monthBookings: monthAgg._count,
                monthRevenue: monthAgg._sum.totalAmount ?? 0,
                monthPayout: monthAgg._sum.hostPayout ?? 0,
                occupancyNext30: propIds.length
                    ? Math.min(100, Math.round((bookedNights / (propIds.length * 30)) * 100))
                    : 0,
            },
            upcoming,
            recentReviews: recentReviews.map((r) => ({
                id: r.id, rating: r.rating, comment: r.comment,
                propertyTitle: r.property.title, userName: r.user.fullName ?? "مهمان",
                createdAt: r.createdAt, hostReply: r.hostReply,
            })),
            monthly,
        };
    }
    async hostEarnings(user) {
        const props = await this.prisma.property.findMany({ where: { hostId: user.id }, select: { id: true } });
        const ids = props.map((p) => p.id);
        const agg = await this.prisma.booking.aggregate({
            where: { propertyId: { in: ids }, status: { in: [constants_1.BOOKING_STATUS.CONFIRMED, constants_1.BOOKING_STATUS.COMPLETED] } },
            _sum: { totalAmount: true, hostPayout: true, commissionAmount: true },
            _count: true,
        });
        const [payouts, settlements] = await Promise.all([
            this.prisma.payout.findMany({ where: { hostId: user.id }, orderBy: { createdAt: "desc" } }),
            this.prisma.booking.findMany({
                where: {
                    property: { hostId: user.id },
                    status: { in: [constants_1.BOOKING_STATUS.CONFIRMED, constants_1.BOOKING_STATUS.COMPLETED] },
                },
                include: { property: { select: { title: true } } },
                orderBy: { createdAt: "desc" },
                take: 50,
            }),
        ]);
        const paidOut = payouts.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0);
        return {
            totals: {
                gross: agg._sum.totalAmount ?? 0,
                net: agg._sum.hostPayout ?? 0,
                commission: agg._sum.commissionAmount ?? 0,
                bookings: agg._count,
                paidOut,
                pendingPayout: Math.max(0, (agg._sum.hostPayout ?? 0) - paidOut),
            },
            payouts,
            settlements: settlements.map((b) => ({
                id: b.id, code: b.code, propertyTitle: b.property.title,
                checkIn: b.checkIn, checkOut: b.checkOut,
                totalAmount: b.totalAmount, commissionAmount: b.commissionAmount,
                hostPayout: b.hostPayout, status: b.status, createdAt: b.createdAt,
            })),
        };
    }
    async hostReviews(user) {
        const list = await this.prisma.review.findMany({
            where: { property: { hostId: user.id } },
            include: { property: { select: { id: true, title: true } }, user: { select: { fullName: true } } },
            orderBy: { createdAt: "desc" },
        });
        return list.map((r) => ({
            id: r.id, rating: r.rating, cleanliness: r.cleanliness, accuracy: r.accuracy, location: r.location,
            comment: r.comment, hostReply: r.hostReply, status: r.status, createdAt: r.createdAt,
            property: r.property, userName: r.user.fullName ?? "مهمان",
        }));
    }
};
exports.HostService = HostService;
exports.HostService = HostService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], HostService);
//# sourceMappingURL=host.service.js.map