import { handler, ok } from "@/server/http";
import * as PublicService from "@/server/services/public";

/** GET /api/cms/[slug] */
export const GET = handler(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  if (slug === "all") return ok(await PublicService.cmsPages());
  return ok(await PublicService.cmsPage(slug));
});
