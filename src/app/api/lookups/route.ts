import { handler, ok } from "@/server/http";
import { db } from "@/lib/db";
import { PROPERTY_TYPES, TRANSACTION_TYPES, DOCUMENT_STATUS, LISTING_STATUS, CONTACT_PREFS } from "@/server/services/properties";

/** GET /api/lookups — provinces/cities/areas, amenities, domain enums */
export const GET = handler(async () => {
  const [provinces, amenities] = await Promise.all([
    db.province.findMany({
      include: {
        cities: {
          orderBy: { name: "asc" },
          include: { areas: { orderBy: { sort: "asc" } } },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.amenity.findMany({ orderBy: { name: "asc" } }),
  ]);
  return ok({
    provinces,
    amenities,
    types: Object.entries(PROPERTY_TYPES).map(([key, name]) => ({ key, name })),
    transactionTypes: Object.entries(TRANSACTION_TYPES).map(([key, name]) => ({ key, name })),
    documentStatus: Object.entries(DOCUMENT_STATUS).map(([key, name]) => ({ key, name })),
    listingStatus: Object.entries(LISTING_STATUS).map(([key, name]) => ({ key, name })),
    contactPrefs: Object.entries(CONTACT_PREFS).map(([key, name]) => ({ key, name })),
  });
});
