import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { badRequest, forbidden, notFound } from "../../common/api-error";
import { BOOKING_STATUS } from "../../common/constants";
import { AuditService } from "../../common/services/audit.service";
import { todayStr } from "../../common/dates.util";
import type { SafeUser } from "../../common/session.middleware";

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private auditSrv: AuditService,
  ) {}

  async createReview(
    user: SafeUser,
    bookingId: string,
    data: { rating: number; cleanliness: number; accuracy: number; location: number; comment: string },
  ) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { property: true } });
    if (!booking) throw notFound("رزرو یافت نشد");
    if (booking.userId !== user.id) throw forbidden();
    if (
      booking.status !== BOOKING_STATUS.COMPLETED &&
      !(booking.status === BOOKING_STATUS.CONFIRMED && booking.checkOut < todayStr())
    )
      throw badRequest("پس از تکمیل اقامت می‌توانید نظر ثبت کنید");
    if (booking.checkOut >= todayStr()) throw badRequest("ثبت نظر پس از پایان اقامت امکان‌پذیر است");
    const existing = await this.prisma.review.findUnique({ where: { bookingId } });
    if (existing) throw badRequest("برای این رزرو قبلاً نظر ثبت شده است");
    if (data.rating < 1 || data.rating > 5) throw badRequest("امتیاز باید بین ۱ تا ۵ باشد");

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

  async replyReview(user: SafeUser, reviewId: string, reply: string) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId }, include: { property: true } });
    if (!review) throw notFound("نظر یافت نشد");
    if (review.property.hostId !== user.id && user.role !== "ADMIN") throw notFound("نظر یافت نشد");
    return this.prisma.review.update({ where: { id: reviewId }, data: { hostReply: reply } });
  }
}
