import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import type { SafeUser } from "../../common/session.middleware";

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async listNotifications(user: SafeUser) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      this.prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);
    return { items, unread };
  }

  async markNotificationsRead(user: SafeUser, ids?: string[]) {
    await this.prisma.notification.updateMany({
      where: { userId: user.id, ...(ids?.length ? { id: { in: ids } } : {}), readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
