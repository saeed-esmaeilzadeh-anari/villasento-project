"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const constants_1 = require("../../common/constants");
/** Public lookup data: provinces/cities, amenities, property types + CMS pages */
let PublicService = class PublicService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
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
            types: Object.entries(constants_1.PROPERTY_TYPES).map(([key, name]) => ({ key, name })),
        };
    }
    async cmsPage(slug) {
        const page = await this.prisma.cmsPage.findUnique({ where: { slug } });
        return page && page.isPublished ? page : null;
    }
    async cmsPages() {
        return this.prisma.cmsPage.findMany({ where: { isPublished: true }, orderBy: { sort: "asc" } });
    }
};
exports.PublicService = PublicService;
exports.PublicService = PublicService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PublicService);
//# sourceMappingURL=public.service.js.map