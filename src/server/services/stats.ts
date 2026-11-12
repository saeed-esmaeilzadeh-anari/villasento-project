import { db } from "@/lib/db";
import { forbidden } from "../http";
import { isAdmin } from "./properties";
import { PROPERTY_TYPES, TRANSACTION_TYPES, LISTING_STATUS } from "./properties";
import { todayStr, addDays } from "../dates";

/** Real, database-backed dashboard statistics */
export async function overview(user: { role: string }) {
  if (!isAdmin(user)) throw forbidden("این بخش فقط برای مدیران سامانه است");
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const [
    propsTotal, propsPublished, propsPending, propsRejected, propsExpired, propsDraft,
    usersTotal, agentsTotal, ownersTotal,
    visitsTotal, visitsNew, messagesNew, reportsOpen,
    viewsTotal, viewsMonth, listingsMonth, usersMonth,
  ] = await Promise.all([
    db.property.count(),
    db.property.count({ where: { status: "PUBLISHED" } }),
    db.property.count({ where: { status: "PENDING" } }),
    db.property.count({ where: { status: "REJECTED" } }),
    db.property.count({ where: { status: "EXPIRED" } }),
    db.property.count({ where: { status: "DRAFT" } }),
    db.user.count(),
    db.user.count({ where: { role: "AGENT" } }),
    db.user.count({ where: { role: "OWNER" } }),
    db.visitRequest.count(),
    db.visitRequest.count({ where: { status: "NEW" } }),
    db.contactMessage.count({ where: { status: "NEW" } }),
    db.complaint.count({ where: { status: { not: "RESOLVED" } } }),
    db.propertyView.count(),
    db.propertyView.count({ where: { day: { gte: todayStr().slice(0, 8) + "01" } } }),
    db.property.count({ where: { createdAt: { gte: monthStart } } }),
    db.user.count({ where: { createdAt: { gte: monthStart } } }),
  ]);

  return {
    kpis: {
      propsTotal, propsPublished, propsPending, propsRejected, propsExpired, propsDraft,
      usersTotal, agentsTotal, ownersTotal,
      visitsTotal, visitsNew, messagesNew, reportsOpen,
      viewsTotal, viewsMonth, listingsMonth, usersMonth,
    },
  };
}

/** Chart series: views per day, new listings per day, new users per day */
export async function charts(user: { role: string }, days = 30) {
  if (!isAdmin(user)) throw forbidden();
  const from = addDays(todayStr(), -days);

  const [views, props, users, byType, byTT, byStatus, topViewed] = await Promise.all([
    db.propertyView.findMany({
      where: { day: { gte: from } },
      select: { day: true },
    }),
    db.property.findMany({
      where: { createdAt: { gte: new Date(from) } },
      select: { createdAt: true },
    }),
    db.user.findMany({
      where: { createdAt: { gte: new Date(from) } },
      select: { createdAt: true },
    }),
    db.$queryRaw<{ type: string; cnt: number }[]>`SELECT type as type, COUNT(*) as cnt FROM Property GROUP BY type`.catch(() => []),
    db.$queryRaw<{ transactionType: string; cnt: number }[]>`SELECT transactionType as transactionType, COUNT(*) as cnt FROM Property GROUP BY transactionType`.catch(() => []),
    db.$queryRaw<{ status: string; cnt: number }[]>`SELECT status as status, COUNT(*) as cnt FROM Property GROUP BY status`.catch(() => []),
    db.property.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { viewCount: "desc" },
      select: { id: true, title: true, viewCount: true },
      take: 8,
    }),
  ]);

  const series: { date: string; views: number; listings: number; users: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(todayStr(), -i);
    series.push({ date: d, views: 0, listings: 0, users: 0 });
  }
  const idx = new Map(series.map((s, i) => [s.date, i]));
  for (const v of views) {
    const i = idx.get(v.day);
    if (i != null) series[i].views += 1;
  }
  for (const p of props) {
    const k = new Date(p.createdAt).toISOString().slice(0, 10);
    const i = idx.get(k);
    if (i != null) series[i].listings += 1;
  }
  for (const u of users) {
    const k = new Date(u.createdAt).toISOString().slice(0, 10);
    const i = idx.get(k);
    if (i != null) series[i].users += 1;
  }

  return {
    series,
    byType: byType.map((r) => ({ label: PROPERTY_TYPES[r.type] ?? r.type, count: Number(r.cnt) })),
    byTransactionType: byTT.map((r) => ({ label: TRANSACTION_TYPES[r.transactionType] ?? r.transactionType, count: Number(r.cnt) })),
    byStatus: byStatus.map((r) => ({ label: LISTING_STATUS[r.status] ?? r.status, count: Number(r.cnt) })),
    topViewed,
  };
}

/** Recent activity feeds */
export async function recents(user: { role: string }) {
  if (!isAdmin(user)) throw forbidden();
  const [latestListings, latestVisits, latestMessages, latestAudit, latestUsers] = await Promise.all([
    db.property.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { city: { select: { name: true } }, images: { take: 1, orderBy: { sort: "asc" } }, host: { select: { fullName: true, phone: true } } },
    }),
    db.visitRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { property: { select: { title: true } }, assignedTo: { select: { fullName: true } } },
    }),
    db.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { actor: { select: { fullName: true, phone: true } } },
    }),
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, fullName: true, phone: true, role: true, createdAt: true } }),
  ]);
  return { latestListings, latestVisits, latestMessages, latestAudit, latestUsers };
}
