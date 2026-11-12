import { handler, ok, parseBody } from "@/server/http";
import { getCurrentUser, requireUser } from "@/server/session";
import * as Props from "@/server/services/properties";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/properties/[id] — real-estate detail (similar, owner, favorite state) */
export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const viewer = await getCurrentUser();
  return ok(await Props.propertyDetail(id, viewer));
});

const updateSchema = z.object({
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

/** PATCH /api/properties/[id] — owner/agent updates listing */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const body = await parseBody(req, updateSchema);
  return ok(await Props.updateProperty(user, id, body as Props.ListingInput));
});

/** DELETE /api/properties/[id] — owner deletes listing */
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  return ok(await Props.deleteProperty(user, id));
});
