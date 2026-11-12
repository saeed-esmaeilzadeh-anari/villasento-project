import { Body, Controller, Get, HttpCode, HttpStatus, Put, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../../common/current-user.decorator";
import { requireUser } from "../../common/user.util";
import { badRequest } from "../../common/api-error";
import type { SafeUser } from "../../common/session.middleware";
import { HostService } from "./host.service";
import { PropertiesService } from "../properties/properties.service";
import { UpdateCalendarDto } from "../properties/properties.dto";

@ApiTags("host")
@Controller("host")
export class HostController {
  constructor(
    private host: HostService,
    private props: PropertiesService,
  ) {}

  @Get()
  @ApiOperation({ summary: "داشبورد/درآمد/نظرات/اقامتگاه‌ها/تقویم میزبان (?view=)" })
  async view(
    @CurrentUser() user: SafeUser | null,
    @Query("view") view = "dashboard",
    @Query("propertyId") propertyId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const u = requireUser(user);
    switch (view) {
      case "dashboard":
        return this.host.hostDashboard(u);
      case "earnings":
        return this.host.hostEarnings(u);
      case "reviews":
        return this.host.hostReviews(u);
      case "properties":
        return this.props.hostProperties(u);
      case "calendar": {
        if (!propertyId) throw badRequest("propertyId الزامی است");
        if (!from || !to) throw badRequest("from و to الزامی است");
        return this.props.hostCalendar(u, propertyId, from, to);
      }
      default:
        throw badRequest("view نامعتبر است");
    }
  }

  @Put("calendar")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "ویرایش گروهی روزهای تقویم (قیمت/مسدودسازی)" })
  updateCalendar(@CurrentUser() user: SafeUser | null, @Body() dto: UpdateCalendarDto) {
    return this.props.updateCalendarDays(requireUser(user), dto.propertyId, dto.updates);
  }
}
