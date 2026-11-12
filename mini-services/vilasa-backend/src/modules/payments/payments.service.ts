import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";

import { PrismaService } from "../../prisma/prisma.service";
import { badRequest, forbidden, notFound } from "../../common/api-error";
import { BOOKING_STATUS } from "../../common/constants";
import { AuditService } from "../../common/services/audit.service";
import { NotificationsService } from "../../common/services/notifications.service";
import type { SafeUser } from "../../common/session.middleware";

/**
 * Payment module — gateway-agnostic (Adapter pattern).
 * The sandbox ships a MockGateway; a real Iranian PSP (e.g. Zarinpal) only
 * needs to implement `PaymentGateway` and register itself below.
 */
export interface StartResult {
  authority: string;
  redirectUrl: string;
}

export interface PaymentGateway {
  readonly key: string;
  start(bookingId: string, amount: number, callbackUrl: string): Promise<StartResult>;
  verify(authority: string): Promise<{ ok: boolean; refId?: string; cardMask?: string; reason?: string }>;
}

class MockGateway implements PaymentGateway {
  readonly key = "MOCK_GATEWAY";
  async start(_bookingId: string, _amount: number): Promise<StartResult> {
    const authority = "MCK-" + randomUUID().slice(0, 18).toUpperCase();
    return { authority, redirectUrl: `/pay/${authority}` };
  }
  async verify(_authority: string) {
    // The sandbox gateway page posts an explicit success/fail intent;
    // default to success for direct API calls.
    return {
      ok: true,
      refId: String(Math.floor(100000000 + Math.random() * 899999999)),
      cardMask: "6104-****-****-3791",
    };
  }
}

@Injectable()
export class PaymentsService {
  private gateways: Record<string, PaymentGateway> = { MOCK_GATEWAY: new MockGateway() };

  constructor(
    private prisma: PrismaService,
    private auditSrv: AuditService,
    private notifySrv: NotificationsService,
  ) {}

  /** Register a real PSP (Zarinpal, IDPay, …) at bootstrap time. */
  registerGateway(g: PaymentGateway) {
    this.gateways[g.key] = g;
  }

  getGateway(key = "MOCK_GATEWAY"): PaymentGateway {
    const gw = this.gateways[key];
    if (!gw) throw badRequest("درگاه پرداخت پشتیبانی نمی‌شود");
    return gw;
  }

  /** GET /api/payments?authority=… — poll payment status */
  async getByAuthority(authority: string, viewer: SafeUser | null) {
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
    if (!payment) throw badRequest("تراکنش یافت نشد");
    if (viewer && payment.booking.userId !== viewer.id && viewer.role !== "ADMIN")
      throw badRequest("دسترسی مجاز نیست");
    return payment;
  }

  /** Create a payment intent for a pending booking */
  async startPayment(user: SafeUser, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw notFound("رزرو یافت نشد");
    if (booking.userId !== user.id) throw forbidden();
    if (booking.status !== BOOKING_STATUS.PENDING_PAYMENT)
      throw badRequest("این رزرو در وضعیت قابل پرداخت نیست");

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
  async settlePayment(authority: string, result: "success" | "fail", user?: SafeUser) {
    const payment = await this.prisma.payment.findUnique({
      where: { authority },
      include: { booking: { include: { property: true } } },
    });
    if (!payment) throw notFound("تراکنش یافت نشد");
    if (payment.status === "PAID") return { payment, booking: payment.booking, alreadyPaid: true };

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
        ? BOOKING_STATUS.CONFIRMED
        : BOOKING_STATUS.PENDING_APPROVAL;
      const b = await tx.booking.update({
        where: { id: payment.bookingId },
        data: { status: nextStatus },
      });
      await tx.bookingEvent.create({
        data: {
          bookingId: b.id,
          type: "STATUS_CHANGED",
          fromStatus: BOOKING_STATUS.PENDING_PAYMENT,
          toStatus: nextStatus,
          actorId: user?.id,
        },
      });
      return { payment: p, booking: b };
    });

    await this.notifySrv.notify(
      payment.booking.property.hostId, "PAYMENT", "پرداخت موفق",
      `پرداخت رزرو ${payment.booking.code} با موفقیت انجام شد.`, "/host/bookings",
    );
    await this.notifySrv.notify(
      payment.booking.userId, "PAYMENT", "پرداخت موفق",
      `پرداخت شما برای رزرو ${payment.booking.code} ثبت شد.`, "/account?tab=bookings",
    );
    await this.auditSrv.audit({
      actorId: user?.id, action: "PAYMENT_SUCCESS", entity: "Payment", entityId: payment.id,
      meta: { refId: verified.refId, amount: payment.amount },
    });
    return { ...updated, alreadyPaid: false };
  }

  /** Admin refund workflow */
  async createRefund(admin: SafeUser, paymentId: string, amount: number, reason: string, autoDone = true) {
    if (admin.role !== "ADMIN") throw forbidden();
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw notFound("تراکنش یافت نشد");
    if (payment.status !== "PAID" && payment.status !== "REFUNDED")
      throw badRequest("فقط تراکنش‌های موفق قابل بازگشت هستند");
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
}
