import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { PublicService } from "./public.service";

@ApiTags("public")
@Controller("lookups")
export class LookupsController {
  constructor(private publicSrv: PublicService) {}

  @Get()
  @ApiOperation({ summary: "استان‌ها/شهرها، امکانات و انواع اقامتگاه" })
  lookups() {
    return this.publicSrv.lookups();
  }
}
