import { db } from "@/lib/db";
import { badRequest, forbidden } from "../http";
import { audit } from "../audit";
import { isAdmin, type SafeUser } from "./properties";
import { normalizePhone } from "./auth";

export const MSG_STATUS: Record<string, string> = {
  NEW: "جدید",
  IN_PROGRESS: "در حال پیگیری",
  DONE: "انجام‌شده",
  CANCELLED: "لغوشده",
};
const MSG_STATUSES = Object.keys(MSG_STATUS);

/** Public contact form — no login required */
export async function createContactMessage(input: {
  name: string; phone: string; email?: string; subject?: string; body: string; propertyId?: string;
}) {
  if (!input.name?.trim()) throw badRequest("نام خود را وارد کنید");
  const phone = normalizePhone(input.phone);
  if (!input.body?.trim() || input.body.trim().length < 10) throw badRequest("متن پیام باید حداقل ۱۰ نویسه باشد");
  if (input.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email)) throw badRequest("ایمیل معتبر نیست");

  let propertyId: string | null = null;
  if (input.propertyId) {
    const p = await db.property.findUnique({ where: { id: input.propertyId }, select: { id: true } });
    propertyId = p?.id ?? null;
  }

  const msg = await db.contactMessage.create({
    data: {
      name: input.name.trim(), phone,
      email: input.email?.trim() || null,
      subject: input.subject?.trim() || null,
      body: input.body.trim(), propertyId,
    },
  });

  const admins = await db.user.findMany({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } }, select: { id: true } });
  if (admins.length) {
    await db.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id, type: "MESSAGE",
        title: "پیام جدید از تماس با ما",
        body: `${msg.name}: ${msg.body.slice(0, 60)}`,
        link: "#/admin/messages",
      })),
    });
  }
  await audit({ action: "CONTACT_MESSAGE", entity: "ContactMessage", entityId: msg.id });
  return { ok: true, id: msg.id };
}

export async function adminMessages(user: SafeUser, status?: string) {
  if (!isAdmin(user)) throw forbidden("این بخش فقط برای مدیران سامانه است");
  return db.contactMessage.findMany({
    where: status && status !== "ALL" ? { status } : {},
    include: { property: { select: { title: true, code: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function adminUpdateMessage(user: SafeUser, id: string, input: { status?: string; adminNote?: string }) {
  if (!isAdmin(user)) throw forbidden("این بخش فقط برای مدیران سامانه است");
  const msg = await db.contactMessage.findUnique({ where: { id } });
  if (!msg) throw badRequest("پیام یافت نشد");
  const data: Record<string, unknown> = {};
  if (input.status) {
    if (!MSG_STATUSES.includes(input.status)) throw badRequest("وضعیت نامعتبر است");
    data.status = input.status;
  }
  if (input.adminNote !== undefined) data.adminNote = input.adminNote;
  await db.contactMessage.update({ where: { id }, data });
  await audit({ actorId: user.id, action: "CONTACT_UPDATE", entity: "ContactMessage", entityId: id, meta: input });
  return { ok: true };
}
