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
exports.MessagesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const api_error_1 = require("../../common/api-error");
const events_gateway_1 = require("../../events/events.gateway");
let MessagesService = class MessagesService {
    prisma;
    gateway;
    constructor(prisma, gateway) {
        this.prisma = prisma;
        this.gateway = gateway;
    }
    async listConversations(user) {
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
    async getMessages(user, conversationId) {
        const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
        if (!conv || (conv.hostId !== user.id && conv.customerId !== user.id))
            throw (0, api_error_1.notFound)("گفت‌وگو یافت نشد");
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
    async sendMessage(user, conversationId, propertyId, text) {
        text = text.trim();
        if (!text)
            throw (0, api_error_1.badRequest)("متن پیام خالی است");
        let conv;
        if (conversationId) {
            conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
            if (!conv || (conv.hostId !== user.id && conv.customerId !== user.id))
                throw (0, api_error_1.notFound)("گفت‌وگو یافت نشد");
        }
        else {
            if (!propertyId)
                throw (0, api_error_1.badRequest)("اقامتگاه مشخص نیست");
            const prop = await this.prisma.property.findUnique({ where: { id: propertyId } });
            if (!prop)
                throw (0, api_error_1.notFound)("اقامتگاه یافت نشد");
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
};
exports.MessagesService = MessagesService;
exports.MessagesService = MessagesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        events_gateway_1.EventsGateway])
], MessagesService);
//# sourceMappingURL=messages.service.js.map