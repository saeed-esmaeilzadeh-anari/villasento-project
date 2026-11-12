import { handler, ok, parseBody, badRequest } from "@/server/http";
import { requireUser } from "@/server/session";
import * as B from "@/server/services/bookings";
import { db } from "@/lib/db";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/bookings/[id] */
export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const booking = await db.booking.findUnique({
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
  return ok(booking);
});

/** PATCH /api/bookings/[id] — { action: cancel | approve | reject | complete } */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const body = await parseBody(req, z.object({
    action: z.enum(["cancel", "approve", "reject", "complete"]),
    reason: z.string().optional(),
  }));
  switch (body.action) {
    case "approve": return ok(await B.approveBooking(user, id));
    case "reject": return ok(await B.rejectBooking(user, id, body.reason));
    case "complete": return ok(await B.completeBooking(user, id));
    case "cancel": return ok(await B.cancelBooking(user, id, body.reason));
  }
});
