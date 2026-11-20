import { handler, ok } from "@/server/http";
import { featuredRegions, regionTreePublic, searchRegions } from "@/server/services/regions";

/**
 * GET /api/regions — real region data from the database (no hard-coded arrays).
 *   ?q=           search by Persian/Latin/alternative names
 *   ?featured=1   only the main (featured) regions with real listing counts
 *   default       full active tree + real published counts + verified bbox
 */
export const GET = handler(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q") ?? "";

  if (q.trim()) {
    return ok({ items: await searchRegions(q) });
  }
  if (sp.get("featured") === "1") {
    return ok({ items: await featuredRegions() });
  }
  return ok(await regionTreePublic());
});
