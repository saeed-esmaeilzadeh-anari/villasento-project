import { handler, ok } from "@/server/http";
import { db } from "@/lib/db";

/** GET /api/agents — public list of active agents */
export const GET = handler(async () => {
  const agents = await db.user.findMany({
    where: { role: "AGENT", isBlocked: false, agentProfile: { isActive: true } },
    select: {
      id: true, fullName: true, phone: true, isHostVerified: true,
      agentProfile: { select: { agencyName: true, bio: true, photoUrl: true, licenseNo: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 24,
  });
  const withCounts = await Promise.all(agents.map(async (a) => {
    const published = await db.property.count({ where: { agentId: a.id, status: "PUBLISHED" } });
    return {
      id: a.id, name: a.fullName ?? "مشاور ویلاسنتو", phone: a.phone,
      verified: a.isHostVerified, ...a.agentProfile,
      listingsCount: published,
    };
  }));
  return ok({ items: withCounts.sort((x, y) => y.listingsCount - x.listingsCount) });
});
