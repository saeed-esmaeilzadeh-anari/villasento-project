import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../../common/current-user.decorator";
import { requireUser } from "../../common/user.util";
import { badRequest } from "../../common/api-error";
import type { SafeUser } from "../../common/session.middleware";
import { PaymentsService } from "./payments.service";
import { PaymentActionDto } from "./payments.dto";

@ApiTags("payments")
@Controller("payments")
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: "وضعیت تراکنش بر اساس authority" })
  status(@CurrentUser() user: SafeUser | null, @Query("authority") authority?: string) {
    if (!authority) throw badRequest("authority الزامی است");
    return this.payments.getByAuthority(authority, user);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "start (ایجاد پرداخت) | settle (تأیید درگاه) | refund (بازگشت وجه مدیر)" })
  action(@CurrentUser() user: SafeUser | null, @Body() dto: PaymentActionDto) {
    const u = requireUser(user);

    if (dto.action === "start") {
      if (!dto.bookingId) throw badRequest("شناسه رزرو الزامی است");
      return this.payments.startPayment(u, dto.bookingId);
    }

    if (dto.action === "settle") {
      if (!dto.authority || !dto.result) throw badRequest("پارامترهای تسویه ناقص است");
      return this.payments.settlePayment(dto.authority, dto.result, u);
    }

    // refund (admin)
    if (!dto.paymentId || !dto.amount) throw badRequest("پارامترهای بازگشت وجه ناقص است");
    return this.payments.createRefund(u, dto.paymentId, dto.amount, dto.reason ?? "بازگشت وجه توسط پشتیبانی");
  }
}
