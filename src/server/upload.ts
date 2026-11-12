import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import sharp from "sharp";
import { badRequest } from "./http";

const UPLOAD_ROOT = join(process.cwd(), "uploads");
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES_DEFAULT = 5 * 1024 * 1024;

export type UploadResult = { url: string; width: number; height: number; size: number };

/**
 * Validate + optimize + persist an uploaded image.
 * - Only jpg/png/webp allowed (MIME sniffed by sharp, not just header)
 * - Resized to max 1920px, converted to WebP for performance
 * - Stored under /uploads/YYYY-MM/ and served by /api/files route
 */
export async function saveImage(file: File, folder = "misc"): Promise<UploadResult> {
  if (!file || typeof file.arrayBuffer !== "function") throw badRequest("فایلی ارسال نشده است");
  const maxBytes = MAX_BYTES_DEFAULT;
  if (file.size > maxBytes) throw badRequest(`حجم فایل باید کمتر از ${Math.round(maxBytes / 1048576)} مگابایت باشد`);
  if (file.type && !ALLOWED.includes(file.type)) throw badRequest("فرمت تصویر باید JPG، PNG یا WebP باشد");

  const buf = Buffer.from(await file.arrayBuffer());

  let img: sharp.Sharp;
  try {
    img = sharp(buf, { failOn: "error" });
    const meta = await img.metadata();
    if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format)) {
      throw badRequest("فایل ارسالی تصویر معتبر نیست");
    }
    if (meta.width && meta.height && meta.width < 200) {
      throw badRequest("ابعاد تصویر بسیار کوچک است (حداقل ۲۰۰ پیکسل)");
    }
  } catch (e) {
    if (e instanceof Error && "status" in e) throw e;
    throw badRequest("پردازش تصویر ناموفق بود");
  }

  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const dir = join(UPLOAD_ROOT, ym);
  await mkdir(dir, { recursive: true });

  const name = `${randomBytes(8).toString("hex")}.webp`;
  const outPath = join(dir, name);

  const webp = await img
    .rotate() // respect EXIF
    .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  await writeFile(outPath, webp.data);

  return {
    url: `/api/files/${ym}/${name}`,
    width: webp.info.width,
    height: webp.info.height,
    size: webp.info.size,
  };
}
