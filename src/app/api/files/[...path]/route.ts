import { NextResponse } from "next/server";
import { readFile, stat, open } from "fs/promises";
import { join, normalize, extname } from "path";

const UPLOAD_ROOT = join(process.cwd(), "uploads");
const MIME: Record<string, string> = {
  ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".mp4": "video/mp4", ".webm": "video/webm",
};

function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  let start = m[1] === "" ? NaN : parseInt(m[1], 10);
  let end = m[2] === "" ? NaN : parseInt(m[2], 10);
  if (Number.isNaN(start) && Number.isNaN(end)) return null;
  if (Number.isNaN(start)) { start = size - end; end = size - 1; }
  if (Number.isNaN(end)) end = size - 1;
  if (start < 0 || end >= size || start > end) return null;
  return { start, end: Math.min(end, start + 4 * 1024 * 1024 - 1) }; // cap chunk at 4MB
}

/** GET /api/files/YYYY-MM/name.ext — serve uploaded media with HTTP Range support (video seeking) */
export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const rel = normalize(path.join("/")).replace(/^(\.\.[/\\])+/, "");
  if (rel.includes("..")) return new NextResponse("Not found", { status: 404 });
  const full = join(UPLOAD_ROOT, rel);
  if (!full.startsWith(UPLOAD_ROOT)) return new NextResponse("Not found", { status: 404 });
  try {
    const st = await stat(full);
    if (!st.isFile()) throw new Error("not file");
    const type = MIME[extname(full).toLowerCase()] ?? "application/octet-stream";
    const base: Record<string, string> = {
      "Content-Type": type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
    };

    const range = parseRange(req.headers.get("range"), st.size);
    if (range) {
      const fh = await open(full, "r");
      try {
        const len = range.end - range.start + 1;
        const buf = Buffer.alloc(len);
        await fh.read(buf, 0, len, range.start);
        return new NextResponse(new Uint8Array(buf), {
          status: 206,
          headers: {
            ...base,
            "Content-Range": `bytes ${range.start}-${range.end}/${st.size}`,
            "Content-Length": String(len),
          },
        });
      } finally {
        await fh.close();
      }
    }

    const data = await readFile(full);
    return new NextResponse(new Uint8Array(data), {
      headers: { ...base, "Content-Length": String(st.size) },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
