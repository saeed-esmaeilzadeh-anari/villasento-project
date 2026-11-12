import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

import { CurrentUser } from "../../common/current-user.decorator";
import { requireUser } from "../../common/user.util";
import type { SafeUser } from "../../common/session.middleware";
import { MessagesService } from "./messages.service";

export class SendMessageDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text!: string;
}

export class MarkNotificationsReadDto {
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  ids?: string[];
}

@ApiTags("social")
@Controller("messages")
export class MessagesController {
  constructor(private messages: MessagesService) {}

  @Get()
  @ApiOperation({ summary: "گفت‌وگوها یا رشته پیام‌ها (?conversationId=)" })
  list(@CurrentUser() user: SafeUser | null, @Query() q: Record<string, string | undefined>) {
    const u = requireUser(user);
    if (q.conversationId) return this.messages.getMessages(u, q.conversationId);
    return this.messages.listConversations(u);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "ارسال پیام (گفت‌وگوی موجود یا جدید با propertyId)" })
  send(@CurrentUser() user: SafeUser | null, @Body() dto: SendMessageDto) {
    return this.messages.sendMessage(
      requireUser(user),
      dto.conversationId ?? null,
      dto.propertyId ?? null,
      dto.text,
    );
  }
}
