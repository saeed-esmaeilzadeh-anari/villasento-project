import { Module } from "@nestjs/common";

import { LookupsModule } from "../lookups/lookups.module";
import { CmsController } from "./cms.controller";

@Module({
  imports: [LookupsModule],
  controllers: [CmsController],
})
export class CmsModule {}
