import { handler, ok, parseBody } from "@/server/http";
import * as Contact from "@/server/services/contact";
import { limitOrThrow, clientIp } from "@/server/rateLimit";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2),
  phone: z.string(),
  email: z.string().optional(),
  subject: z.string().max(200).optional(),
  body: z.string().min(10),
  propertyId: z.string().optional(),
});

/** POST /api/contact — public contact form */
export const POST = handler(async (req: Request) => {
  const body = await parseBody(req, schema);
  await limitOrThrow(`contact:${clientIp(req)}`, 5, 3600 * 1000);
  return ok(await Contact.createContactMessage(body));
});
