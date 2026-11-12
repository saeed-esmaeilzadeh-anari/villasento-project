import { handler, ok } from "@/server/http";
import { requireUser } from "@/server/session";
import * as Props from "@/server/services/properties";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/properties/[id]/submit — DRAFT/REJECTED → PENDING (owner) */
export const POST = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  return ok(await Props.submitProperty(user, id));
});
