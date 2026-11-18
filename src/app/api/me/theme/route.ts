import { NextResponse } from "next/server";
import { handler, ok, parseBody } from "@/server/http";
import { requireUser } from "@/server/session";
import { getThemePrefs, updateThemePrefs, validateThemePrefs } from "@/server/services/theme";
import { z } from "zod";

/** GET /api/me/theme — current user's saved theme preferences */
export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  return ok(await getThemePrefs(user));
});

/** POST /api/me/theme — save (merge) theme preferences for the logged-in user */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, z.record(z.string(), z.unknown()));
  const prefs = validateThemePrefs(body);
  return ok(await updateThemePrefs(user, prefs));
});

export function OPTIONS() { return new NextResponse(null, { status: 204 }); }
