import { handler, ok, parseBody } from "@/server/http";
import { requireUser } from "@/server/session";
import * as B from "@/server/services/bookings";
import { z } from "zod";

/** GET /api/bookings?role=host|customer&tab=... */
export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  const sp = new URL(req.url).searchParams;
  const role = sp.get("role") ?? "customer";
  if (role === "host") return ok(await B.hostBookings(user, sp.get("status") ?? "ALL"));
  return ok(await B.myBookings(user, sp.get("tab") ?? "ALL"));
});

const createSchema = z.object({
  propertyId: z.string().min(1),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.number().int().min(0).max(30),
  children: z.number().int().min(0).max(30),
  guestName: z.string().optional(),
  guestPhone: z.string().optional(),
  note: z.string().max(500).optional(),
  couponCode: z.string().optional(),
});

/** POST /api/bookings — create booking (server-side availability enforced) */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, createSchema);
  return ok(await B.createBooking(user, body));
});
