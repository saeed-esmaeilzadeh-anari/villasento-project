import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join, normalize, extname } from "path";

const UPLOAD_ROOT = join(process.cwd(), "uploads");
const MIME: Record<string, string> = {
  ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
};

/** GET /api/files/YYYY-MM/name.webp — serve uploaded media (public assets) */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const rel = normalize(path.join("/")).replace(/^(\.\.[/\\])+/, "");
  if (rel.includes("..")) return new NextResponse("Not found", { status: 404 });
  const full = join(UPLOAD_ROOT, rel);
  if (!full.startsWith(UPLOAD_ROOT)) return new NextResponse("Not found", { status: 404 });
  try {
    const st = await stat(full);
    if (!st.isFile()) throw new Error("not file");
    const data = await readFile(full);
    const type = MIME[extname(full).toLowerCase()] ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(st.size),
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
