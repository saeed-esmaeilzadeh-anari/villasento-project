import { Controller, Get, Param } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { PublicService } from "../lookups/public.service";

@ApiTags("public")
@Controller("cms")
export class CmsController {
  constructor(private publicSrv: PublicService) {}

  @Get(":slug")
  @ApiOperation({ summary: "صفحه CMS بر اساس slug (یا all برای فهرست)" })
  page(@Param("slug") slug: string) {
    if (slug === "all") return this.publicSrv.cmsPages();
    return this.publicSrv.cmsPage(slug);
  }
}
