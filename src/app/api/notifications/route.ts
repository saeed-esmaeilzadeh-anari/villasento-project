import { handler, ok, parseBody } from "@/server/http";
import { requireUser } from "@/server/session";
import * as Social from "@/server/services/social";
import { z } from "zod";

/** GET /api/notifications */
export const GET = handler(async () => {
  const user = await requireUser();
  return ok(await Social.listNotifications(user));
});

/** POST /api/notifications — mark read { ids?: string[] } */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, z.object({ ids: z.array(z.string()).optional() }));
  return ok(await Social.markNotificationsRead(user, body.ids));
});
