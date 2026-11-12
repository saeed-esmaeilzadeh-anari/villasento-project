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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsGateway = void 0;
const common_1 = require("@nestjs/common");
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const session_util_1 = require("../common/session.util");
/**
 * Realtime channel (socket.io) on the same port as the REST API.
 *
 * Frontend (through the Caddy gateway) connects with:
 *   io("/?XTransformPort=3002", { withCredentials: true })
 *
 * The handshake authenticates with the SAME `vilasa_session` cookie used by
 * the REST API; each client joins a private room `user:<uid>` so the backend
 * can push per-user events:
 *   - notification   (new Notification row created)
 *   - message        (new chat message)
 *   - booking:update (booking status changed)
 */
let EventsGateway = class EventsGateway {
    server;
    logger = new common_1.Logger("EventsGateway");
    onApplicationBootstrap() {
        this.logger.log("socket.io gateway ready (rooms per user, cookie auth)");
    }
    handleConnection(client) {
        const header = (client.handshake.headers.cookie ?? "");
        const raw = header
            .split(";")
            .map((s) => s.trim())
            .find((s) => s.startsWith(`${session_util_1.COOKIE_NAME}=`));
        const token = raw ? decodeURIComponent(raw.slice(session_util_1.COOKIE_NAME.length + 1)) : null;
        const payload = token ? (0, session_util_1.decodeSession)(token) : null;
        if (payload) {
            client.data.uid = payload.uid;
            client.join(`user:${payload.uid}`);
        }
    }
    handleDisconnect(client) {
        void client.data?.uid;
    }
    handlePing(client, data) {
        return { event: "pong", data, uid: client.data?.uid ?? null };
    }
    /** Push an event to every socket of one user. */
    emitToUser(userId, event, data) {
        this.server?.to(`user:${userId}`).emit(event, data);
    }
};
exports.EventsGateway = EventsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", Object)
], EventsGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)("ping"),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], EventsGateway.prototype, "handlePing", null);
exports.EventsGateway = EventsGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: true, credentials: true },
        transports: ["polling", "websocket"],
    })
], EventsGateway);
//# sourceMappingURL=events.gateway.js.map