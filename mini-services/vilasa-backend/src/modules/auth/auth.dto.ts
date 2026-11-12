import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class RequestOtpDto {
  @ApiProperty({ example: "09123456789" })
  @IsString()
  phone!: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: "09123456789" })
  @IsString()
  phone!: string;

  @ApiProperty({ example: "12345" })
  @IsString()
  code!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;
}

export class UpdateProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nationalId?: string;
}
