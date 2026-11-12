import { NextResponse } from "next/server";
import { handler, ok, parseBody, badRequest } from "@/server/http";
import { z } from "zod";
import * as AuthService from "@/server/services/auth";
import { limitOrThrow, clientIp } from "@/server/rateLimit";

type Ctx = { params: Promise<{ action: string }> };

/**
 * POST /api/auth/[action]
 * request-otp | verify | logout | profile |
 * password-login | set-password | change-password | reset-password
 */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const { action } = await ctx.params;
  const ip = clientIp(req);

  if (action === "request-otp") {
    const body = await parseBody(req, z.object({ phone: z.string() }));
    await limitOrThrow(`otp:${ip}`, 10, 10 * 60 * 1000);
    return ok(await AuthService.requestOtp(body.phone));
  }

  if (action === "verify") {
    const body = await parseBody(req, z.object({
      phone: z.string(),
      code: z.string(),
      fullName: z.string().optional(),
    }));
    await limitOrThrow(`verify:${ip}`, 20, 10 * 60 * 1000);
    return ok(await AuthService.verifyOtp(body.phone, body.code, body.fullName));
  }

  if (action === "logout") {
    return ok(await AuthService.logout());
  }

  if (action === "profile") {
    const body = await parseBody(req, z.object({
      fullName: z.string().optional(),
      email: z.string().optional(),
      nationalId: z.string().optional(),
    }));
    return ok(await AuthService.updateProfile(body));
  }

  if (action === "password-login") {
    const body = await parseBody(req, z.object({ phone: z.string(), password: z.string() }));
    await limitOrThrow(`plogin:${ip}:${body.phone}`, 10, 10 * 60 * 1000);
    return ok(await AuthService.loginWithPassword(body.phone, body.password));
  }

  if (action === "set-password") {
    const body = await parseBody(req, z.object({ newPassword: z.string() }));
    return ok(await AuthService.setPassword(body.newPassword));
  }

  if (action === "change-password") {
    const body = await parseBody(req, z.object({ currentPassword: z.string(), newPassword: z.string() }));
    return ok(await AuthService.changePassword(body.currentPassword, body.newPassword));
  }

  if (action === "reset-password") {
    const body = await parseBody(req, z.object({ phone: z.string(), code: z.string(), newPassword: z.string() }));
    await limitOrThrow(`reset:${ip}`, 10, 10 * 60 * 1000);
    return ok(await AuthService.resetPassword(body.phone, body.code, body.newPassword));
  }

  throw badRequest("عملیات ناشناخته");
});

/** GET /api/auth/me */
export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const { action } = await ctx.params;
  if (action === "me") return ok(await AuthService.me());
  throw badRequest("عملیات ناشناخته");
});

export function OPTIONS() { return new NextResponse(null, { status: 204 }); }
