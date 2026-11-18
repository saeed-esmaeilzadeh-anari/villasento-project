import { NextResponse } from "next/server";
import { handler, ok, badRequest, forbidden } from "@/server/http";
import { requireUser } from "@/server/session";
import { saveImage, saveVideo, removeUpload } from "@/server/upload";
import { limitOrThrow } from "@/server/rateLimit";
import { db } from "@/lib/db";

/** Shared upload endpoint: image (≤5MB, optimized to WebP) or video (≤N MB, MP4/WebM, magic-byte validated) */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  await limitOrThrow(`upload:${user.id}`, 60, 3600 * 1000);
  const form = await req.formData().catch(() => null);
  if (!form) throw badRequest("بدنه فرم نامعتبر است");
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("فایل ارسال نشده است");
  const folder = String(form.get("folder") ?? "misc").replace(/[^a-z-]/gi, "") || "misc";

  if (file.type.startsWith("video/")) {
    return ok(await saveVideo(file, folder === "misc" ? "videos" : folder));
  }
  return ok(await saveImage(file, folder));
});

/**
 * DELETE /api/upload?url=/api/files/YYYY-MM/name.ext
 * Ownership rules (enforced server-side):
 *  - ADMIN/SUPER_ADMIN can delete any uploaded file
 *  - a normal user can delete a file only while it is NOT referenced by any
 *    listing they do not own (i.e. orphans and files used by their own listings)
 */
export const DELETE = handler(async (req: Request) => {
  const user = await requireUser();
  await limitOrThrow(`upload-del:${user.id}`, 30, 3600 * 1000);
  const url = new URL(req.url).searchParams.get("url") ?? "";
  if (!url.startsWith("/api/files/")) throw badRequest("آدرس فایل نامعتبر است");

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  if (!isAdmin) {
    const [referencingVideo, referencingImage] = await Promise.all([
      db.property.findFirst({
        where: {
          OR: [{ videoUrl: { contains: url } }, { videoPosterUrl: { contains: url } }],
          NOT: { hostId: user.id },
        },
        select: { id: true },
      }),
      db.propertyImage.findFirst({
        where: { url, property: { is: { hostId: { not: user.id } } } },
        select: { id: true },
      }),
    ]);
    if (referencingVideo || referencingImage) {
      throw forbidden("این فایل در آگهی دیگری در حال استفاده است");
    }
  }
  const removed = await removeUpload(url);
  if (!removed) throw badRequest("حذف فایل ناموفق بود یا فایل یافت نشد");
  return ok({ ok: true });
});

export function OPTIONS() { return new NextResponse(null, { status: 204 }); }
