import { db } from "@/lib/db";
import { badRequest, forbidden, notFound } from "../http";
import { audit } from "../audit";
import { type SafeUser, requireUser } from "../session";
import { getAllSettings, setSetting, SETTING_DEFAULTS } from "../settings";
import { isAdmin, LISTING_STATUSES } from "./properties";

function adminGuard(user: Pick<SafeUser, "role">) {
  if (!isAdmin(user)) throw forbidden("این بخش فقط برای مدیران سامانه است");
}

// ───────── Listing moderation ─────────
export async function adminProperties(user: SafeUser, opts: { status?: string; q?: string; tt?: string } = {}) {
  adminGuard(user);
  const where: Record<string, unknown> = {};
  if (opts.status && opts.status !== "ALL") where.status = opts.status;
  if (opts.tt && opts.tt !== "ALL") where.transactionType = opts.tt;
  if (opts.q) where.OR = [{ title: { contains: opts.q } }, { code: { contains: opts.q.toUpperCase() } }, { address: { contains: opts.q } }];
  const props = await db.property.findMany({
    where,
    include: {
      host: { select: { id: true, fullName: true, phone: true, isHostVerified: true } },
      agent: { select: { id: true, fullName: true } },
      city: { include: { province: true } },
      images: { orderBy: { sort: "asc" }, take: 1 },
      _count: { select: { visitRequests: true, favorites: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 150,
  });
  return props.map((p) => ({
    id: p.id, code: p.code, title: p.title,
    type: p.type, transactionType: p.transactionType,
    status: p.status, rejectionReason: p.rejectionReason,
    city: p.city.name, province: p.city.province.name,
    host: p.host, agent: p.agent,
    salePrice: p.salePrice, rahnAmount: p.rahnAmount, rentAmount: p.rentAmount,
    landArea: p.landArea, buildArea: p.buildArea,
    image: p.images[0]?.url ?? null,
    visitsCount: p._count.visitRequests, favoritesCount: p._count.favorites,
    viewCount: p.viewCount, isFeatured: p.isFeatured,
    publishedAt: p.publishedAt, expiresAt: p.expiresAt,
    createdAt: p.createdAt,
  }));
}

/** Validate & perform status transition for a listing */
const TRANSITIONS: Record<string, string[]> = {
  PENDING: ["PUBLISHED", "APPROVED", "REJECTED"],
  APPROVED: ["PUBLISHED", "REJECTED", "ARCHIVED"],
  PUBLISHED: ["APPROVED", "ARCHIVED", "EXPIRED"],
  REJECTED: ["PENDING", "ARCHIVED"],
  EXPIRED: ["PUBLISHED", "ARCHIVED"],
  ARCHIVED: ["PUBLISHED", "PENDING"],
  DRAFT: ["PENDING", "ARCHIVED"],
};

export async function setListingStatus(user: SafeUser, id: string, to: string, reason?: string, featured?: boolean) {
  adminGuard(user);
  if (!LISTING_STATUSES.includes(to)) throw badRequest("وضعیت نامعتبر است");
  const prop = await db.property.findUnique({ where: { id } });
  if (!prop) throw notFound("آگهی یافت نشد");
  if (!TRANSITIONS[prop.status]?.includes(to)) {
    throw badRequest(`انتقال وضعیت از «${prop.status}» به «${to}» مجاز نیست`);
  }
  if (to === "REJECTED" && !reason?.trim()) throw badRequest("دلیل رد را وارد کنید");

  const data: Record<string, unknown> = { status: to };
  if (to === "REJECTED") data.rejectionReason = reason!.trim();
  if (to === "PUBLISHED") {
    const settings = await getAllSettings();
    const days = Number(settings["listing.validityDays"] ?? 60) || 60;
    data.publishedAt = prop.publishedAt ?? new Date();
    data.expiresAt = new Date(Date.now() + days * 86400000);
    data.rejectionReason = null;
  }
  if (featured != null) data.isFeatured = featured;
  await db.property.update({ where: { id }, data });

  // notify owner
  const statusFa: Record<string, string> = {
    PUBLISHED: "تأیید و منتشر شد", APPROVED: "تأیید شد (در انتظار انتشار)",
    REJECTED: "رد شد", EXPIRED: "منقضی شد", ARCHIVED: "بایگانی شد", PENDING: "برای بررسی مجدد ارسال شد",
  };
  await db.notification.create({
    data: {
      userId: prop.hostId, type: "LISTING",
      title: "وضعیت آگهی شما تغییر کرد",
      body: `آگهی «${prop.title}» ${statusFa[to] ?? ""}${to === "REJECTED" ? `. دلیل: ${reason}` : ""}.`,
      link: "#/account/listings",
    },
  });
  await audit({ actorId: user.id, action: `LISTING_${to}`, entity: "Property", entityId: id, meta: { reason, featured } });
  return { ok: true };
}

export async function toggleFeatured(user: SafeUser, id: string) {
  adminGuard(user);
  const prop = await db.property.findUnique({ where: { id } });
  if (!prop) throw notFound();
  await db.property.update({ where: { id }, data: { isFeatured: !prop.isFeatured } });
  await audit({ actorId: user.id, action: "LISTING_FEATURE_TOGGLE", entity: "Property", entityId: id, meta: { featured: !prop.isFeatured } });
  return { ok: true, isFeatured: !prop.isFeatured };
}

export async function adminDeleteProperty(user: SafeUser, id: string) {
  adminGuard(user);
  await db.property.delete({ where: { id } });
  await audit({ actorId: user.id, action: "LISTING_ADMIN_DELETE", entity: "Property", entityId: id });
  return { ok: true };
}

// ───────── Complaints (support + listing reports) ─────────
export async function adminComplaints(user: SafeUser, type?: string) {
  adminGuard(user);
  return db.complaint.findMany({
    where: type && type !== "ALL" ? { type } : {},
    include: {
      user: { select: { fullName: true, phone: true } },
      property: { select: { id: true, title: true, code: true } },
      booking: { select: { code: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function replyComplaint(user: SafeUser, id: string, reply: string, status: string) {
  adminGuard(user);
  await db.complaint.update({ where: { id }, data: { adminReply: reply, status } });
  await audit({ actorId: user.id, action: "COMPLAINT_REPLY", entity: "Complaint", entityId: id, meta: { status } });
  return { ok: true };
}

export async function createComplaint(userId: string, data: { bookingId?: string; subject: string; body: string }) {
  if (!data.subject?.trim()) throw badRequest("موضوع را وارد کنید");
  return db.complaint.create({
    data: { userId, type: "SUPPORT", bookingId: data.bookingId || null, subject: data.subject, body: data.body },
  });
}

// ───────── Settings & Audit ─────────
export async function getSettings(user: SafeUser) {
  adminGuard(user);
  return getAllSettings();
}

export async function updateSettings(user: SafeUser, values: Record<string, string>) {
  adminGuard(user);
  for (const [k, v] of Object.entries(values)) {
    if (k in SETTING_DEFAULTS || k.startsWith("cancelPolicy.")) await setSetting(k, String(v));
  }
  await audit({ actorId: user.id, action: "SETTINGS_UPDATE", entity: "SystemSetting", meta: values });
  return getAllSettings();
}

export async function getAuditLogs(user: SafeUser, q?: string) {
  adminGuard(user);
  return db.auditLog.findMany({
    where: q ? { OR: [{ action: { contains: q } }, { actorPhone: { contains: q } }, { entity: { contains: q } }] } : {},
    include: { actor: { select: { fullName: true, phone: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

// re-export for the route layer (legacy finance sections kept functional)
export { requireUser };
