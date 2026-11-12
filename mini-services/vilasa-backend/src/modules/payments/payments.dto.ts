import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsNumber, IsOptional, IsString } from "class-validator";

export class PaymentActionDto {
  @ApiProperty({ enum: ["start", "settle", "refund"] })
  @IsIn(["start", "settle", "refund"])
  action!: "start" | "settle" | "refund";

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bookingId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  authority?: string;

  @ApiProperty({ required: false, enum: ["success", "fail"] })
  @IsOptional()
  @IsIn(["success", "fail"])
  result?: "success" | "fail";

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  paymentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
