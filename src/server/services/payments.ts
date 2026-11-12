import { db } from "@/lib/db";
import { badRequest, forbidden, notFound } from "./guard";
import { audit } from "../audit";
import { requireUser, type SafeUser } from "../session";
import { BOOKING_STATUS, notify } from "./bookings";
import { randomUUID } from "crypto";

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
  async start(bookingId: string, amount: number): Promise<StartResult> {
    const authority = "MCK-" + randomUUID().slice(0, 18).toUpperCase();
    return { authority, redirectUrl: `/pay/${authority}` };
  }
  async verify(authority: string) {
    // The sandbox gateway page posts an explicit success/fail intent;
    // default to success for direct API calls.
    return { ok: true, refId: String(Math.floor(100000000 + Math.random() * 899999999)), cardMask: "6104-****-****-3791" };
  }
}

const gateways: Record<string, PaymentGateway> = { MOCK_GATEWAY: new MockGateway() };
export function registerGateway(g: PaymentGateway) { gateways[g.key] = g; }
export function getGateway(key = "MOCK_GATEWAY"): PaymentGateway {
  const gw = gateways[key];
  if (!gw) throw badRequest("درگاه پرداخت پشتیبانی نمی‌شود");
  return gw;
}

/** Create a payment intent for a pending booking */
export async function startPayment(user: SafeUser, bookingId: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw notFound("رزرو یافت نشد");
  if (booking.userId !== user.id) throw forbidden();
  if (booking.status !== BOOKING_STATUS.PENDING_PAYMENT)
    throw badRequest("این رزرو در وضعیت قابل پرداخت نیست");

  const gw = getGateway("MOCK_GATEWAY");
  const started = await gw.start(booking.id, booking.totalAmount, "/api/payments?x=callback");
  const payment = await db.payment.create({
    data: {
      bookingId: booking.id,
      amount: booking.totalAmount,
      status: "PENDING",
      gateway: gw.key,
      authority: started.authority,
    },
  });
  await audit({ actorId: user.id, action: "PAYMENT_START", entity: "Payment", entityId: payment.id, meta: { amount: booking.totalAmount } });
  return { paymentId: payment.id, authority: started.authority, redirectUrl: started.redirectUrl, amount: booking.totalAmount };
}

/** Gateway callback (mock page → server). Server-side verification only. */
export async function settlePayment(authority: string, result: "success" | "fail", user?: SafeUser) {
  const payment = await db.payment.findUnique({ where: { authority }, include: { booking: { include: { property: true } } } });
  if (!payment) throw notFound("تراکنش یافت نشد");
  if (payment.status === "PAID") return { payment, booking: payment.booking, alreadyPaid: true };

  const gw = getGateway(payment.gateway);

  if (result === "fail") {
    const updated = await db.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", failureReason: "انصراف کاربر از پرداخت" },
    });
    await audit({ actorId: user?.id, action: "PAYMENT_FAIL", entity: "Payment", entityId: payment.id });
    return { payment: updated, booking: payment.booking, alreadyPaid: false };
  }

  const verified = await gw.verify(authority);
  if (!verified.ok) {
    const updated = await db.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", failureReason: verified.reason ?? "تأیید درگاه ناموفق بود" },
    });
    return { payment: updated, booking: payment.booking, alreadyPaid: false };
  }

  // Idempotency: only settle once
  const updated = await db.$transaction(async (tx) => {
    const p = await tx.payment.update({
      where: { id: payment.id },
      data: { status: "PAID", refId: verified.refId, cardMask: verified.cardMask, paidAt: new Date() },
    });
    const nextStatus = payment.booking.property.instantBooking ? BOOKING_STATUS.CONFIRMED : BOOKING_STATUS.PENDING_APPROVAL;
    const b = await tx.booking.update({
      where: { id: payment.bookingId },
      data: { status: nextStatus },
    });
    await tx.bookingEvent.create({
      data: { bookingId: b.id, type: "STATUS_CHANGED", fromStatus: BOOKING_STATUS.PENDING_PAYMENT, toStatus: nextStatus, actorId: user?.id },
    });
    return { payment: p, booking: b };
  });

  await notify(payment.booking.property.hostId, "PAYMENT", "پرداخت موفق", `پرداخت رزرو ${payment.booking.code} با موفقیت انجام شد.`, "/host/bookings");
  await notify(payment.booking.userId, "PAYMENT", "پرداخت موفق", `پرداخت شما برای رزرو ${payment.booking.code} ثبت شد.`, "/account?tab=bookings");
  await audit({ actorId: user?.id, action: "PAYMENT_SUCCESS", entity: "Payment", entityId: payment.id, meta: { refId: verified.refId, amount: payment.amount } });
  return { ...updated, alreadyPaid: false };
}

/** Admin refund workflow */
export async function createRefund(admin: SafeUser, paymentId: string, amount: number, reason: string, autoDone = true) {
  if (admin.role !== "ADMIN") throw forbidden();
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw notFound("تراکنش یافت نشد");
  if (payment.status !== "PAID" && payment.status !== "REFUNDED") throw badRequest("فقط تراکنش‌های موفق قابل بازگشت هستند");
  const refundAmount = Math.min(amount, payment.amount);
  const refund = await db.refund.create({
    data: {
      paymentId,
      bookingId: payment.bookingId,
      amount: refundAmount,
      reason,
      status: autoDone ? "DONE" : "PENDING",
      processedAt: autoDone ? new Date() : null,
    },
  });
  await db.payment.update({ where: { id: paymentId }, data: { status: "REFUNDED" } });
  await audit({ actorId: admin.id, action: "REFUND_CREATE", entity: "Refund", entityId: refund.id, meta: { amount: refundAmount, reason } });
  return refund;
}
