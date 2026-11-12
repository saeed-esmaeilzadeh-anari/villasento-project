import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { badRequest, notFound } from "../../common/api-error";
import { EventsGateway } from "../../events/events.gateway";
import type { SafeUser } from "../../common/session.middleware";

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private gateway: EventsGateway,
  ) {}

  async listConversations(user: SafeUser) {
    const convs = await this.prisma.conversation.findMany({
      where: { OR: [{ hostId: user.id }, { customerId: user.id }] },
      include: {
        property: { select: { id: true, title: true, images: { take: 1, orderBy: { sort: "asc" } } } },
        host: { select: { id: true, fullName: true, phone: true } },
        customer: { select: { id: true, fullName: true, phone: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { lastMessageAt: "desc" },
    });
    return convs.map((c) => {
      const other = c.customerId === user.id ? c.host : c.customer;
      const last = c.messages[0];
      return {
        id: c.id,
        property: { id: c.property.id, title: c.property.title, image: c.property.images[0]?.url ?? null },
        other: { id: other.id, name: other.fullName ?? other.phone, phone: other.phone },
        lastMessage: last
          ? { text: last.text, createdAt: last.createdAt, senderId: last.senderId }
          : null,
        lastMessageAt: c.lastMessageAt,
      };
    });
  }

  async getMessages(user: SafeUser, conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv || (conv.hostId !== user.id && conv.customerId !== user.id)) throw notFound("گفت‌وگو یافت نشد");
    const msgs = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    // mark incoming as read
    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: user.id }, readAt: null },
      data: { readAt: new Date() },
    });
    return {
      conversation: {
        id: conv.id,
        propertyId: conv.propertyId,
        hostId: conv.hostId,
        customerId: conv.customerId,
      },
      messages: msgs.map((m) => ({
        id: m.id, text: m.text, senderId: m.senderId, createdAt: m.createdAt, readAt: m.readAt,
      })),
    };
  }

  async sendMessage(
    user: SafeUser,
    conversationId: string | null,
    propertyId: string | null,
    text: string,
  ) {
    text = text.trim();
    if (!text) throw badRequest("متن پیام خالی است");
    let conv;
    if (conversationId) {
      conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
      if (!conv || (conv.hostId !== user.id && conv.customerId !== user.id))
        throw notFound("گفت‌وگو یافت نشد");
    } else {
      if (!propertyId) throw badRequest("اقامتگاه مشخص نیست");
      const prop = await this.prisma.property.findUnique({ where: { id: propertyId } });
      if (!prop) throw notFound("اقامتگاه یافت نشد");
      conv = await this.prisma.conversation.upsert({
        where: { propertyId_customerId: { propertyId, customerId: user.id } },
        create: { propertyId, hostId: prop.hostId, customerId: user.id },
        update: { lastMessageAt: new Date() },
      });
    }
    const msg = await this.prisma.message.create({
      data: { conversationId: conv.id, senderId: user.id, text },
    });
    await this.prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: new Date() } });
    const otherId = conv.customerId === user.id ? conv.hostId : conv.customerId;
    await this.prisma.notification.create({
      data: { userId: otherId, type: "MESSAGE", title: "پیام جدید", body: text.slice(0, 80), link: "/account?tab=messages" },
    });
    // Realtime push (socket.io) — the web app also polls, mobile app can rely on this.
    this.gateway.emitToUser(otherId, "message", {
      id: msg.id, text: msg.text, senderId: msg.senderId, createdAt: msg.createdAt, conversationId: conv.id,
    });
    return { id: msg.id, text: msg.text, senderId: msg.senderId, createdAt: msg.createdAt };
  }
}
