import { handler, ok, parseBody, badRequest, notFound, forbidden } from "@/server/http";
import { requireUser } from "@/server/session";
import { db } from "@/lib/db";
import * as Social from "@/server/services/social";
import { audit } from "@/server/audit";
import { z } from "zod";

/** POST /api/reviews — create review for a completed booking (legacy flow) */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, z.object({
    bookingId: z.string().min(1),
    rating: z.number().int().min(1).max(5),
    cleanliness: z.number().int().min(1).max(5),
    accuracy: z.number().int().min(1).max(5),
    location: z.number().int().min(1).max(5),
    comment: z.string().min(5).max(2000),
  }));
  return ok(await Social.createReview(user, body.bookingId, body));
});

/** PATCH /api/reviews — owner/admin replies to a review (legacy flow) */
export const PATCH = handler(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, z.object({
    id: z.string().min(1),
    hostReply: z.string().min(1).max(1000),
  }));
  const review = await db.review.findUnique({ where: { id: body.id }, include: { property: { select: { hostId: true } } } });
  if (!review) throw notFound("نظر یافت نشد");
  if (review.property.hostId !== user.id && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") throw forbidden();
  await db.review.update({ where: { id: body.id }, data: { hostReply: body.hostReply } });
  await audit({ actorId: user.id, action: "REVIEW_REPLY", entity: "Review", entityId: body.id });
  return ok({ ok: true });
});
