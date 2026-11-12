import { handler, ok } from "@/server/http";
import * as Content from "@/server/services/content";

/** GET /api/banners?position=HOME_TOP — active banners */
export const GET = handler(async (req: Request) => {
  const position = new URL(req.url).searchParams.get("position") ?? undefined;
  return ok({ items: await Content.activeBanners(position) });
});
