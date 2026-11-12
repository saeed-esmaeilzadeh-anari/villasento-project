import { handler, ok, parseBody, badRequest } from "@/server/http";
import { requireUser } from "@/server/session";
import * as B from "@/server/services/bookings";
import { z } from "zod";

/** POST /api/coupons/validate — { code, amount } → discount preview */
export const POST = handler(async (req: Request) => {
  await requireUser();
  const body = await parseBody(req, z.object({
    code: z.string().min(2),
    amount: z.number().int().min(0),
  }));
  try {
    const res = await B.validateCoupon(body.code, body.amount);
    return ok({ valid: true, ...res });
  } catch (e) {
    if (e instanceof Error) return ok({ valid: false, message: e.message });
    throw badRequest("کد تخفیف نامعتبر است");
  }
});
