import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { badRequest, notFound } from "../../common/api-error";
import { adminGuard } from "../../common/user.util";
import { BOOKING_STATUS, PROPERTY_TYPES } from "../../common/constants";
import { AuditService } from "../../common/services/audit.service";
import { SettingsService, SETTING_DEFAULTS } from "../../common/services/settings.service";
import { addDays, todayStr } from "../../common/dates.util";
import type { SafeUser } from "../../common/session.middleware";

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private auditSrv: AuditService,
    private settings: SettingsService,
  ) {}

  // ───────── Overview KPIs ─────────
  async overview(user: SafeUser) {
    adminGuard(user);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      usersCount, hostsCount, propsPublished, propsPending,
      bookingsActive, bookingsMonth, gmvAgg, commissionAgg,
      pendingRefunds, openComplaints, unpaidPayouts, pendingReviews,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: "HOST" } }),
      this.prisma.property.count({ where: { status: "PUBLISHED" } }),
      this.prisma.property.count({ where: { status: "PENDING" } }),
      this.prisma.booking.count({
        where: { status: { in: [BOOKING_STATUS.PENDING_APPROVAL, BOOKING_STATUS.CONFIRMED] } },
      }),
      this.prisma.booking.count({ where: { createdAt: { gte: monthStart } } }),
      this.prisma.booking.aggregate({
        where: { status: { in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED] } },
        _sum: { totalAmount: true },
      }),
      this.prisma.booking.aggregate({
        where: { status: { in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED] } },
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
  async reports(user: SafeUser, days = 30) {
    adminGuard(user);
    const from = addDays(todayStr(), -days);

    const [payments, bookings, cityRows, typeRows] = await Promise.all([
      this.prisma.payment.findMany({
        where: { status: "PAID", paidAt: { gte: new Date(from) } },
        select: { amount: true, paidAt: true },
      }),
      this.prisma.booking.findMany({
        where: { createdAt: { gte: new Date(from) } },
        select: { createdAt: true, status: true, totalAmount: true, propertyId: true },
      }),
      this.prisma.$queryRaw<{ name: string; cnt: number; total: number }[]>`
        SELECT c.name as name, COUNT(b.id) as cnt, COALESCE(SUM(b.totalAmount),0) as total
        FROM Booking b JOIN Property p ON p.id = b.propertyId JOIN City c ON c.id = p.cityId
        WHERE b.status IN ('CONFIRMED','COMPLETED')
        GROUP BY c.name ORDER BY total DESC LIMIT 8
      `.catch(() => []),
      this.prisma.$queryRaw<{ type: string; cnt: number }[]>`
        SELECT p.type as type, COUNT(*) as cnt FROM Property p GROUP BY p.type
      `.catch(() => []),
    ]);

    // revenue series by day
    const series: { date: string; revenue: number; bookings: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = addDays(todayStr(), -i);
      series.push({ date: d, revenue: 0, bookings: 0 });
    }
    const idx = new Map(series.map((s, i) => [s.date, i]));
    for (const p of payments) {
      const k = p.paidAt ? new Date(p.paidAt).toISOString().slice(0, 10) : "";
      const i = idx.get(k);
      if (i != null) series[i].revenue += p.amount;
    }
    for (const b of bookings) {
      const k = new Date(b.createdAt).toISOString().slice(0, 10);
      const i = idx.get(k);
      if (i != null) series[i].bookings += 1;
    }

    const topProps = await this.prisma
      .$queryRaw<{ title: string; cnt: number; total: number }[]>`
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
        type: r.type, label: PROPERTY_TYPES[r.type] ?? r.type, count: Number(r.cnt),
      })),
    };
  }

  // ───────── Users ─────────
  async listUsers(user: SafeUser, q?: string, role?: string) {
    adminGuard(user);
    const where: Record<string, unknown> = {};
    if (role && role !== "ALL") where.role = role;
    if (q) where.OR = [{ fullName: { contains: q } }, { phone: { contains: q } }];
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

  async toggleUserBlock(user: SafeUser, id: string) {
    adminGuard(user);
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw notFound("کاربر یافت نشد");
    if (target.role === "ADMIN") throw badRequest("حساب مدیر قابل مسدودسازی نیست");
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isBlocked: !target.isBlocked },
    });
    await this.auditSrv.audit({
      actorId: user.id, action: updated.isBlocked ? "USER_BLOCK" : "USER_UNBLOCK", entity: "User", entityId: id,
    });
    return { ok: true, isBlocked: updated.isBlocked };
  }

  async setUserRole(user: SafeUser, id: string, role: string) {
    adminGuard(user);
    if (!["CUSTOMER", "HOST", "ADMIN"].includes(role)) throw badRequest("نقش نامعتبر است");
    await this.prisma.user.update({ where: { id }, data: { role } });
    await this.auditSrv.audit({
      actorId: user.id, action: "USER_ROLE_CHANGE", entity: "User", entityId: id, meta: { role },
    });
    return { ok: true };
  }

  // ───────── Property verification ─────────
  async adminProperties(user: SafeUser, status?: string) {
    adminGuard(user);
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
      id: p.id, title: p.title, type: p.type, typeLabel: PROPERTY_TYPES[p.type] ?? p.type,
      status: p.status, city: p.city.name, province: p.city.province.name,
      host: p.host, basePrice: p.basePrice, capacity: p.capacity,
      image: p.images[0]?.url ?? null, bookingsCount: p._count.bookings,
      rejectionReason: p.rejectionReason, createdAt: p.createdAt,
      isFeatured: p.isFeatured,
    }));
  }

  async verifyProperty(user: SafeUser, id: string, action: "APPROVE" | "REJECT", reason?: string) {
    adminGuard(user);
    const prop = await this.prisma.property.findUnique({ where: { id } });
    if (!prop) throw notFound("اقامتگاه یافت نشد");
    if (action === "APPROVE") {
      await this.prisma.property.update({
        where: { id },
        data: { status: "PUBLISHED", rejectionReason: null },
      });
      await this.prisma.user
        .update({ where: { id: prop.hostId }, data: { role: "HOST", isHostVerified: true } })
        .catch(() => undefined);
    } else {
      if (!reason?.trim()) throw badRequest("دلیل رد را وارد کنید");
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

  async toggleFeatured(user: SafeUser, id: string) {
    adminGuard(user);
    const prop = await this.prisma.property.findUnique({ where: { id } });
    if (!prop) throw notFound();
    await this.prisma.property.update({ where: { id }, data: { isFeatured: !prop.isFeatured } });
    return { ok: true, isFeatured: !prop.isFeatured };
  }

  async suspendProperty(user: SafeUser, id: string) {
    adminGuard(user);
    const prop = await this.prisma.property.findUnique({ where: { id } });
    if (!prop) throw notFound();
    const next = prop.status === "SUSPENDED" ? "PUBLISHED" : "SUSPENDED";
    await this.prisma.property.update({ where: { id }, data: { status: next } });
    await this.auditSrv.audit({
      actorId: user.id, action: "PROPERTY_SUSPEND_TOGGLE", entity: "Property", entityId: id, meta: { next },
    });
    return { ok: true, status: next };
  }

  // ───────── Bookings / Payments ─────────
  async adminBookings(user: SafeUser, status?: string, q?: string) {
    adminGuard(user);
    const where: Record<string, unknown> = {};
    if (status && status !== "ALL") where.status = status;
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

  async adminPayments(user: SafeUser) {
    adminGuard(user);
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

  async adminRefunds(user: SafeUser) {
    adminGuard(user);
    return this.prisma.refund.findMany({
      include: { payment: { include: { booking: { select: { code: true, guestName: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async processRefund(user: SafeUser, refundId: string) {
    adminGuard(user);
    const refund = await this.prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund) throw notFound("بازگشت وجه یافت نشد");
    if (refund.status === "DONE") throw badRequest("این بازگشت قبلاً پردازش شده است");
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
  async adminPayouts(user: SafeUser) {
    adminGuard(user);
    const payouts = await this.prisma.payout.findMany({
      include: { host: { select: { fullName: true, phone: true } } },
      orderBy: { createdAt: "desc" },
    });
    // Suggest payouts: confirmed/completed bookings not yet in a paid payout
    const hosts = await this.prisma.user.findMany({
      where: { role: { in: ["HOST", "ADMIN"] } },
      select: { id: true, fullName: true, phone: true },
    });
    const suggestions: { hostId: string; hostName: string; phone: string; amount: number; count: number }[] = [];
    for (const h of hosts) {
      const agg = await this.prisma.booking.aggregate({
        where: { property: { hostId: h.id }, status: { in: [BOOKING_STATUS.COMPLETED] } },
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

  async createPayout(user: SafeUser, hostId: string, amount: number, periodLabel: string) {
    adminGuard(user);
    if (amount <= 0) throw badRequest("مبلغ نامعتبر است");
    const payout = await this.prisma.payout.create({
      data: { hostId, amount, periodLabel, itemsCount: 0 },
    });
    await this.auditSrv.audit({
      actorId: user.id, action: "PAYOUT_CREATE", entity: "Payout", entityId: payout.id, meta: { amount },
    });
    return payout;
  }

  async markPayoutPaid(user: SafeUser, id: string) {
    adminGuard(user);
    const payout = await this.prisma.payout.findUnique({ where: { id } });
    if (!payout) throw notFound();
    if (payout.status === "PAID") throw badRequest("این تسویه قبلاً پرداخت شده است");
    await this.prisma.payout.update({ where: { id }, data: { status: "PAID", paidAt: new Date() } });
    await this.auditSrv.audit({
      actorId: user.id, action: "PAYOUT_PAID", entity: "Payout", entityId: id, meta: { amount: payout.amount },
    });
    return { ok: true };
  }

  // ───────── Coupons ─────────
  async adminCoupons(user: SafeUser) {
    adminGuard(user);
    return this.prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { usages: true } } },
    });
  }

  async upsertCoupon(
    user: SafeUser,
    data: {
      id?: string; code: string; title: string; type: string; value: number;
      maxDiscount?: number; minAmount?: number; usageLimit?: number;
      validTo: string; isActive?: boolean;
    },
  ) {
    adminGuard(user);
    const code = data.code.trim().toUpperCase();
    const payload = {
      code, title: data.title, type: data.type, value: data.value,
      maxDiscount: data.maxDiscount, minAmount: data.minAmount, usageLimit: data.usageLimit,
      validTo: new Date(data.validTo), isActive: data.isActive ?? true,
    };
    if (data.id) {
      await this.prisma.coupon.update({ where: { id: data.id }, data: payload });
    } else {
      const exists = await this.prisma.coupon.findUnique({ where: { code } });
      if (exists) throw badRequest("این کد قبلاً ثبت شده است");
      await this.prisma.coupon.create({ data: payload });
    }
    await this.auditSrv.audit({
      actorId: user.id, action: data.id ? "COUPON_UPDATE" : "COUPON_CREATE", entity: "Coupon", meta: { code },
    });
    return { ok: true };
  }

  async deleteCoupon(user: SafeUser, id: string) {
    adminGuard(user);
    const used = await this.prisma.couponUsage.count({ where: { couponId: id } });
    if (used > 0) {
      await this.prisma.coupon.update({ where: { id }, data: { isActive: false } });
      return { ok: true, deactivated: true };
    }
    await this.prisma.coupon.delete({ where: { id } });
    return { ok: true, deactivated: false };
  }

  // ───────── Complaints ─────────
  async adminComplaints(user: SafeUser) {
    adminGuard(user);
    return this.prisma.complaint.findMany({
      include: { user: { select: { fullName: true, phone: true } }, booking: { select: { code: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async replyComplaint(user: SafeUser, id: string, reply: string, status: string) {
    adminGuard(user);
    await this.prisma.complaint.update({ where: { id }, data: { adminReply: reply, status } });
    await this.auditSrv.audit({ actorId: user.id, action: "COMPLAINT_REPLY", entity: "Complaint", entityId: id });
    return { ok: true };
  }

  // ───────── Reviews moderation ─────────
  async adminReviews(user: SafeUser, status?: string) {
    adminGuard(user);
    return this.prisma.review.findMany({
      where: status && status !== "ALL" ? { status } : {},
      include: { property: { select: { title: true } }, user: { select: { fullName: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async moderateReview(user: SafeUser, id: string, status: string) {
    adminGuard(user);
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw notFound();
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
  async getSettings(user: SafeUser) {
    adminGuard(user);
    return this.settings.getAllSettings();
  }

  async updateSettings(user: SafeUser, values: Record<string, string>) {
    adminGuard(user);
    for (const [k, v] of Object.entries(values)) {
      if (k in SETTING_DEFAULTS || k.startsWith("cancelPolicy.")) await this.settings.setSetting(k, String(v));
    }
    await this.auditSrv.audit({
      actorId: user.id, action: "SETTINGS_UPDATE", entity: "SystemSetting", meta: values,
    });
    return this.settings.getAllSettings();
  }

  async getAuditLogs(user: SafeUser) {
    adminGuard(user);
    return this.prisma.auditLog.findMany({
      include: { actor: { select: { fullName: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
}
