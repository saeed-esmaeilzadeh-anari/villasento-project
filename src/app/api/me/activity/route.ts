import { handler, ok } from "@/server/http";
import { requireUser } from "@/server/session";
import { db } from "@/lib/db";

/** GET /api/me/activity — user activity history (audit trail of own actions) */
export const GET = handler(async () => {
  const user = await requireUser();
  const items = await db.auditLog.findMany({
    where: { actorId: user.id },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  return ok({ items });
});
