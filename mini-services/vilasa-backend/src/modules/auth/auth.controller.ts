import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Response } from "express";

import { COOKIE_NAME, SESSION_MAX_AGE } from "../../common/session.util";
import { CurrentUser } from "../../common/current-user.decorator";
import { requireUser } from "../../common/user.util";
import type { SafeUser } from "../../common/session.middleware";
import { AuthService } from "./auth.service";
import { RequestOtpDto, UpdateProfileDto, VerifyOtpDto } from "./auth.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post("request-otp")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "ارسال کد یک‌بارمصرف (در حالت نمایشی demoCode برگردانده می‌شود)" })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.phone);
  }

  @Post("verify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "تأیید کد و ورود — کوکی نشست امضاشده تنظیم می‌شود" })
  async verify(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    const { token, ...body } = await this.auth.verifyOtp(dto.phone, dto.code, dto.fullName);
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE * 1000,
      secure: process.env.NODE_ENV === "production",
    });
    return { ok: body.ok, user: body.user };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "خروج — حذف کوکی نشست" })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    return { ok: true };
  }

  @Post("profile")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "به‌روزرسانی پروفایل کاربر جاری" })
  updateProfile(@CurrentUser() user: SafeUser | null, @Body() dto: UpdateProfileDto) {
    const u = requireUser(user);
    return this.auth.updateProfile(u, dto);
  }

  @Get("me")
  @ApiOkResponse({ description: "کاربر جاری یا null" })
  me(@CurrentUser() user: SafeUser | null) {
    return this.auth.me(user);
  }
}
