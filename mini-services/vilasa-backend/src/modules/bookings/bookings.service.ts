import { Injectable } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";

import { PrismaService } from "../../prisma/prisma.service";
import { badRequest, forbidden, notFound } from "../../common/api-error";
import { ACTIVE_STATUSES, BOOKING_STATUS } from "../../common/constants";
import { AuditService } from "../../common/services/audit.service";
import { NotificationsService } from "../../common/services/notifications.service";
import { SettingsService } from "../../common/services/settings.service";
import { diffDays, isValidDateStr, nightsOf, isWeekend, todayStr } from "../../common/dates.util";
import type { SafeUser } from "../../common/session.middleware";
import type { Prisma } from "@prisma/client";

// ───────────────────────── Pricing engine ─────────────────────────
export type Quote = {
  nights: number;
  nightly: { date: string; price: number; isWeekend: boolean; custom: boolean }[];
  baseAmount: number;
  cleaningFee: number;
  discountAmount: number;
  totalAmount: number;
  commissionRate: number;
  commissionAmount: number;
  hostPayout: number;
};

export type CreateBookingInput = {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  guestName?: string;
  guestPhone?: string;
  note?: string;
  couponCode?: string;
};

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private auditSrv: AuditService,
    private settings: SettingsService,
    private notifySrv: NotificationsService,
  ) {}

  async quoteStay(propertyId: string, checkIn: string, checkOut: string, couponCode?: string): Promise<Quote> {
    const prop = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: { city: { include: { province: true } } },
    });
    if (!prop) throw notFound("اقامتگاه یافت نشد");

    const nights = nightsOf(checkIn, checkOut);
    if (!nights.length) throw badRequest("بازه تاریخ نامعتبر است");
    if (nights.length < prop.minNights)
      throw badRequest(`حداقل مدت اقامت در این اقامتگاه ${prop.minNights} شب است`);

    const days = await this.prisma.calendarDay.findMany({
      where: { propertyId, date: { in: nights } },
    });
    const dayMap = new Map<string, (typeof days)[number]>(
      days.map((day) => [day.date, day] as const),
    );

    const nightly = nights.map((date) => {
      const custom = dayMap.get(date);
      const price = custom?.price ?? (isWeekend(date) ? prop.weekendPrice : prop.basePrice);
      return { date, price, isWeekend: isWeekend(date), custom: custom?.price != null };
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
  async validateCoupon(code: string, amount: number) {
    const coupon = await this.prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (!coupon || !coupon.isActive) throw badRequest("کد تخفیف نامعتبر است");
    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validTo) throw badRequest("کد تخفیف منقضی شده است");
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit)
      throw badRequest("ظرفیت استفاده از این کد تکمیل شده است");
    if (coupon.minAmount && amount < coupon.minAmount)
      throw badRequest(`حداقل مبلغ سفارش برای این کد ${coupon.minAmount.toLocaleString("fa-IR")} تومان است`);

    let discount =
      coupon.type === "PERCENT" ? Math.round((amount * coupon.value) / 100) : coupon.value;
    if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
    discount = Math.min(discount, amount);
    return { couponId: coupon.id, discountAmount: discount, title: coupon.title };
  }

  // ───────────────────────── Availability check ─────────────────────────
  /** Hard server-side guard against double booking (frontend checks are cosmetic only). */
  private async assertAvailable(
    propertyId: string,
    checkIn: string,
    checkOut: string,
    tx: Prisma.TransactionClient,
  ) {
    const blocked = await tx.calendarDay.findFirst({
      where: { propertyId, date: { gte: checkIn, lt: checkOut }, isBlocked: true },
    });
    if (blocked) throw badRequest("برخی از شب‌های انتخابی شما توسط میزبان مسدود شده است");

    const conflict = await tx.booking.findFirst({
      where: {
        propertyId,
        status: { in: ACTIVE_STATUSES },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
    });
    if (conflict) throw badRequest("این بازه متأسفانه همین الان رزرو شد. لطفاً تاریخ دیگری انتخاب کنید.");
  }

  // ───────────────────────── Create booking ─────────────────────────
  async createBooking(user: SafeUser, input: CreateBookingInput) {
    if (!isValidDateStr(input.checkIn) || !isValidDateStr(input.checkOut))
      throw badRequest("تاریخ ورود یا خروج نامعتبر است");
    if (input.checkIn < todayStr()) throw badRequest("تاریخ ورود نمی‌تواند در گذشته باشد");
    if (input.checkOut <= input.checkIn) throw badRequest("تاریخ خروج باید بعد از تاریخ ورود باشد");

    const prop = await this.prisma.property.findUnique({ where: { id: input.propertyId } });
    if (!prop || prop.status !== "PUBLISHED") throw notFound("این اقامتگاه در حال حاضر قابل رزرو نیست");
    if (prop.hostId === user.id) throw badRequest("رزرو اقامتگاه خودتان امکان‌پذیر نیست");

    const guests = (input.adults || 0) + (input.children || 0);
    if (guests < 1) throw badRequest("تعداد مهمان را مشخص کنید");
    if (guests > prop.capacity) throw badRequest(`ظرفیت این اقامتگاه حداکثر ${prop.capacity} نفر است`);

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
          status: BOOKING_STATUS.PENDING_PAYMENT,
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
          toStatus: BOOKING_STATUS.PENDING_PAYMENT,
          actorId: user.id,
        },
      });
      return booking;
    });

    await this.auditSrv.audit({
      actorId: user.id, action: "BOOKING_CREATE", entity: "Booking", entityId: created.id, meta: { code: created.code },
    });
    await this.notifySrv.notify(
      prop.hostId, "BOOKING", "درخواست رزرو جدید",
      `رزرو ${created.code} برای «${prop.title}» ثبت شد و در انتظار پرداخت است.`, "/host/bookings",
    );
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
      where: { status: BOOKING_STATUS.PENDING_PAYMENT, expiresAt: { lt: new Date() } },
      data: { status: BOOKING_STATUS.EXPIRED },
    });

    const today = todayStr();
    const staleConfirmed = await this.prisma.booking.findMany({
      where: { status: BOOKING_STATUS.CONFIRMED, checkOut: { lt: today } },
      select: { id: true, userId: true, propertyId: true, code: true },
      take: 50,
    });
    for (const b of staleConfirmed) {
      await this.prisma.booking.update({ where: { id: b.id }, data: { status: BOOKING_STATUS.COMPLETED } });
      await this.prisma.bookingEvent.create({
        data: {
          bookingId: b.id,
          type: "STATUS_CHANGED",
          fromStatus: BOOKING_STATUS.CONFIRMED,
          toStatus: BOOKING_STATUS.COMPLETED,
        },
      });
      await this.notifySrv.notify(
        b.userId, "BOOKING", "اقامت شما تکمیل شد",
        `رزرو ${b.code} تکمیل شد؛ تجربه‌تان را با ثبت نظر به اشتراک بگذارید.`, "/account?tab=bookings",
      );
    }
    return expired.count + staleConfirmed.length;
  }

  @Interval(60_000)
  async sweep() {
    try {
      await this.expireStaleHolds();
    } catch (e) {
      console.error("[SWEEP_FAILED]", e);
    }
  }

  // ───────────────────────── Lifecycle actions ─────────────────────────
  private async loadBookingFor(id: string, user: SafeUser) {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: { property: true } });
    if (!booking) throw notFound("رزرو یافت نشد");
    const isOwner = booking.userId === user.id;
    const isHost = booking.property.hostId === user.id;
    const isAdmin = user.role === "ADMIN";
    if (!isOwner && !isHost && !isAdmin) throw forbidden();
    return { booking, isOwner, isHost, isAdmin };
  }

  private async addEvent(
    bookingId: string, type: string, fromStatus: string, toStatus: string, actorId: string, message?: string,
  ) {
    await this.prisma.bookingEvent.create({
      data: { bookingId, type, fromStatus, toStatus, actorId, message },
    });
  }

  async approveBooking(user: SafeUser, id: string) {
    const { booking, isHost, isAdmin } = await this.loadBookingFor(id, user);
    if (!isHost && !isAdmin) throw forbidden("فقط میزبان می‌تواند رزرو را تأیید کند");
    if (booking.status !== BOOKING_STATUS.PENDING_APPROVAL)
      throw badRequest("این رزرو در وضعیت قابل تأیید نیست");
    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: BOOKING_STATUS.CONFIRMED },
    });
    await this.addEvent(id, "STATUS_CHANGED", booking.status, BOOKING_STATUS.CONFIRMED, user.id);
    await this.notifySrv.notify(
      booking.userId, "BOOKING", "رزرو شما تأیید شد",
      `رزرو ${booking.code} توسط میزبان تأیید شد.`, "/account?tab=bookings",
    );
    await this.auditSrv.audit({ actorId: user.id, action: "BOOKING_APPROVE", entity: "Booking", entityId: id });
    return updated;
  }

  async rejectBooking(user: SafeUser, id: string, reason?: string) {
    const { booking, isHost, isAdmin } = await this.loadBookingFor(id, user);
    if (!isHost && !isAdmin) throw forbidden("فقط میزبان می‌تواند رزرو را رد کند");
    if (booking.status !== BOOKING_STATUS.PENDING_APPROVAL)
      throw badRequest("این رزرو در وضعیت قابل رد نیست");
    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: BOOKING_STATUS.REJECTED, cancelReason: reason, cancelledAt: new Date() },
    });
    await this.addEvent(id, "STATUS_CHANGED", booking.status, BOOKING_STATUS.REJECTED, user.id, reason);
    await this.notifySrv.notify(
      booking.userId, "BOOKING", "رزرو شما رد شد",
      `رزرو ${booking.code} توسط میزبان رد شد. مبلغ پرداختی بازگشت داده می‌شود.`, "/account?tab=bookings",
    );
    await this.auditSrv.audit({
      actorId: user.id, action: "BOOKING_REJECT", entity: "Booking", entityId: id, meta: { reason },
    });
    return updated;
  }

  async cancelBooking(user: SafeUser, id: string, reason?: string) {
    const { booking, isOwner, isHost } = await this.loadBookingFor(id, user);
    if (!isOwner && !isHost) throw forbidden();
    const cancellable = [BOOKING_STATUS.PENDING_PAYMENT, BOOKING_STATUS.PENDING_APPROVAL, BOOKING_STATUS.CONFIRMED];
    if (!cancellable.includes(booking.status as (typeof cancellable)[number]))
      throw badRequest("این رزرو در وضعیت فعلی قابل لغو نیست");

    const policy = booking.property.cancelPolicy;
    const daysToCheckIn = diffDays(todayStr(), booking.checkIn);
    const tiers = await this.settings.getCancelPolicy(policy);
    // first tier whose untilDays >= daysToCheckIn → percent
    let penaltyPercent = 0;
    for (const t of tiers) {
      if (daysToCheckIn >= t.untilDays) {
        penaltyPercent = t.percent;
        break;
      }
    }
    const penalty = booking.status === BOOKING_STATUS.CONFIRMED
      ? Math.round((booking.totalAmount * penaltyPercent) / 100)
      : 0; // unpaid/pending-approval cancellations carry no charge

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        status: BOOKING_STATUS.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: reason ?? null,
        penaltyAmount: penalty,
      },
    });
    await this.addEvent(
      id, "STATUS_CHANGED", booking.status, BOOKING_STATUS.CANCELLED, user.id,
      `${reason ?? ""} | جریمه: ${penalty}%`.trim(),
    );

    // If a payment exists and it was CONFIRMED → request refund of (total - penalty)
    if (penalty < booking.totalAmount && booking.status === BOOKING_STATUS.CONFIRMED) {
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

    await this.notifySrv.notify(
      booking.property.hostId, "BOOKING", "رزرو لغو شد",
      `رزرو ${booking.code} ${isOwner ? "توسط مهمان" : "توسط میزبان"} لغو شد.`, "/host/bookings",
    );
    await this.notifySrv.notify(
      booking.userId, "BOOKING", "رزرو لغو شد",
      `رزرو ${booking.code} لغو شد.`, "/account?tab=bookings",
    );
    await this.auditSrv.audit({
      actorId: user.id, action: "BOOKING_CANCEL", entity: "Booking", entityId: id, meta: { penaltyPercent, penalty },
    });
    return updated;
  }

  /** Host/admin marks a past confirmed stay as completed (auto-sweeper also exists) */
  async completeBooking(user: SafeUser, id: string) {
    const { booking } = await this.loadBookingFor(id, user);
    if (booking.status !== BOOKING_STATUS.CONFIRMED) throw badRequest("فقط رزروهای تأییدشده تکمیل می‌شوند");
    if (booking.checkOut > todayStr()) throw badRequest("تاریخ خروج هنوز نرسیده است");
    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: BOOKING_STATUS.COMPLETED },
    });
    await this.addEvent(id, "STATUS_CHANGED", booking.status, BOOKING_STATUS.COMPLETED, user.id);
    await this.notifySrv.notify(
      booking.userId, "BOOKING", "اقامت شما تکمیل شد",
      "تجربه‌تان از این اقامتگاه را با ثبت نظر به اشتراک بگذارید.", "/account?tab=bookings",
    );
    return updated;
  }

  // ───────────────────────── Lists & tracking ─────────────────────────
  async myBookings(user: SafeUser, tab: string) {
    await this.expireStaleHolds();
    const where =
      tab === "UPCOMING"
        ? {
            userId: user.id,
            status: { in: [BOOKING_STATUS.PENDING_PAYMENT, BOOKING_STATUS.PENDING_APPROVAL, BOOKING_STATUS.CONFIRMED] },
            checkOut: { gte: todayStr() },
          }
        : tab === "PAST"
          ? {
              userId: user.id,
              status: { in: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED, BOOKING_STATUS.REJECTED, BOOKING_STATUS.EXPIRED] },
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

  async hostBookings(user: SafeUser, status?: string) {
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

  async trackByCode(code: string) {
    await this.expireStaleHolds();
    const booking = await this.prisma.booking.findUnique({
      where: { code: code.trim().toUpperCase() },
      include: {
        property: { select: { title: true, city: { select: { name: true } } } },
        events: { orderBy: { createdAt: "asc" } },
        payments: { select: { status: true, amount: true, refId: true, createdAt: true } },
      },
    });
    if (!booking) throw notFound("رزروی با این کد یافت نشد");
    return booking;
  }

  async findOwnedBooking(id: string, user: SafeUser) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        property: { include: { city: true, images: { orderBy: { sort: "asc" }, take: 1 } } },
        events: { orderBy: { createdAt: "asc" } },
        payments: true,
        user: { select: { fullName: true, phone: true } },
      },
    });
    if (!booking) throw badRequest("رزرو یافت نشد");
    const isAllowed = booking.userId === user.id || booking.property.hostId === user.id || user.role === "ADMIN";
    if (!isAllowed) throw badRequest("دسترسی مجاز نیست");
    return booking;
  }
}
