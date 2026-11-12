import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../../common/current-user.decorator";
import { requireUser } from "../../common/user.util";
import type { SafeUser } from "../../common/session.middleware";
import { MarkNotificationsReadDto } from "../messages/messages.controller";
import { NotificationsService as NotificationsCrud } from "./notifications.service";

@ApiTags("social")
@Controller("notifications")
export class NotificationsController {
  constructor(private notif: NotificationsCrud) {}

  @Get()
  @ApiOperation({ summary: "آخرین اعلان‌ها + تعداد خوانده‌نشده" })
  list(@CurrentUser() user: SafeUser | null) {
    return this.notif.listNotifications(requireUser(user));
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "علامت‌گذاری اعلان‌ها به‌عنوان خوانده‌شده" })
  markRead(@CurrentUser() user: SafeUser | null, @Body() dto: MarkNotificationsReadDto) {
    return this.notif.markNotificationsRead(requireUser(user), dto.ids);
  }
}
