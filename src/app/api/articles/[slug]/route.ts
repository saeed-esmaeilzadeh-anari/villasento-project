import { handler, ok } from "@/server/http";
import * as Content from "@/server/services/content";

type Ctx = { params: Promise<{ slug: string }> };

/** GET /api/articles/[slug] — article detail + related */
export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  return ok(await Content.articleBySlug(slug));
});
