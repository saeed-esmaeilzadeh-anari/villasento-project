import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import type { SafeUser } from "../../common/session.middleware";

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  async listFavorites(user: SafeUser) {
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

  async toggleFavorite(user: SafeUser, propertyId: string) {
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
}
