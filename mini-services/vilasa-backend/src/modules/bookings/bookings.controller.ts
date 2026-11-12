import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../../common/current-user.decorator";
import { requireUser } from "../../common/user.util";
import { badRequest } from "../../common/api-error";
import type { SafeUser } from "../../common/session.middleware";
import { BookingsService } from "./bookings.service";
import { BookingActionDto, CreateBookingDto, ValidateCouponDto } from "./bookings.dto";

@ApiTags("bookings")
@Controller()
export class BookingsController {
  constructor(private bookings: BookingsService) {}

  @Get("bookings")
  @ApiOperation({ summary: "رزروهای من (role=host → رزروهای اقامتگاه‌های میزبان)" })
  list(
    @CurrentUser() user: SafeUser | null,
    @Query("role") role?: string,
    @Query("tab") tab?: string,
    @Query("status") status?: string,
  ) {
    const u = requireUser(user);
    if (role === "host") return this.bookings.hostBookings(u, status ?? "ALL");
    return this.bookings.myBookings(u, tab ?? "ALL");
  }

  @Post("bookings")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "ثبت رزرو — کنترل دو‌بار‌رزرو شدن در تراکنش دیتابیس" })
  create(@CurrentUser() user: SafeUser | null, @Body() dto: CreateBookingDto) {
    return this.bookings.createBooking(requireUser(user), dto);
  }

  @Get("bookings/:id")
  @ApiOperation({ summary: "جزئیات یک رزرو (مهمان/میزبان/مدیر)" })
  detail(@CurrentUser() user: SafeUser | null, @Param("id") id: string) {
    return this.bookings.findOwnedBooking(id, requireUser(user));
  }

  @Patch("bookings/:id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "اقدام روی رزرو: cancel | approve | reject | complete" })
  action(@CurrentUser() user: SafeUser | null, @Param("id") id: string, @Body() dto: BookingActionDto) {
    const u = requireUser(user);
    switch (dto.action) {
      case "approve":
        return this.bookings.approveBooking(u, id);
      case "reject":
        return this.bookings.rejectBooking(u, id, dto.reason);
      case "complete":
        return this.bookings.completeBooking(u, id);
      case "cancel":
        return this.bookings.cancelBooking(u, id, dto.reason);
    }
  }

  @Post("coupons/validate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "اعتبارسنجی کد تخفیف و پیش‌نمایش تخفیف" })
  validateCoupon(@CurrentUser() user: SafeUser | null, @Body() dto: ValidateCouponDto) {
    requireUser(user);
    return this.bookings
      .validateCoupon(dto.code, dto.amount)
      .then((res) => ({ valid: true, ...res }))
      .catch((e: unknown) => {
        if (e instanceof Error) return { valid: false, message: e.message };
        throw badRequest("کد تخفیف نامعتبر است");
      });
  }

  @Get("track")
  @ApiOperation({ summary: "رهگیری عمومی رزرو با کد (بدون ورود)" })
  track(@Query("code") code?: string) {
    if (!code) throw badRequest("کد رهگیری را وارد کنید");
    return this.bookings.trackByCode(code);
  }
}
