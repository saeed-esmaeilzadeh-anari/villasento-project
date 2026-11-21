import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { Landing } from "@/lib/landings";
import {
  MIN_REGION_DESCRIPTION_LENGTH,
  plainTextLength,
  isIndexableArticle,
  isIndexableCmsPage,
} from "@/lib/seoText";
export { MIN_REGION_DESCRIPTION_LENGTH, plainTextLength, isIndexableArticle, isIndexableCmsPage };

export const MIN_INDEXABLE_LISTINGS = 3;
export function publishedPropertyWhere(now = new Date()): Prisma.PropertyWhereInput {
  return {
    status: "PUBLISHED",
    AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
  };
}


export async function landingInventoryCount(landing: Pick<Landing, "tt" | "types" | "provinces">, now = new Date()) {
  let cityIds: string[] | undefined;
  if (landing.provinces?.length) {
    const provinces = await db.province.findMany({
      where: { name: { in: landing.provinces } },
      select: { id: true },
    });
    if (!provinces.length) return 0;
    const cities = await db.city.findMany({
      where: { provinceId: { in: provinces.map((province) => province.id) } },
      select: { id: true },
    });
    cityIds = cities.map((city) => city.id);
    if (!cityIds.length) return 0;
  }

  const where: Prisma.PropertyWhereInput = {
    ...publishedPropertyWhere(now),
    ...(landing.tt.length ? { transactionType: { in: landing.tt } } : {}),
    ...(landing.types.length ? { type: { in: landing.types } } : {}),
    ...(cityIds ? { cityId: { in: cityIds } } : {}),
  };
  return db.property.count({ where });
}

export function cityInventoryCount(cityId: string, now = new Date()) {
  return db.property.count({
    where: { ...publishedPropertyWhere(now), cityId },
  });
}

export async function regionInventoryCount(regionNameEn: string, now = new Date()) {
  const root = await db.region.findUnique({
    where: { nameEn: regionNameEn },
    select: { id: true, isActive: true },
  });
  if (!root?.isActive) return 0;

  const regions = await db.region.findMany({
    where: { isActive: true },
    select: { id: true, parentId: true },
  });
  const children = new Map<string, string[]>();
  for (const region of regions) {
    if (region.parentId) {
      const siblings = children.get(region.parentId) ?? [];
      siblings.push(region.id);
      children.set(region.parentId, siblings);
    }
  }

  const descendants: string[] = [];
  const queue = [root.id];
  const seen = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    descendants.push(id);
    queue.push(...(children.get(id) ?? []));
  }

  return db.property.count({
    where: { ...publishedPropertyWhere(now), regionId: { in: descendants } },
  });
}

export async function indexableRegions(now = new Date()) {
  const [regions, listingGroups] = await Promise.all([
    db.region.findMany({
      where: { isActive: true },
      select: { id: true, nameEn: true, description: true, updatedAt: true, parentId: true, geoStatus: true },
      take: 2000,
    }),
    db.property.groupBy({
      by: ["regionId"],
      where: { ...publishedPropertyWhere(now), regionId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const directCounts = new Map<string, number>();
  for (const group of listingGroups) {
    if (group.regionId) directCounts.set(group.regionId, group._count._all);
  }

  const activeIds = new Set(regions.map((region) => region.id));
  const children = new Map<string, string[]>();
  for (const region of regions) {
    if (region.parentId && activeIds.has(region.parentId)) {
      const childIds = children.get(region.parentId) ?? [];
      childIds.push(region.id);
      children.set(region.parentId, childIds);
    }
  }

  const memo = new Map<string, number>();
  const countTree = (id: string, visiting = new Set<string>()): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;
    const nextVisiting = new Set(visiting);
    nextVisiting.add(id);
    const total = (directCounts.get(id) ?? 0) +
      (children.get(id) ?? []).reduce((sum, childId) => sum + countTree(childId, nextVisiting), 0);
    memo.set(id, total);
    return total;
  };

  return regions.filter((region) =>
    region.geoStatus === "VERIFIED" &&
    plainTextLength(region.description) >= MIN_REGION_DESCRIPTION_LENGTH &&
    countTree(region.id) >= MIN_INDEXABLE_LISTINGS
  );
}

export function isValidSitemapSegment(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9-]{0,179}$/.test(value) &&
    value.toLowerCase() !== "undefined" && value.toLowerCase() !== "null";
}
