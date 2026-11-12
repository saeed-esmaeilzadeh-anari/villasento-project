import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { badRequest, forbidden, notFound } from "../../common/api-error";
import { ACTIVE_STATUSES, PROPERTY_TYPES } from "../../common/constants";
import { AuditService } from "../../common/services/audit.service";
import {
  addDays,
  diffDays,
  isValidDateStr,
  nightsOf,
  isWeekend,
  todayStr,
} from "../../common/dates.util";
import type { SafeUser } from "../../common/session.middleware";
import type { PropertyInput, SearchParams } from "./properties.types";

@Injectable()
export class PropertiesService {
  constructor(
    private prisma: PrismaService,
    private auditSrv: AuditService,
  ) {}

  /** Search with REAL database-backed filters + availability window */
  async searchProperties(p: SearchParams) {
    const page = Math.max(1, p.page ?? 1);
    const pageSize = Math.min(24, Math.max(1, p.pageSize ?? 9));

    const guests = (p.adults ?? 0) + (p.children ?? 0);
    const where: Record<string, unknown> = { status: "PUBLISHED" };

    if (p.q) {
      where.OR = [
        { title: { contains: p.q } },
        { description: { contains: p.q } },
        { address: { contains: p.q } },
      ];
    }
    if (p.cityId) where.cityId = p.cityId;
    if (p.provinceId) where.city = { provinceId: p.provinceId };
    if (guests > 0) where.capacity = { gte: guests };
    if (p.minPrice != null || p.maxPrice != null) {
      where.OR = [
        ...(p.minPrice != null ? [{ basePrice: { gte: p.minPrice } }] : []),
        ...(p.maxPrice != null ? [{ basePrice: { lte: p.maxPrice } }] : []),
      ];
    }
    if (p.types?.length) where.type = { in: p.types };
    if (p.instantOnly) where.instantBooking = true;
    if (p.featuredOnly) where.isFeatured = true;

    if (p.amenities?.length) {
      where.amenities = { some: { amenity: { key: { in: p.amenities } } } };
    }

    // Availability: exclude properties with overlapping active bookings or blocked days
    if (p.checkIn && p.checkOut && isValidDateStr(p.checkIn) && isValidDateStr(p.checkOut) && p.checkOut > p.checkIn) {
      const busyProps = await this.prisma.booking.findMany({
        where: {
          status: { in: ACTIVE_STATUSES },
          checkIn: { lt: p.checkOut },
          checkOut: { gt: p.checkIn },
        },
        select: { propertyId: true },
      });
      const blockedProps = await this.prisma.calendarDay.findMany({
        where: { isBlocked: true, date: { gte: p.checkIn, lt: p.checkOut } },
        select: { propertyId: true },
      });
      const exclude = [
        ...new Set([...busyProps.map((b) => b.propertyId), ...blockedProps.map((b) => b.propertyId)]),
      ];
      where.id = { notIn: exclude };
      where.minNights = { lte: Math.max(1, diffDays(p.checkIn, p.checkOut)) };
    }

    const orderBy: Record<string, string | object>[] =
      p.sort === "PRICE_ASC" ? [{ basePrice: "asc" }]
      : p.sort === "PRICE_DESC" ? [{ basePrice: "desc" }]
      : p.sort === "RATING" ? [{ ratingAvg: "desc" }, { reviewCount: "desc" }]
      : p.sort === "NEWEST" ? [{ createdAt: "desc" }]
      : [{ isFeatured: "desc" }, { ratingAvg: "desc" }];

    const [total, items] = await Promise.all([
      this.prisma.property.count({ where }),
      this.prisma.property.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          city: { include: { province: true } },
          images: { orderBy: { sort: "asc" } },
          amenities: { include: { amenity: true } },
          host: { select: { fullName: true, isHostVerified: true } },
        },
      }),
    ]);

    return {
      items: items.map((pr) => this.mapCard(pr as never)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  mapCard(pr: {
    id: string; title: string; type: string; capacity: number; bedrooms: number; beds: number;
    basePrice: number; weekendPrice: number; cleaningFee: number; ratingAvg: number; reviewCount: number;
    instantBooking: boolean; isFeatured: boolean; lat: number | null; lng: number | null;
    city: { name: string; province: { name: string } };
    images: { url: string }[];
    amenities: { amenity: { key: string; name: string; icon: string } }[];
    host: { fullName: string | null; isHostVerified: boolean };
  }) {
    return {
      id: pr.id,
      title: pr.title,
      type: pr.type,
      typeLabel: PROPERTY_TYPES[pr.type] ?? pr.type,
      city: pr.city.name,
      province: pr.city.province.name,
      capacity: pr.capacity,
      bedrooms: pr.bedrooms,
      beds: pr.beds,
      basePrice: pr.basePrice,
      weekendPrice: pr.weekendPrice,
      cleaningFee: pr.cleaningFee,
      rating: pr.ratingAvg,
      reviewCount: pr.reviewCount,
      instantBooking: pr.instantBooking,
      isFeatured: pr.isFeatured,
      image: pr.images[0]?.url ?? null,
      imageCount: pr.images.length,
      amenities: pr.amenities.slice(0, 6).map((a) => a.amenity),
      hostVerified: pr.host?.isHostVerified ?? false,
      lat: pr.lat,
      lng: pr.lng,
    };
  }

  /** Detail + calendar + reviews */
  async propertyDetail(id: string, viewer?: SafeUser | null, days = 90) {
    const prop = await this.prisma.property.findUnique({
      where: { id },
      include: {
        city: { include: { province: true } },
        images: { orderBy: { sort: "asc" } },
        amenities: { include: { amenity: true } },
        host: { select: { id: true, fullName: true, phone: true, isHostVerified: true, createdAt: true } },
      },
    });
    if (!prop) throw notFound("اقامتگاه یافت نشد");

    const isHostOrAdmin = viewer && (viewer.id === prop.hostId || viewer.role === "ADMIN");
    if (prop.status !== "PUBLISHED" && !isHostOrAdmin) throw notFound("این اقامتگاه در دسترس نیست");

    const [reviews, calendar] = await Promise.all([
      this.prisma.review.findMany({
        where: { propertyId: id, status: "APPROVED" },
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.calendarDay.findMany({
        where: { propertyId: id, date: { gte: todayStr(), lte: addDays(todayStr(), days) } },
      }),
    ]);

    // Active bookings in window (to grey out on calendar)
    const activeBookings = await this.prisma.booking.findMany({
      where: {
        propertyId: id,
        status: { in: ACTIVE_STATUSES },
        checkOut: { gte: todayStr() },
      },
      select: { checkIn: true, checkOut: true },
    });

    if (viewer?.id !== prop.hostId) {
      await this.prisma
        .property.update({ where: { id }, data: { viewCount: { increment: 1 } } })
        .catch(() => undefined);
    }

    const favorited = viewer
      ? !!(await this.prisma.favorite.findUnique({
          where: { userId_propertyId: { userId: viewer.id, propertyId: id } },
        }))
      : false;

    return {
      ...this.mapCard(prop as never),
      description: prop.description,
      address: prop.address,
      checkInTime: prop.checkInTime,
      checkOutTime: prop.checkOutTime,
      rules: prop.rules,
      cancelPolicy: prop.cancelPolicy,
      minNights: prop.minNights,
      deposit: prop.deposit,
      status: prop.status,
      rejectionReason: prop.rejectionReason,
      viewCount: prop.viewCount,
      allAmenities: prop.amenities.map((a) => a.amenity),
      images: prop.images.map((i) => i.url),
      host: prop.host,
      reviews: reviews.map((r) => ({
        id: r.id, rating: r.rating, cleanliness: r.cleanliness, accuracy: r.accuracy, location: r.location,
        comment: r.comment, hostReply: r.hostReply, createdAt: r.createdAt,
        user: { fullName: r.user.fullName ?? "مهمان" },
      })),
      calendar: calendar.map((c) => ({ date: c.date, price: c.price, isBlocked: c.isBlocked })),
      activeBookings,
      favorited,
    };
  }

  // ───────────────────────── Host CRUD ─────────────────────────

  async createProperty(host: SafeUser, input: PropertyInput) {
    if (!input.title?.trim()) throw badRequest("عنوان اقامتگاه الزامی است");
    if (!input.cityId) throw badRequest("شهر را انتخاب کنید");
    const city = await this.prisma.city.findUnique({ where: { id: input.cityId } });
    if (!city) throw badRequest("شهر نامعتبر است");

    const prop = await this.prisma.property.create({
      data: {
        hostId: host.id,
        title: input.title.trim(),
        type: input.type && input.type in PROPERTY_TYPES ? input.type : "VILLA",
        description: input.description ?? "",
        cityId: input.cityId,
        address: input.address ?? "",
        lat: input.lat,
        lng: input.lng,
        capacity: input.capacity ?? 4,
        bedrooms: input.bedrooms ?? 2,
        beds: input.beds ?? 3,
        basePrice: input.basePrice ?? 1000000,
        weekendPrice: input.weekendPrice ?? Math.round((input.basePrice ?? 1000000) * 1.4),
        cleaningFee: input.cleaningFee ?? 0,
        deposit: input.deposit ?? 0,
        minNights: input.minNights ?? 1,
        checkInTime: input.checkInTime ?? "14:00",
        checkOutTime: input.checkOutTime ?? "12:00",
        rules: input.rules ?? "",
        cancelPolicy: input.cancelPolicy ?? "MODERATE",
        instantBooking: input.instantBooking ?? false,
        status: input.submit ? "PENDING" : "DRAFT",
      },
    });

    if (input.images?.length) {
      await this.prisma.propertyImage.createMany({
        data: input.images.slice(0, 15).map((url, i) => ({ propertyId: prop.id, url, sort: i })),
      });
    }
    if (input.amenityKeys?.length) {
      const amenities = await this.prisma.amenity.findMany({ where: { key: { in: input.amenityKeys } } });
      await this.prisma.propertyAmenity.createMany({
        data: amenities.map((a) => ({ propertyId: prop.id, amenityId: a.id })),
      });
    }

    // If host role was only CUSTOMER, promote
    if (host.role === "CUSTOMER") {
      await this.prisma.user.update({ where: { id: host.id }, data: { role: "HOST" } });
    }

    await this.auditSrv.audit({ actorId: host.id, action: "PROPERTY_CREATE", entity: "Property", entityId: prop.id });
    return prop;
  }

  private async assertOwnership(user: SafeUser, propertyId: string) {
    const prop = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!prop) throw notFound("اقامتگاه یافت نشد");
    if (prop.hostId !== user.id && user.role !== "ADMIN") throw forbidden();
    return prop;
  }

  async updateProperty(user: SafeUser, id: string, input: PropertyInput) {
    await this.assertOwnership(user, id);
    const data: Record<string, unknown> = {};
    const strFields = ["title", "description", "address", "checkInTime", "checkOutTime", "rules", "cancelPolicy", "type"] as const;
    for (const f of strFields) if (input[f] != null) data[f] = input[f];
    const numFields = ["capacity", "bedrooms", "beds", "basePrice", "weekendPrice", "cleaningFee", "deposit", "minNights"] as const;
    for (const f of numFields) if (input[f] != null) data[f] = input[f];
    if (input.lat != null) data.lat = input.lat;
    if (input.lng != null) data.lng = input.lng;
    if (input.instantBooking != null) data.instantBooking = input.instantBooking;
    if (input.cityId) data.cityId = input.cityId;
    if (input.submit) {
      data.status = "PENDING";
      data.rejectionReason = null;
    }

    const updated = await this.prisma.property.update({ where: { id }, data });

    if (input.images) {
      await this.prisma.propertyImage.deleteMany({ where: { propertyId: id } });
      await this.prisma.propertyImage.createMany({
        data: input.images.slice(0, 15).map((url, i) => ({ propertyId: id, url, sort: i })),
      });
    }
    if (input.amenityKeys) {
      await this.prisma.propertyAmenity.deleteMany({ where: { propertyId: id } });
      const amenities = await this.prisma.amenity.findMany({ where: { key: { in: input.amenityKeys } } });
      await this.prisma.propertyAmenity.createMany({
        data: amenities.map((a) => ({ propertyId: id, amenityId: a.id })),
      });
    }

    await this.auditSrv.audit({ actorId: user.id, action: "PROPERTY_UPDATE", entity: "Property", entityId: id });
    return updated;
  }

  async deleteProperty(user: SafeUser, id: string) {
    await this.assertOwnership(user, id);
    const hasBookings = await this.prisma.booking.count({
      where: { propertyId: id, status: { in: ACTIVE_STATUSES } },
    });
    if (hasBookings > 0) throw badRequest("این اقامتگاه رزرو فعال دارد و قابل حذف نیست");
    await this.prisma.property.delete({ where: { id } });
    await this.auditSrv.audit({ actorId: user.id, action: "PROPERTY_DELETE", entity: "Property", entityId: id });
    return { ok: true };
  }

  async hostProperties(host: SafeUser) {
    const props = await this.prisma.property.findMany({
      where: { hostId: host.id },
      include: {
        city: { include: { province: true } },
        images: { orderBy: { sort: "asc" }, take: 1 },
        _count: { select: { bookings: true, reviews: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return props.map((p) => ({
      id: p.id, title: p.title, type: p.type, typeLabel: PROPERTY_TYPES[p.type] ?? p.type,
      city: p.city.name, province: p.city.province.name,
      status: p.status, rejectionReason: p.rejectionReason,
      basePrice: p.basePrice, weekendPrice: p.weekendPrice, capacity: p.capacity,
      rating: p.ratingAvg, reviewCount: p.reviewCount,
      image: p.images[0]?.url ?? null,
      bookingsCount: p._count.bookings, reviewsCount: p._count.reviews,
      createdAt: p.createdAt,
    }));
  }

  // ───────────────────────── Host calendar ─────────────────────────

  async hostCalendar(user: SafeUser, propertyId: string, from: string, to: string) {
    await this.assertOwnership(user, propertyId);
    const prop = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!prop) throw notFound("اقامتگاه یافت نشد");
    const existing = await this.prisma.calendarDay.findMany({
      where: { propertyId, date: { gte: from, lte: to } },
    });
    const bookings = await this.prisma.booking.findMany({
      where: {
        propertyId,
        status: { in: ACTIVE_STATUSES },
        checkOut: { gte: from },
        checkIn: { lte: to },
      },
      select: { checkIn: true, checkOut: true, code: true, status: true, guestName: true },
    });
    return {
      property: { id: prop.id, title: prop.title, basePrice: prop.basePrice, weekendPrice: prop.weekendPrice },
      from,
      to,
      days: existing.map((d) => ({ date: d.date, price: d.price, isBlocked: d.isBlocked, note: d.note })),
      bookings,
    };
  }

  async updateCalendarDays(
    user: SafeUser,
    propertyId: string,
    updates: { date: string; price?: number | null; isBlocked?: boolean; note?: string | null }[],
  ) {
    await this.assertOwnership(user, propertyId);
    const prop = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!prop) throw notFound();

    for (const u of updates.slice(0, 400)) {
      if (!isValidDateStr(u.date)) continue;
      const data: Record<string, unknown> = {};
      if (u.price != null) data.price = u.price;
      if (u.isBlocked != null) data.isBlocked = u.isBlocked;
      if (u.note !== undefined) data.note = u.note;
      await this.prisma.calendarDay.upsert({
        where: { propertyId_date: { propertyId, date: u.date } },
        create: {
          propertyId,
          date: u.date,
          price: u.price ?? null,
          isBlocked: u.isBlocked ?? false,
          note: u.note ?? null,
        },
        update: data,
      });
    }
    await this.auditSrv.audit({
      actorId: user.id, action: "CALENDAR_UPDATE", entity: "Property", entityId: propertyId,
      meta: { count: updates.length },
    });
    return { ok: true, updated: updates.length };
  }
}
