import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../../common/current-user.decorator";
import { requireUser } from "../../common/user.util";
import type { SafeUser } from "../../common/session.middleware";
import { PropertiesService } from "./properties.service";
import { CreatePropertyDto, UpdatePropertyDto } from "./properties.dto";
import type { PropertyInput, SearchParams } from "./properties.types";

@ApiTags("properties")
@Controller("properties")
export class PropertiesController {
  constructor(private props: PropertiesService) {}

  @Get()
  @ApiOperation({ summary: "جستجوی اقامتگاه‌ها با فیلترهای واقعی دیتابیس" })
  search(@Query() q: Record<string, string | undefined>) {
    const num = (v: string | undefined): number | undefined => {
      if (v == null || v === "") return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    return this.props.searchProperties({
      q: q.q || undefined,
      cityId: q.cityId || undefined,
      provinceId: q.provinceId || undefined,
      checkIn: q.checkIn || undefined,
      checkOut: q.checkOut || undefined,
      adults: num(q.adults),
      children: num(q.children),
      minPrice: num(q.minPrice),
      maxPrice: num(q.maxPrice),
      amenities: q.amenities ? q.amenities.split(",").filter(Boolean) : undefined,
      types: q.types ? q.types.split(",").filter(Boolean) : undefined,
      instantOnly: q.instantOnly === "1",
      featuredOnly: q.featuredOnly === "1",
      sort: (q.sort as SearchParams["sort"]) || undefined,
      page: num(q.page) ?? 1,
      pageSize: num(q.pageSize) ?? 9,
    } satisfies SearchParams);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "ثبت اقامتگاه جدید توسط میزبان" })
  create(@CurrentUser() user: SafeUser | null, @Body() dto: CreatePropertyDto) {
    return this.props.createProperty(requireUser(user), dto as PropertyInput);
  }

  @Get(":id")
  @ApiOperation({ summary: "جزئیات اقامتگاه + تقویم + نظرات" })
  detail(@CurrentUser() user: SafeUser | null, @Param("id") id: string) {
    return this.props.propertyDetail(id, user);
  }

  @Patch(":id")
  @ApiOperation({ summary: "ویرایش اقامتگاه توسط میزبان" })
  update(@CurrentUser() user: SafeUser | null, @Param("id") id: string, @Body() dto: UpdatePropertyDto) {
    return this.props.updateProperty(requireUser(user), id, dto as PropertyInput);
  }

  @Delete(":id")
  @ApiOperation({ summary: "حذف اقامتگاه (در صورت نبود رزرو فعال)" })
  remove(@CurrentUser() user: SafeUser | null, @Param("id") id: string) {
    return this.props.deleteProperty(requireUser(user), id);
  }
}
