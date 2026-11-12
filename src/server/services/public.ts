import { db } from "@/lib/db";
import { PROPERTY_TYPES } from "./properties";

/** Public lookup data: provinces/cities, amenities, property types */
export async function lookups() {
  const [provinces, amenities] = await Promise.all([
    db.province.findMany({ include: { cities: { orderBy: { name: "asc" } } }, orderBy: { name: "asc" } }),
    db.amenity.findMany({ orderBy: { name: "asc" } }),
  ]);
  return {
    provinces,
    amenities,
    types: Object.entries(PROPERTY_TYPES).map(([key, name]) => ({ key, name })),
  };
}

export { PROPERTY_TYPES };

// ───────── CMS pages ─────────
export async function cmsPage(slug: string) {
  const page = await db.cmsPage.findUnique({ where: { slug } });
  return page && page.isPublished ? page : null;
}

export async function cmsPages() {
  return db.cmsPage.findMany({ where: { isPublished: true }, orderBy: { sort: "asc" } });
}
