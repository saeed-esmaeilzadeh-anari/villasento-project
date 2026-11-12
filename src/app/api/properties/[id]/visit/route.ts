import { handler, ok, parseBody } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import * as Visits from "@/server/services/visits";
import { limitOrThrow, clientIp } from "@/server/rateLimit";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().min(2),
  phone: z.string(),
  note: z.string().max(1000).optional(),
  preferredAt: z.string().optional(),
});

/** POST /api/properties/[id]/visit — public visit request (auth optional) */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  const body = await parseBody(req, schema);
  await limitOrThrow(`visit:${clientIp(req)}`, 8, 3600 * 1000);
  return ok(await Visits.createVisitRequest(user, { ...body, propertyId: id }));
});
