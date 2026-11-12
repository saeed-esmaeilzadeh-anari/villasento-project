import { handler, ok } from "@/server/http";
import * as Content from "@/server/services/content";

/** GET /api/articles?q=&categoryId=&page= — public article list + categories */
export const GET = handler(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const page = Number(sp.get("page") ?? 1) || 1;
  const [list, categories] = await Promise.all([
    Content.listArticles({
      q: sp.get("q") ?? undefined,
      categoryId: sp.get("categoryId") ?? undefined,
      page,
      pageSize: 9,
    }),
    Content.articleCategories(),
  ]);
  return ok({ ...list, categories });
});
