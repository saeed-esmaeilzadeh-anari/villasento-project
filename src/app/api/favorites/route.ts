import { handler, ok, parseBody } from "@/server/http";
import { requireUser } from "@/server/session";
import * as Social from "@/server/services/social";
import { z } from "zod";

/** GET /api/favorites */
export const GET = handler(async () => {
  const user = await requireUser();
  return ok(await Social.listFavorites(user));
});

/** POST /api/favorites — toggle { propertyId } */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, z.object({ propertyId: z.string().min(1) }));
  return ok(await Social.toggleFavorite(user, body.propertyId));
});
