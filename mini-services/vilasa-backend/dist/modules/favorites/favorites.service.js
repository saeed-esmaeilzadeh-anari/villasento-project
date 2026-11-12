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
exports.FavoritesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let FavoritesService = class FavoritesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listFavorites(user) {
        const favs = await this.prisma.favorite.findMany({
            where: { userId: user.id },
            include: {
                property: {
                    include: {
                        city: { include: { province: true } },
                        images: { orderBy: { sort: "asc" }, take: 1 },
                        amenities: { include: { amenity: true } },
                        host: { select: { isHostVerified: true } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        return favs
            .filter((f) => f.property.status === "PUBLISHED")
            .map((f) => ({
            id: f.property.id, title: f.property.title, city: f.property.city.name,
            province: f.property.city.province.name, basePrice: f.property.basePrice,
            weekendPrice: f.property.weekendPrice, capacity: f.property.capacity,
            bedrooms: f.property.bedrooms, rating: f.property.ratingAvg,
            reviewCount: f.property.reviewCount, image: f.property.images[0]?.url ?? null,
            type: f.property.type, instantBooking: f.property.instantBooking,
            amenities: f.property.amenities.slice(0, 5).map((a) => a.amenity),
        }));
    }
    async toggleFavorite(user, propertyId) {
        const existing = await this.prisma.favorite.findUnique({
            where: { userId_propertyId: { userId: user.id, propertyId } },
        });
        if (existing) {
            await this.prisma.favorite.delete({
                where: { userId_propertyId: { userId: user.id, propertyId } },
            });
            return { favorited: false };
        }
        await this.prisma.favorite.create({ data: { userId: user.id, propertyId } });
        return { favorited: true };
    }
};
exports.FavoritesService = FavoritesService;
exports.FavoritesService = FavoritesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FavoritesService);
//# sourceMappingURL=favorites.service.js.map