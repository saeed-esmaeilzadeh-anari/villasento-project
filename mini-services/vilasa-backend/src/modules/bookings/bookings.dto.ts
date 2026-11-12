import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateBookingDto {
  @ApiProperty()
  @IsString()
  propertyId!: string;

  @ApiProperty({ example: "2026-11-10" })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkIn!: string;

  @ApiProperty({ example: "2026-11-13" })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkOut!: string;

  @ApiProperty({ minimum: 0, maximum: 30 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  adults!: number;

  @ApiProperty({ minimum: 0, maximum: 30 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  children!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  guestName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  guestPhone?: string;

  @ApiProperty({ required: false, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  couponCode?: string;
}

export class BookingActionDto {
  @ApiProperty({ enum: ["cancel", "approve", "reject", "complete"] })
  @IsIn(["cancel", "approve", "reject", "complete"])
  action!: "cancel" | "approve" | "reject" | "complete";

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ValidateCouponDto {
  @ApiProperty({ minLength: 2 })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amount!: number;
}

export class AdminActionDto {
  @ApiProperty()
  @IsString()
  action!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  hostId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  periodLabel?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reply?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;
}

export class UpsertCouponDataDto {
  @IsOptional() @IsString() id?: string;
  @IsString() code!: string;
  @IsString() title!: string;
  @IsString() type!: string;
  @IsNumber() value!: number;
  @IsOptional() @IsNumber() maxDiscount?: number;
  @IsOptional() @IsNumber() minAmount?: number;
  @IsOptional() @IsNumber() usageLimit?: number;
  @IsString() validTo!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
