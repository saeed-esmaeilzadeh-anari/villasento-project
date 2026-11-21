import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/seoJson";

export const dynamic = "force-dynamic";

/** Legacy compatibility endpoint; the only authoritative sitemap is /sitemap.xml. */
export async function GET() {
  return NextResponse.redirect(siteUrl("/sitemap.xml"), 308);
}
