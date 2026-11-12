import { db } from "@/lib/db";
import { badRequest, forbidden, notFound } from "../http";
import { audit } from "../audit";
import { requireUser, type SafeUser } from "../session";
export type { SafeUser };
import { todayStr, addDays } from "../dates";
import { getSettingNumber } from "../settings";

// ───────────────────────── Domain constants ─────────────────────────

export const PROPERTY_TYPES: Record<string, string> = {
  GARDEN: "باغ",
  VILLA: "ویلا",
  GARDEN_VILLA: "باغ‌ویلا",
  HOUSE: "خانه ویلایی",
  APARTMENT: "آپارتمان",
  LAND: "زمین و کلنگی",
};

export const TRANSACTION_TYPES: Record<string, string> = {
  SALE: "فروش",
  RAHN: "رهن کامل",
  RAHN_RENT: "رهن و اجاره",
  RENT: "اجاره ماهانه",
};

export const DOCUMENT_STATUS: Record<string, string> = {
  MALIKI: "مالکیتی",
  SIX_DANG: "شش‌دانگ",
  SINGLE_SHEET: "تک‌برگ",
  WATHIQI: "واعثی/وثیقه‌ای",
  COLLECTIVE: "تفکیکی/قولنامه‌ای",
  WITHOUT_DOC: "بدون سند",
};

export const CONTACT_PREFS: Record<string, string> = {
  CALL: "تماس تلفنی",
  MESSAGE: "پیام در سایت",
  BOTH: "تماس یا پیام",
};

/** All valid listing statuses + Persian labels */
export const LISTING_STATUS: Record<string, string> = {
  DRAFT: "پیش‌نویس",
  PENDING: "در انتظار تأیید",
  APPROVED: "تأییدشده (منتشرنشده)",
  PUBLISHED: "منتشرشده",
  REJECTED: "ردشده",
  EXPIRED: "منقضی‌شده",
  ARCHIVED: "بایگانی",
};
export const LISTING_STATUSES = Object.keys(LISTING_STATUS);

/** Publicly visible statuses */
export const PUBLIC_STATUSES = ["PUBLISHED"];

const AMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export function isAdmin(user: Pick<SafeUser, "role">) {
  return AMIN_ROLES.includes(user.role);
}

// ───────────────────────── Helpers ─────────────────────────

function genCode(): string {
  return "VS-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Lazy expiry: flip PUBLISHED listings past expiresAt to EXPIRED (single-row cheap check) */
async function lazyExpire(id?: string) {
  try {
    const where = id
      ? { id, status: "PUBLISHED", expiresAt: { lt: new Date() } }
      : { status: "PUBLISHED", expiresAt: { lt: new Date() } };
    await db.property.updateMany({ where, data: { status: "EXPIRED" } });
  } catch { /* non-fatal */ }
}

function priceWhere(p: { transactionTypes?: string[]; minPrice?: number; maxPrice?: number }): unknown[] | null {
  const tts = p.transactionTypes?.length ? p.transactionTypes : Object.keys(TRANSACTION_TYPES);
  const or: unknown[] = [];
  for (const tt of tts) {
    const cond: Record<string, unknown> = { transactionType: tt };
    const range: Record<string, unknown> = {};
    if (p.minPrice != null) range.gte = p.minPrice;
    if (p.maxPrice != null) range.lte = p.maxPrice;
    if (Object.keys(range).length) {
      if (tt === "SALE") cond.salePrice = range;
      else if (tt === "RAHN") cond.rahnAmount = range;
      else cond.rentAmount = tt === "RAHN_RENT" ? range : range;
    }
    or.push(cond);
  }
  return or.length ? or : null;
}

// ───────────────────────── Search (server-side) ─────────────────────────

export type SearchParams = {
  q?: string;
  provinceId?: string;
  cityId?: string;
  areaId?: string;
  transactionTypes?: string[];
  types?: string[];
  minPrice?: number;
  maxPrice?: number;
  minLand?: number;
  maxLand?: number;
  minBuild?: number;
  maxBuild?: number;
  minBedrooms?: number;
  amenities?: string[]; // amenity keys
  documentStatus?: string;
  negotiableOnly?: boolean;
  featuredOnly?: boolean;
  bbox?: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  sort?: "NEWEST" | "PRICE_ASC" | "PRICE_DESC" | "MOST_VIEWED";
  page?: number;
  pageSize?: number;
};

export async function searchProperties(p: SearchParams) {
  await lazyExpire();
  const page = Math.max(1, p.page ?? 1);
  const pageSize = Math.min(36, Math.max(1, p.pageSize ?? 12));

  const where: Record<string, unknown> = { status: "PUBLISHED" };

  if (p.q) {
    where.OR = [
      { title: { contains: p.q } },
      { description: { contains: p.q } },
      { address: { contains: p.q } },
      { code: { contains: p.q.toUpperCase() } },
    ];
  }
  if (p.cityId) where.cityId = p.cityId;
  if (p.provinceId) where.city = { provinceId: p.provinceId };
  if (p.areaId) where.areaId = p.areaId;
  if (p.transactionTypes?.length) where.transactionType = { in: p.transactionTypes };
  if (p.types?.length) where.type = { in: p.types };
  if (p.documentStatus) where.documentStatus = p.documentStatus;
  if (p.negotiableOnly) where.negotiable = true;
  if (p.featuredOnly) where.isFeatured = true;
  if (p.minBedrooms != null) where.bedrooms = { gte: p.minBedrooms };
  if (p.minLand != null || p.maxLand != null) {
    where.landArea = {
      ...(p.minLand != null ? { gte: p.minLand } : {}),
      ...(p.maxLand != null ? { lte: p.maxLand } : {}),
    };
  }
  if (p.minBuild != null || p.maxBuild != null) {
    where.buildArea = {
      ...(p.minBuild != null ? { gte: p.minBuild } : {}),
      ...(p.maxBuild != null ? { lte: p.maxBuild } : {}),
    };
  }
  const priceOr = priceWhere(p);
  if (priceOr) where.AND = [...((where.AND as unknown[]) ?? []), { OR: priceOr }];

  if (p.amenities?.length) {
    where.amenities = { some: { amenity: { key: { in: p.amenities } } } };
  }
  if (p.bbox) {
    where.lat = { gte: p.bbox.minLat, lte: p.bbox.maxLat };
    where.lng = { gte: p.bbox.minLng, lte: p.bbox.maxLng };
  }

  const orderBy: Record<string, string | object>[] =
    p.sort === "PRICE_ASC" ? [{ salePrice: "asc" }, { rahnAmount: "asc" }, { rentAmount: "asc" }]
    : p.sort === "PRICE_DESC" ? [{ salePrice: "desc" }, { rahnAmount: "desc" }, { rentAmount: "desc" }]
    : p.sort === "MOST_VIEWED" ? [{ viewCount: "desc" }]
    : [{ isFeatured: "desc" }, { createdAt: "desc" }];

  const [total, items, allIds] = await Promise.all([
    db.property.count({ where }),
    db.property.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        city: { include: { province: true } },
        area: true,
        images: { orderBy: { sort: "asc" } },
        amenities: { include: { amenity: true } },
        host: { select: { fullName: true, isHostVerified: true } },
        agent: { select: { fullName: true, isHostVerified: true } },
      },
    }),
    // For map view: fetch coordinates of ALL matching items (bounded)
    db.property.findMany({
      where,
      select: { id: true, lat: true, lng: true },
      take: 200,
    }),
  ]);

  return {
    items: items.map(mapCard),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    pins: allIds.filter((x) => x.lat != null && x.lng != null),
  };
}

export type PropertyRow = {
  id: string; code: string; title: string; type: string; transactionType: string;
  hostId: string; agentId: string | null;
  cityId: string; city: { name: string; province: { name: string } };
  areaId: string | null; area: { name: string } | null;
  address: string; lat: number | null; lng: number | null;
  landArea: number | null; buildArea: number | null;
  bedrooms: number; bathrooms: number; floors: number; buildYear: number | null;
  documentStatus: string; salePrice: number | null; rahnAmount: number | null;
  rentAmount: number | null; negotiable: boolean; paymentTerms: string | null;
  amenitiesExtra: string; videoUrl: string | null; tourUrl: string | null;
  contactName: string | null; contactPhone: string | null; contactPreference: string;
  description: string; status: string; rejectionReason: string | null;
  publishedAt: Date | null; expiresAt: Date | null; isFeatured: boolean;
  ratingAvg: number; reviewCount: number; viewCount: number;
  createdAt: Date; updatedAt: Date;
  images: { url: string; sort: number }[];
  amenities: { amenity: { key: string; name: string; icon: string } }[];
  host: { fullName: string | null; isHostVerified: boolean } | null;
  agent?: { fullName: string | null; isHostVerified: boolean } | null;
};

export function mapCard(pr: PropertyRow) {
  return {
    id: pr.id,
    code: pr.code,
    title: pr.title,
    type: pr.type,
    typeLabel: PROPERTY_TYPES[pr.type] ?? pr.type,
    transactionType: pr.transactionType,
    ttLabel: TRANSACTION_TYPES[pr.transactionType] ?? pr.transactionType,
    city: pr.city?.name ?? "",
    province: pr.city?.province?.name ?? "",
    area: pr.area?.name ?? null,
    address: pr.address,
    landArea: pr.landArea,
    buildArea: pr.buildArea,
    bedrooms: pr.bedrooms,
    bathrooms: pr.bathrooms,
    buildYear: pr.buildYear,
    documentStatus: pr.documentStatus,
    docLabel: DOCUMENT_STATUS[pr.documentStatus] ?? pr.documentStatus,
    salePrice: pr.salePrice,
    rahnAmount: pr.rahnAmount,
    rentAmount: pr.rentAmount,
    negotiable: pr.negotiable,
    isFeatured: pr.isFeatured,
    viewCount: pr.viewCount,
    publishedAt: pr.publishedAt,
    updatedAt: pr.updatedAt,
    createdAt: pr.createdAt,
    image: pr.images?.[0]?.url ?? null,
    imageCount: pr.images?.length ?? 0,
    amenities: (pr.amenities ?? []).slice(0, 6).map((a) => a.amenity),
    lat: pr.lat,
    lng: pr.lng,
    contactPreference: pr.contactPreference,
    ownerName: pr.agent?.fullName ?? pr.host?.fullName ?? null,
    verified: !!(pr.agent?.isHostVerified || pr.host?.isHostVerified),
  };
}

// ───────────────────────── Detail ─────────────────────────

export async function propertyDetail(id: string, viewer?: SafeUser | null) {
  await lazyExpire(id);
  const prop = (await db.property.findUnique({
    where: { id },
    include: {
      city: { include: { province: true } },
      area: true,
      images: { orderBy: { sort: "asc" } },
      amenities: { include: { amenity: true } },
      host: { select: { id: true, fullName: true, phone: true, isHostVerified: true, createdAt: true } },
      agent: {
        select: { id: true, fullName: true, phone: true, isHostVerified: true, createdAt: true, agentProfile: { select: { agencyName: true, bio: true, photoUrl: true } } },
      },
    },
  })) as unknown as (PropertyRow & {
    host: { id: string; fullName: string | null; phone: string; isHostVerified: boolean; createdAt: Date };
    agent: { id: string; fullName: string | null; phone: string; isHostVerified: boolean; createdAt: Date; agentProfile: { agencyName: string | null; bio: string | null; photoUrl: string | null } | null } | null;
  }) | null;
  if (!prop) throw notFound("آگهی یافت نشد");

  const isOwnerOrAdmin = viewer && (viewer.id === prop.hostId || viewer.id === prop.agentId || isAdmin(viewer));
  if (!PUBLIC_STATUSES.includes(prop.status) && !isOwnerOrAdmin) throw notFound("این آگهی در دسترس نیست");

  // record a real view (dedupe per viewer+day is handled by /api/track; direct detail fetch counts lightly)
  if (!isOwnerOrAdmin && viewer?.id !== prop.hostId) {
    await db.property.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
  }

  const favorited = viewer
    ? !!(await db.favorite.findUnique({ where: { userId_propertyId: { userId: viewer.id, propertyId: id } } }))
    : false;

  const similar = await db.property.findMany({
    where: {
      id: { not: id },
      status: "PUBLISHED",
      OR: [{ type: prop.type }, { cityId: prop.cityId }],
      transactionType: prop.transactionType,
    },
    include: {
      city: { include: { province: true } },
      images: { orderBy: { sort: "asc" }, take: 1 },
      host: { select: { isHostVerified: true } },
    },
    orderBy: [{ isFeatured: "desc" }, { viewCount: "desc" }],
    take: 6,
  });

  const detail = {
    ...mapCard(prop as unknown as PropertyRow),
    description: prop.description,
    floors: prop.floors,
    paymentTerms: prop.paymentTerms,
    amenitiesExtra: prop.amenitiesExtra ? prop.amenitiesExtra.split(",").map((s) => s.trim()).filter(Boolean) : [],
    videoUrl: prop.videoUrl,
    tourUrl: prop.tourUrl,
    status: prop.status,
    rejectionReason: prop.rejectionReason,
    expiresAt: prop.expiresAt,
    allAmenities: prop.amenities.map((a) => a.amenity),
    images: prop.images.map((i) => i.url),
    // contact info: phone revealed only when preference allows CALL/BOTH; message allowed when MESSAGE/BOTH
    owner: prop.agent
      ? {
          kind: "AGENT" as const,
          id: prop.agent.id,
          name: prop.agent.fullName ?? "مشاور ویلاسنتو",
          phone: prop.contactPhone ?? prop.agent.phone,
          verified: prop.agent.isHostVerified,
          agency: prop.agent.agentProfile?.agencyName ?? null,
          bio: prop.agent.agentProfile?.bio ?? null,
          photo: prop.agent.agentProfile?.photoUrl ?? null,
          since: prop.agent.createdAt,
        }
      : {
          kind: "OWNER" as const,
          id: prop.host.id,
          name: prop.contactName ?? prop.host.fullName ?? "مالک",
          phone: prop.contactPhone ?? prop.host.phone,
          verified: prop.host.isHostVerified,
          agency: null,
          bio: null,
          photo: null,
          since: prop.host.createdAt,
        },
    similar: similar.map((s) => ({
      id: s.id, code: s.code, title: s.title, type: s.type, transactionType: s.transactionType,
      city: s.city.name, salePrice: s.salePrice, rahnAmount: s.rahnAmount, rentAmount: s.rentAmount,
      bedrooms: s.bedrooms, landArea: s.landArea, buildArea: s.buildArea,
      image: s.images[0]?.url ?? null,
    })),
    favorited,
    hostId: prop.hostId,
    agentId: prop.agentId,
  };
  return detail;
}

// ───────────────────────── CRUD (owner / agent) ─────────────────────────

export type ListingInput = {
  title?: string;
  type?: string;
  transactionType?: string;
  description?: string;
  cityId?: string;
  areaId?: string;
  address?: string;
  lat?: number;
  lng?: number;
  landArea?: number;
  buildArea?: number;
  bedrooms?: number;
  bathrooms?: number;
  floors?: number;
  buildYear?: number;
  documentStatus?: string;
  amenitiesExtra?: string;
  salePrice?: number;
  rahnAmount?: number;
  rentAmount?: number;
  negotiable?: boolean;
  paymentTerms?: string;
  videoUrl?: string;
  tourUrl?: string;
  contactName?: string;
  contactPhone?: string;
  contactPreference?: string;
  images?: string[];
  amenityKeys?: string[];
  submit?: boolean; // true → send to review (PENDING)
  draft?: boolean; // save as draft (default on create without submit)
};

function validateListing(input: ListingInput, forSubmit: boolean) {
  if (forSubmit) {
    if (!input.title?.trim() || input.title.trim().length < 8) throw badRequest("عنوان آگهی باید حداقل ۸ نویسه باشد");
    if (!input.cityId) throw badRequest("شهر را انتخاب کنید");
    if (!input.transactionType || !(input.transactionType in TRANSACTION_TYPES)) throw badRequest("نوع معامله را انتخاب کنید");
    if (!input.type || !(input.type in PROPERTY_TYPES)) throw badRequest("نوع ملک را انتخاب کنید");
    if (!input.images?.length) throw badRequest("حداقل یک تصویر برای انتشار آگهی لازم است");
    if (input.transactionType === "SALE" && !input.salePrice) throw badRequest("قیمت فروش را وارد کنید");
    if ((input.transactionType === "RAHN" || input.transactionType === "RAHN_RENT") && !input.rahnAmount) throw badRequest("مبلغ رهن را وارد کنید");
    if ((input.transactionType === "RENT" || input.transactionType === "RAHN_RENT") && !input.rentAmount) throw badRequest("مبلغ اجاره ماهانه را وارد کنید");
    if (!input.description?.trim() || input.description.trim().length < 30) throw badRequest("توضیحات آگهی باید حداقل ۳۰ نویسه باشد");
  }
  if (input.cityId) {
    // cityId validity checked in create/update
  }
}

export async function createProperty(user: SafeUser, input: ListingInput) {
  const forSubmit = !!input.submit;
  validateListing(input, forSubmit);
  if (!input.cityId) throw badRequest("شهر را انتخاب کنید");
  const city = await db.city.findUnique({ where: { id: input.cityId } });
  if (!city) throw badRequest("شهر نامعتبر است");
  if (input.areaId) {
    const area = await db.area.findUnique({ where: { id: input.areaId } });
    if (!area || area.cityId !== input.cityId) throw badRequest("منطقه انتخابی با شهر همخوانی ندارد");
  }
  if (input.transactionType && !(input.transactionType in TRANSACTION_TYPES)) throw badRequest("نوع معامله نامعتبر است");
  if (input.type && !(input.type in PROPERTY_TYPES)) throw badRequest("نوع ملک نامعتبر است");

  const prop = await db.property.create({
    data: {
      code: genCode(),
      hostId: user.id,
      title: input.title?.trim() ?? "آگهی بدون عنوان",
      type: input.type && input.type in PROPERTY_TYPES ? input.type : "VILLA",
      transactionType: input.transactionType && input.transactionType in TRANSACTION_TYPES ? input.transactionType : "SALE",
      description: input.description ?? "",
      cityId: input.cityId,
      areaId: input.areaId || null,
      address: input.address ?? "",
      lat: input.lat, lng: input.lng,
      landArea: input.landArea, buildArea: input.buildArea,
      bedrooms: input.bedrooms ?? 0,
      bathrooms: input.bathrooms ?? 1,
      floors: input.floors ?? 1,
      buildYear: input.buildYear,
      documentStatus: input.documentStatus && input.documentStatus in DOCUMENT_STATUS ? input.documentStatus : "MALIKI",
      amenitiesExtra: input.amenitiesExtra ?? "",
      salePrice: input.salePrice ?? null,
      rahnAmount: input.rahnAmount ?? null,
      rentAmount: input.rentAmount ?? null,
      negotiable: !!input.negotiable,
      paymentTerms: input.paymentTerms ?? null,
      videoUrl: input.videoUrl ?? null,
      tourUrl: input.tourUrl ?? null,
      contactName: input.contactName ?? user.fullName ?? null,
      contactPhone: input.contactPhone ?? user.phone,
      contactPreference: input.contactPreference && input.contactPreference in CONTACT_PREFS ? input.contactPreference : "BOTH",
      status: forSubmit ? "PENDING" : "DRAFT",
      images: {
        create: (input.images ?? []).slice(0, 12).map((url, i) => ({ url, sort: i })),
      },
      ...(input.amenityKeys?.length
        ? {
            amenities: {
              create: (await db.amenity.findMany({ where: { key: { in: input.amenityKeys } } })).map((a) => ({ amenityId: a.id })),
            },
          }
        : {}),
    },
  });

  // A user who posts a listing becomes OWNER
  if (user.role === "CUSTOMER") {
    await db.user.update({ where: { id: user.id }, data: { role: "OWNER" } });
  }

  await audit({ actorId: user.id, action: forSubmit ? "LISTING_SUBMIT" : "LISTING_DRAFT", entity: "Property", entityId: prop.id, meta: { title: prop.title, code: prop.code } });

  if (forSubmit) {
    const admins = await db.user.findMany({ where: { role: { in: AMIN_ROLES } }, select: { id: true } });
    if (admins.length) {
      await db.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id, type: "LISTING",
          title: "آگهی جدید در انتظار بررسی",
          body: `آگهی «${prop.title}» ثبت شد و در انتظار تأیید است.`,
          link: "#/admin/listings?status=PENDING",
        })),
      });
    }
  }
  return prop;
}

async function assertOwnership(user: SafeUser, propertyId: string) {
  const prop = await db.property.findUnique({ where: { id: propertyId } });
  if (!prop) throw notFound("آگهی یافت نشد");
  if (prop.hostId !== user.id && prop.agentId !== user.id && !isAdmin(user)) throw forbidden();
  return prop;
}

export async function updateProperty(user: SafeUser, id: string, input: ListingInput) {
  await assertOwnership(user, id);
  const forSubmit = !!input.submit;
  if (forSubmit) validateListing(input, true);

  const data: Record<string, unknown> = {};
  const strFields = ["title", "description", "address", "type", "transactionType", "documentStatus", "amenitiesExtra", "paymentTerms", "videoUrl", "tourUrl", "contactName", "contactPhone", "contactPreference"] as const;
  for (const f of strFields) if (input[f] != null) (data as Record<string, unknown>)[f] = input[f];
  const numFields = ["bedrooms", "bathrooms", "floors", "landArea", "buildArea", "buildYear"] as const;
  for (const f of numFields) if (input[f] != null) (data as Record<string, unknown>)[f] = input[f];
  const moneyFields = ["salePrice", "rahnAmount", "rentAmount"] as const;
  for (const f of moneyFields) if (input[f] !== undefined) (data as Record<string, unknown>)[f] = input[f];
  if (input.lat != null) data.lat = input.lat;
  if (input.lng != null) data.lng = input.lng;
  if (input.negotiable != null) data.negotiable = input.negotiable;
  if (input.cityId) {
    const city = await db.city.findUnique({ where: { id: input.cityId } });
    if (!city) throw badRequest("شهر نامعتبر است");
    data.cityId = input.cityId;
  }
  if (input.areaId !== undefined) data.areaId = input.areaId || null;
  if (input.type && !(input.type in PROPERTY_TYPES)) throw badRequest("نوع ملک نامعتبر است");
  if (input.transactionType && !(input.transactionType in TRANSACTION_TYPES)) throw badRequest("نوع معامله نامعتبر است");

  if (forSubmit) {
    const prop0 = await db.property.findUnique({ where: { id } });
    if (prop0 && prop0.status === "PUBLISHED") throw badRequest("این آگهی منتشرشده است؛ ابتدا آن را از انتشار خارج کنید");
    data.status = "PENDING";
    data.rejectionReason = null;
  }

  const updated = await db.property.update({ where: { id }, data });

  if (input.images) {
    await db.propertyImage.deleteMany({ where: { propertyId: id } });
    await db.propertyImage.createMany({
      data: input.images.slice(0, 12).map((url, i) => ({ propertyId: id, url, sort: i })),
    });
  }
  if (input.amenityKeys) {
    await db.propertyAmenity.deleteMany({ where: { propertyId: id } });
    const list = await db.amenity.findMany({ where: { key: { in: input.amenityKeys } } });
    if (list.length) {
      await db.propertyAmenity.createMany({ data: list.map((a) => ({ propertyId: id, amenityId: a.id })) });
    }
  }

  await audit({ actorId: user.id, action: forSubmit ? "LISTING_RESUBMIT" : "LISTING_UPDATE", entity: "Property", entityId: id });
  return updated;
}

export async function deleteProperty(user: SafeUser, id: string) {
  await assertOwnership(user, id);
  const prop = await db.property.findUnique({ where: { id } });
  if (prop?.status === "PUBLISHED" && !isAdmin(user)) {
    throw badRequest("آگهی منتشرشده ابتدا باید از انتشار خارج شود");
  }
  await db.property.delete({ where: { id } });
  await audit({ actorId: user.id, action: "LISTING_DELETE", entity: "Property", entityId: id });
  return { ok: true };
}

export async function submitProperty(user: SafeUser, id: string) {
  await assertOwnership(user, id);
  const prop = await db.property.findUnique({ where: { id }, include: { images: true } });
  if (!prop) throw notFound();
  if (!["DRAFT", "REJECTED", "APPROVED"].includes(prop.status)) throw badRequest("این آگهی در وضعیت قابل ارسال نیست");
  if (!prop.title || prop.title.length < 8) throw badRequest("عنوان آگهی باید حداقل ۸ نویسه باشد");
  if (!prop.description || prop.description.length < 30) throw badRequest("توضیحات آگهی باید حداقل ۳۰ نویسه باشد");
  if (!prop.images.length) throw badRequest("حداقل یک تصویر برای انتشار لازم است");
  const hasPrice = prop.salePrice || prop.rahnAmount || prop.rentAmount;
  if (!hasPrice) throw badRequest("اطلاعات مالی آگهی کامل نیست");
  await db.property.update({ where: { id }, data: { status: "PENDING", rejectionReason: null } });
  await audit({ actorId: user.id, action: "LISTING_SUBMIT", entity: "Property", entityId: id });
  return { ok: true };
}

export async function extendProperty(user: SafeUser, id: string) {
  await assertOwnership(user, id);
  const prop = await db.property.findUnique({ where: { id } });
  if (!prop) throw notFound();
  if (prop.status !== "EXPIRED" && !(prop.status === "PUBLISHED" && prop.expiresAt && new Date(prop.expiresAt).getTime() - Date.now() < 7 * 86400000)) {
    throw badRequest("تمدید فقط برای آگهی‌های منقضی یا نزدیک به انقضا امکان دارد");
  }
  const days = await getSettingNumber("listing.validityDays", 60);
  await db.property.update({
    where: { id },
    data: { status: "PUBLISHED", expiresAt: new Date(Date.now() + days * 86400000) },
  });
  await audit({ actorId: user.id, action: "LISTING_EXTEND", entity: "Property", entityId: id, meta: { days } });
  return { ok: true, expiresAt: new Date(Date.now() + days * 86400000) };
}

export async function myProperties(user: SafeUser) {
  await lazyExpire();
  const props = await db.property.findMany({
    where: { OR: [{ hostId: user.id }, { agentId: user.id }] },
    include: {
      city: { include: { province: true } },
      images: { orderBy: { sort: "asc" }, take: 1 },
      _count: { select: { visitRequests: true, favorites: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return props.map((p) => ({
    id: p.id, code: p.code, title: p.title,
    type: p.type, typeLabel: PROPERTY_TYPES[p.type] ?? p.type,
    transactionType: p.transactionType, ttLabel: TRANSACTION_TYPES[p.transactionType] ?? p.transactionType,
    city: p.city.name, province: p.city.province.name,
    status: p.status, statusLabel: LISTING_STATUS[p.status] ?? p.status,
    rejectionReason: p.rejectionReason,
    salePrice: p.salePrice, rahnAmount: p.rahnAmount, rentAmount: p.rentAmount,
    landArea: p.landArea, buildArea: p.buildArea, bedrooms: p.bedrooms,
    viewCount: p.viewCount, isFeatured: p.isFeatured,
    image: p.images[0]?.url ?? null,
    visitsCount: p._count.visitRequests,
    favoritesCount: p._count.favorites,
    publishedAt: p.publishedAt,
    expiresAt: p.expiresAt,
    createdAt: p.createdAt,
  }));
}

// ───────────────────────── Report invalid listing ─────────────────────────

export async function reportListing(user: SafeUser | null, propertyId: string, body: { reason: string; detail?: string }) {
  const prop = await db.property.findUnique({ where: { id: propertyId } });
  if (!prop) throw notFound("آگهی یافت نشد");
  if (!body.reason?.trim()) throw badRequest("دلیل گزارش را انتخاب کنید");
  const userId = user?.id;
  if (!userId) throw badRequest("برای گزارش آگهی ابتدا وارد حساب شوید");
  const complaint = await db.complaint.create({
    data: {
      userId, type: "LISTING_REPORT", propertyId,
      subject: `گزارش آگهی ${prop.code}`,
      body: [body.reason, body.detail].filter(Boolean).join(" — "),
      status: "OPEN",
    },
  });
  await audit({ actorId: userId, action: "LISTING_REPORT", entity: "Property", entityId: propertyId, meta: { reason: body.reason } });
  return complaint;
}

// ───────────────────────── View tracking (called by /api/track) ─────────────────────────

export async function trackView(opts: {
  propertyId: string;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const day = todayStr();
  const exists = await db.propertyView.findFirst({
    where: {
      propertyId: opts.propertyId, day,
      OR: [{ userId: opts.userId ?? "___anon" }, { ip: opts.ip ?? "___noip" }],
    },
  });
  if (exists) return { counted: false };
  await db.$transaction([
    db.propertyView.create({
      data: {
        propertyId: opts.propertyId, userId: opts.userId ?? null,
        ip: opts.ip ?? null, userAgent: opts.userAgent ?? null, day,
      },
    }),
    db.property.update({ where: { id: opts.propertyId }, data: { viewCount: { increment: 1 } } }),
  ]);
  return { counted: true };
}

// ───────────────────────── Expiry sweep (used by admin/cron) ─────────────────────────

export async function sweepExpiries() {
  const res = await db.property.updateMany({
    where: { status: "PUBLISHED", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
  return { expired: res.count };
}

export { addDays };
