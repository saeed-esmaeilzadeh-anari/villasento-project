import { handler, ok, parseBody } from "@/server/http";
import { getCurrentUser } from "@/server/session";
import * as Props from "@/server/services/properties";
import { limitOrThrow, clientIp } from "@/server/rateLimit";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  reason: z.string().min(2),
  detail: z.string().max(2000).optional(),
});

/** POST /api/properties/[id]/report — report an invalid listing */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  const body = await parseBody(req, schema);
  await limitOrThrow(`report:${clientIp(req)}`, 5, 3600 * 1000);
  return ok(await Props.reportListing(user, id, body));
});
