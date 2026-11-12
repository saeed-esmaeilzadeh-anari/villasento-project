import { db } from "@/lib/db";
import { badRequest, forbidden, notFound } from "../http";
import { audit } from "../audit";
import { isAdmin, type SafeUser } from "./properties";
import { normalizePhone } from "./auth";

export const VISIT_STATUS: Record<string, string> = {
  NEW: "جدید",
  IN_PROGRESS: "در حال پیگیری",
  DONE: "انجام‌شده",
  CANCELLED: "لغوشده",
};
const VISIT_STATUSES = Object.keys(VISIT_STATUS);

function genCode() {
  return "VR-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ───────── Create (public form, auth optional) ─────────
export async function createVisitRequest(user: SafeUser | null, input: {
  propertyId: string; name: string; phone: string; note?: string; preferredAt?: string;
}) {
  const prop = await db.property.findUnique({ where: { id: input.propertyId } });
  if (!prop || prop.status !== "PUBLISHED") throw notFound("آگهی برای درخواست بازدید در دسترس نیست");
  const phone = normalizePhone(input.phone);
  if (!input.name?.trim()) throw badRequest("نام و نام خانوادگی را وارد کنید");

  // rate limit: max 5 open visit requests per phone per day
  const recent = await db.visitRequest.count({
    where: { phone, createdAt: { gte: new Date(Date.now() - 86400000) } },
  });
  if (recent >= 5) throw badRequest("تعداد درخواست‌های بازدید امروز شما بیش از حد مجاز است");

  let preferredAt: Date | null = null;
  if (input.preferredAt) {
    const t = new Date(input.preferredAt);
    if (Number.isNaN(t.getTime())) throw badRequest("زمان بازدید نامعتبر است");
    if (t.getTime() < Date.now() - 86400000) throw badRequest("زمان بازدید نمی‌تواند در گذشته باشد");
    preferredAt = t;
  }

  const visit = await db.visitRequest.create({
    data: {
      code: genCode(), propertyId: input.propertyId,
      userId: user?.id ?? null,
      name: input.name.trim(), phone,
      note: input.note?.trim() || null,
      preferredAt,
    },
  });
  await db.visitRequestEvent.create({
    data: { visitRequestId: visit.id, type: "CREATED", toStatus: "NEW" },
  });

  // notify owner + assigned agent + admins (new request)
  const notifyUserIds = new Set<string>([prop.hostId]);
  if (prop.agentId) notifyUserIds.add(prop.agentId);
  const admins = await db.user.findMany({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } }, select: { id: true } });
  for (const a of admins) notifyUserIds.add(a.id);
  await db.notification.createMany({
    data: [...notifyUserIds].map((userId) => ({
      userId, type: "VISIT",
      title: "درخواست بازدید جدید",
      body: `برای «${prop.title}» درخواست بازدید از طرف ${visit.name} ثبت شد.`,
      link: "#/admin/visits",
    })),
  });

  await audit({ actorId: user?.id ?? null, action: "VISIT_REQUEST", entity: "VisitRequest", entityId: visit.id, meta: { propertyId: input.propertyId } });
  return visit;
}

// ───────── Lists ─────────
export async function myVisitRequests(user: SafeUser) {
  const list = await db.visitRequest.findMany({
    where: { OR: [{ userId: user.id }, { phone: user.phone }] },
    include: {
      property: { select: { id: true, title: true, code: true, images: { take: 1, orderBy: { sort: "asc" } } } },
      assignedTo: { select: { fullName: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  return list.map((v) => ({
    id: v.id, code: v.code,
    property: { id: v.property.id, title: v.property.title, code: v.property.code, image: v.property.images[0]?.url ?? null },
    name: v.name, phone: v.phone, note: v.note,
    preferredAt: v.preferredAt, status: v.status, statusLabel: VISIT_STATUS[v.status] ?? v.status,
    assignedTo: v.assignedTo?.fullName ?? null, adminNote: v.adminNote,
    createdAt: v.createdAt,
    events: v.events.map((e) => ({ type: e.type, toStatus: e.toStatus, message: e.message, createdAt: e.createdAt })),
  }));
}

/** Incoming requests for listings the user owns / is agent of */
export async function incomingVisits(user: SafeUser) {
  const props = await db.property.findMany({
    where: { OR: [{ hostId: user.id }, { agentId: user.id }] },
    select: { id: true },
  });
  if (!props.length) return [];
  const list = await db.visitRequest.findMany({
    where: { propertyId: { in: props.map((p) => p.id) } },
    include: {
      property: { select: { id: true, title: true, code: true, images: { take: 1, orderBy: { sort: "asc" } } } },
      assignedTo: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return list.map((v) => ({
    id: v.id, code: v.code,
    property: { id: v.property.id, title: v.property.title, code: v.property.code, image: v.property.images[0]?.url ?? null },
    name: v.name, phone: v.phone, note: v.note,
    preferredAt: v.preferredAt, status: v.status, statusLabel: VISIT_STATUS[v.status] ?? v.status,
    assignedTo: v.assignedTo ? { id: v.assignedTo.id, name: v.assignedTo.fullName } : null,
    adminNote: v.adminNote, createdAt: v.createdAt,
    canManage: true,
  }));
}

// ───────── Owner/agent updates their request status ─────────
export async function updateVisitStatus(user: SafeUser, id: string, status: string) {
  if (!VISIT_STATUSES.includes(status)) throw badRequest("وضعیت نامعتبر است");
  const visit = await db.visitRequest.findUnique({ where: { id }, include: { property: true } });
  if (!visit) throw notFound("درخواست بازدید یافت نشد");
  const isOwner = visit.property.hostId === user.id || visit.property.agentId === user.id;
  if (!isOwner && !isAdmin(user)) throw forbidden();
  const before = visit.status;
  await db.visitRequest.update({ where: { id }, data: { status } });
  await db.visitRequestEvent.create({
    data: { visitRequestId: id, type: "STATUS_CHANGED", fromStatus: before, toStatus: status, actorId: user.id },
  });
  if (visit.userId) {
    await db.notification.create({
      data: {
        userId: visit.userId, type: "VISIT",
        title: "به‌روزرسانی درخواست بازدید",
        body: `وضعیت درخواست بازدید شما (${visit.code}) به «${VISIT_STATUS[status]}» تغییر کرد.`,
        link: "#/account/visits",
      },
    });
  }
  await audit({ actorId: user.id, action: "VISIT_STATUS", entity: "VisitRequest", entityId: id, meta: { from: before, to: status } });
  return { ok: true };
}

// ───────── Admin management ─────────
export async function adminVisits(user: SafeUser, status?: string) {
  if (!isAdmin(user)) throw forbidden("این بخش فقط برای مدیران سامانه است");
  const list = await db.visitRequest.findMany({
    where: status && status !== "ALL" ? { status } : {},
    include: {
      property: { select: { id: true, title: true, code: true } },
      user: { select: { fullName: true, phone: true } },
      assignedTo: { select: { id: true, fullName: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return list;
}

export async function adminUpdateVisit(user: SafeUser, id: string, input: {
  status?: string; assignedToId?: string | null; adminNote?: string;
}) {
  if (!isAdmin(user)) throw forbidden("این بخش فقط برای مدیران سامانه است");
  const visit = await db.visitRequest.findUnique({ where: { id } });
  if (!visit) throw notFound("درخواست بازدید یافت نشد");
  const data: Record<string, unknown> = {};
  if (input.status) {
    if (!VISIT_STATUSES.includes(input.status)) throw badRequest("وضعیت نامعتبر است");
    data.status = input.status;
  }
  if (input.assignedToId !== undefined) {
    if (input.assignedToId) {
      const agent = await db.user.findUnique({ where: { id: input.assignedToId } });
      if (!agent) throw badRequest("مشاور انتخابی یافت نشد");
    }
    data.assignedToId = input.assignedToId || null;
  }
  if (input.adminNote !== undefined) data.adminNote = input.adminNote;
  await db.visitRequest.update({ where: { id }, data });
  if (input.status) {
    await db.visitRequestEvent.create({
      data: { visitRequestId: id, type: "STATUS_CHANGED", fromStatus: visit.status, toStatus: input.status, actorId: user.id },
    });
  }
  if (input.assignedToId) {
    await db.visitRequestEvent.create({
      data: { visitRequestId: id, type: "ASSIGN", actorId: user.id, message: input.assignedToId },
    });
    await db.notification.create({
      data: {
        userId: input.assignedToId, type: "VISIT",
        title: "درخواست بازدید به شما تخصیص یافت",
        body: `درخواست ${visit.code} برای پیگیری به شما تخصیص یافت.`,
        link: "#/account/visits",
      },
    });
  }
  await audit({ actorId: user.id, action: "VISIT_ADMIN_UPDATE", entity: "VisitRequest", entityId: id, meta: input });
  return { ok: true };
}

export async function adminAgents(user: SafeUser) {
  if (!isAdmin(user)) throw forbidden("این بخش فقط برای مدیران سامانه است");
  return db.user.findMany({
    where: { role: { in: ["AGENT"] } },
    select: { id: true, fullName: true, phone: true, isBlocked: true, isHostVerified: true, agentProfile: true },
    orderBy: { createdAt: "desc" },
  });
}
