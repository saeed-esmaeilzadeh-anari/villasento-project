import { handler, ok, parseBody, badRequest } from "@/server/http";
import { requireUser } from "@/server/session";
import * as Visits from "@/server/services/visits";
import { z } from "zod";

/**
 * GET /api/visits?scope=mine|incoming
 *   mine     → requests the user has made
 *   incoming → requests for listings the user owns / is agent of
 * PATCH — owner/agent status update { id, status }
 */
export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  const scope = new URL(req.url).searchParams.get("scope") ?? "mine";
  if (scope === "incoming") return ok({ items: await Visits.incomingVisits(user) });
  return ok({ items: await Visits.myVisitRequests(user) });
});

const patchSchema = z.object({
  id: z.string(),
  status: z.enum(["NEW", "IN_PROGRESS", "DONE", "CANCELLED"]),
});

export const PATCH = handler(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, patchSchema);
  if (body.status === "NEW") throw badRequest("وضعیت «جدید» قابل انتخاب نیست");
  return ok(await Visits.updateVisitStatus(user, body.id, body.status));
});
