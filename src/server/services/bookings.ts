import { db } from "@/lib/db";
import { badRequest, forbidden, notFound, unauthorized } from "../http";
import { audit } from "../audit";
import { requireUser, type SafeUser } from "../session";
import { getCancelPolicy, getSetting, getSettingNumber } from "../settings";
import { diffDays, isValidDateStr, nightsOf, isWeekend, todayStr } from "../dates";

// ───────────────────────── Status constants ─────────────────────────
export const BOOKING_STATUS = {
  PENDING_PAYMENT: "PENDING_PAYMENT",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  CONFIRMED: "CONFIRMED",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const;

export const ACTIVE_STATUSES = [
  BOOKING_STATUS.PENDING_PAYMENT,
  BOOKING_STATUS.PENDING_APPROVAL,
  BOOKING_STATUS.CONFIRMED,
];

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

export async function quoteStay(propertyId: string, checkIn: string, checkOut: string, couponCode?: string): Promise<Quote> {
  const prop = await db.property.findUnique({
    where: { id: propertyId },
    include: { city: { include: { province: true } } },
  });
  if (!prop) throw notFound("اقامتگاه یافت نشد");

  const nights = nightsOf(checkIn, checkOut);
  if (!nights.length) throw badRequest("بازه تاریخ نامعتبر است");
  if (nights.length < prop.minNights)
    throw badRequest(`حداقل مدت اقامت در این اقامتگاه ${prop.minNights} شب است`);

  const days = await db.calendarDay.findMany({
    where: { propertyId, date: { in: nights } },
  });
  const dayMap = new Map(days.map((d) => [d.date, d]));

  const nightly = nights.map((date) => {
    const custom = dayMap.get(date);
    const price = custom?.price ?? (isWeekend(date) ? prop.weekendPrice : prop.basePrice);
    return { date, price, isWeekend: isWeekend(date), custom: custom?.price != null };
  });

  const baseAmount = nightly.reduce((s, n) => s + n.price, 0);
  const cleaningFee = prop.cleaningFee;
  let discountAmount = 0;
  let couponId: string | undefined;

  if (couponCode) {
    const res = await validateCoupon(couponCode, baseAmount + cleaningFee);
    discountAmount = res.discountAmount;
    couponId = res.couponId;
  }

  const totalAmount = Math.max(0, baseAmount + cleaningFee - discountAmount);
  const commissionRate = await getSettingNumber("commission.rate", 0.12);
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
export async function validateCoupon(code: string, amount: number) {
  const coupon = await db.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
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
async function assertAvailable(propertyId: string, checkIn: string, checkOut: string, tx: typeof db) {
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

export async function createBooking(user: SafeUser, input: CreateBookingInput) {
  if (!isValidDateStr(input.checkIn) || !isValidDateStr(input.checkOut))
    throw badRequest("تاریخ ورود یا خروج نامعتبر است");
  if (input.checkIn < todayStr()) throw badRequest("تاریخ ورود نمی‌تواند در گذشته باشد");
  if (input.checkOut <= input.checkIn) throw badRequest("تاریخ خروج باید بعد از تاریخ ورود باشد");

  const prop = await db.property.findUnique({ where: { id: input.propertyId } });
  if (!prop || prop.status !== "PUBLISHED") throw notFound("این اقامتگاه در حال حاضر قابل رزرو نیست");
  if (prop.hostId === user.id) throw badRequest("رزرو اقامتگاه خودتان امکان‌پذیر نیست");

  const guests = (input.adults || 0) + (input.children || 0);
  if (guests < 1) throw badRequest("تعداد مهمان را مشخص کنید");
  if (guests > prop.capacity)
    throw badRequest(`ظرفیت این اقامتگاه حداکثر ${prop.capacity} نفر است`);

  const holdMinutes = await getSettingNumber("booking.holdMinutes", 30);
  const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000);

  const created = await db.$transaction(async (tx) => {
    await assertAvailable(input.propertyId, input.checkIn, input.checkOut, tx as unknown as typeof db);

    const q = await quoteStay(input.propertyId, input.checkIn, input.checkOut, input.couponCode);

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
      const coupon = await tx.coupon.findUnique({ where: { code: input.couponCode.trim().toUpperCase() } });
      if (coupon) {
        await tx.booking.update({ where: { id: booking.id }, data: { couponId: coupon.id } });
        await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
        await tx.couponUsage.create({ data: { couponId: coupon.id, userId: user.id, bookingId: booking.id } });
      }
    }

    await tx.bookingEvent.create({
      data: { bookingId: booking.id, type: "CREATED", toStatus: BOOKING_STATUS.PENDING_PAYMENT, actorId: user.id },
    });
    return booking;
  });

  await audit({ actorId: user.id, action: "BOOKING_CREATE", entity: "Booking", entityId: created.id, meta: { code: created.code } });
  await notify(prop.hostId, "BOOKING", "درخواست رزرو جدید", `رزرو ${created.code} برای «${prop.title}» ثبت شد و در انتظار پرداخت است.`, "/host/bookings");
  return created;
}

// ───────────────────────── Notifications helper ─────────────────────────
export async function notify(userId: string, type: string, title: string, body: string, link?: string) {
  try {
    await db.notification.create({ data: { userId, type, title, body, link } });
  } catch (e) {
    console.error("[NOTIFY_FAILED]", e);
  }
}

// ───────────────────────── Background sweeper ─────────────────────────
/**
 * Idempotent lifecycle sweeper, invoked on state-changing/list endpoints:
 *  1) Expire payment holds (PENDING_PAYMENT past expiresAt)
 *  2) Auto-complete confirmed stays whose checkOut has passed
 * In production this becomes a cron/queue job (Redis + BullMQ per target architecture).
 */
export async function expireStaleHolds() {
  const expired = await db.booking.updateMany({
    where: { status: BOOKING_STATUS.PENDING_PAYMENT, expiresAt: { lt: new Date() } },
    data: { status: BOOKING_STATUS.EXPIRED },
  });

  const today = todayStr();
  const staleConfirmed = await db.booking.findMany({
    where: { status: BOOKING_STATUS.CONFIRMED, checkOut: { lt: today } },
    select: { id: true, userId: true, propertyId: true, code: true },
    take: 50,
  });
  for (const b of staleConfirmed) {
    await db.booking.update({ where: { id: b.id }, data: { status: BOOKING_STATUS.COMPLETED } });
    await db.bookingEvent.create({
      data: { bookingId: b.id, type: "STATUS_CHANGED", fromStatus: BOOKING_STATUS.CONFIRMED, toStatus: BOOKING_STATUS.COMPLETED },
    });
    await notify(b.userId, "BOOKING", "اقامت شما تکمیل شد", `رزرو ${b.code} تکمیل شد؛ تجربه‌تان را با ثبت نظر به اشتراک بگذارید.`, "/account?tab=bookings");
  }
  return expired.count + staleConfirmed.length;
}

// ───────────────────────── Lifecycle actions ─────────────────────────
async function loadBookingFor(id: string, user: SafeUser) {
  const booking = await db.booking.findUnique({ where: { id }, include: { property: true } });
  if (!booking) throw notFound("رزرو یافت نشد");
  const isOwner = booking.userId === user.id;
  const isHost = booking.property.hostId === user.id;
  const isAdmin = user.role === "ADMIN";
  if (!isOwner && !isHost && !isAdmin) throw forbidden();
  return { booking, isOwner, isHost, isAdmin };
}

async function addEvent(bookingId: string, type: string, fromStatus: string, toStatus: string, actorId: string, message?: string) {
  await db.bookingEvent.create({
    data: { bookingId, type, fromStatus, toStatus, actorId, message },
  });
}

export async function approveBooking(user: SafeUser, id: string) {
  const { booking, isHost, isAdmin } = await loadBookingFor(id, user);
  if (!isHost && !isAdmin) throw forbidden("فقط میزبان می‌تواند رزرو را تأیید کند");
  if (booking.status !== BOOKING_STATUS.PENDING_APPROVAL)
    throw badRequest("این رزرو در وضعیت قابل تأیید نیست");
  const updated = await db.booking.update({
    where: { id },
    data: { status: BOOKING_STATUS.CONFIRMED },
  });
  await addEvent(id, "STATUS_CHANGED", booking.status, BOOKING_STATUS.CONFIRMED, user.id);
  await notify(booking.userId, "BOOKING", "رزرو شما تأیید شد", `رزرو ${booking.code} توسط میزبان تأیید شد.`, "/account?tab=bookings");
  await audit({ actorId: user.id, action: "BOOKING_APPROVE", entity: "Booking", entityId: id });
  return updated;
}

export async function rejectBooking(user: SafeUser, id: string, reason?: string) {
  const { booking, isHost, isAdmin } = await loadBookingFor(id, user);
  if (!isHost && !isAdmin) throw forbidden("فقط میزبان می‌تواند رزرو را رد کند");
  if (booking.status !== BOOKING_STATUS.PENDING_APPROVAL)
    throw badRequest("این رزرو در وضعیت قابل رد نیست");
  const updated = await db.booking.update({
    where: { id },
    data: { status: BOOKING_STATUS.REJECTED, cancelReason: reason, cancelledAt: new Date() },
  });
  await addEvent(id, "STATUS_CHANGED", booking.status, BOOKING_STATUS.REJECTED, user.id, reason);
  await notify(booking.userId, "BOOKING", "رزرو شما رد شد", `رزرو ${booking.code} توسط میزبان رد شد. مبلغ پرداختی بازگشت داده می‌شود.`, "/account?tab=bookings");
  await audit({ actorId: user.id, action: "BOOKING_REJECT", entity: "Booking", entityId: id, meta: { reason } });
  return updated;
}

export async function cancelBooking(user: SafeUser, id: string, reason?: string) {
  const { booking, isOwner, isHost } = await loadBookingFor(id, user);
  if (!isOwner && !isHost) throw forbidden();
  const cancellable = [BOOKING_STATUS.PENDING_PAYMENT, BOOKING_STATUS.PENDING_APPROVAL, BOOKING_STATUS.CONFIRMED];
  if (!cancellable.includes(booking.status as (typeof cancellable)[number]))
    throw badRequest("این رزرو در وضعیت فعلی قابل لغو نیست");

  const policy = booking.property.cancelPolicy;
  const daysToCheckIn = diffDays(todayStr(), booking.checkIn);
  const tiers = await getCancelPolicy(policy);
  // first tier whose untilDays >= daysToCheckIn → percent; e.g. [{untilDays:3,percent:0},{untilDays:0,percent:60}]
  let penaltyPercent = 0;
  for (const t of tiers) {
    if (daysToCheckIn >= t.untilDays) { penaltyPercent = t.percent; break; }
  }
  const penalty = booking.status === BOOKING_STATUS.CONFIRMED
    ? Math.round((booking.totalAmount * penaltyPercent) / 100)
    : 0; // unpaid/pending-approval cancellations carry no charge

  const updated = await db.booking.update({
    where: { id },
    data: {
      status: BOOKING_STATUS.CANCELLED,
      cancelledAt: new Date(),
      cancelReason: reason ?? null,
      penaltyAmount: penalty,
    },
  });
  await addEvent(id, "STATUS_CHANGED", booking.status, BOOKING_STATUS.CANCELLED, user.id, `${reason ?? ""} | جریمه: ${penalty}%`.trim());

  // If a payment exists and it was CONFIRMED → request refund of (total - penalty)
  if (penalty < booking.totalAmount && booking.status === BOOKING_STATUS.CONFIRMED) {
    const paid = await db.payment.findFirst({ where: { bookingId: id, status: "PAID" } });
    if (paid) {
      await db.refund.create({
        data: {
          paymentId: paid.id,
          bookingId: id,
          amount: booking.totalAmount - penalty,
          reason: `لغو رزرو ${booking.code} (جریمه ${penaltyPercent}٪)`,
        },
      });
      await db.payment.update({ where: { id: paid.id }, data: { status: "REFUNDED" } });
    }
  }

  await notify(booking.property.hostId, "BOOKING", "رزرو لغو شد", `رزرو ${booking.code} ${isOwner ? "توسط مهمان" : "توسط میزبان"} لغو شد.`, "/host/bookings");
  await notify(booking.userId, "BOOKING", "رزرو لغو شد", `رزرو ${booking.code} لغو شد.`, "/account?tab=bookings");
  await audit({ actorId: user.id, action: "BOOKING_CANCEL", entity: "Booking", entityId: id, meta: { penaltyPercent, penalty } });
  return updated;
}

/** Host/admin marks a past confirmed stay as completed (auto-sweeper also exists) */
export async function completeBooking(user: SafeUser, id: string) {
  const { booking } = await loadBookingFor(id, user);
  if (booking.status !== BOOKING_STATUS.CONFIRMED) throw badRequest("فقط رزروهای تأییدشده تکمیل می‌شوند");
  if (booking.checkOut > todayStr()) throw badRequest("تاریخ خروج هنوز نرسیده است");
  const updated = await db.booking.update({ where: { id }, data: { status: BOOKING_STATUS.COMPLETED } });
  await addEvent(id, "STATUS_CHANGED", booking.status, BOOKING_STATUS.COMPLETED, user.id);
  await notify(booking.userId, "BOOKING", "اقامت شما تکمیل شد", "تجربه‌تان از این اقامتگاه را با ثبت نظر به اشتراک بگذارید.", "/account?tab=bookings");
  return updated;
}

// ───────────────────────── Lists & tracking ─────────────────────────
export async function myBookings(user: SafeUser, tab: string) {
  await expireStaleHolds();
  const where =
    tab === "UPCOMING"
      ? { userId: user.id, status: { in: [BOOKING_STATUS.PENDING_PAYMENT, BOOKING_STATUS.PENDING_APPROVAL, BOOKING_STATUS.CONFIRMED] }, checkOut: { gte: todayStr() } }
      : tab === "PAST"
        ? { userId: user.id, status: { in: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED, BOOKING_STATUS.REJECTED, BOOKING_STATUS.EXPIRED] } }
        : { userId: user.id };
  return db.booking.findMany({
    where,
    include: { property: { include: { city: true, images: { orderBy: { sort: "asc" }, take: 1 } } }, payments: true, review: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function hostBookings(user: SafeUser, status?: string) {
  await expireStaleHolds();
  const props = await db.property.findMany({ where: { hostId: user.id }, select: { id: true } });
  return db.booking.findMany({
    where: {
      propertyId: { in: props.map((p) => p.id) },
      ...(status && status !== "ALL" ? { status } : {}),
    },
    include: { property: { select: { title: true } }, user: { select: { fullName: true, phone: true } }, payments: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function trackByCode(code: string) {
  await expireStaleHolds();
  const booking = await db.booking.findUnique({
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

export { requireUser, unauthorized };
