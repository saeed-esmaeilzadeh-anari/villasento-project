import { handler, ok } from "@/server/http";
import { requireUser } from "@/server/session";
import * as Props from "@/server/services/properties";

/** GET /api/me/listings — listings of the logged-in owner/agent */
export const GET = handler(async () => {
  const user = await requireUser();
  return ok({ items: await Props.myProperties(user) });
});
