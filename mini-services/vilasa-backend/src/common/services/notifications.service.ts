import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { EventsGateway } from "../../events/events.gateway";

/** Create Notification rows + push them over the socket.io channel. */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger("Notify");

  constructor(
    private prisma: PrismaService,
    private gateway: EventsGateway,
  ) {}

  async notify(userId: string, type: string, title: string, body: string, link?: string) {
    try {
      const n = await this.prisma.notification.create({ data: { userId, type, title, body, link } });
      this.gateway.emitToUser(userId, "notification", { id: n.id, type, title, body, link });
      return n;
    } catch (e) {
      this.logger.error("NOTIFY_FAILED", e);
      return null;
    }
  }
}
