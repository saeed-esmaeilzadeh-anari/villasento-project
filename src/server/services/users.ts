import { db } from "@/lib/db";
import { badRequest, forbidden, notFound } from "../http";
import { audit } from "../audit";
import { isAdmin, PROPERTY_TYPES, TRANSACTION_TYPES, LISTING_STATUS, type SafeUser } from "./properties";
import { hashPassword } from "./password";

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "مدیر ارشد",
  ADMIN: "مدیر",
  AGENT: "مشاور املاک",
  OWNER: "مالک",
  CUSTOMER: "کاربر عادی",
};
const ASSIGNABLE_ROLES = ["SUPER_ADMIN", "ADMIN", "AGENT", "OWNER", "CUSTOMER"];

// ───────── Users ─────────
export async function listUsers(actor: SafeUser, q?: string, role?: string, page = 1, pageSize = 20) {
  if (!isAdmin(actor)) throw forbidden();
  const where: Record<string, unknown> = {};
  if (role && role !== "ALL") {
    where.role = role === "ADMIN" ? { in: ["ADMIN", "SUPER_ADMIN"] } : role;
  }
  if (q) where.OR = [{ fullName: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }];
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      include: {
        _count: { select: { properties: true, favorites: true, visitRequests: true } },
        agentProfile: { select: { agencyName: true, isActive: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    items: users.map((u) => ({
      id: u.id, phone: u.phone, fullName: u.fullName, email: u.email, role: u.role,
      roleLabel: ROLE_LABELS[u.role] ?? u.role,
      isBlocked: u.isBlocked, isHostVerified: u.isHostVerified,
      hasPassword: !!u.passwordHash,
      propertiesCount: u._count.properties,
      favoritesCount: u._count.favorites,
      visitsCount: u._count.visitRequests,
      agencyName: u.agentProfile?.agencyName ?? null,
      createdAt: u.createdAt,
    })),
    total, page, pageSize,
  };
}

export async function userDetail(actor: SafeUser, id: string) {
  if (!isAdmin(actor)) throw forbidden();
  const u = await db.user.findUnique({
    where: { id },
    include: {
      properties: {
        include: { city: { select: { name: true } }, images: { take: 1, orderBy: { sort: "asc" } } },
        orderBy: { createdAt: "desc" },
      },
      agentProfile: true,
      _count: { select: { properties: true, favorites: true, visitRequests: true } },
    },
  });
  if (!u) throw notFound("کاربر یافت نشد");
  const activity = await db.auditLog.findMany({
    where: { actorId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const { passwordHash: _ph, ...safe } = u;
  return { user: safe, activity };
}

export async function toggleUserBlock(actor: SafeUser, id: string) {
  if (!isAdmin(actor)) throw forbidden();
  const target = await db.user.findUnique({ where: { id } });
  if (!target) throw notFound("کاربر یافت نشد");
  if (["ADMIN", "SUPER_ADMIN"].includes(target.role)) throw badRequest("حساب مدیر قابل مسدودسازی نیست");
  if (target.id === actor.id) throw badRequest("حساب خودتان قابل مسدودسازی نیست");
  const updated = await db.user.update({ where: { id }, data: { isBlocked: !target.isBlocked } });
  await audit({ actorId: actor.id, action: updated.isBlocked ? "USER_BLOCK" : "USER_UNBLOCK", entity: "User", entityId: id });
  return { ok: true, isBlocked: updated.isBlocked };
}

export async function setUserRole(actor: SafeUser, id: string, role: string) {
  if (!isAdmin(actor)) throw forbidden();
  if (actor.role !== "SUPER_ADMIN") {
    // only SUPER_ADMIN can grant admin-level roles
    if (["ADMIN", "SUPER_ADMIN"].includes(role)) throw forbidden("فقط مدیر ارشد می‌تواند نقش مدیریتی بدهد");
  }
  if (!ASSIGNABLE_ROLES.includes(role)) throw badRequest("نقش نامعتبر است");
  const target = await db.user.findUnique({ where: { id } });
  if (!target) throw notFound("کاربر یافت نشد");
  if (target.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") throw forbidden();
  await db.user.update({ where: { id }, data: { role } });
  await audit({ actorId: actor.id, action: "USER_ROLE_CHANGE", entity: "User", entityId: id, meta: { role } });
  return { ok: true };
}

// ───────── Agents management ─────────
export async function listAgents(actor: SafeUser) {
  if (!isAdmin(actor)) throw forbidden();
  const agents = await db.user.findMany({
    where: { role: "AGENT" },
    include: {
      agentProfile: true,
      _count: { select: { agentProperties: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const perf = await Promise.all(agents.map(async (a) => {
    const [published, pending, visitsDone] = await Promise.all([
      db.property.count({ where: { agentId: a.id, status: "PUBLISHED" } }),
      db.property.count({ where: { agentId: a.id, status: "PENDING" } }),
      db.visitRequest.count({ where: { assignedToId: a.id, status: "DONE" } }),
    ]);
    const viewsAgg = await db.property.aggregate({ where: { agentId: a.id }, _sum: { viewCount: true } });
    return {
      id: a.id, fullName: a.fullName, phone: a.phone, isBlocked: a.isBlocked,
      profile: a.agentProfile,
      assignedCount: a._count.agentProperties, publishedCount: published, pendingCount: pending,
      visitsDone, totalViews: viewsAgg._sum.viewCount ?? 0,
      createdAt: a.createdAt,
    };
  }));
  return perf;
}

export async function upsertAgent(actor: SafeUser, data: {
  id?: string; fullName: string; phone: string; agencyName?: string; bio?: string;
  licenseNo?: string; phone2?: string; isActive?: boolean; password?: string;
}) {
  if (!isAdmin(actor)) throw forbidden();
  const { normalizePhone } = await import("./auth");
  const phone = normalizePhone(data.phone);
  const profileData = {
    agencyName: data.agencyName ?? null, bio: data.bio ?? null,
    licenseNo: data.licenseNo ?? null, phone2: data.phone2 ?? null,
    isActive: data.isActive ?? true,
  };
  if (data.id) {
    const agent = await db.user.findUnique({ where: { id: data.id }, include: { agentProfile: true } });
    if (!agent) throw notFound("مشاور یافت نشد");
    await db.user.update({ where: { id: data.id }, data: { fullName: data.fullName, phone, ...(data.password ? { passwordHash: hashPassword(data.password) } : {}) } });
    if (agent.agentProfile) await db.agentProfile.update({ where: { userId: data.id }, data: profileData });
    else await db.agentProfile.create({ data: { userId: data.id, ...profileData } });
    await audit({ actorId: actor.id, action: "AGENT_UPDATE", entity: "User", entityId: data.id });
  } else {
    const exists = await db.user.findUnique({ where: { phone } });
    if (exists) throw badRequest("این شماره قبلاً ثبت شده است");
    const agent = await db.user.create({
      data: {
        phone, fullName: data.fullName, role: "AGENT",
        isHostVerified: true,
        passwordHash: data.password ? hashPassword(data.password) : null,
      },
    });
    await db.agentProfile.create({ data: { userId: agent.id, ...profileData } });
    await audit({ actorId: actor.id, action: "AGENT_CREATE", entity: "User", entityId: agent.id });
  }
  return { ok: true };
}

export async function toggleAgentActive(actor: SafeUser, id: string) {
  if (!isAdmin(actor)) throw forbidden();
  const profile = await db.agentProfile.findUnique({ where: { userId: id } });
  if (profile) {
    await db.agentProfile.update({ where: { userId: id }, data: { isActive: !profile.isActive } });
  }
  const agent = await db.user.findUnique({ where: { id } });
  if (!agent) throw notFound();
  await db.user.update({ where: { id }, data: { isHostVerified: !(profile?.isActive ?? false) } });
  await audit({ actorId: actor.id, action: "AGENT_TOGGLE_ACTIVE", entity: "User", entityId: id });
  return { ok: true };
}

/** Assign an agent to a listing */
export async function assignAgent(actor: SafeUser, propertyId: string, agentId: string | null) {
  if (!isAdmin(actor)) throw forbidden();
  const prop = await db.property.findUnique({ where: { id: propertyId } });
  if (!prop) throw notFound("آگهی یافت نشد");
  if (agentId) {
    const agent = await db.user.findFirst({ where: { id: agentId, role: "AGENT" } });
    if (!agent) throw badRequest("مشاور انتخابی یافت نشد");
  }
  await db.property.update({ where: { id: propertyId }, data: { agentId: agentId || null } });
  await audit({ actorId: actor.id, action: "AGENT_ASSIGN", entity: "Property", entityId: propertyId, meta: { agentId } });
  return { ok: true };
}

// ───────── CSV export (Excel-compatible: BOM + CRLF) ─────────
function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function toCsv(rows: Record<string, unknown>[], headers: Record<string, string>): string {
  const head = Object.keys(headers).join(",");
  const lines = rows.map((r) => Object.keys(headers).map((k) => csvEscape(r[k])).join(","));
  return "\uFEFF" + [head, ...lines].join("\r\n");
}

export async function exportCsv(actor: SafeUser, entity: string): Promise<{ filename: string; csv: string }> {
  if (!isAdmin(actor)) throw forbidden();
  if (entity === "listings") {
    const props = await db.property.findMany({
      include: { city: { include: { province: true } }, host: { select: { fullName: true, phone: true } }, agent: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    const csv = toCsv(props.map((p) => ({
      code: p.code, title: p.title,
      type: PROPERTY_TYPES[p.type] ?? p.type,
      transactionType: TRANSACTION_TYPES[p.transactionType] ?? p.transactionType,
      province: p.city.province.name, city: p.city.name,
      status: LISTING_STATUS[p.status] ?? p.status,
      salePrice: p.salePrice ?? "", rahn: p.rahnAmount ?? "", rent: p.rentAmount ?? "",
      land: p.landArea ?? "", build: p.buildArea ?? "",
      bedrooms: p.bedrooms, views: p.viewCount,
      owner: p.host.fullName ?? p.host.phone, agent: p.agent?.fullName ?? "",
      createdAt: p.createdAt.toISOString().slice(0, 10),
    })), {
      code: "کد", title: "عنوان", type: "نوع ملک", transactionType: "نوع معامله",
      province: "استان", city: "شهر", status: "وضعیت",
      salePrice: "قیمت فروش", rahn: "رهن", rent: "اجاره",
      land: "متراژ زمین", build: "متراژ بنا", bedrooms: "خواب",
      views: "بازدید", owner: "ثبت‌کننده", agent: "مشاور", createdAt: "تاریخ ثبت",
    });
    return { filename: "villasento-listings.csv", csv };
  }
  if (entity === "users") {
    const users = await db.user.findMany({ orderBy: { createdAt: "desc" }, take: 5000 });
    const csv = toCsv(users.map((u) => ({
      phone: u.phone, fullName: u.fullName ?? "", email: u.email ?? "",
      role: ROLE_LABELS[u.role] ?? u.role, isBlocked: u.isBlocked ? "بله" : "خیر",
      createdAt: u.createdAt.toISOString().slice(0, 10),
    })), {
      phone: "موبایل", fullName: "نام", email: "ایمیل", role: "نقش", isBlocked: "مسدود", createdAt: "تاریخ عضویت",
    });
    return { filename: "villasento-users.csv", csv };
  }
  if (entity === "visits") {
    const visits = await db.visitRequest.findMany({
      include: { property: { select: { title: true, code: true } }, assignedTo: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" }, take: 5000,
    });
    const csv = toCsv(visits.map((v) => ({
      code: v.code, property: v.property.title, propCode: v.property.code,
      name: v.name, phone: v.phone,
      status: ({ NEW: "جدید", IN_PROGRESS: "در حال پیگیری", DONE: "انجام‌شده", CANCELLED: "لغوشده" } as Record<string, string>)[v.status] ?? v.status,
      agent: v.assignedTo?.fullName ?? "",
      createdAt: v.createdAt.toISOString().slice(0, 16).replace("T", " "),
    })), {
      code: "کد", property: "ملک", propCode: "کد آگهی", name: "متقاضی", phone: "موبایل",
      status: "وضعیت", agent: "مشاور", createdAt: "تاریخ ثبت",
    });
    return { filename: "villasento-visits.csv", csv };
  }
  throw badRequest("نوع خروجی نامعتبر است");
}
