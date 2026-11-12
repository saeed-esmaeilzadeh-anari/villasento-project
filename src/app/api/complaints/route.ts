import { handler, ok, parseBody } from "@/server/http";
import { requireUser } from "@/server/session";
import * as Admin from "@/server/services/admin";
import { z } from "zod";

/** POST /api/complaints — customer submits a complaint/ticket */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, z.object({
    bookingId: z.string().optional(),
    subject: z.string().min(2).max(120),
    body: z.string().min(5).max(3000),
  }));
  return ok(await Admin.createComplaint(user.id, body));
});

/** GET /api/complaints — my complaints */
export const GET = handler(async () => {
  const user = await requireUser();
  const { db } = await import("@/lib/db");
  return ok(await db.complaint.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }));
});
