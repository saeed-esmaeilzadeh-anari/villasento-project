import { Module } from "@nestjs/common";

import { LookupsController } from "./lookups.controller";
import { PublicService } from "./public.service";

@Module({
  controllers: [LookupsController],
  providers: [PublicService],
  exports: [PublicService],
})
export class LookupsModule {}
