import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { PROPERTY_TYPES } from "../../common/constants";

/** Public lookup data: provinces/cities, amenities, property types + CMS pages */
@Injectable()
export class PublicService {
  constructor(private prisma: PrismaService) {}

  async lookups() {
    const [provinces, amenities] = await Promise.all([
      this.prisma.province.findMany({
        include: { cities: { orderBy: { name: "asc" } } },
        orderBy: { name: "asc" },
      }),
      this.prisma.amenity.findMany({ orderBy: { name: "asc" } }),
    ]);
    return {
      provinces,
      amenities,
      types: Object.entries(PROPERTY_TYPES).map(([key, name]) => ({ key, name })),
    };
  }

  async cmsPage(slug: string) {
    const page = await this.prisma.cmsPage.findUnique({ where: { slug } });
    return page && page.isPublished ? page : null;
  }

  async cmsPages() {
    return this.prisma.cmsPage.findMany({ where: { isPublished: true }, orderBy: { sort: "asc" } });
  }
}
