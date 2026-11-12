import { handler, ok, parseBody, badRequest } from "@/server/http";
import { getCurrentUser, requireUser } from "@/server/session";
import * as Pay from "@/server/services/payments";
import { db } from "@/lib/db";
import { z } from "zod";

/** GET /api/payments?authority=... — poll payment status */
export const GET = handler(async (req: Request) => {
  const authority = new URL(req.url).searchParams.get("authority");
  if (!authority) throw badRequest("authority الزامی است");
  const payment = await db.payment.findUnique({
    where: { authority },
    include: { booking: { select: { id: true, code: true, status: true, totalAmount: true, userId: true, property: { select: { title: true } } } } },
  });
  if (!payment) throw badRequest("تراکنش یافت نشد");
  const user = await getCurrentUser();
  if (user && payment.booking.userId !== user.id && user.role !== "ADMIN") throw badRequest("دسترسی مجاز نیست");
  return ok(payment);
});

/** POST /api/payments — { action: start | settle | refund } */
export const POST = handler(async (req: Request) => {
  const body = await parseBody(req, z.object({
    action: z.enum(["start", "settle", "refund"]),
    bookingId: z.string().optional(),
    authority: z.string().optional(),
    result: z.enum(["success", "fail"]).optional(),
    paymentId: z.string().optional(),
    amount: z.number().optional(),
    reason: z.string().optional(),
  }));
  const user = await requireUser();

  if (body.action === "start") {
    if (!body.bookingId) throw badRequest("شناسه رزرو الزامی است");
    return ok(await Pay.startPayment(user, body.bookingId));
  }

  if (body.action === "settle") {
    if (!body.authority || !body.result) throw badRequest("پارامترهای تسویه ناقص است");
    return ok(await Pay.settlePayment(body.authority, body.result, user));
  }

  // refund (admin)
  if (!body.paymentId || !body.amount) throw badRequest("پارامترهای بازگشت وجه ناقص است");
  return ok(await Pay.createRefund(user, body.paymentId, body.amount, body.reason ?? "بازگشت وجه توسط پشتیبانی"));
});
