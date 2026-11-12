import { ApiProperty, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class CreatePropertyDto {
  @ApiProperty({ minLength: 3 })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;

  @ApiProperty()
  @IsString()
  cityId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  capacity?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  bedrooms?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(40)
  beds?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(50000)
  basePrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(50000)
  weekendPrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cleaningFee?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  deposit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  minNights?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  checkInTime?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  checkOutTime?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  rules?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cancelPolicy?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  instantBooking?: boolean;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  images?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenityKeys?: string[];

  @ApiProperty({ required: false, description: "true → ارسال برای بررسی (PENDING)" })
  @IsOptional()
  @IsBoolean()
  submit?: boolean;
}

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {}

export class CalendarDayUpdateDto {
  @ApiProperty({ example: "2026-11-10" })
  @IsString()
  date!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  price?: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  note?: string | null;
}

export class UpdateCalendarDto {
  @ApiProperty()
  @IsString()
  propertyId!: string;

  @ApiProperty({ type: [CalendarDayUpdateDto] })
  @IsArray()
  @ArrayMaxSize(400)
  @ValidateNested({ each: true })
  @Type(() => CalendarDayUpdateDto)
  updates!: CalendarDayUpdateDto[];
}
