import { Logger, OnApplicationBootstrap } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

import { COOKIE_NAME, decodeSession } from "../common/session.util";

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
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  transports: ["polling", "websocket"],
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnApplicationBootstrap {
  @WebSocketServer()
  server: Server | undefined;

  private readonly logger = new Logger("EventsGateway");

  onApplicationBootstrap() {
    this.logger.log("socket.io gateway ready (rooms per user, cookie auth)");
  }

  handleConnection(client: Socket) {
    const header = (client.handshake.headers.cookie ?? "") as string;
    const raw = header
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${COOKIE_NAME}=`));
    const token = raw ? decodeURIComponent(raw.slice(COOKIE_NAME.length + 1)) : null;
    const payload = token ? decodeSession(token) : null;
    if (payload) {
      client.data.uid = payload.uid;
      client.join(`user:${payload.uid}`);
    }
  }

  handleDisconnect(client: Socket) {
    void client.data?.uid;
  }

  @SubscribeMessage("ping")
  handlePing(@ConnectedSocket() client: Socket, @MessageBody() data: unknown) {
    return { event: "pong", data, uid: client.data?.uid ?? null };
  }

  /** Push an event to every socket of one user. */
  emitToUser(userId: string, event: string, data: unknown) {
    this.server?.to(`user:${userId}`).emit(event, data);
  }
}
