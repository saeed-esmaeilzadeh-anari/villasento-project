import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

import { CurrentUser } from "../../common/current-user.decorator";
import { requireUser } from "../../common/user.util";
import type { SafeUser } from "../../common/session.middleware";
import { FavoritesService } from "./favorites.service";

export class ToggleFavoriteDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  propertyId!: string;
}

@ApiTags("social")
@Controller("favorites")
export class FavoritesController {
  constructor(private favorites: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: "فهرست علاقه‌مندی‌های من" })
  list(@CurrentUser() user: SafeUser | null) {
    return this.favorites.listFavorites(requireUser(user));
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "افزودن/حذف علاقه‌مندی (toggle)" })
  toggle(@CurrentUser() user: SafeUser | null, @Body() dto: ToggleFavoriteDto) {
    return this.favorites.toggleFavorite(requireUser(user), dto.propertyId);
  }
}
