import { handler, ok, parseBody } from "@/server/http";
import { requireUser } from "@/server/session";
import * as Props from "@/server/services/properties";
import { z } from "zod";

const schema = z.object({
  propertyId: z.string(),
});

/** POST /api/track — record a real property view (deduped per viewer+day) */
export const POST = handler(async (req: Request) => {
  const body = await parseBody(req, schema);
  const user = await getCurrentUserSafe();
  const res = await Props.trackView({
    propertyId: body.propertyId,
    userId: user?.id ?? null,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: req.headers.get("user-agent")?.slice(0, 250) ?? null,
  });
  return ok(res);
});

import { getCurrentUser } from "@/server/session";
function getCurrentUserSafe() {
  return getCurrentUser();
}
