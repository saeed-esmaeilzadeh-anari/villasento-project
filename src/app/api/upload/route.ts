import { NextResponse } from "next/server";
import { handler, ok, badRequest } from "@/server/http";
import { requireUser } from "@/server/session";
import { saveImage } from "@/server/upload";
import { limitOrThrow } from "@/server/rateLimit";

/** POST /api/upload — multipart image upload (jpg/png/webp ≤ 5MB, auto-optimized to WebP) */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  await limitOrThrow(`upload:${user.id}`, 60, 3600 * 1000);
  const form = await req.formData().catch(() => null);
  if (!form) throw badRequest("بدنه فرم نامعتبر است");
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("فایل تصویر ارسال نشده است");
  const folder = String(form.get("folder") ?? "misc").replace(/[^a-z-]/gi, "") || "misc";
  const res = await saveImage(file, folder);
  return ok(res);
});

export function OPTIONS() { return new NextResponse(null, { status: 204 }); }
