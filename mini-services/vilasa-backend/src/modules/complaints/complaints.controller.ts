import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

import { CurrentUser } from "../../common/current-user.decorator";
import { requireUser } from "../../common/user.util";
import { PrismaService } from "../../prisma/prisma.service";
import { ComplaintsService } from "./complaints.service";
import type { SafeUser } from "../../common/session.middleware";

export class CreateComplaintDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bookingId?: string;

  @ApiProperty({ minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  subject!: string;

  @ApiProperty({ minLength: 5, maxLength: 3000 })
  @IsString()
  @MinLength(5)
  @MaxLength(3000)
  body!: string;
}

@ApiTags("social")
@Controller("complaints")
export class ComplaintsController {
  constructor(
    private complaints: ComplaintsService,
    private prisma: PrismaService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "ثبت شکایت/تیکت پشتیبانی" })
  create(@CurrentUser() user: SafeUser | null, @Body() dto: CreateComplaintDto) {
    return this.complaints.createComplaint(requireUser(user).id, dto);
  }

  @Get()
  @ApiOperation({ summary: "شکایات من" })
  async mine(@CurrentUser() user: SafeUser | null) {
    const u = requireUser(user);
    return this.prisma.complaint.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" } });
  }
}
