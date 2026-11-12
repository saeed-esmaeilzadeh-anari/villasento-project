import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { BOOKING_STATUS } from "../../common/constants";
import { PROPERTY_TYPES } from "../../common/constants";
import { addDays, diffDays, todayStr } from "../../common/dates.util";
import type { SafeUser } from "../../common/session.middleware";

@Injectable()
export class HostService {
  constructor(private prisma: PrismaService) {}

  async hostDashboard(user: SafeUser) {
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
        where: { propertyId: { in: propIds }, status: BOOKING_STATUS.PENDING_APPROVAL },
      }),
      this.prisma.booking.count({
        where: { propertyId: { in: propIds }, status: BOOKING_STATUS.CONFIRMED },
      }),
      this.prisma.booking.aggregate({
        where: {
          propertyId: { in: propIds },
          status: { in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED] },
          createdAt: { gte: monthStart },
        },
        _sum: { totalAmount: true, hostPayout: true, commissionAmount: true },
        _count: true,
      }),
      this.prisma.booking.findMany({
        where: {
          propertyId: { in: propIds },
          status: { in: [BOOKING_STATUS.PENDING_APPROVAL, BOOKING_STATUS.CONFIRMED] },
          checkOut: { gte: todayStr() },
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
          status: { in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED] },
        },
        select: { checkIn: true, totalAmount: true, hostPayout: true },
      }),
    ]);

    const monthlyMap = new Map<string, { ym: string; total: number; payout: number; cnt: number }>();
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
          status: { in: [BOOKING_STATUS.CONFIRMED] },
          checkOut: { gte: todayStr() },
          checkIn: { lte: addDays(todayStr(), 30) },
        },
        select: { checkIn: true, checkOut: true },
      });
      for (const b of bks) {
        const s = b.checkIn > todayStr() ? b.checkIn : todayStr();
        const e = b.checkOut < addDays(todayStr(), 30) ? b.checkOut : addDays(todayStr(), 30);
        if (e > s) bookedNights += diffDays(s, e);
      }
    }

    return {
      properties: props.map((p) => ({
        id: p.id, title: p.title, typeLabel: PROPERTY_TYPES[p.type] ?? p.type,
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

  async hostEarnings(user: SafeUser) {
    const props = await this.prisma.property.findMany({ where: { hostId: user.id }, select: { id: true } });
    const ids = props.map((p) => p.id);
    const agg = await this.prisma.booking.aggregate({
      where: { propertyId: { in: ids }, status: { in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED] } },
      _sum: { totalAmount: true, hostPayout: true, commissionAmount: true },
      _count: true,
    });
    const [payouts, settlements] = await Promise.all([
      this.prisma.payout.findMany({ where: { hostId: user.id }, orderBy: { createdAt: "desc" } }),
      this.prisma.booking.findMany({
        where: {
          property: { hostId: user.id },
          status: { in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED] },
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

  async hostReviews(user: SafeUser) {
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
}
