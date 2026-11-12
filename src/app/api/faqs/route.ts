import { handler, ok } from "@/server/http";
import * as Content from "@/server/services/content";

/** GET /api/faqs — active FAQs */
export const GET = handler(async () => {
  return ok({ items: await Content.activeFaqs() });
});
