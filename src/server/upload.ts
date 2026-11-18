import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import sharp from "sharp";
import { badRequest } from "./http";
import { getSetting } from "./settings";

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

export type VideoUploadResult = { url: string; size: number; kind: "mp4" | "webm" };

/** MP4: "ftyp" at offset 4 — WebM/EBML: 1A 45 DF A3 */
function sniffVideo(buf: Buffer): "mp4" | "webm" | null {
  if (buf.length > 12 && buf.subarray(4, 8).toString("latin1") === "ftyp") return "mp4";
  if (buf.length > 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "webm";
  return null;
}

/**
 * Validate + persist an uploaded video (no transcoding — stored as-is).
 * - Magic bytes sniffed server-side (declared MIME alone is never trusted)
 * - MP4 / WebM only
 * - Size cap from SystemSetting upload.videoMaxSizeMB (default 50MB)
 * - Stored under /uploads/YYYY-MM/ and served with Range support by /api/files
 */
export async function saveVideo(file: File, folder = "videos"): Promise<VideoUploadResult> {
  if (!file || typeof file.arrayBuffer !== "function") throw badRequest("فایلی ارسال نشده است");
  const maxMB = Number((await getSetting("upload.videoMaxSizeMB")) ?? 50);
  const maxBytes = maxMB * 1024 * 1024;
  if (file.size > maxBytes) throw badRequest(`حجم ویدیو باید کمتر از ${maxMB} مگابایت باشد`);
  if (file.size < 1024) throw badRequest("فایل ویدیو نامعتبر است");

  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniffVideo(buf);
  if (!kind) throw badRequest("فرمت ویدیو باید MP4 یا WebM باشد (فایل ویدیوی معتبر نیست)");

  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const dir = join(UPLOAD_ROOT, ym);
  await mkdir(dir, { recursive: true });

  const name = `${randomBytes(8).toString("hex")}.${kind === "mp4" ? "mp4" : "webm"}`;
  await writeFile(join(dir, name), buf);

  return { url: `/api/files/${ym}/${name}`, size: buf.length, kind };
}

/** Delete an uploaded media file under uploads/ (path-validated). */
export async function removeUpload(url: string): Promise<boolean> {
  const m = /^\/api\/files\/((\d{4}-\d{2})\/([a-z0-9]+\.(?:webp|jpg|png|mp4|webm)))$/i.exec(url);
  if (!m) return false;
  const full = join(UPLOAD_ROOT, m[1]);
  if (!full.startsWith(UPLOAD_ROOT)) return false;
  try {
    await (await import("fs/promises")).unlink(full);
    return true;
  } catch {
    return false;
  }
}
