import type { Server as HTTPServer } from "node:http";
import { WebSocketServer } from "ws";
import { authenticateSocket, type AuthenticatedSocket } from "./auth";
import { registerSocket, unregisterSocket, sendToUser, isUserOnline } from "./manager";
import { sendMessageService, markMessagesAsReadService, markMessagesAsDeliveredService } from "../services/message-service";
import { Types } from "mongoose";

let wss: WebSocketServer | null = null;

export function initWebSocketServer(server: HTTPServer): WebSocketServer {
  if (wss) return wss;

  wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (request: InstanceType<typeof import("node:http").IncomingMessage>, socket: InstanceType<typeof import("node:net").Socket>, head: Buffer) => {
    const pathname = new URL(request.url || "", `http://${request.headers.host}`).pathname;
    if (pathname === "/api/ws" || pathname === "/ws") {
      const auth = await authenticateSocket(request);
      if (!auth) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss?.handleUpgrade(request, socket, head, (ws) => {
        const authWs = ws as AuthenticatedSocket;
        authWs.isAlive = true;
        authWs.userId = auth.user._id.toString();
        authWs.coupleId = auth.coupleId;
        authWs.partnerId = auth.partnerId;
        wss?.emit("connection", authWs, request);
      });
    }
  });

  wss.on("connection", (ws: AuthenticatedSocket) => {
    registerSocket(ws);

    // Broadcast online status to partner
    if (ws.partnerId) {
      sendToUser(ws.partnerId, {
        type: "presence",
        userId: ws.userId,
        status: "online",
      });

      // Send initial partner presence status to this user
      const partnerOnline = isUserOnline(ws.partnerId);
      ws.send(
        JSON.stringify({
          type: "presence",
          userId: ws.partnerId,
          status: partnerOnline ? "online" : "offline",
        })
      );

      // Auto-mark messages as delivered when receiver connects
      if (ws.userId) {
        markMessagesAsDeliveredService(new Types.ObjectId(ws.userId)).then((result) => {
          if (result) {
            sendToUser(ws.partnerId!, {
              type: "messages_delivered",
              coupleId: result.coupleId,
            });
          }
        });
      }
    }

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", async (data: RawData) => {
      try {
        const payload = JSON.parse(data.toString());
        if (!ws.userId || !ws.coupleId || !ws.partnerId) return;

        switch (payload.type) {
          case "ping": {
            ws.send(JSON.stringify({ type: "pong" }));
            break;
          }

          case "send_message": {
            const { content, clientMessageId, media, replyToId } = payload;
            try {
              const res = await sendMessageService(
                new Types.ObjectId(ws.userId),
                content,
                clientMessageId,
                media,
                replyToId
              );

              // Ack back to sender with canonical message
              ws.send(
                JSON.stringify({
                  type: "message_ack",
                  clientMessageId,
                  message: res.message,
                })
              );

              // Broadcast new message to partner
              sendToUser(ws.partnerId, {
                type: "new_message",
                message: res.message,
              });

              // If partner is online, mark message as delivered immediately
              if (isUserOnline(ws.partnerId)) {
                sendToUser(ws.userId, {
                  type: "message_delivered",
                  messageId: res.message.id,
                });
              }
            } catch (err: unknown) {
              console.error("[ws:send_message] Error handling send_message:", err);
              const msg = err instanceof Error ? err.message : "Failed to send message";
              ws.send(
                JSON.stringify({
                  type: "message_error",
                  clientMessageId,
                  error: msg,
                })
              );
            }
            break;
          }

          case "typing": {
            sendToUser(ws.partnerId, {
              type: "typing",
              userId: ws.userId,
              isTyping: !!payload.isTyping,
            });
            break;
          }

          case "mark_read": {
            const result = await markMessagesAsReadService(new Types.ObjectId(ws.userId));
            if (result) {
              sendToUser(ws.partnerId, {
                type: "messages_read",
                coupleId: result.coupleId,
              });
              // Echo back to user's other open tabs
              sendToUser(ws.userId, {
                type: "messages_read",
                coupleId: result.coupleId,
              });
            }
            break;
          }

          case "call_signal": {
            if (ws.partnerId) {
              sendToUser(ws.partnerId, {
                type: "call_signal",
                fromUserId: ws.userId,
                signal: payload.signal,
              });
            }
            break;
          }
        }
      } catch (err) {
        console.error("[ws:handler] Message parse error:", err);
      }
    });

    ws.on("close", () => {
      unregisterSocket(ws);
      if (ws.userId && ws.partnerId && !isUserOnline(ws.userId)) {
        sendToUser(ws.partnerId, {
          type: "presence",
          userId: ws.userId,
          status: "offline",
        });
      }
    });
  });

  // Heartbeat ping/pong timer (every 25s)
  const interval = setInterval(() => {
    if (!wss) return;
    for (const ws of wss.clients) {
      const authWs = ws as AuthenticatedSocket;
      if (authWs.isAlive === false) {
        authWs.terminate();
        continue;
      }
      authWs.isAlive = false;
      authWs.ping();
    }
  }, 25000);

  wss.on("close", () => {
    clearInterval(interval);
  });

  return wss;
}

type RawData = string | Buffer | ArrayBuffer | Buffer[];
