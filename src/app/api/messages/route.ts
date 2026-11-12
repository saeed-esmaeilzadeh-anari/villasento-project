import { handler, ok, parseBody } from "@/server/http";
import { requireUser } from "@/server/session";
import * as Social from "@/server/services/social";
import { z } from "zod";

/** GET /api/messages — conversations, or ?conversationId= for thread */
export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  const conversationId = new URL(req.url).searchParams.get("conversationId");
  if (conversationId) return ok(await Social.getMessages(user, conversationId));
  return ok(await Social.listConversations(user));
});

/** POST /api/messages — { conversationId? , propertyId?, text } */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, z.object({
    conversationId: z.string().optional(),
    propertyId: z.string().optional(),
    text: z.string().min(1).max(2000),
  }));
  return ok(await Social.sendMessage(user, body.conversationId ?? null, body.propertyId ?? null, body.text));
});
