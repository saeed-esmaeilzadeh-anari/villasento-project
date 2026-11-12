import { handler, ok, parseBody } from "@/server/http";
import { getCurrentUser, requireUser } from "@/server/session";
import * as Props from "@/server/services/properties";
import { limitOrThrow, clientIp } from "@/server/rateLimit";
import { z } from "zod";

/** GET /api/properties — server-side search with all filters */
export const GET = handler(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const num = (k: string) => {
    const v = sp.get(k);
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const arr = (k: string) => {
    const v = sp.get(k);
    if (!v) return undefined;
    const list = v.split(",").map((s) => s.trim()).filter(Boolean);
    return list.length ? list : undefined;
  };
  const bboxRaw = sp.get("bbox");
  let bbox: Props.SearchParams["bbox"];
  if (bboxRaw) {
    const parts = bboxRaw.split(",").map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      bbox = { minLat: Math.min(parts[0], parts[1]), maxLat: Math.max(parts[0], parts[1]), minLng: Math.min(parts[2], parts[3]), maxLng: Math.max(parts[2], parts[3]) };
    }
  }

  // batch fetch by ids (used by compare + view history)
  const ids = sp.get("ids");
  if (ids) {
    const list = ids.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12);
    const viewer = await getCurrentUser();
    const items = await Promise.all(
      list.map((id) => Props.propertyDetail(id, viewer).catch(() => null))
    );
    return ok({ items: items.filter(Boolean) });
  }

  return ok(await Props.searchProperties({
    q: sp.get("q") ?? undefined,
    provinceId: sp.get("provinceId") ?? undefined,
    cityId: sp.get("cityId") ?? undefined,
    areaId: sp.get("areaId") ?? undefined,
    transactionTypes: arr("tt"),
    types: arr("types"),
    minPrice: num("minPrice"),
    maxPrice: num("maxPrice"),
    minLand: num("minLand"),
    maxLand: num("maxLand"),
    minBuild: num("minBuild"),
    maxBuild: num("maxBuild"),
    minBedrooms: num("bedrooms"),
    amenities: arr("amenities"),
    documentStatus: sp.get("doc") ?? undefined,
    negotiableOnly: sp.get("negotiable") === "1",
    featuredOnly: sp.get("featured") === "1",
    bbox,
    sort: (sp.get("sort") as Props.SearchParams["sort"]) ?? undefined,
    page: num("page"),
    pageSize: num("pageSize"),
  }));
});

const createSchema = z.object({
  title: z.string().optional(),
  type: z.string().optional(),
  transactionType: z.string().optional(),
  description: z.string().optional(),
  cityId: z.string().optional(),
  areaId: z.string().optional(),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  landArea: z.number().optional(),
  buildArea: z.number().optional(),
  bedrooms: z.number().int().min(0).max(30).optional(),
  bathrooms: z.number().int().min(0).max(20).optional(),
  floors: z.number().int().min(0).max(30).optional(),
  buildYear: z.number().int().min(1300).max(1500).optional(),
  documentStatus: z.string().optional(),
  amenitiesExtra: z.string().optional(),
  salePrice: z.number().min(0).optional(),
  rahnAmount: z.number().min(0).optional(),
  rentAmount: z.number().min(0).optional(),
  negotiable: z.boolean().optional(),
  paymentTerms: z.string().optional(),
  videoUrl: z.string().optional(),
  tourUrl: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactPreference: z.string().optional(),
  images: z.array(z.string()).max(12).optional(),
  amenityKeys: z.array(z.string()).optional(),
  submit: z.boolean().optional(),
});

/** POST /api/properties — create listing (draft or submit for review) */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  await limitOrThrow(`listing-create:${user.id}`, 10, 3600 * 1000);
  const ip = clientIp(req);
  await limitOrThrow(`listing-create-ip:${ip}`, 20, 3600 * 1000);
  const body = await parseBody(req, createSchema);
  return ok(await Props.createProperty(user, body as Props.ListingInput));
});
