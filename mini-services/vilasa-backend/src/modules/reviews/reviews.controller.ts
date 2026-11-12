import { Body, Controller, HttpCode, HttpStatus, Patch, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../../common/current-user.decorator";
import { requireUser } from "../../common/user.util";
import type { SafeUser } from "../../common/session.middleware";
import { ReviewsService } from "./reviews.service";
import { CreateReviewDto, ReplyReviewDto } from "./reviews.dto";

@ApiTags("social")
@Controller("reviews")
export class ReviewsController {
  constructor(private reviews: ReviewsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "ثبت نظر برای اقامت تکمیل‌شده" })
  create(@CurrentUser() user: SafeUser | null, @Body() dto: CreateReviewDto) {
    return this.reviews.createReview(requireUser(user), dto.bookingId, dto);
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "پاسخ میزبان به نظر" })
  reply(@CurrentUser() user: SafeUser | null, @Body() dto: ReplyReviewDto) {
    return this.reviews.replyReview(requireUser(user), dto.id, dto.hostReply);
  }
}
