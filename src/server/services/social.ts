import { db } from "@/lib/db";
import { badRequest, forbidden, notFound } from "../http";
import { audit } from "../audit";
import { requireUser, type SafeUser } from "../session";
import { BOOKING_STATUS } from "./bookings";
import { todayStr } from "../dates";

// ───────── Reviews ─────────
export async function createReview(user: SafeUser, bookingId: string, data: {
  rating: number; cleanliness: number; accuracy: number; location: number; comment: string;
}) {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { property: true } });
  if (!booking) throw notFound("رزرو یافت نشد");
  if (booking.userId !== user.id) throw forbidden();
  if (booking.status !== BOOKING_STATUS.COMPLETED && !(booking.status === BOOKING_STATUS.CONFIRMED && booking.checkOut < todayStr()))
    throw badRequest("پس از تکمیل اقامت می‌توانید نظر ثبت کنید");
  if (booking.checkOut >= todayStr()) throw badRequest("ثبت نظر پس از پایان اقامت امکان‌پذیر است");
  const existing = await db.review.findUnique({ where: { bookingId } });
  if (existing) throw badRequest("برای این رزرو قبلاً نظر ثبت شده است");
  if (data.rating < 1 || data.rating > 5) throw badRequest("امتیاز باید بین ۱ تا ۵ باشد");

  const review = await db.review.create({
    data: {
      propertyId: booking.propertyId, userId: user.id, bookingId,
      rating: data.rating, cleanliness: data.cleanliness, accuracy: data.accuracy,
      location: data.location, comment: data.comment,
      status: "APPROVED", // auto-approve; admin can reject later
    },
  });

  // Recalculate property rating
  const agg = await db.review.aggregate({
    where: { propertyId: booking.propertyId, status: "APPROVED" },
    _avg: { rating: true }, _count: true,
  });
  await db.property.update({
    where: { id: booking.propertyId },
    data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, reviewCount: agg._count },
  });

  await audit({ actorId: user.id, action: "REVIEW_CREATE", entity: "Review", entityId: review.id });
  return review;
}

// ───────── Favorites ─────────
export async function listFavorites(user: SafeUser) {
  const favs = await db.favorite.findMany({
    where: { userId: user.id },
    include: {
      property: {
        include: {
          city: { include: { province: true } },
          images: { orderBy: { sort: "asc" }, take: 1 },
          amenities: { include: { amenity: true } },
          host: { select: { fullName: true, isHostVerified: true } },
          agent: { select: { fullName: true, isHostVerified: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return favs
    .filter((f) => f.property.status === "PUBLISHED")
    .map((f) => ({
      id: f.property.id,
      code: f.property.code,
      title: f.property.title,
      type: f.property.type,
      typeLabel: f.property.type,
      transactionType: f.property.transactionType,
      ttLabel: f.property.transactionType,
      city: f.property.city.name,
      province: f.property.city.province.name,
      area: null,
      landArea: f.property.landArea,
      buildArea: f.property.buildArea,
      bedrooms: f.property.bedrooms,
      bathrooms: f.property.bathrooms,
      buildYear: f.property.buildYear,
      documentStatus: f.property.documentStatus,
      docLabel: f.property.documentStatus,
      salePrice: f.property.salePrice,
      rahnAmount: f.property.rahnAmount,
      rentAmount: f.property.rentAmount,
      negotiable: f.property.negotiable,
      isFeatured: f.property.isFeatured,
      viewCount: f.property.viewCount,
      publishedAt: f.property.publishedAt,
      updatedAt: f.property.updatedAt,
      createdAt: f.property.createdAt,
      image: f.property.images[0]?.url ?? null,
      imageCount: f.property.images.length,
      amenities: f.property.amenities.slice(0, 5).map((a) => a.amenity),
      lat: f.property.lat,
      lng: f.property.lng,
      ownerName: f.property.agent?.fullName ?? f.property.host?.fullName ?? null,
      verified: !!(f.property.agent?.isHostVerified || f.property.host?.isHostVerified),
      address: f.property.address,
    }));
}

export async function toggleFavorite(user: SafeUser, propertyId: string) {
  const existing = await db.favorite.findUnique({
    where: { userId_propertyId: { userId: user.id, propertyId } },
  });
  if (existing) {
    await db.favorite.delete({ where: { userId_propertyId: { userId: user.id, propertyId } } });
    return { favorited: false };
  }
  await db.favorite.create({ data: { userId: user.id, propertyId } });
  return { favorited: true };
}

// ───────── Messaging ─────────
export async function listConversations(user: SafeUser) {
  const convs = await db.conversation.findMany({
    where: { OR: [{ hostId: user.id }, { customerId: user.id }] },
    include: {
      property: { select: { id: true, title: true, images: { take: 1, orderBy: { sort: "asc" } } } },
      host: { select: { id: true, fullName: true, phone: true } },
      customer: { select: { id: true, fullName: true, phone: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { lastMessageAt: "desc" },
  });
  return convs.map((c) => {
    const other = c.customerId === user.id ? c.host : c.customer;
    const last = c.messages[0];
    return {
      id: c.id,
      property: { id: c.property.id, title: c.property.title, image: c.property.images[0]?.url ?? null },
      other: { id: other.id, name: other.fullName ?? other.phone, phone: other.phone },
      lastMessage: last ? { text: last.text, createdAt: last.createdAt, senderId: last.senderId } : null,
      lastMessageAt: c.lastMessageAt,
    };
  });
}

export async function getMessages(user: SafeUser, conversationId: string) {
  const conv = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!conv || (conv.hostId !== user.id && conv.customerId !== user.id)) throw notFound("گفت‌وگو یافت نشد");
  const msgs = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  // mark incoming as read
  await db.message.updateMany({
    where: { conversationId, senderId: { not: user.id }, readAt: null },
    data: { readAt: new Date() },
  });
  return {
    conversation: {
      id: conv.id, propertyId: conv.propertyId, hostId: conv.hostId, customerId: conv.customerId,
    },
    messages: msgs.map((m) => ({
      id: m.id, text: m.text, senderId: m.senderId, createdAt: m.createdAt, readAt: m.readAt,
    })),
  };
}

export async function sendMessage(user: SafeUser, conversationId: string | null, propertyId: string | null, text: string) {
  text = text.trim();
  if (!text) throw badRequest("متن پیام خالی است");
  let conv;
  if (conversationId) {
    conv = await db.conversation.findUnique({ where: { id: conversationId } });
    if (!conv || (conv.hostId !== user.id && conv.customerId !== user.id)) throw notFound("گفت‌وگو یافت نشد");
  } else {
    if (!propertyId) throw badRequest("اقامتگاه مشخص نیست");
    const prop = await db.property.findUnique({ where: { id: propertyId } });
    if (!prop) throw notFound("اقامتگاه یافت نشد");
    conv = await db.conversation.upsert({
      where: { propertyId_customerId: { propertyId, customerId: user.id } },
      create: { propertyId, hostId: prop.hostId, customerId: user.id },
      update: { lastMessageAt: new Date() },
    });
  }
  const msg = await db.message.create({
    data: { conversationId: conv.id, senderId: user.id, text },
  });
  await db.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: new Date() } });
  const otherId = conv.customerId === user.id ? conv.hostId : conv.customerId;
  await db.notification.create({
    data: { userId: otherId, type: "MESSAGE", title: "پیام جدید", body: text.slice(0, 80), link: "/account?tab=messages" },
  });
  return { id: msg.id, text: msg.text, senderId: msg.senderId, createdAt: msg.createdAt };
}

// ───────── Notifications ─────────
export async function listNotifications(user: SafeUser) {
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return { items, unread };
}

export async function markNotificationsRead(user: SafeUser, ids?: string[]) {
  await db.notification.updateMany({
    where: { userId: user.id, ...(ids?.length ? { id: { in: ids } } : {}), readAt: null },
    data: { readAt: new Date() },
  });
  return { ok: true };
}
